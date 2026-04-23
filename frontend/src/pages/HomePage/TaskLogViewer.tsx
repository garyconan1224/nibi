import { useEffect, useRef, useState, type FC } from 'react'
import { AlertCircle, Info, AlertTriangle, WifiOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useTaskStore } from '@/store/taskStore'
import type { TaskLogEntry } from '@/types/task'

// 日志等级配置
const LEVEL_CONFIG: Record<
  TaskLogEntry['level'],
  { icon: FC<{ className?: string }>; color: string; bg: string }
> = {
  info: { icon: Info, color: 'text-sky-400', bg: '' },
  warning: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-950/30' },
  error: { icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-950/40' },
}

// SSE 事件数据类型
interface SseLogEvent {
  type: 'log'
  entry: TaskLogEntry
}

interface SseTaskEvent {
  type: 'task'
  task: { task_id: string; status: string; progress: number }
}

type SseEvent = SseLogEvent | SseTaskEvent

const BASE_URL = import.meta.env.VITE_BACKEND_BASE_URL ?? 'http://127.0.0.1:8000'

interface TaskLogViewerProps {
  /** 目标任务 ID */
  taskId: string
}

/**
 * TaskLogViewer
 *
 * 使用原生 EventSource 订阅 /pipeline/tasks/{taskId}/events（SSE），
 * 流式渲染日志行，自动滚动到底部，断开后显示重连提示。
 */
/** SSE 连接三态：初始/重连中/已连接/已关闭，驱动状态栏图标与文案。 */
type ConnState = 'connecting' | 'open' | 'closed'

const TaskLogViewer: FC<TaskLogViewerProps> = ({ taskId }) => {
  const { t } = useTranslation(['homePage', 'common'])
  const [logs, setLogs] = useState<TaskLogEntry[]>([])
  const [connState, setConnState] = useState<ConnState>('connecting')
  // 日志容器 ref：用于直接操作 scrollTop，避免 scrollIntoView 冒泡到父级 ScrollArea
  const containerRef = useRef<HTMLDivElement>(null)
  // 粘性底部：记录用户是否正在查阅历史（距底部 > 80px 时暂停自动滚动）
  const isAtBottomRef = useRef(true)
  const esRef = useRef<EventSource | null>(null)

  const updateTask = useTaskStore((s) => s.updateTask)

  // ── SSE 连接 ─────────────────────────────────────────────────
  useEffect(() => {
    if (!taskId) return

    const url = `${BASE_URL}/pipeline/tasks/${taskId}/events`
    const es = new EventSource(url)
    esRef.current = es

    es.onopen = () => {
      setConnState('open')
    }

    es.onmessage = (evt) => {
      try {
        const data: SseEvent = JSON.parse(evt.data as string)
        if (data.type === 'log') {
          setLogs((prev) => [...prev, data.entry])
        } else if (data.type === 'task') {
          updateTask(data.task.task_id, {
            status: data.task.status,
            progress: data.task.progress,
          })
        }
      } catch {
        // 忽略非 JSON 行（如心跳注释）
      }
    }

    es.onerror = () => {
      // 不手动 close()：让 EventSource 自带的重连机制恢复连接（默认 ~3s 后重试），
      // 避免某次瞬时错误（例如后端重启、代理超时、HF 下载阶段 CPU 打满导致的丢包）
      // 永久卡在"未连接"。区分两种子状态给用户不同反馈：
      //   CLOSED(2)     → 彻底断开，显示红色"连接已关闭"
      //   CONNECTING(0) → 浏览器正在自动重连，显示琥珀色"正在尝试重连..."
      if (es.readyState === EventSource.CLOSED) {
        setConnState('closed')
      } else {
        setConnState('connecting')
      }
    }

    return () => {
      es.close()
      esRef.current = null
    }
  }, [taskId, updateTask, t])

  // ── 粘性底部：监听用户手动滚动 ───────────────────────────────
  const handleScroll = () => {
    const el = containerRef.current
    if (!el) return
    // 距底部 80px 以内视为"在底部"
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  // ── 新日志到达时，仅在粘性底部模式下滚动 ──────────────────────
  // 使用 scrollTop = scrollHeight（只滚本容器），而非 scrollIntoView（会冒泡到父级 ScrollArea）
  useEffect(() => {
    if (!isAtBottomRef.current) return
    const el = containerRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [logs])

  // 根据连接状态确定状态栏的颜色与文案；重连中用琥珀色，已关闭用灰色
  const statusColor =
    connState === 'open'
      ? 'text-emerald-400'
      : connState === 'connecting'
        ? 'text-amber-400'
        : 'text-gray-500'

  return (
    <div className="flex flex-col rounded-b-xl">
      {/* 连接状态栏 */}
      <div className={cn('flex items-center gap-1.5 bg-gray-900 px-4 py-1 text-[11px]', statusColor)}>
        {connState === 'open' && (
          <>
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            {t('homePage:logs.connected')}
          </>
        )}
        {connState === 'connecting' && (
          <>
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
            {t('homePage:logs.reconnecting')}
          </>
        )}
        {connState === 'closed' && (
          <>
            <WifiOff className="h-3 w-3" />
            {t('homePage:logs.connectionClosed')}
          </>
        )}
      </div>

      {/* 日志内容区：ref 指向本容器，onScroll 检测用户是否在查阅历史 */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="max-h-56 overflow-y-auto bg-gray-950 px-4 py-3 font-mono text-xs"
      >
        {logs.length === 0 && (
          <p className="text-gray-600">{t('homePage:logs.waiting')}</p>
        )}
        {logs.map((entry, i) => {
          const cfg = LEVEL_CONFIG[entry.level]
          const LevelIcon = cfg.icon
          return (
            <div
              key={i}
              className={cn('mb-0.5 flex items-start gap-2 rounded px-1 py-0.5', cfg.bg)}
            >
              <LevelIcon className={cn('mt-0.5 h-3 w-3 shrink-0', cfg.color)} />
              <span className="shrink-0 text-gray-500">{entry.ts.slice(11, 19)}</span>
              <span className={cn('break-all', cfg.color)}>{entry.message}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default TaskLogViewer

