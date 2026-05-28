import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { AlertTriangle, ArrowRight, Music, RotateCcw, X } from 'lucide-react'
import { toast } from 'sonner'

import { useTaskStore } from '@/store/taskStore'
import { useTaskSse } from '@/hooks/useTaskSse'
import { isTaskTerminal, getStatusText } from '@/types/task'
import { getPipelineTask } from '@/services/pipeline'
import { categorizeError } from '@/lib/errorCategories'
import { platformPrefixFromUrl } from '@/lib/platformPrefix'
import MusicModeConfirmModal from '@/components/workspace/MusicModeConfirmModal'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { StepProgress } from './StepProgress'
import SystemResourceCard from './SystemResourceCard'
import TasksCard from './TasksCard'
import { LiveLog } from './LiveLog'

import './processing.css'

interface LocationState {
  workspaceId?: string
  itemId?: string
  url?: string
}

const STUCK_MS = 10 * 60 * 1000

function titleFromFilename(filename: unknown): string {
  const raw = typeof filename === 'string' ? filename.trim() : ''
  if (!raw) return ''
  const name = raw.split('/').pop() || raw
  return name.replace(/\.[^.]+$/, '')
}

function audioThumbnailFromResult(result: Record<string, unknown>, audio?: Record<string, unknown>): string {
  const projectId = typeof result.project_id === 'string' ? result.project_id.trim() : ''
  const filename = typeof audio?.filename === 'string' ? audio.filename.trim() : ''
  if (!projectId || !filename) return ''
  return `/static/workspaces/${projectId}/audio/${titleFromFilename(filename)}.jpg`
}

