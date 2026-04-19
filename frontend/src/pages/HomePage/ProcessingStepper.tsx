import { FC } from 'react'
import { Zap, Download, Subtitles, Eye, BookMarked, CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TaskStatus, PROCESSING_STAGES } from '@/types/task'

// 图标映射（与 PROCESSING_STAGES 中 icon 字段对应）
const ICON_MAP: Record<string, FC<{ className?: string }>> = {
  Zap,
  Download,
  Subtitles,
  Eye,
  BookMarked,
}

// 阶段在流程中的顺序索引
const STAGE_ORDER = PROCESSING_STAGES.map((s) => s.id)

/** 判断当前 status 在步骤条中的位置 */
function getStageIndex(status: string): number {
  return STAGE_ORDER.indexOf(status as TaskStatus)
}

interface ProcessingStepperProps {
  /** 任务当前状态 */
  status: string
  /** 进度值 0~1，用于活跃阶段的进度条 */
  progress: number
}

/**
 * ProcessingStepper
 *
 * 展示五阶段任务流程：PARSING → DOWNLOADING → TRANSCRIBING → ANALYZING → SUMMARIZING
 * - 已完成阶段：蓝色实心✓
 * - 活跃阶段：蓝色高亮 + 进度条动画
 * - 待处理阶段：灰色
 * - SUCCESS：全部绿色✓
 * - FAILED：活跃阶段显示红色✗
 */
const ProcessingStepper: FC<ProcessingStepperProps> = ({ status, progress }) => {
  const isSuccess = status === TaskStatus.SUCCESS
  const isFailed = status === TaskStatus.FAILED
  const isCancelled = status === TaskStatus.CANCELLED
  const activeIndex = getStageIndex(status)

  return (
    <div className="w-full px-1 py-2">
      <div className="flex items-start justify-between">
        {PROCESSING_STAGES.map((stage, idx) => {
          const IconComp = ICON_MAP[stage.icon] ?? Zap

          // 判断阶段状态
          const isDone = isSuccess || (!isFailed && !isCancelled && activeIndex > idx)
          const isActive = !isSuccess && !isFailed && !isCancelled && activeIndex === idx
          const isFail = isFailed && activeIndex === idx

          return (
            <div key={stage.id} className="flex flex-1 flex-col items-center">
              {/* 图标圆圈 */}
              <div
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all duration-300',
                  isDone && 'border-blue-500 bg-blue-500 text-white',
                  isActive && 'border-blue-500 bg-blue-50 text-blue-600 shadow-md shadow-blue-100',
                  isFail && 'border-red-500 bg-red-50 text-red-600',
                  !isDone && !isActive && !isFail && 'border-gray-200 bg-white text-gray-300',
                )}
              >
                {isDone ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : isFail ? (
                  <XCircle className="h-5 w-5" />
                ) : (
                  <IconComp className="h-4 w-4" />
                )}
              </div>

              {/* 阶段名称 */}
              <span
                className={cn(
                  'mt-1.5 text-[11px] font-medium leading-tight',
                  isDone && 'text-blue-600',
                  isActive && 'text-blue-700',
                  isFail && 'text-red-600',
                  !isDone && !isActive && !isFail && 'text-gray-400',
                )}
              >
                {stage.name}
              </span>

              {/* 活跃阶段进度条 */}
              {isActive && (
                <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-blue-100">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all duration-500"
                    style={{ width: `${Math.round(progress * 100)}%` }}
                  />
                </div>
              )}

              {/* 连接线（最后一个不显示） */}
              {idx < PROCESSING_STAGES.length - 1 && (
                <div
                  className={cn(
                    'absolute mt-4 hidden h-0.5 w-full translate-x-1/2',
                    // 使用伪元素替代，连接线通过父容器外部实现
                  )}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* SUCCESS 全局提示 */}
      {isSuccess && (
        <p className="mt-2 text-center text-xs font-medium text-emerald-600">✅ 全部完成</p>
      )}
      {isFailed && (
        <p className="mt-2 text-center text-xs font-medium text-red-500">❌ 处理失败</p>
      )}
      {isCancelled && (
        <p className="mt-2 text-center text-xs font-medium text-slate-500">⏹ 已取消</p>
      )}
    </div>
  )
}

export default ProcessingStepper

