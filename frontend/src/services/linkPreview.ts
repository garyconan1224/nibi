/** 前端 link preview fetcher — 调用后端 GET /link-preview */

import { http } from './client'

export interface LinkPreviewResult {
  title: string | null
  description: string | null
  image_url: string | null
  source: 'bili' | 'og' | 'fallback'
}

export interface LinkPreviewWithContent extends LinkPreviewResult {
  content: string
  word_count: number
}

export async function fetchLinkPreview(url: string): Promise<LinkPreviewResult> {
  try {
    const { data } = await http.get<LinkPreviewResult>('/link-preview', { params: { url } })
    return data
  } catch {
    return { title: null, description: null, image_url: null, source: 'fallback' }
  }
}

export async function fetchLinkPreviewWithContent(url: string): Promise<LinkPreviewWithContent> {
  try {
    const { data } = await http.get<LinkPreviewWithContent>('/link-preview', {
      params: { url, include_content: true },
    })
    return data
  } catch {
    return { title: null, description: null, image_url: null, source: 'fallback', content: '', word_count: 0 }
  }
}