export default function ProcessingPage() {
  const { taskId = '' } = useParams<{ taskId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as LocationState | null

  const task = useTaskStore((s) => s.getTask(taskId))
  const addTask = useTaskStore((s) => s.addTask)
  const updateTask = useTaskStore((s) => s.updateTask)
  const cancelTask = useTaskStore((s) => s.cancelTask)
  const retryTask = useTaskStore((s) => s.retryTask)

  const workspaceId = state?.workspaceId ?? task?.project_id
  const itemId = state?.itemId ?? (task?.payload as Record<string, unknown>)?.item_id as string | undefined

  const isActive = task ? !isTaskTerminal(task.status) : false
  useTaskSse(taskId, isActive)

  useEffect(() => {
    if (!taskId) return
    let cancelled = false
    getPipelineTask(taskId)
      .then((fresh) => {
        if (cancelled) return
        if (useTaskStore.getState().getTask(fresh.task_id)) {
          updateTask(fresh.task_id, fresh)
        } else {
          addTask(fresh)
        }
      })
      .catch(() => {
        // 详情补拉失败时保留本地 store，避免打断正在看的页面。
      })
    return () => { cancelled = true }
  }, [taskId, addTask, updateTask])

  const progress = task?.progress ?? 0
  const status = task?.status ?? 'PENDING'
  const logs = task?.log ?? []
  const isFailed = status === 'FAILED'
  const isCancelled = status === 'CANCELLED'
  const isSuccess = status === 'SUCCESS'

  // A3: 音乐模式确认弹窗
  const [dismissedMusicModalTaskId, setDismissedMusicModalTaskId] = useState<string | null>(null)
  const showMusicModal = status === 'AWAITING_CONFIRM' && dismissedMusicModalTaskId !== taskId

  // R18.1.3: 任务失败弹窗
  const [showFailModal, setShowFailModal] = useState(false)
  const prevStatusRef = useRef(status)
  useEffect(() => {
    // 状态刚变为 FAILED 时自动弹窗
    if (status === 'FAILED' && prevStatusRef.current !== 'FAILED') {
      setShowFailModal(true)
    }
    prevStatusRef.current = status
  }, [status])

  const handleMusicConfirmed = () => {
    setDismissedMusicModalTaskId(taskId)
    toast.success('已切换为音乐分析模式，任务继续执行')
  }

  const handleMusicCancelled = () => {
    setDismissedMusicModalTaskId(taskId)
    if (taskId) cancelTask(taskId)
    toast.info('任务已取消，可在素材设置中手动勾选「音乐分析」后重跑')
  }

  // F3.5: 任务卡住检测（非终结态 > 10 分钟无 updated_at 变化 → 警告）
  const lastActivityRef = useRef<number | null>(null)
  const stuckToastedRef = useRef(false)

  useEffect(() => {
    if (!task?.updated_at) return
    const currentActivity = lastActivityRef.current ?? 0
    lastActivityRef.current = Math.max(
      currentActivity,
      new Date(task.updated_at).getTime(),
    )
    // 有新活动时重置 toast 标记，以便下次卡住能再次提醒
    stuckToastedRef.current = false
  }, [task?.updated_at])

  useEffect(() => {
    if (!isActive) return
    if (lastActivityRef.current == null) {
      lastActivityRef.current = Date.now()
    }
    const timer = setInterval(() => {
      const lastActivity = lastActivityRef.current ?? Date.now()
      if (Date.now() - lastActivity > STUCK_MS && !stuckToastedRef.current) {
        toast.warning('任务已超过 10 分钟无进度更新，可能已卡住。建议取消后重试。')
        stuckToastedRef.current = true
      }
    }, 30_000)
    return () => clearInterval(timer)
  }, [isActive])

  const handleCancel = () => {
    if (taskId) cancelTask(taskId)
  }

  const handleRetry = () => {
    retryTask(taskId)
  }

  const categorized = categorizeError(task?.error)

  const result = task?.result ?? {} as Record<string, unknown>
  const payload = task?.payload ?? {} as Record<string, unknown>
  const taskType: string = task?.task_type ?? ''
  const isAudioTask = taskType === 'audio'
  // R13.2/R18.1 标题/封面/时长来源优先级：result（直接来源）→ payload（从 download 继承）→ fallback
  const resultAudio = result.audio as Record<string, unknown> | undefined
  const url =
    (task?.payload?.url as string) ??
    (payload.source as string) ??
    (payload.source_url as string) ??
    (result.source as string) ??
    state?.url ??
    ''
  const platform = platformPrefixFromUrl(url)
  const safeHostname = (() => {
    if (!url) return '任务'
    try { return new URL(url).hostname } catch { return '任务' }
  })()
  const title: string =
    (result.video_title as string) ||
    (resultAudio?.title as string) ||
    titleFromFilename(resultAudio?.filename) ||
    (payload.video_title as string) ||
    (task?.payload?.title as string) ||
    safeHostname
  const coverUrl: string =
    (result.video_thumbnail_url as string) ||
    (result.cover_thumbnail as string) ||
    audioThumbnailFromResult(result, resultAudio) ||
    (payload.video_thumbnail_url as string) ||
    ''
  const durationSec: number =
    Number(
      (result.video_duration as number) ||
      (result.duration_sec as number) ||
      (resultAudio?.duration_sec as number) ||
      (payload.video_duration as number),
    ) || 0
  const fmtDuration = (sec: number) => {
    if (!sec) return ''
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }
  const durationLabel = fmtDuration(durationSec)
  const framesCount: number = Number(result.frames_count as number) || 0
  const asrSegments: number = Number(result.asr_segments as number) || 0
  // ETA = 剩余时间估算（基于 progress）；任务无总时长信息时不显示
  const etaSec = durationSec && progress > 0 && progress < 1
    ? Math.max(0, Math.round(durationSec * (1 - progress) / progress))
    : 0

  return (
    <div className="vm-processing-scope">
      <div className="proc-wrap">
        <div className="proc-main">
          {/* Hero */}
          <div className="proc-hero">
            <div className="thumb">
              {coverUrl ? (
                <img
                  src={coverUrl}
                  alt={title}
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    // 封面加载失败（B 站 CDN 防盗链等）静默隐藏，露出黑底
                    (e.target as HTMLImageElement).style.display = 'none'
                  }}
                />
              ) : (
                isAudioTask && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Music size={32} style={{ color: 'var(--ink-4)' }} />
                  </div>
                )
              )}
              {!isFailed && !isCancelled && (
                <div className="live">● LIVE</div>
              )}
              {isAudioTask && coverUrl && (
                <>
                  <div className="thumb-audio-mask" />
                  <div className="thumb-audio-badge">
                    <Music size={12} color="#fff" />
                    <span>AUDIO</span>
                  </div>
                </>
              )}
            </div>
            <div className="info">
              <div className="eyebrow">{isAudioTask ? 'AUDIO' : 'PROCESSING'} · {taskId.slice(0, 8)}</div>
              <div className="title">
                {platform && <span style={{ color: 'var(--ink-3)', fontWeight: 400, marginRight: 10 }}>{platform} ·</span>}
                {title}
              </div>
              <div className="src">{url}</div>
              <div className="stats">
                {durationLabel && (
                  <span>
                    <strong>{durationLabel}</strong> 时长
                  </span>
                )}
                {framesCount > 0 && !isAudioTask && (
                  <span>
                    <strong>{framesCount}</strong> 帧
                  </span>
                )}
                {asrSegments > 0 && (
                  <span>
                    <strong>{asrSegments}</strong> 句转录
                  </span>
                )}
                <span>
                  状态 <strong>{getStatusText(status)}</strong>
                </span>
                <span>
                  进度 <strong>{Math.round(progress * 100)}%</strong>
                </span>
                {etaSec > 0 && (
                  <span>
                    剩余 <strong>{etaSec}s</strong>
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
                    完成 · 点击查看结果
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Failed state — inline indicator */}
          {isFailed && (
            <div className="proc-error">
              <AlertTriangle size={28} style={{ color: 'var(--accent)' }} />
              <h3>任务失败</h3>
              <p style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
                {categorized.friendlyMessage}
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button className="btn" onClick={() => setShowFailModal(true)}>
                  查看详情
                </button>
                <button className="btn btn-primary" onClick={handleRetry}>
                  <RotateCcw size={14} />
                  重试
                </button>
              </div>
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
              taskType={taskType}
              taskLogs={logs}
            />
          )}
        </div>

        {/* Sidebar */}
        <aside className="proc-side">
          <SystemResourceCard etaSec={etaSec} />
          <TasksCard currentTaskId={taskId} />
          <LiveLog logs={logs} />
        </aside>
      </div>

      {/* A3: VAD 无人声 → 音乐模式确认弹窗 */}
      <MusicModeConfirmModal
        open={showMusicModal}
        onOpenChange={(open) => {
          setDismissedMusicModalTaskId(open ? null : taskId)
        }}
        taskId={taskId}
        speechRatio={(task?.result?.speech_ratio as number) ?? 0}
        totalDuration={(task?.result?.total_duration as number) ?? 0}
        onConfirmed={handleMusicConfirmed}
        onCancelled={handleMusicCancelled}
      />

      {/* R18.1.3: 任务失败详情弹窗 */}
      <Dialog open={showFailModal} onOpenChange={setShowFailModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-destructive" />
              任务失败
            </DialogTitle>
            <DialogDescription>
              {categorized.friendlyMessage}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{categorized.suggestion}</p>
            {task?.error && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground font-mono">
                  查看原始错误信息
                </summary>
                <pre className="mt-2 p-3 rounded-md bg-muted text-muted-foreground whitespace-pre-wrap break-all text-[11px]">
                  {task.error}
                </pre>
              </details>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFailModal(false)}>
              关闭
            </Button>
            <Button onClick={() => { setShowFailModal(false); handleRetry() }}>
              <RotateCcw size={14} className="mr-1" />
              重试
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
