import { useMemo } from 'react'
import { RefreshCw } from 'lucide-react'
import { useTaskStore } from '@/store/taskStore'
import { isTaskTerminal, getStatusText } from '@/types/task'

const STATE_DOT: Record<string, string> = {
  running: 'var(--ink)',
  queued: 'var(--ink-4)',
  error: 'var(--accent)',
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

  const active = tasks.filter((t) => !isTaskTerminal(t.status))
  const errored = tasks.filter((t) => t.status === 'FAILED')
  const rows = [...active, ...errored]

  const running = rows.filter((r) => r.status === 'running' || r.status === 'DOWNLOAD' || r.status === 'ASR' || r.status === 'VLM' || r.status === 'FRAMES' || r.status === 'SUM').length
  const queued = rows.filter((r) => r.status === 'PENDING').length
  const failed = errored.length

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
        {rows.map((t) => {
          const isRunning = !isTaskTerminal(t.status) && t.status !== 'PENDING'
          const isQueued = t.status === 'PENDING'
          const isFailed = t.status === 'FAILED'
          const pct = isRunning ? Math.round(t.progress * 100) : 0

          return (
            <div key={t.task_id} className="qp-row" data-state={isFailed ? 'error' : isQueued ? 'queued' : 'running'}>
              <div className="qp-dot" data-state={isFailed ? 'error' : isQueued ? 'queued' : 'running'} />
              <div className="qp-t">
                <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.payload?.name ?? t.task_type}
                </div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 3 }}>
                  {getStatusText(t.status)}{t.error ? ` · ${t.error}` : ''}
                </div>
              </div>
              <div className="qp-bar">
                <span style={{ width: `${pct}%` }} />
              </div>
              <div className="mono qp-pct" style={{ width: 50, textAlign: 'right', color: isFailed ? 'var(--accent)' : isRunning ? 'var(--ink)' : 'var(--ink-4)' }}>
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
