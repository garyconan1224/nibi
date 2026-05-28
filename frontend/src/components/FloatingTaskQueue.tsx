import { useState, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { RotateCcw, X } from 'lucide-react'
import { useTaskStore } from '@/store/taskStore'
import { usePipelineTasks } from '@/hooks/usePipelineTasks'
import { PROCESSING_STAGES, isTaskTerminal, type TaskRecord } from '@/types/task'
import './FloatingTaskQueue.css'

/* ── helpers ── */

type DisplayState = 'running' | 'queued' | 'error'

interface QueueRow {
  id: string
  title: string
  state: DisplayState
  status: string
  progress: number
  stage: string
  workspaceId: string
  itemId?: string
}

function displayState(status: string): DisplayState {
  if (status === 'FAILED') return 'error'
  if (status === 'PENDING') return 'queued'
  return 'running'
}

function getStageLabel(status: string, errorMsg?: string): string {
  if (status === 'FAILED') {
    if (errorMsg) {
      const short = errorMsg.slice(0, 22)
      return short.length < errorMsg.length ? short + '…' : short
    }
    return '失败'
  }
  const stage = PROCESSING_STAGES.find((s) => s.id === status)
  if (stage) return stage.name
  if (status === 'PENDING') return '等待槽位'
  return status
}

function getTaskTitle(task: TaskRecord): string {
  const payload = (task.payload ?? {}) as Record<string, unknown>
  const result = (task.result ?? {}) as Record<string, unknown>

  const rTitle = result?.title as string | undefined
  if (rTitle?.trim()) return rTitle.trim()

  const url = payload?.url as string | undefined
  if (url?.trim()) {
    try {
      const segment = new URL(url.trim()).pathname.split('/').filter(Boolean).pop() || url
      return segment.length > 40 ? segment.slice(0, 37) + '...' : segment
    } catch {
      return url.trim().length > 40 ? url.trim().slice(0, 37) + '...' : url.trim()
    }
  }

  const pTitle = payload?.title as string | undefined
  if (pTitle?.trim()) return pTitle.trim()

  return task.task_id.slice(0, 8)
}

const timeOf = (value: string | undefined): number => {
  const ts = Date.parse(value || '')
  return Number.isFinite(ts) ? ts : 0
}

const dotColor = (s: DisplayState): string =>
  s === 'running' ? 'var(--accent-green)'
    : s === 'queued' ? 'var(--ink-4)'
    : 'var(--accent)'

/* ── component ── */

export function FloatingTaskQueue() {
  usePipelineTasks({ pollInterval: 5000 })
  const navigate = useNavigate()
  const location = useLocation()
  const tasks = useTaskStore((s) => s.tasks)
  const storeCurrentTaskId = useTaskStore((s) => s.currentTaskId)
  const setCurrentTask = useTaskStore((s) => s.setCurrentTask)
  const cancelTask = useTaskStore((s) => s.cancelTask)
  const retryTask = useTaskStore((s) => s.retryTask)
  const removeTask = useTaskStore((s) => s.removeTask)
  const [open, setOpen] = useState(false)

  /* current task id from URL path /processing/:taskId */
  const routeTaskId = useMemo(() => {
    const m = location.pathname.match(/^\/processing\/(.+)/)
    return m ? m[1] : null
  }, [location.pathname])

  const currentTaskId = routeTaskId ?? storeCurrentTaskId

  const rows: QueueRow[] = useMemo(() => {
    const activeTasks = tasks.filter((t) => !isTaskTerminal(t.status) || t.status === 'FAILED')

    // 按 project_id + payload.url 分组
    const groups = new Map<string, TaskRecord[]>()
    for (const task of activeTasks) {
      const payload = (task.payload ?? {}) as Record<string, unknown>
      const url = (payload?.url as string) || ''
      const key = `${task.project_id}::${url || task.task_id}`
      const group = groups.get(key) || []
      group.push(task)
      groups.set(key, group)
    }

    // 每组取代表 task
    const statusPriority: Record<string, number> = {
      RUNNING: 4,
      PENDING: 3,
      FAILED: 2,
      SUCCESS: 1,
    }

    const representativeTasks = Array.from(groups.values()).map((group) => {
      // 按 status 优先级排序，取优先级最高的
      group.sort((a, b) => (statusPriority[b.status] || 0) - (statusPriority[a.status] || 0))
      const representative = group[0]

      // 计算加权平均进度（download 30% + analyze 70%）
      const downloadTask = group.find((t) => t.task_type === 'download')
      const analyzeTask = group.find((t) => t.task_type === 'analyze')
      const downloadProgress = downloadTask ? (downloadTask.progress ?? 0) : 0
      const analyzeProgress = analyzeTask ? (analyzeTask.progress ?? 0) : 0
      const weightedProgress = downloadProgress * 0.3 + analyzeProgress * 0.7

      return {
        task: representative,
        progress: weightedProgress,
      }
    })

    // 按更新时间排序，取前 8 个
    return representativeTasks
      .sort((a, b) => timeOf(b.task.updated_at) - timeOf(a.task.updated_at))
      .slice(0, 8)
      .map(({ task: t, progress }) => {
        const state = displayState(t.status)
        const displayProgress = Math.round(progress * 100)
        const payload = (t.payload ?? {}) as Record<string, unknown>
        return {
          id: t.task_id,
          title: getTaskTitle(t),
          state,
          status: t.status,
          progress: state === 'error' ? Math.max(displayProgress, 1) : displayProgress,
          stage: getStageLabel(t.status, t.error || undefined),
          workspaceId: t.project_id,
          itemId: payload?.item_id as string | undefined,
        }
      })
  }, [tasks])

  const running = rows.filter((r) => r.state === 'running').length
  const queued = rows.filter((r) => r.state === 'queued').length
  const errored = rows.filter((r) => r.state === 'error').length
  const total = rows.length

  const avgPct = total
    ? Math.round(rows.reduce((a, r) => a + (r.progress || 0), 0) / total)
    : 0

  const handleSelectTask = (row: QueueRow) => {
    setCurrentTask(row.id)
    navigate(`/processing/${row.id}`, {
      state: {
        workspaceId: row.workspaceId,
        itemId: row.itemId,
      },
    })
    setOpen(false)
  }

  const handleCancelOrHide = (row: QueueRow) => {
    if (row.status === 'FAILED') {
      removeTask(row.id)
      return
    }
    void cancelTask(row.id)
  }

  const retryErrored = (erroredRows: QueueRow[]) => {
    for (const row of erroredRows) {
      void retryTask(row.id)
    }
  }

  const cancelActive = (activeRows: QueueRow[]) => {
    for (const row of activeRows) {
      void cancelTask(row.id)
    }
  }

  if (total === 0) return null

  const activeRows = rows.filter((r) => r.status !== 'FAILED')
  const erroredRows = rows.filter((r) => r.status === 'FAILED')

  return (
    <>
      {/* ───── Collapsed FAB ───── */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          style={{
            position: 'fixed', right: 24, bottom: 24, zIndex: 38,
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 16px 10px 12px',
            background: 'var(--ink)', color: 'var(--bg)',
            borderRadius: 99, border: 'none', cursor: 'pointer',
            boxShadow: 'var(--shadow-lg)',
            fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 500,
            transition: 'transform 160ms ease, box-shadow 160ms ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)' }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'none' }}
        >
          {/* mini progress ring */}
          <svg width="22" height="22" viewBox="0 0 22 22" style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8.5" stroke="rgba(255,255,255,0.18)" strokeWidth="2" fill="none" />
            <circle
              cx="11" cy="11" r="8.5"
              stroke="var(--accent-green)" strokeWidth="2" fill="none"
              strokeDasharray={`${(avgPct / 100) * 53.4} 53.4`}
              strokeLinecap="round"
              transform="rotate(-90 11 11)"
            />
            <text
              x="11" y="14" textAnchor="middle" fontSize="7"
              fontFamily="var(--mono)" fill="var(--bg)" fontWeight="700"
            >
              {avgPct}
            </text>
          </svg>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-start', lineHeight: 1.1 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--bg)' }}>
              任务 · {running + queued + errored} 项进行中
            </span>
            <span style={{ fontSize: 10, opacity: 0.65 }}>
              {running > 0 && <>● {running} 处理</>}
              {queued > 0 && <>{running > 0 ? ' · ' : ''}○ {queued} 等待</>}
              {errored > 0 && (
                <>{(running || queued) ? ' · ' : ''}<span style={{ color: 'var(--accent)' }}>✗ {errored} 失败</span></>
              )}
            </span>
          </div>
        </button>
      )}

      {/* ───── Expanded panel ───── */}
      {open && (
        <div
          style={{
            position: 'fixed', right: 24, bottom: 24, zIndex: 38,
            width: 380, maxHeight: '70vh',
            background: 'var(--bg-elev)', border: '1px solid var(--line)',
            borderRadius: 16, boxShadow: 'var(--shadow-lg)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            animation: 'ks-menu-in 200ms cubic-bezier(0.2,0.8,0.2,1)',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 14px', borderBottom: '1px solid var(--line)',
              background: 'var(--bg-sunken)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span className="eyebrow">任务 · 近期活跃</span>
              <span className="mono" style={{ fontSize: 10, color: 'var(--ink-3)' }}>
                {running}/{total} 处理中 · 平均 {avgPct}%
              </span>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                className="btn btn-ghost"
                aria-label="关闭浮动任务队列"
                onClick={() => setOpen(false)}
                style={{ width: 24, height: 24, padding: 0, display: 'grid', placeItems: 'center' }}
              >
                <X size={12} />
              </button>
            </div>
          </div>

          {/* Aggregate bar */}
          <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
              <span className="mono" style={{ fontSize: 10, color: 'var(--ink-3)' }}>聚合进度</span>
              <div style={{ flex: 1, height: 3, background: 'var(--bg-sunken)', borderRadius: 99, overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${avgPct}%`,
                    background: 'linear-gradient(90deg, var(--accent), var(--accent-2), var(--accent-green))',
                    transition: 'width 400ms ease',
                  }}
                />
              </div>
              <span className="mono" style={{ fontSize: 10, color: 'var(--ink)' }}>{avgPct}%</span>
            </div>
          </div>

          {/* Rows */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
            {rows.map((r) => {
              const isActive = currentTaskId === r.id
              return (
                <div
                  key={r.id}
                  onClick={() => handleSelectTask(r)}
                  style={{
                    padding: '10px 14px',
                    borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                    background: isActive ? 'var(--bg-sunken)' : 'transparent',
                    borderBottom: '1px solid var(--line)',
                    cursor: 'pointer',
                    transition: 'background 140ms ease',
                    display: 'flex', flexDirection: 'column', gap: 5,
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.background = 'var(--bg-sunken)'
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.background = 'transparent'
                  }}
                >
                  {/* row layer 1: dot + title + pill + progress */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        width: 7, height: 7, borderRadius: 99,
                        background: dotColor(r.state), flexShrink: 0,
                        animation: r.state === 'running' ? 'proc-blink 1.6s infinite' : 'none',
                      }}
                    />
                    <span
                      style={{
                        flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        color: r.state === 'error' ? 'var(--accent)' : 'var(--ink)',
                      }}
                    >
                      {r.title}
                    </span>
                    {isActive && (
                      <span
                        className="mono"
                        style={{
                          fontSize: 9, color: 'var(--accent)', flexShrink: 0,
                          padding: '1px 5px', border: '1px solid var(--accent)', borderRadius: 4,
                        }}
                      >
                        查看中
                      </span>
                    )}
                    <span className="mono" style={{ fontSize: 10, color: dotColor(r.state), flexShrink: 0 }}>
                      {r.state === 'error' ? 'FAIL' : `${r.progress}%`}
                    </span>
                  </div>

                  {/* row layer 2: thin progress bar + stage */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ flex: 1, height: 2, background: 'var(--bg-sunken)', borderRadius: 99, overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${r.progress}%`,
                          background: dotColor(r.state),
                          transition: 'width 400ms ease',
                        }}
                      />
                    </div>
                    <span className="mono" style={{ fontSize: 9.5, color: 'var(--ink-4)' }}>
                      {r.stage}
                    </span>
                    {r.state === 'error' && (
                      <button
                        className="btn btn-ghost"
                        aria-label={`重试 ${r.title}`}
                        style={{ height: 20, padding: '0 7px', fontSize: 10, gap: 4 }}
                        onClick={(e) => {
                          e.stopPropagation()
                          void retryTask(r.id)
                        }}
                      >
                        <RotateCcw size={10} />重试
                      </button>
                    )}
                    <button
                      className="btn btn-ghost"
                      aria-label={r.status === 'FAILED' ? `隐藏失败任务 ${r.title}` : `取消任务 ${r.title}`}
                      style={{ height: 20, padding: '0 7px', fontSize: 10, color: 'var(--ink-3)' }}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleCancelOrHide(r)
                      }}
                    >
                      <X size={10} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Footer */}
          <div
            style={{
              display: 'flex', gap: 6, padding: '10px 14px',
              borderTop: '1px solid var(--line)',
              background: 'var(--bg-sunken)',
            }}
          >
            <button
              className="btn"
              style={{ flex: 1, height: 30, fontSize: 12 }}
              onClick={() => { navigate('/workspaces'); setOpen(false) }}
            >
              查看全部
            </button>
            <button
              className="btn"
              style={{ flex: 1, height: 30, fontSize: 12 }}
              disabled={activeRows.length === 0}
              onClick={() => cancelActive(activeRows)}
            >
              暂停全部
            </button>
            <button
              className="btn"
              style={{ flex: 1, height: 30, fontSize: 12 }}
              disabled={erroredRows.length === 0}
              onClick={() => retryErrored(erroredRows)}
            >
              <RotateCcw size={11} />重试 {erroredRows.length} 项
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export default FloatingTaskQueue
