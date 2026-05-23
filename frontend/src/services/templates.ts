// 视频模板 API 客户端——对应 backend/app/routes/templates.py
import { http } from './client'

export interface VideoTemplateItem {
  template_id: string
  name: string
  prompt: string
  is_builtin: boolean
  created_at: string
  updated_at: string
}

const BASE = '/video-templates'

export async function fetchTemplates(): Promise<VideoTemplateItem[]> {
  const res = await http.get<VideoTemplateItem[]>(BASE)
  return res.data
}

export async function createTemplate(body: {
  name: string
  prompt: string
}): Promise<VideoTemplateItem> {
  const res = await http.post<VideoTemplateItem>(BASE, body)
  return res.data
}

export async function updateTemplate(
  templateId: string,
  body: { name: string; prompt: string },
): Promise<VideoTemplateItem> {
  const res = await http.put<VideoTemplateItem>(`${BASE}/${templateId}`, body)
  return res.data
}

export async function deleteTemplate(templateId: string): Promise<void> {
  await http.delete(`${BASE}/${templateId}`)
}

export async function duplicateTemplate(
  templateId: string,
  body: { source_prompt: string },
): Promise<VideoTemplateItem> {
  const res = await http.post<VideoTemplateItem>(
    `${BASE}/${templateId}/duplicate`,
    body,
  )
  return res.data
}
