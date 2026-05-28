/** 前端 link preview fetcher — 调用后端 GET /link-preview */

export interface LinkPreviewResult {
  title: string | null
  description: string | null
  image_url: string | null
  source: 'bili' | 'og' | 'fallback'
}

export async function fetchLinkPreview(url: string): Promise<LinkPreviewResult> {
  const resp = await fetch(`/link-preview?url=${encodeURIComponent(url)}`)
  if (!resp.ok) {
    return { title: null, description: null, image_url: null, source: 'fallback' }
  }
  return resp.json()
}
