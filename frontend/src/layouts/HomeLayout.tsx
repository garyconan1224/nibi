import { type FC, Suspense, lazy, useRef, useState } from 'react'
import { SlidersHorizontal, PanelLeftClose, PanelLeftOpen, History as HistoryIcon } from 'lucide-react'
import TaskDashboard from '@/pages/HomePage/TaskDashboard'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip.tsx'
import { Link } from 'react-router-dom'
import { ResizablePanel, ResizablePanelGroup, ResizableHandle } from '@/components/ui/resizable'
import { ScrollArea } from '@/components/ui/scroll-area.tsx'
import { Skeleton } from '@/components/ui/skeleton'
import type { ImperativePanelHandle } from 'react-resizable-panels'
import { useBackendHealth } from '@/hooks/useBackendHealth'
import ThemeSwitcher from '@/components/ThemeSwitcher'
import ProjectSwitcher from '@/components/ProjectSwitcher'
import { useTaskStore } from '@/store/taskStore'

// 组件级代码分割：重型组件全部改为 lazy，避免首次进入 /home 就拉 markdown/form/export vendor
const NoteForm = lazy(() => import('@/pages/HomePage/NoteForm'))
const MarkdownViewer = lazy(() => import('@/pages/HomePage/MarkdownViewer'))
const AnalyzeView = lazy(() => import('@/pages/HomePage/AnalyzeView'))
const StoryboardPanel = lazy(() => import('@/pages/HomePage/StoryboardPanel'))

// 左栏 NoteForm 懒加载时的骨架屏占位
const NoteFormFallback: FC = () => (
  <div className="space-y-3">
    <Skeleton className="h-9 w-full" />
    <Skeleton className="h-24 w-full" />
    <Skeleton className="h-9 w-2/3" />
    <Skeleton className="h-9 w-full" />
  </div>
)

// 右栏主面板切换时的骨架屏占位
const MainPaneFallback: FC = () => (
  <div className="flex h-full flex-col gap-4 px-8 py-6">
    <Skeleton className="h-6 w-1/3" />
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-11/12" />
    <Skeleton className="h-4 w-4/5" />
    <Skeleton className="h-64 w-full" />
  </div>
)

/**
 * 按当前选中任务的 task_type 决定右栏主面板组件。
 * - analyze    → AnalyzeView
 * - storyboard → StoryboardPanel
 * - 其它（note/download/create/未选中） → MarkdownViewer（默认笔记视图）
 *
 * 每个分支组件均为 lazy，外层统一 Suspense 以便类型切换时有平滑占位。
 */
const MainPaneByTaskType: FC = () => {
  const currentTask = useTaskStore((s) => s.getCurrentTask())
  const type = currentTask?.task_type
  const node =
    type === 'analyze' ? <AnalyzeView />
      : type === 'storyboard' ? <StoryboardPanel />
        : <MarkdownViewer />
  return <Suspense fallback={<MainPaneFallback />}>{node}</Suspense>
}

const HomeLayout: FC = () => {
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false)
  const [isMiddleCollapsed, setIsMiddleCollapsed] = useState(false)
  const leftPanelRef = useRef<ImperativePanelHandle>(null)
  const middlePanelRef = useRef<ImperativePanelHandle>(null)
  const health = useBackendHealth()

  return (
    <div className="h-screen w-screen overflow-hidden">
      <ResizablePanelGroup direction="horizontal" className="h-full w-full">
        {/* 左栏 */}
        <ResizablePanel
          ref={leftPanelRef}
          defaultSize={30}
          minSize={10}
          maxSize={40}
          collapsible
          collapsedSize={0}
          onCollapse={() => setIsLeftCollapsed(true)}
          onExpand={() => setIsLeftCollapsed(false)}
        >
          <aside className="flex h-full flex-col overflow-hidden border-r border-neutral-200 bg-white">
            <header className="flex h-16 items-center justify-between px-6">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl bg-slate-200">
                  <span className="text-sm font-bold">VM</span>
                </div>
                <div className="text-2xl font-bold text-gray-800">VidMirror</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  {health === null ? '检测中...' : health ? '✅ 后端在线' : '❌ 后端离线'}
                </span>
                <div className="flex items-center gap-1">
                  <ThemeSwitcher />
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => leftPanelRef.current?.collapse()}
                          className="text-muted-foreground hover:text-primary cursor-pointer rounded p-1 hover:bg-neutral-100"
                        >
                          <PanelLeftClose className="h-5 w-5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <span>收起</span>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Link to={'/settings'}>
                          <SlidersHorizontal className="text-muted-foreground hover:text-primary cursor-pointer h-5 w-5" />
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent>
                        <span>设置</span>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </header>
            <div className="border-b border-neutral-100 px-4 py-2">
              <ProjectSwitcher />
            </div>
            <ScrollArea className="flex-1 overflow-auto">
              <div className="p-4">
                <Suspense fallback={<NoteFormFallback />}>
                  <NoteForm />
                </Suspense>
              </div>
            </ScrollArea>
          </aside>
        </ResizablePanel>

        <ResizableHandle />

        {/* 左栏折叠时的展开按钮 */}
        {isLeftCollapsed && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => leftPanelRef.current?.expand()}
                  className="flex h-full w-8 shrink-0 items-center justify-center border-r border-neutral-200 bg-white hover:bg-neutral-50"
                >
                  <PanelLeftOpen className="h-4 w-4 text-muted-foreground" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <span>展开</span>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* 中栏 */}
        <ResizablePanel
          ref={middlePanelRef}
          defaultSize={20}
          minSize={10}
          maxSize={40}
          collapsible
          collapsedSize={0}
          onCollapse={() => setIsMiddleCollapsed(true)}
          onExpand={() => setIsMiddleCollapsed(false)}
        >
          <aside className="flex h-full flex-col overflow-hidden border-r border-neutral-200 bg-white">
            <header className="flex h-10 shrink-0 items-center justify-between border-b border-neutral-100 px-3">
              <span className="text-sm font-medium text-gray-600">任务中心</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => middlePanelRef.current?.collapse()}
                      className="text-muted-foreground hover:text-primary cursor-pointer rounded p-1 hover:bg-neutral-100"
                    >
                      <PanelLeftClose className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <span>收起</span>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </header>
            <div className="flex-1 overflow-hidden">
              <TaskDashboard />
            </div>
          </aside>
        </ResizablePanel>

        <ResizableHandle />

        {/* 中栏折叠时的展开按钮 */}
        {isMiddleCollapsed && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => middlePanelRef.current?.expand()}
                  className="flex h-full w-8 shrink-0 items-center justify-center border-r border-neutral-200 bg-white hover:bg-neutral-50"
                >
                  <HistoryIcon className="h-4 w-4 text-muted-foreground" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <span>展开</span>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* 右栏：按当前任务类型路由分发 */}
        <ResizablePanel defaultSize={50} minSize={30}>
          <main className="flex h-full flex-col overflow-hidden bg-white">
            <MainPaneByTaskType />
          </main>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}

export default HomeLayout

