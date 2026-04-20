import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { TaskRecord } from '@/types/task'
import { isTaskTerminal } from '@/types/task'

interface TaskStoreState {
  // 状态
  tasks: TaskRecord[]
  currentTaskId: string | null
  isPolling: boolean

  // 操作
  setTasks: (tasks: TaskRecord[]) => void
  addTask: (task: TaskRecord) => void
  updateTask: (taskId: string, task: Partial<TaskRecord>) => void
  setCurrentTask: (taskId: string | null) => void
  setIsPolling: (isPolling: boolean) => void

  // 便利方法
  getTask: (taskId: string) => TaskRecord | undefined
  getCurrentTask: () => TaskRecord | undefined
}

export const useTaskStore = create<TaskStoreState>()(
  persist(
    (set, get) => ({
      tasks: [],
      currentTaskId: null,
      isPolling: false,

      // 用后端全量列表同步 store。
      // 防御逻辑：若后端返回空数组（网络抖动/重启），保留本地仍在追踪的非终结任务，
      // 避免进行中的任务因一次空响应被清空。
      setTasks: (incoming) =>
        set((state) => {
          if (incoming.length === 0) {
            // 后端返回空：仅保留本地非终结状态任务（下载中、等待中等）
            const activeLocally = state.tasks.filter((t) => !isTaskTerminal(t.status))
            return { tasks: activeLocally }
          }
          // 正常同步：以后端数据为准，同时将本地有但后端没有的非终结任务补回
          const backendIds = new Set(incoming.map((t) => t.task_id))
          const localOnlyActive = state.tasks.filter(
            (t) => !backendIds.has(t.task_id) && !isTaskTerminal(t.status)
          )
          return { tasks: [...incoming, ...localOnlyActive] }
        }),

      addTask: (task) =>
        set((state) => {
          // 如果已存在同 ID 的任务则更新，否则追加
          const existingIndex = state.tasks.findIndex((t) => t.task_id === task.task_id)
          if (existingIndex >= 0) {
            const newTasks = [...state.tasks]
            newTasks[existingIndex] = task
            return { tasks: newTasks }
          }
          return { tasks: [task, ...state.tasks] }
        }),

      updateTask: (taskId, updates) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.task_id === taskId ? { ...t, ...updates } : t
          ),
        })),

      setCurrentTask: (taskId) => set({ currentTaskId: taskId }),
      setIsPolling: (isPolling) => set({ isPolling }),

      getTask: (taskId) => {
        const tasks = get().tasks
        return tasks.find((t) => t.task_id === taskId)
      },

      getCurrentTask: () => {
        const state = get()
        if (!state.currentTaskId) return undefined
        return state.getTask(state.currentTaskId)
      },
    }),
    {
      name: 'task-storage',
      partialize: (state) => ({
        tasks: state.tasks,
      } as Pick<TaskStoreState, 'tasks'>),
    }
  )
)

