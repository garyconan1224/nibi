import { type FC } from 'react'
import { Eye, Info } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useTaskStore } from '@/store/taskStore'

/**
 * AnalyzeView
 *
 * 当当前选中任务的 task_type === 'analyze' 时，由 HomeLayout 右栏主区
 * 渲染本组件。当前为 MVP 骨架：读取 currentTask.result 的关键字段展示，
 * 无数据时给出占位引导。后续可逐步补全分镜时间轴、抽帧网格等视图。
 */
const AnalyzeView: FC = () => {
  const currentTask = useTaskStore((s) => s.getCurrentTask())

  if (!currentTask) {
    return <EmptyHint text="尚未选中任何任务" />
  }
  if (currentTask.task_type !== 'analyze') {
    return (
      <EmptyHint text={`当前任务类型为 "${currentTask.task_type}"，请选择一个 analyze 任务`} />
    )
  }

  const result = currentTask.result ?? {}
  // 后端 analyze handler 的 result 字段尚在演进，以下字段按"若有则展示"容错读取
  const summary = (result as Record<string, unknown>).summary as string | undefined
  const keyframes = (result as Record<string, unknown>).keyframes as
    | Array<{ ts?: string; caption?: string }>
    | undefined

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto w-full max-w-3xl px-6 py-8">
        <header className="mb-6 flex items-center gap-2 border-b border-neutral-200 pb-3">
          <Eye className="h-5 w-5 text-orange-500" />
          <h2 className="text-lg font-semibold text-gray-800">视觉分析结果</h2>
          <span className="ml-auto font-mono text-xs text-muted-foreground">
            {currentTask.task_id.slice(0, 8)}…
          </span>
        </header>

        <section className="mb-6">
          <h3 className="mb-2 text-sm font-medium text-gray-700">摘要</h3>
          {summary ? (
            <p className="whitespace-pre-wrap text-sm text-gray-800">{summary}</p>
          ) : (
            <p className="text-xs text-muted-foreground">（暂无摘要字段，任务仍在进行或后端尚未回填）</p>
          )}
        </section>

        <section>
          <h3 className="mb-2 text-sm font-medium text-gray-700">关键帧</h3>
          {keyframes && keyframes.length > 0 ? (
            <ul className="space-y-2">
              {keyframes.map((kf, i) => (
                <li key={i} className="rounded border border-neutral-100 bg-neutral-50 p-2">
                  <span className="mr-2 font-mono text-xs text-muted-foreground">{kf.ts ?? '--:--'}</span>
                  <span className="text-sm text-gray-800">{kf.caption ?? '(无描述)'}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">（暂无 keyframes 字段）</p>
          )}
        </section>
      </div>
    </ScrollArea>
  )
}

const EmptyHint: FC<{ text: string }> = ({ text }) => (
  <div className="flex h-full items-center justify-center">
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Info className="h-4 w-4" />
      <span>{text}</span>
    </div>
  </div>
)

export default AnalyzeView

