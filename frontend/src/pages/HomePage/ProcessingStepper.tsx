import type { FC } from 'react'
import {
  Download,
  Search,
  Image,
  Subtitles,
  Eye,
  BookMarked,
  Database,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { TaskStatus, PROCESSING_STAGES, STEP_TO_STAGE } from '@/types/task'

// 图标映射（与 PROCESSING_STAGES 中 icon 字段对应）
const ICON_MAP: Record<string, FC<{ className?: string }>> = {
  Download,
  Search,
  Image,
  Subtitles,
  Eye,
  BookMarked,
  Database,
}

// 颜色 → Tailwind class 映射（对齐 v1.1 §13 颜色语义）
const COLOR_ACTIVE: Record<string, string> = {
  blue: 'border-blue-500 bg-blue-50 text-blue-600 shadow-blue-100',
  gray: 'border-gray-400 bg-gray-50 text-gray-500 shadow-gray-100',
  amber: 'border-amber-500 bg-amber-50 text-amber-600 shadow-amber-100',
  rose: 'border-rose-500 bg-rose-50 text-rose-600 shadow-rose-100',
  purple: 'border-purple-500 bg-purple-50 text-purple-600 shadow-purple-100',
  emerald: 'border-emerald-500 bg-emerald-50 text-emerald-600 shadow-emerald-100',
  slate: 'border-slate-400 bg-slate-50 text-slate-500 shadow-slate-100',
}

const COLOR_DONE: Record<string, string> = {
  blue: 'border-blue-500 bg-blue-500 text-white',
  gray: 'border-gray-400 bg-gray-400 text-white',
  amber: 'border-amber-500 bg-amber-500 text-white',
  rose: 'border-rose-500 bg-rose-500 text-white',
  purple: 'border-purple-500 bg-purple-500 text-white',
  emerald: 'border-emerald-500 bg-emerald-500 text-white',
  slate: 'border-slate-400 bg-slate-400 text-white',
}

const COLOR_TEXT: Record<string, string> = {
  blue: 'text-blue-600',
  gray: 'text-gray-500',
  amber: 'text-amber-600',
  rose: 'text-rose-600',
  purple: 'text-purple-600',
  emerald: 'text-emerald-600',
  slate: 'text-slate-500',
}

const COLOR_BAR: Record<string, string> = {
  blue: 'bg-blue-500',
  gray: 'bg-gray-400',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  purple: 'bg-purple-500',
  emerald: 'bg-emerald-500',
  slate: 'bg-slate-400',
}

const COLOR_BAR_BG: Record<string, string> = {
  blue: 'bg-blue-100',
  gray: 'bg-gray-100',
  amber: 'bg-amber-100',
  rose: 'bg-rose-100',
  purple: 'bg-purple-100',
  emerald: 'bg-emerald-100',
  slate: 'bg-slate-100',
}

interface ProcessingStepperProps {
  status: string
  progress: number
  steps?: string[]
  downloadSpeed?: string
}

/**
 * ProcessingStepper
 *
 * 展示七阶段任务流程（对齐 v1.1 §11）：
 * DOWNLOAD → PROBE → FRAMES → ASR → VLM → SUM → STORE
 */
const ProcessingStepper: FC<ProcessingStepperProps> = ({ status, progress, steps, downloadSpeed }) => {
  const isSuccess = status === TaskStatus.SUCCESS
  const isFailed = status === TaskStatus.FAILED
  const isCancelled = status === TaskStatus.CANCELLED
  const isPending = status === TaskStatus.PENDING

  // 根据 steps 过滤阶段。
  // 注意：PROBE / STORE 是 pipeline 框架级阶段（探测/入库），无论用户勾选什么 steps 都会触发，
  // 因此在 UI 中始终显示；VLM 当前未启用（Phase 1G 实装），按用户 steps 决定是否显示。
  const visibleStages =
    steps && steps.length > 0
      ? PROCESSING_STAGES.filter((stage) => {
          if (stage.id === TaskStatus.PROBE || stage.id === TaskStatus.STORE) return true
          return Object.entries(STEP_TO_STAGE).some(
            ([stepName, mappedStage]) => steps.includes(stepName) && mappedStage === stage.id,
          )
        })
      : PROCESSING_STAGES

  // 当前活跃阶段在可见阶段中的索引
  const activeStageIdx = visibleStages.findIndex((s) => s.id === status)
  // PENDING 或未知状态：定位到第一阶段
  const activeIndex = isPending || activeStageIdx < 0 ? 0 : activeStageIdx

  return (
    <div className="w-full px-1 py-2">
      <div className="flex items-start justify-between gap-0.5">
        {visibleStages.map((stage, idx) => {
          const IconComp = ICON_MAP[stage.icon] ?? Download
          const color = stage.color

          const isDone = isSuccess || (!isFailed && !isCancelled && !isPending && activeIndex > idx)
          const isActive = !isSuccess && !isFailed && !isCancelled && !isPending && activeIndex === idx
          const failedIdx = activeStageIdx >= 0 ? activeStageIdx : visibleStages.length - 1
          const isFail = isFailed && failedIdx === idx
          const showSpeed = isActive && stage.id === TaskStatus.DOWNLOAD && !!downloadSpeed

          return (
            <div key={stage.id} className="flex flex-1 flex-col items-center min-w-0">
              {/* 图标圆圈 */}
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-300',
                  isDone && COLOR_DONE[color],
                  isActive && `${COLOR_ACTIVE[color]} shadow-md`,
                  isFail && 'border-red-500 bg-red-50 text-red-600',
                  !isDone && !isActive && !isFail && 'border-gray-200 bg-white text-gray-300',
                )}
              >
                {isDone ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : isFail ? (
                  <XCircle className="h-4 w-4" />
                ) : (
                  <IconComp className="h-3.5 w-3.5" />
                )}
              </div>

              {/* 阶段名称 */}
              <span
                className={cn(
                  'mt-1 text-[10px] font-medium leading-tight text-center',
                  isDone && COLOR_TEXT[color],
                  isActive && COLOR_TEXT[color],
                  isFail && 'text-red-600',
                  !isDone && !isActive && !isFail && 'text-gray-400',
                )}
              >
                {stage.name}
              </span>

              {/* 活跃阶段进度条 */}
              {isActive && (
                <div className={cn('mt-1 h-1 w-full overflow-hidden rounded-full', COLOR_BAR_BG[color])}>
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', COLOR_BAR[color])}
                    style={{ width: `${Math.round(progress * 100)}%` }}
                  />
                </div>
              )}

              {/* 下载阶段实时网速 */}
              {showSpeed && (
                <span className="mt-0.5 text-[9px] font-mono text-blue-600 tabular-nums">
                  {downloadSpeed}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* 全局状态提示 */}
      {isSuccess && (
        <p className="mt-2 text-center text-xs font-medium text-emerald-600">全部完成</p>
      )}
      {isFailed && (
        <p className="mt-2 text-center text-xs font-medium text-red-500">处理失败</p>
      )}
      {isCancelled && (
        <p className="mt-2 text-center text-xs font-medium text-slate-500">已取消</p>
      )}
    </div>
  )
}

export default ProcessingStepper
