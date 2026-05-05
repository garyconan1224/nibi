// workspaces API 客户端——对应 backend/app/routes/workspaces.py
//
// 与 services/pipeline.ts 同风格：
//   - 走全局 http (axios) 实例
//   - 函数返回解析后的 .data
//   - 出错由 axios 抛，调用方用 try/catch 或 react-query 的 error 处理

import { http } from './client'
import type {
  ItemAddRequest,
  PreflightSaveRequest,
  StartItemResponse,
  WorkspaceCreateRequest,
  WorkspaceRecord,
  WorkspaceUpdateRequest,
} from '@/types/workspace'

const BASE = '/workspaces'

/** GET /workspaces — 列表，可按 project_id 过滤 */
export async function listWorkspaces(projectId?: string): Promise<WorkspaceRecord[]> {
  const params = projectId ? { project_id: projectId } : undefined
  const res = await http.get<WorkspaceRecord[]>(BASE, { params })
  return res.data
}

/** GET /workspaces/{id} — 详情 */
export async function getWorkspace(workspaceId: string): Promise<WorkspaceRecord> {
  const res = await http.get<WorkspaceRecord>(`${BASE}/${workspaceId}`)
  return res.data
}

/** POST /workspaces — 创建 */
export async function createWorkspace(
  req: WorkspaceCreateRequest,
): Promise<WorkspaceRecord> {
  const res = await http.post<WorkspaceRecord>(BASE, req)
  return res.data
}

/** PATCH /workspaces/{id} — 更新名称 / 状态 / 背景信息 */
export async function updateWorkspace(
  workspaceId: string,
  req: WorkspaceUpdateRequest,
): Promise<WorkspaceRecord> {
  const res = await http.patch<WorkspaceRecord>(`${BASE}/${workspaceId}`, req)
  return res.data
}

/** DELETE /workspaces/{id} — 删除 */
export async function deleteWorkspace(workspaceId: string): Promise<void> {
  await http.delete(`${BASE}/${workspaceId}`)
}

/** POST /workspaces/{id}/items — 添加素材 */
export async function addWorkspaceItem(
  workspaceId: string,
  req: ItemAddRequest,
): Promise<WorkspaceRecord> {
  const res = await http.post<WorkspaceRecord>(`${BASE}/${workspaceId}/items`, req)
  return res.data
}

/** DELETE /workspaces/{id}/items/{itemId} — 移除素材 */
export async function removeWorkspaceItem(
  workspaceId: string,
  itemId: string,
): Promise<WorkspaceRecord> {
  const res = await http.delete<WorkspaceRecord>(
    `${BASE}/${workspaceId}/items/${itemId}`,
  )
  return res.data
}

/** POST /workspaces/{id}/favorites/{itemId} — 收藏 */
export async function favoriteItem(
  workspaceId: string,
  itemId: string,
): Promise<WorkspaceRecord> {
  const res = await http.post<WorkspaceRecord>(
    `${BASE}/${workspaceId}/favorites/${itemId}`,
  )
  return res.data
}

/** DELETE /workspaces/{id}/favorites/{itemId} — 取消收藏 */
export async function unfavoriteItem(
  workspaceId: string,
  itemId: string,
): Promise<WorkspaceRecord> {
  const res = await http.delete<WorkspaceRecord>(
    `${BASE}/${workspaceId}/favorites/${itemId}`,
  )
  return res.data
}

/** PUT /workspaces/{id}/items/{itemId}/preflight — 保存前置配置 */
export async function savePreflight(
  workspaceId: string,
  itemId: string,
  req: PreflightSaveRequest,
): Promise<WorkspaceRecord> {
  const res = await http.put<WorkspaceRecord>(
    `${BASE}/${workspaceId}/items/${itemId}/preflight`,
    req,
  )
  return res.data
}

/** POST /workspaces/{id}/items/{itemId}/start — 触发 pipeline 任务 */
export async function startItemPipeline(
  workspaceId: string,
  itemId: string,
): Promise<StartItemResponse> {
  const res = await http.post<StartItemResponse>(
    `${BASE}/${workspaceId}/items/${itemId}/start`,
  )
  return res.data
}
