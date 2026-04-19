import { create } from 'zustand'
import type { TaskRecord } from '@/types/task'

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

export const useTaskStore = create<TaskStoreState>((set, get) => ({
  tasks: [],
  currentTaskId: null,
  isPolling: false,

  setTasks: (tasks) => set({ tasks }),

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
}))

