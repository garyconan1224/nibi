import { type FC } from 'react'
import { Clapperboard, Info } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useTaskStore } from '@/store/taskStore'

/**
 * StoryboardPanel
 *
 * 当当前选中任务的 task_type === 'storyboard' 时由 HomeLayout 右栏渲染。
 * 分镜任务的 result 约定包含 A/B/C 三个候选方案（storyboard_generator 产出）；
 * 这里用 Tabs 承载，并对任一方案缺失/格式不符做容错占位。
 */
const PLANS = ['A', 'B', 'C'] as const

const StoryboardPanel: FC = () => {
  const currentTask = useTaskStore((s) => s.getCurrentTask())

  if (!currentTask) {
    return <EmptyHint text="尚未选中任何任务" />
  }
  if (currentTask.task_type !== 'storyboard') {
    return (
      <EmptyHint
        text={`当前任务类型为 "${currentTask.task_type}"，请选择一个 storyboard 任务`}
      />
    )
  }

  const storyboard = (currentTask.result ?? {}) as Record<string, unknown>

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto w-full max-w-3xl px-6 py-8">
        <header className="mb-6 flex items-center gap-2 border-b border-neutral-200 pb-3">
          <Clapperboard className="h-5 w-5 text-indigo-500" />
          <h2 className="text-lg font-semibold text-gray-800">分镜候选方案</h2>
          <span className="ml-auto font-mono text-xs text-muted-foreground">
            {currentTask.task_id.slice(0, 8)}…
          </span>
        </header>

        <Tabs defaultValue="A" className="w-full">
          <TabsList>
            {PLANS.map((p) => (
              <TabsTrigger key={p} value={p}>
                方案 {p}
              </TabsTrigger>
            ))}
          </TabsList>
          {PLANS.map((p) => {
            const plan = storyboard[p] ?? storyboard[`plan_${p}`]
            return (
              <TabsContent key={p} value={p} className="mt-3">
                <PlanContent plan={plan} />
              </TabsContent>
            )
          })}
        </Tabs>
      </div>
    </ScrollArea>
  )
}

const PlanContent: FC<{ plan: unknown }> = ({ plan }) => {
  if (plan == null) {
    return <p className="text-xs text-muted-foreground">（后端暂未回填此方案）</p>
  }
  if (typeof plan === 'string') {
    return <p className="whitespace-pre-wrap text-sm text-gray-800">{plan}</p>
  }
  return (
    <pre className="overflow-auto rounded bg-neutral-50 p-3 text-xs text-gray-700">
      {JSON.stringify(plan, null, 2)}
    </pre>
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

export default StoryboardPanel

