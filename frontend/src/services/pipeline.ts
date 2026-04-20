import type { TaskCreateRequest, TaskCreateResponse } from '@/types/task'
import { http } from './client'

/** POST /pipeline/tasks 请求路径 */
const PIPELINE_TASKS_URL = '/pipeline/tasks'

/**
 * 创建 pipeline 任务
 *
 * 请求体（TaskCreateRequest）：
 *   - project_id  : string             — 项目 ID（crypto.randomUUID()）
 *   - task_type   : 'download'|'analyze'|'create'|'storyboard'
 *   - payload     : AnalyzePayload | DownloadPayload
 *
 * analyze payload 新增字段：
 *   - model_name          : string     — 模型标识，如 "gpt-4o-mini"
 *   - provider_id         : string     — 提供商 ID，如 "openai"
 *   - quality             : 'fast'|'medium'|'slow'
 *   - format              : string[]   — ['bulleted','mindmap','quiz','summary','key_points']
 *   - style               : 'academic'|'minimalist'|'creative'
 *   - screenshot          : boolean    — 是否插入截图
 *   - link                : boolean    — 是否保留原始链接
 *   - video_understanding : boolean    — 是否开启视觉理解
 *   - video_interval      : number     — 抽帧间隔（秒）
 *   - grid_size           : [number, number] — 网格拼图 [列, 行]
 *   - extras              : string?    — 额外 prompt
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

