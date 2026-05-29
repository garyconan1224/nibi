// Library 聚合端点 —— GET /workspaces/library
import { http } from './client'

export interface LibraryItem {
  item_id: string
  workspace_id: string
  workspace_name: string
  type: 'video' | 'audio' | 'image' | 'text'
  source: 'url' | 'local'
  source_value: string
  name: string
  status: 'pending' | 'processing' | 'done' | 'failed'
  created_at: string
  updated_at: string
  duration_seconds: number | null
  thumbnail: string | null
  results_summary: { has_summary: boolean; has_transcript: boolean }
  primary_task_status: string | null
  related_task_ids?: string[]
  uploader?: string | null
  has_subtitle?: boolean
  has_chapters?: boolean
  frames_count?: number
  audio_nature?: 'speech' | 'music' | null
}

export interface LibraryWorkspace {
  workspace_id: string
  name: string
  items_count: number
  items_count_by_type: Record<string, number>
  cover_thumbnail: string | null
  updated_at: string
  status: string
}

export interface LibraryResponse {
  items: LibraryItem[]
  workspaces: LibraryWorkspace[]
}

export async function fetchLibrary(
  includeTrashed = false,
): Promise<LibraryResponse> {
  const res = await http.get<LibraryResponse>('/workspaces/library', {
    params: includeTrashed ? { include_trashed: true } : undefined,
  })
  return res.data
}

export async function deleteItem(
  workspaceId: string,
  itemId: string,
): Promise<void> {
  await http.delete(`/workspaces/${workspaceId}/items/${itemId}`)
}

export async function batchDeleteItems(
  items: { workspace_id: string; item_id: string }[],
): Promise<{ removed: number; failed: number; removed_ids: string[] }> {
  const res = await http.post('/workspaces/items/batch-delete', { items })
  return res.data
}
