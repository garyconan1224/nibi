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
const TaskLogViewer: FC<TaskLogViewerProps> = ({ taskId }) => {
  const { t } = useTranslation(['homePage', 'common'])
  const [logs, setLogs] = useState<TaskLogEntry[]>([])
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
      setConnected(true)
      setError(null)
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
      setConnected(false)
      setError(t('homePage:logs.connectionClosed'))
      es.close()
    }

    return () => {
      es.close()
      esRef.current = null
    }
  }, [taskId, updateTask])

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

  return (
    <div className="flex flex-col rounded-b-xl">
      {/* 连接状态栏 */}
      <div
        className={cn(
          'flex items-center gap-1.5 px-4 py-1 text-[11px]',
          connected ? 'bg-gray-900 text-emerald-400' : 'bg-gray-900 text-gray-500',
        )}
      >
        {connected ? (
          <>
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            {t('homePage:logs.connected')}
          </>
        ) : (
          <>
            <WifiOff className="h-3 w-3" />
            {error ?? t('homePage:logs.disconnected')}
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

