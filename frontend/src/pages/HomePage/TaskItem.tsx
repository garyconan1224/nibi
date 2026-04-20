import { useState, type FC } from 'react'
import { ChevronDown, ChevronUp, AlertCircle, Info, AlertTriangle, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  type TaskRecord,
  type TaskLogEntry,
  getStatusText,
  getStatusColor,
  isTaskTerminal,
} from '@/types/task'
import { useTaskStore } from '@/store/taskStore'
import ProcessingStepper from './ProcessingStepper'
import TaskLogViewer from './TaskLogViewer'

// 日志等级图标
const LOG_LEVEL_ICON: Record<TaskLogEntry['level'], FC<{ className?: string }>> = {
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
}

// 日志等级颜色
const LOG_LEVEL_COLOR: Record<TaskLogEntry['level'], string> = {
  info: 'text-sky-400',
  warning: 'text-amber-400',
  error: 'text-red-400',
}

interface TaskItemProps {
  task: TaskRecord
  /** 点击卡片回调（可选） */
  onSelect?: () => void
}

/**
 * TaskItem
 *
 * 单任务卡片：
 * - 头部：task_type、task_id（截断）、status 标签、进度百分比
 * - 正文：ProcessingStepper（仅处理中任务显示）
 * - 底部：可折叠的日志区（静态历史 log[]）
 * - 若任务正在进行，展开后显示实时 TaskLogViewer（SSE）
 */
const TaskItem: FC<TaskItemProps> = ({ task, onSelect }) => {
  const [expanded, setExpanded] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const cancelTask = useTaskStore((s) => s.cancelTask)

  const isActive = !isTaskTerminal(task.status) && task.status !== 'PENDING'
  // 仅 PENDING / DOWNLOADING / ANALYZING / SUMMARIZING 状态可取消
  const isCancellable = !isTaskTerminal(task.status)

  const handleCancel = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setCancelling(true)
    await cancelTask(task.task_id)
    setCancelling(false)
  }
  const shortId = task.task_id.slice(0, 8)
  const progressPct = Math.round(task.progress * 100)

  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation()
    setExpanded((prev) => !prev)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === 'Enter' && onSelect?.()}
      className={cn(
        'group cursor-pointer rounded-xl border border-neutral-200 bg-white transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
        onSelect && 'hover:border-blue-200',
      )}
    >
      {/* ── 头部 ── */}
      <div className="flex items-center gap-3 px-4 pt-3 pb-2">
        {/* 任务类型 + 短 ID */}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="truncate text-sm font-semibold capitalize text-gray-800">
              {task.task_type}
            </span>
            <span className="shrink-0 font-mono text-[10px] text-gray-400">#{shortId}</span>
          </div>
          {/* 进度百分比（活跃时显示） */}
          {isActive && (
            <div className="mt-1 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="shrink-0 text-[11px] text-blue-600">{progressPct}%</span>
            </div>
          )}
        </div>

        {/* Status 标签 */}
        <span
          className={cn(
            'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium',
            getStatusColor(task.status),
          )}
        >
          {getStatusText(task.status)}
        </span>

        {/* 取消按钮（仅非终结状态显示） */}
        {isCancellable && (
          <button
            type="button"
            aria-label="取消任务"
            onClick={handleCancel}
            disabled={cancelling}
            title="取消任务"
            className="shrink-0 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {/* 展开日志按钮 */}
        <button
          type="button"
          aria-label={expanded ? '收起日志' : '展开日志'}
          onClick={toggleExpand}
          className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* ── 步骤条（活跃任务） ── */}
      {isActive && (
        <div className="px-4 pb-2">
          <ProcessingStepper status={task.status} progress={task.progress} />
        </div>
      )}

      {/* ── 展开区域：日志 ── */}
      {expanded && (
        <div className="border-t border-neutral-100">
          {/* 活跃任务：使用 SSE 实时日志 */}
          {isActive ? (
            <TaskLogViewer taskId={task.task_id} />
          ) : (
            /* 已完成任务：渲染历史静态日志 */
            <div className="max-h-48 overflow-y-auto bg-gray-950 px-4 py-3 font-mono text-xs">
              {task.log.length === 0 ? (
                <p className="text-gray-500">暂无日志</p>
              ) : (
                task.log.map((entry, i) => {
                  const LevelIcon = LOG_LEVEL_ICON[entry.level]
                  return (
                    <div key={i} className="mb-1 flex items-start gap-2">
                      <LevelIcon
                        className={cn('mt-0.5 h-3 w-3 shrink-0', LOG_LEVEL_COLOR[entry.level])}
                      />
                      <span className="text-gray-500">{entry.ts.slice(11, 19)}</span>
                      <span className={cn('break-all', LOG_LEVEL_COLOR[entry.level])}>
                        {entry.message}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default TaskItem

