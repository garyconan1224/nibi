import { FC, useMemo, useState } from 'react'
import { RefreshCw, ListChecks, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useTaskStore } from '@/store/taskStore'
import { usePipelineTasks } from '@/hooks/usePipelineTasks'
import TaskItem from './TaskItem'

interface TaskDashboardProps {
  /** 可选项目 ID 过滤 */
  projectId?: string
}

/**
 * TaskDashboard
 *
 * 任务中心面板：
 * - 使用 usePipelineTasks() 每 3s 自动轮询 /pipeline/tasks
 * - 按 updated_at 倒序排列任务列表
 * - 支持项目 ID 文本过滤、手动刷新
 */
const TaskDashboard: FC<TaskDashboardProps> = ({ projectId }) => {
  const [filterText, setFilterText] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)

  const tasks = useTaskStore((s) => s.tasks)
  const isPolling = useTaskStore((s) => s.isPolling)
  const setCurrentTask = useTaskStore((s) => s.setCurrentTask)

  const { fetchTasks } = usePipelineTasks({ projectId, enabled: true })

  // 手动刷新
  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchTasks()
    setTimeout(() => setIsRefreshing(false), 600)
  }

  // 过滤 + 倒序排列
  const sortedTasks = useMemo(() => {
    const lower = filterText.trim().toLowerCase()
    return [...tasks]
      .filter((t) => {
        if (!lower) return true
        return (
          t.task_id.toLowerCase().includes(lower) ||
          t.task_type.toLowerCase().includes(lower) ||
          t.status.toLowerCase().includes(lower)
        )
      })
      .sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      )
  }, [tasks, filterText])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ── 顶部栏 ── */}
      <header className="flex shrink-0 items-center gap-2 border-b border-neutral-100 px-3 py-2">
        <ListChecks className="h-4 w-4 shrink-0 text-gray-500" />
        <span className="text-sm font-semibold text-gray-700">任务中心</span>

        {/* 实时轮询指示 */}
        {isPolling && (
          <span className="ml-auto flex items-center gap-1 text-[10px] text-gray-400">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
            轮询中
          </span>
        )}

        {/* 手动刷新按钮 */}
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing}
          title="刷新任务列表"
          className={cn(
            'ml-1 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed',
            isRefreshing && 'animate-spin text-blue-500',
          )}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </header>

      {/* ── 搜索框 ── */}
      <div className="shrink-0 px-3 py-2">
        <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5">
          <Search className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          <input
            type="text"
            placeholder="搜索任务 ID / 类型 / 状态…"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="flex-1 bg-transparent text-xs text-gray-700 outline-none placeholder:text-gray-400"
          />
        </div>
      </div>

      {/* ── 任务列表 ── */}
      <ScrollArea className="flex-1 overflow-hidden">
        <div className="space-y-2 px-3 pb-4">
          {sortedTasks.length === 0 ? (
            <div className="py-12 text-center">
              <ListChecks className="mx-auto mb-2 h-8 w-8 text-gray-200" />
              <p className="text-xs text-gray-400">
                {filterText ? '没有匹配的任务' : '暂无任务记录'}
              </p>
            </div>
          ) : (
            sortedTasks.map((task) => (
              <TaskItem
                key={task.task_id}
                task={task}
                onSelect={() => setCurrentTask(task.task_id)}
              />
            ))
          )}
        </div>
      </ScrollArea>

      {/* ── 底部统计 ── */}
      <div className="shrink-0 border-t border-neutral-100 px-3 py-1.5 text-[10px] text-gray-400">
        共 {tasks.length} 条任务
        {filterText && sortedTasks.length !== tasks.length && (
          <span>，过滤后 {sortedTasks.length} 条</span>
        )}
      </div>
    </div>
  )
}

export default TaskDashboard

