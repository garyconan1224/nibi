import { Download, Subtitles, BookMarked, Check } from 'lucide-react'

const ALL_STEPS = [
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

export interface DeriveStepsOpts {
  /** false 时省略 TRANSCRIBE 步（图片笔记等无 ASR 流程），默认 true */
  hasTranscriptStep?: boolean
}

/**
 * 5 步进度映射（VN3）。
 *
 * pipeline 实际阶段 → UI 显示步骤：
 *   PENDING/PROBE → 排队或下载 / DOWNLOAD → 下载 / ASR → 转录
 *   FRAMES/VLM/SUM/STORE → 生成笔记 / SUCCESS → 完成
 *
 * opts.hasTranscriptStep=false 时省略 TRANSCRIBE，产出 4 步列表。
 */
export function deriveSteps(
  currentStatus: string,
  progress: number,
  opts: DeriveStepsOpts = {},
): StepWithState[] {
  const { hasTranscriptStep = true } = opts
  const steps = hasTranscriptStep
    ? [...ALL_STEPS]
    : ALL_STEPS.filter(s => s.id !== 'TRANSCRIBE')

  // terminal / non-progress states → all queued (UI 层单独处理 AWAITING_CONFIRM / FAILED / CANCELLED)
  if (currentStatus === 'SUCCESS') {
    return steps.map(s => ({ ...s, icon: s.icon, state: 'done' as StepState, pct: 1 }))
  }
  if (currentStatus === 'FAILED' || currentStatus === 'CANCELLED' || currentStatus === 'AWAITING_CONFIRM') {
    return steps.map(s => ({ ...s, icon: s.icon, state: 'queued' as StepState, pct: 0 }))
  }

  // pipeline stage → active step id
  let activeId: string
  if (currentStatus === 'PENDING') {
    activeId = 'PENDING'
  } else if (currentStatus === 'DOWNLOAD' || currentStatus === 'PROBE') {
    // PROBE 是下载后的解析阶段，归入「下载」步骤
    activeId = 'DOWNLOAD'
  } else if (currentStatus === 'ASR') {
    activeId = hasTranscriptStep ? 'TRANSCRIBE' : 'ANALYZE_NOTE'
  } else if (currentStatus === 'FRAMES' || currentStatus === 'VLM' || currentStatus === 'SUM' || currentStatus === 'STORE') {
    activeId = 'ANALYZE_NOTE'
  } else {
    activeId = 'PENDING'
  }

  const activeIdx = steps.findIndex(s => s.id === activeId)

  return steps.map((step, idx) => {
    if (idx < activeIdx) return { ...step, icon: step.icon, state: 'done', pct: 1 }
    if (idx === activeIdx) return { ...step, icon: step.icon, state: progress >= 1 ? 'done' : 'running', pct: progress }
    return { ...step, icon: step.icon, state: 'queued', pct: 0 }
  })
}

interface StepProgressProps {
  currentStatus: string
  progress: number
  /** 图文笔记：省略「转录」步骤 */
  isImageNote?: boolean
}

export function StepProgress({ currentStatus, progress, isImageNote = false }: StepProgressProps) {
  const steps = deriveSteps(currentStatus, progress, { hasTranscriptStep: !isImageNote })

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
