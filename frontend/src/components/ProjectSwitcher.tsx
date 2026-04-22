import { useMemo, type FC } from 'react'
import { FolderOpen } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useTaskStore } from '@/store/taskStore'
import { useProjectStore } from '@/store/projectStore'

/**
 * ProjectSwitcher
 *
 * 位于 HomeLayout 左栏顶部，用于在多个项目之间快速切换。选项来自当前
 * taskStore 中所有任务的 project_id 去重集合；选中值通过 projectStore
 * 广播给下游（TaskDashboard 等）做筛选。
 *
 * 说明：当前仓库只有"基于任务派生"的项目集合，尚无独立的 /projects 列表
 * API。若后续接入后端项目列表，仅需替换 options 数据源。
 */
const ProjectSwitcher: FC = () => {
  const tasks = useTaskStore((s) => s.tasks)
  const currentProjectId = useProjectStore((s) => s.currentProjectId)
  const setCurrentProjectId = useProjectStore((s) => s.setCurrentProjectId)

  const options = useMemo(() => {
    const ids = [...new Set(tasks.map((t) => t.project_id).filter(Boolean))]
    return ids
  }, [tasks])

  // Select 不接受空串作为 value，用 __ALL__ 哨兵代表"全部项目"
  const ALL = '__ALL__'
  const value = currentProjectId || ALL

  const handleChange = (next: string) => {
    setCurrentProjectId(next === ALL ? '' : next)
  }

  return (
    <div className="flex items-center gap-2">
      <FolderOpen className="h-4 w-4 text-muted-foreground" aria-hidden />
      <Select value={value} onValueChange={handleChange}>
        <SelectTrigger className="h-8 w-full text-xs" aria-label="切换当前项目">
          <SelectValue placeholder="全部项目" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>全部项目</SelectItem>
          {options.map((pid) => (
            <SelectItem key={pid} value={pid}>
              <span className="font-mono">{pid}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export default ProjectSwitcher

