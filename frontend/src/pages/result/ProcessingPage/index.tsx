import { useEffect } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { ArrowRight, RotateCcw, X } from 'lucide-react'

import { useTaskStore } from '@/store/taskStore'
import { useTaskSse } from '@/hooks/useTaskSse'
import { isTaskTerminal, getStatusText } from '@/types/task'
import { StepProgress } from './StepProgress'
import { LiveLog } from './LiveLog'

import './processing.css'

interface LocationState {
  workspaceId?: string
  itemId?: string
  url?: string
}

export default function ProcessingPage() {
  const { taskId = '' } = useParams<{ taskId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as LocationState | null
  const workspaceId = state?.workspaceId
  const itemId = state?.itemId

  const task = useTaskStore((s) => s.getTask(taskId))
  const cancelTask = useTaskStore((s) => s.cancelTask)
  const retryTask = useTaskStore((s) => s.retryTask)

  const isActive = task ? !isTaskTerminal(task.status) : false
  useTaskSse(taskId, isActive)

  const progress = task?.progress ?? 0
  const status = task?.status ?? 'PENDING'
  const logs = task?.log ?? []
  const isFailed = status === 'FAILED'
  const isCancelled = status === 'CANCELLED'
  const isSuccess = status === 'SUCCESS'

  // 任务完成后自动跳转结果总览页
  useEffect(() => {
    if (!isSuccess) return
    if (!itemId) return // 没有 itemId 时不跳转（旧链接兼容）
    const timer = setTimeout(() => {
      const wid = workspaceId ?? 'default'
      navigate(`/workspaces/${wid}/items/${itemId}/overview`, { replace: true })
    }, 1500)
    return () => clearTimeout(timer)
  }, [isSuccess, workspaceId, itemId, navigate])

  const handleCancel = () => {
    if (taskId) cancelTask(taskId)
  }

  const handleRetry = async () => {
    try {
      await retryTask(taskId)
    } catch {
      // retryTask 内部已 toast
    }
  }

  const url = task?.payload?.url ?? state?.url ?? ''
  const title = task?.payload?.title ?? (url ? new URL(url).hostname : '任务')

  return (
    <div className="vm-processing-scope">
      <div className="proc-wrap">
        <div className="proc-main">
          {/* Hero */}
          <div className="proc-hero">
            <div className="thumb">
              {!isFailed && !isCancelled && (
                <div className="live">● LIVE</div>
              )}
            </div>
            <div className="info">
              <div className="eyebrow">PROCESSING · {taskId.slice(0, 8)}</div>
              <div className="title">{title}</div>
              <div className="src">{url}</div>
              <div className="stats">
                <span>
                  状态 <strong>{getStatusText(status)}</strong>
                </span>
                <span>
                  进度 <strong>{Math.round(progress * 100)}%</strong>
                </span>
                {logs.length > 0 && (
                  <span>
                    <strong>{logs.length}</strong> 条日志
                  </span>
                )}
              </div>
              <div className="actions">
                {!isSuccess && (
                  <button className="btn" onClick={handleCancel}>
                    <X size={14} />
                    取消
                  </button>
                )}
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    if (isSuccess && itemId) {
                      const wid = workspaceId ?? 'default'
                      navigate(`/workspaces/${wid}/items/${itemId}/overview`)
                    }
                  }}
                  style={{
                    opacity: isSuccess ? 1 : 0.5,
                    cursor: isSuccess ? 'pointer' : 'not-allowed',
                  }}
                >
                  查看结果 <ArrowRight size={14} />
                </button>
                {isSuccess && (
                  <span
                    className="chip"
                    style={{
                      background: 'rgba(34, 211, 154, 0.12)',
                      color: 'var(--accent-green)',
                      borderColor: 'rgba(34, 211, 154, 0.3)',
                    }}
                  >
                    <span
                      className="chip-dot"
                      style={{ background: 'var(--accent-green)' }}
                    />
                    完成 · 自动跳转中…
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Failed state */}
          {isFailed && (
            <div className="proc-error">
              <h3>任务失败</h3>
              <p>{task?.error || '处理过程中发生未知错误'}</p>
              {task?.error && (
                <div className="error-log">{task.error}</div>
              )}
              <button className="btn btn-primary" onClick={handleRetry}>
                <RotateCcw size={14} />
                重试
              </button>
            </div>
          )}

          {/* Cancelled state */}
          {isCancelled && (
            <div className="proc-error">
              <h3>任务已取消</h3>
              <p>你可以重新提交此任务</p>
              <button className="btn btn-primary" onClick={handleRetry}>
                <RotateCcw size={14} />
                重新提交
              </button>
            </div>
          )}

          {/* Step progress (running / success) */}
          {!isFailed && !isCancelled && (
            <StepProgress
              currentStatus={status}
              progress={progress}
              taskLogs={logs}
            />
          )}
        </div>

        {/* Sidebar */}
        <aside className="proc-side">
          <LiveLog logs={logs} />
        </aside>
      </div>
    </div>
  )
}
