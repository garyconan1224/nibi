import { useEffect, useRef, useCallback } from 'react'
import { useTaskStore } from '@/store/taskStore'
import { http } from '@/services/client'
import type { TaskRecord, TaskListResponse } from '@/types/task'

interface UsePipelineTasksOptions {
  projectId?: string
  pollInterval?: number // 毫秒，默认 3000
  enabled?: boolean
}

/**
 * Hook：轮询后端任务列表，实时更新 Zustand store
 *
 * 使用场景：任务中心 (TaskDashboard) 中轮询所有任务
 * SSE 细粒度日志推送由 TaskLogViewer 单独处理
 */
export const usePipelineTasks = (options: UsePipelineTasksOptions = {}) => {
  const {
    projectId,
    pollInterval = 3000,
    enabled = true,
  } = options

  const { setTasks, setIsPolling } = useTaskStore()
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const isFirstRunRef = useRef(true)

  // 单次轮询请求
  const fetchTasks = useCallback(async () => {
    try {
      const url = '/pipeline/tasks'
      const params = projectId ? { project_id: projectId } : {}
      const resp = await http.get<TaskListResponse>(url, { params })

      const tasksData = resp.data.data || []
      // 后端返回数组，但 Response 中的 data 字段可能是 { data: [...] } 结构
      const tasks: TaskRecord[] = Array.isArray(tasksData)
        ? tasksData
        : tasksData && typeof tasksData === 'object' && 'data' in tasksData
          ? (tasksData as any).data
          : []

      setTasks(tasks)
      isFirstRunRef.current = false
    } catch (error) {
      console.error('Failed to fetch pipeline tasks:', error)
      isFirstRunRef.current = false
    }
  }, [projectId, setTasks])

  // 启动/停止轮询
  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      setIsPolling(false)
      return
    }

    // 立即执行一次
    fetchTasks()
    setIsPolling(true)

    // 然后启动定时轮询
    intervalRef.current = setInterval(fetchTasks, pollInterval)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      setIsPolling(false)
    }
  }, [enabled, pollInterval, fetchTasks, setIsPolling])

  return { fetchTasks }
}

