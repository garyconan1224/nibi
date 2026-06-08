/** Provider 列表 API（用于总结弹窗选模型）。 */

import http from './client'

export interface ProviderInfo {
  id: string
  name: string
  kind: string
  enabled: boolean
  capabilities: string[]
  base_url: string
  has_api_key: boolean
}

/** GET /providers — 获取所有已启用的 provider。 */
export async function listProviders(): Promise<ProviderInfo[]> {
  const { data } = await http.get<ProviderInfo[]>('/providers')
  return data.filter((p) => p.enabled && p.capabilities.includes('chat'))
}
