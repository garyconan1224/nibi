import type { TaskCreateRequest, TaskCreateResponse } from '@/types/task'
import { http } from './client'

/** POST /pipeline/tasks 请求路径 */
const PIPELINE_TASKS_URL = '/pipeline/tasks'

/**
 * 创建 pipeline 任务
 *
 * 请求体（TaskCreateRequest）：
 *   - project_id  : string  — 项目 ID（可用 crypto.randomUUID() 生成）
 *   - task_type   : string  — 任务类型 download | analyze | create | storyboard
 *   - payload     : object  — 任务参数，create 类型传 { url: string }
 *
 * 响应体（TaskCreateResponse）：
 *   - status   : "accepted"
 *   - task_id  : string
 */
export async function createPipelineTask(
  req: TaskCreateRequest,
): Promise<TaskCreateResponse> {
  const res = await http.post<TaskCreateResponse>(PIPELINE_TASKS_URL, req)
  return res.data
}

