/** 总结 CRUD API。 */

import http from './client'

export interface ItemSummary {
  summary_id: string
  template: string
  version: number
  name: string
  background_for_summary: string
  content_md: string
  model_used: string
  created_at: string
}

/** GET 列表（按 template 分组，按 version 排序）。 */
export async function listSummaries(
  workspaceId: string,
  itemId: string,
): Promise<ItemSummary[]> {
  const { data } = await http.get<ItemSummary[]>(
    `/workspaces/${workspaceId}/items/${itemId}/summaries`,
  )
  return data
}

/** POST 同步生成一份总结（可能耗时 5-15s）。 */
export async function createSummary(
  workspaceId: string,
  itemId: string,
  template: string,
  background_for_summary = '',
): Promise<ItemSummary> {
  const { data } = await http.post<ItemSummary>(
    `/workspaces/${workspaceId}/items/${itemId}/summaries`,
    { template, background_for_summary },
    { timeout: 120_000 },  // LLM 调用可能慢
  )
  return data
}

/** GET 单份详情。 */
export async function getSummary(
  workspaceId: string,
  itemId: string,
  summaryId: string,
): Promise<ItemSummary> {
  const { data } = await http.get<ItemSummary>(
    `/workspaces/${workspaceId}/items/${itemId}/summaries/${summaryId}`,
  )
  return data
}

/** DELETE 硬删。 */
export async function deleteSummary(
  workspaceId: string,
  itemId: string,
  summaryId: string,
): Promise<void> {
  await http.delete(
    `/workspaces/${workspaceId}/items/${itemId}/summaries/${summaryId}`,
  )
}

/** PATCH 改名（空字符串 = 清除自定义名）。 */
export async function renameSummary(
  workspaceId: string,
  itemId: string,
  summaryId: string,
  name: string,
): Promise<ItemSummary> {
  const { data } = await http.patch<ItemSummary>(
    `/workspaces/${workspaceId}/items/${itemId}/summaries/${summaryId}`,
    { name },
  )
  return data
}
