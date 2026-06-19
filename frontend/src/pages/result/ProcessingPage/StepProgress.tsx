import { Download, Subtitles, BookMarked, Check } from 'lucide-react'

const FIVE_STEPS = [
  { id: 'PENDING', name: '排队', icon: Download },
  { id: 'DOWNLOAD', name: '下载', icon: Download },
  { id: 'TRANSCRIBE', name: '转录', icon: Subtitles },
  { id: 'ANALYZE_NOTE', name: '生成笔记', icon: BookMarked },
  { id: 'SUCCESS', name: '完成', icon: Check },
] as const

type StepState = 'queued' | 'running' | 'done'

export interface StepWithState {
  id: string
  name: string
  icon: typeof Download
  state: StepState
  pct: number
}

/**
 * 5 步进度映射（VN3）。
 *
 * pipeline 实际阶段 → UI 显示步骤：
 *   PENDING → 排队 / DOWNLOAD → 下载 / ASR → 转录 / analyze+note(SUM) → 生成笔记 / SUCCESS → 完成
 */
export function deriveSteps(currentStatus: string, progress: number): StepWithState[] {
  // terminal states → all done or all queued
  if (currentStatus === 'SUCCESS') {
    return FIVE_STEPS.map(s => ({ ...s, icon: s.icon, state: 'done' as StepState, pct: 1 }))
  }
  if (currentStatus === 'FAILED' || currentStatus === 'CANCELLED') {
    return FIVE_STEPS.map(s => ({ ...s, icon: s.icon, state: 'queued' as StepState, pct: 0 }))
  }

  // Determine active step from pipeline stage + progress
  let activeId: string
  if (currentStatus === 'PENDING') {
    activeId = 'PENDING'
  } else if (currentStatus === 'DOWNLOAD') {
    activeId = 'DOWNLOAD'
  } else if (currentStatus === 'ASR') {
    activeId = 'TRANSCRIBE'
  } else if (currentStatus === 'FRAMES' || currentStatus === 'VLM' || currentStatus === 'SUM' || currentStatus === 'STORE') {
    activeId = 'ANALYZE_NOTE'
  } else {
    activeId = 'PENDING'
  }

  const activeIdx = FIVE_STEPS.findIndex(s => s.id === activeId)

  return FIVE_STEPS.map((step, idx) => {
    if (idx < activeIdx) return { ...step, icon: step.icon, state: 'done', pct: 1 }
    if (idx === activeIdx) return { ...step, icon: step.icon, state: progress >= 1 ? 'done' : 'running', pct: progress }
    return { ...step, icon: step.icon, state: 'queued', pct: 0 }
  })
}

interface StepProgressProps {
  currentStatus: string
  progress: number
}

export function StepProgress({ currentStatus, progress }: StepProgressProps) {
  const steps = deriveSteps(currentStatus, progress)

  return (
    <div className="step-stream">
      {steps.map((s) => {
        const Icon = s.icon
        return (
          <div key={s.id} className="step-row" data-state={s.state}>
            <div className="ico">
              {s.state === 'done' ? (
                <Check size={20} />
              ) : s.state === 'running' ? (
                <div className="spinner" />
              ) : (
                <Icon size={18} />
              )}
            </div>
            <div className="body">
              <div className="hd">{s.name}</div>
            </div>
            <div className="progress">
              <div className="pct">
                {s.state === 'queued'
                  ? '—'
                  : s.state === 'done'
                    ? '✓'
                    : `${Math.round(s.pct * 100)}%`}
              </div>
              <div className="bar">
                <div className="fill" style={{ width: `${s.pct * 100}%` }} />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
