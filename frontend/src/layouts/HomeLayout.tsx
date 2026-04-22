import { type FC, Suspense, lazy, useState, useMemo } from 'react'
import { FilePlus2, PlayCircle } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Section } from '@/components/ui/section'
import { EmptyState } from '@/components/ui/empty-state'
import WorkbenchShell from '@/layouts/WorkbenchShell'
import TasksDrawer from '@/pages/HomePage/TasksDrawer'
import { useTaskStore } from '@/store/taskStore'
import { isTaskTerminal } from '@/types/task'

/*
 * HomeLayout · 作业台单页结构（重构版）。
 *
 * 替代原 BiliNote 式三栏 ResizablePanelGroup：
 * - 顶部 WorkbenchShell 承载 Header（品牌/健康/项目/任务按钮/主题/语言/设置）；
 * - 主内容以 mx-auto max-w-5xl 纵列组合 Section：新建任务 + 处理结果；
 * - 任务中心迁移为右侧 TasksDrawer，由 Header 的"任务"按钮唤出。
 *
 * 结果区按 currentTask.task_type 路由到 AnalyzeView / StoryboardPanel /
 * MarkdownViewer，保持既有后端结果渲染契约。
 */

const NoteForm = lazy(() => import('@/pages/HomePage/NoteForm'))
const MarkdownViewer = lazy(() => import('@/pages/HomePage/MarkdownViewer'))
const AnalyzeView = lazy(() => import('@/pages/HomePage/AnalyzeView'))
const StoryboardPanel = lazy(() => import('@/pages/HomePage/StoryboardPanel'))

const NoteFormFallback: FC = () => (
  <div className="space-y-3">
    <Skeleton className="h-9 w-full" />
    <Skeleton className="h-24 w-full" />
    <Skeleton className="h-9 w-2/3" />
    <Skeleton className="h-9 w-full" />
  </div>
)

const ResultFallback: FC = () => (
  <div className="space-y-3 p-2">
    <Skeleton className="h-5 w-1/3" />
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-11/12" />
    <Skeleton className="h-48 w-full" />
  </div>
)

/**
 * 结果区主 Pane：按 task_type 路由
 * - analyze    → AnalyzeView
 * - storyboard → StoryboardPanel
 * - 其它       → MarkdownViewer
 *
 * 空任务态由外层 HomeLayout 统一渲染 EmptyState，避免在每个视图内部重复处理。
 */
const MainPaneByTaskType: FC = () => {
  const currentTask = useTaskStore((s) => s.getCurrentTask())
  const type = currentTask?.task_type
  const node =
    type === 'analyze' ? <AnalyzeView />
      : type === 'storyboard' ? <StoryboardPanel />
        : <MarkdownViewer />
  return <Suspense fallback={<ResultFallback />}>{node}</Suspense>
}

const HomeLayout: FC = () => {
  const [tasksOpen, setTasksOpen] = useState(false)
  const tasks = useTaskStore((s) => s.tasks)
  const currentTask = useTaskStore((s) => s.getCurrentTask())

  const activeTaskCount = useMemo(
    () => tasks.filter((t) => !isTaskTerminal(t.status)).length,
    [tasks],
  )

  return (
    <WorkbenchShell
      activeTaskCount={activeTaskCount}
      onOpenTasks={() => setTasksOpen(true)}
    >
      <div className="mx-auto w-full max-w-5xl space-y-8 p-6">
        {/* 页面标题 · 与 SettingsShell 子页规范一致 */}
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">
            视频作业台
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            粘贴链接或上传本地音视频，一站式完成下载、转录、视觉分析与笔记生成。
          </p>
        </div>

        {/* Section 1 · 新建任务 */}
        <Section
          title="新建任务"
          description="填写来源与参数，点击「开始处理」提交到处理队列。"
          icon={<FilePlus2 className="size-4" />}
        >
          <div className="rounded-lg border border-border bg-card p-5 text-card-foreground shadow-xs">
            <Suspense fallback={<NoteFormFallback />}>
              <NoteForm />
            </Suspense>
          </div>
        </Section>

        {/* Section 2 · 处理结果 */}
        <Section
          title="处理结果"
          description={
            currentTask
              ? `当前查看：${currentTask.task_type} · #${currentTask.task_id.slice(0, 8)}`
              : '选中任一任务后将在此展示笔记、分析或分镜产物。'
          }
          icon={<PlayCircle className="size-4" />}
        >
          <div className="min-h-[320px] overflow-hidden rounded-lg border border-border bg-card text-card-foreground">
            {currentTask ? (
              <MainPaneByTaskType />
            ) : (
              <div className="p-6">
                <EmptyState
                  title="暂未选中任务"
                  description="点击右上角「任务」查看历史与进行中的处理，选择其一以展开结果。"
                />
              </div>
            )}
          </div>
        </Section>
      </div>

      <TasksDrawer
        open={tasksOpen}
        onClose={() => setTasksOpen(false)}
      />
    </WorkbenchShell>
  )
}

export default HomeLayout

