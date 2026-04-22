import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * 项目多开的最小状态源。
 *
 * - currentProjectId：当前选中的项目 ID；空串 '' 表示"全部项目"。
 * - 与 TaskDashboard 的筛选、ProjectSwitcher 的下拉值双向同步。
 * - 持久化到 localStorage，页面刷新保持上次选择。
 */
interface ProjectStoreState {
  currentProjectId: string
  setCurrentProjectId: (id: string) => void
}

export const useProjectStore = create<ProjectStoreState>()(
  persist(
    (set) => ({
      currentProjectId: '',
      setCurrentProjectId: (id: string) => set({ currentProjectId: id }),
    }),
    { name: 'project-storage' },
  ),
)

