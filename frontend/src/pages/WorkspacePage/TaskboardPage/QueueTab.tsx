import { useMemo } from 'react'
import { RefreshCw } from 'lucide-react'
import { useTaskStore } from '@/store/taskStore'
import { isTaskTerminal, getStatusText, type TaskRecord } from '@/types/task'

/** 任务在「同素材一行」聚合时的状态排序：运行中 > 排队 > 失败 > 已完成 */
function statusRank(status: string): number {
  if (status === 'FAILED') return 2
  if (isTaskTerminal(status)) return 1 // SUCCESS / CANCELLED
  if (status === 'PENDING') return 3
  return 4 // DOWNLOAD / ASR / VLM / FRAMES / SUM / RUNNING…
}

const STATE_DOT: Record<string, string> = {
  running: 'var(--ink)',
  queued: 'var(--ink-4)',
  error: 'var(--accent-pink)',
}

/**
 * Queue tab — 显示活跃任务（running / queued / failed）。
 * 设计稿来源：taskboard.jsx TBQueue（简化版，去掉系统检测和并行滑块）。
 */
interface QueueTabProps {
  workspaceId: string
}

export function QueueTab({ workspaceId }: QueueTabProps) {
  const allTasks = useTaskStore((s) => s.tasks)
  const retryTask = useTaskStore((s) => s.retryTask)
  const tasks = useMemo(
    () => allTasks.filter((t) => t.project_id === workspaceId),
    [allTasks, workspaceId],
  )

  // 同素材的 download + analyze 是两个独立 task，按 project_id + url 归并成一行，
  // 避免「下载完成→脱组→冒出新分析任务」的重复行；进度按 download 30% + analyze 70% 加权。
  const rows = useMemo(() => {
    const groups = new Map<string, TaskRecord[]>()
    for (const t of tasks) {
      const payload = (t.payload ?? {}) as Record<string, unknown>
      const url = (payload.url as string) || (payload.source_url as string) || ''
      const key = `${t.project_id}::${url || t.task_id}`
      const group = groups.get(key) || []
      group.push(t)
      groups.set(key, group)
    }
    // 整组未完成（任一非终态，或有 FAILED）才显示
    const activeGroups = Array.from(groups.entries()).filter(([, g]) =>
      g.some((t) => !isTaskTerminal(t.status) || t.status === 'FAILED'),
    )
    return activeGroups.map(([groupKey, g]) => {
      g.sort((a, b) => statusRank(b.status) - statusRank(a.status))
      const representative = g[0]
      const downloadTask = g.find((t) => t.task_type === 'download')
      const analyzeTask = g.find((t) => t.task_type === 'analyze')
      const dl = downloadTask ? (downloadTask.progress ?? 0) : 0
      const an = analyzeTask ? (analyzeTask.progress ?? 0) : 0
      let progress: number
      if (downloadTask && analyzeTask) progress = dl * 0.3 + an * 0.7
      else if (downloadTask) progress = dl
      else if (analyzeTask) progress = an
      else progress = representative.progress ?? 0
      return { groupKey, task: representative, progress }
    })
  }, [tasks])

  const running = rows.filter((r) => statusRank(r.task.status) === 4).length
  const queued = rows.filter((r) => r.task.status === 'PENDING').length
  const failed = rows.filter((r) => r.task.status === 'FAILED').length

  if (rows.length === 0) {
    return (
      <div className="tb-placeholder" style={{ minHeight: 240 }}>
        暂无活跃任务
      </div>
    )
  }

  return (
    <>
      <div className="tb-head-mini">
        <div>
          <div
            className="eyebrow"
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 11,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--ink-3)',
            }}
          >
            BATCH QUEUE · 并行执行
          </div>
          <h2
            className="display"
            style={{ fontSize: 28, margin: '4px 0 0' }}
          >
            队列 · Queue
          </h2>
        </div>
      </div>

      {/* Summary chips */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <span className="kw" style={{ background: 'var(--bg-sunken)', fontSize: 12, padding: '5px 11px' }}>
          <span style={{ background: STATE_DOT.running, width: 6, height: 6, borderRadius: 99, display: 'inline-block', marginRight: 6 }} />
          运行中 <b style={{ marginLeft: 4, fontFamily: 'var(--mono)' }}>{running}</b>
        </span>
        <span className="kw" style={{ background: 'var(--bg-sunken)', fontSize: 12, padding: '5px 11px' }}>
          <span style={{ background: STATE_DOT.queued, width: 6, height: 6, borderRadius: 99, display: 'inline-block', marginRight: 6 }} />
          排队中 <b style={{ marginLeft: 4, fontFamily: 'var(--mono)' }}>{queued}</b>
        </span>
        <span className="kw" style={{ background: 'var(--bg-sunken)', fontSize: 12, padding: '5px 11px' }}>
          <span style={{ background: STATE_DOT.error, width: 6, height: 6, borderRadius: 99, display: 'inline-block', marginRight: 6 }} />
          失败 <b style={{ marginLeft: 4, fontFamily: 'var(--mono)' }}>{failed}</b>
        </span>
      </div>

      {/* Queue rows */}
      <div className="qp-list">
        {rows.map(({ groupKey, task: t, progress }) => {
          const isRunning = !isTaskTerminal(t.status) && t.status !== 'PENDING'
          const isQueued = t.status === 'PENDING'
          const isFailed = t.status === 'FAILED'
          const payload = (t.payload ?? {}) as Record<string, unknown>
          const pct = isRunning ? Math.round(progress * 100) : 0
          const title = (payload.name as string) || (payload.video_title as string) || t.task_type

          return (
            <div key={groupKey} className="qp-row" data-state={isFailed ? 'error' : isQueued ? 'queued' : 'running'}>
              <div className="qp-dot" data-state={isFailed ? 'error' : isQueued ? 'queued' : 'running'} />
              <div className="qp-t">
                <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {title}
                </div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 3 }}>
                  {getStatusText(t.status)}{t.error ? ` · ${t.error}` : ''}
                </div>
              </div>
              <div className="qp-bar">
                <span style={{ width: `${pct}%` }} />
              </div>
              <div className="mono qp-pct" style={{ width: 50, textAlign: 'right', color: isFailed ? 'var(--accent-pink)' : isRunning ? 'var(--ink)' : 'var(--ink-4)' }}>
                {isRunning ? `${pct}%` : isQueued ? '—' : isFailed ? '失败' : '完成'}
              </div>
              <div className="qp-acts">
                {isFailed && (
                  <button
                    className="btn btn-ghost"
                    style={{ height: 26, fontSize: 11 }}
                    onClick={() => retryTask(t.task_id)}
                  >
                    <RefreshCw size={12} /> 重试
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
