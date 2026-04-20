import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { http } from '@/services/client'

/** Provider 条目（与后端 GET /providers 响应字段对齐） */
export interface ProviderItem {
  id: string          // 提供商唯一标识（provider_id）
  name: string        // 显示名称
  base_url: string    // 接口地址
  enabled: boolean    // 是否启用
  kind: string        // openai_compatible | anthropic | ...
  logo?: string       // 可选 logo URL
}

/** 从后端 /providers/{id}/models 返回的模型条目 */
export interface Model {
  id: string    // 模型唯一 ID（传给后端的 model_name）
  name: string  // 显示名称
}

interface ProviderStoreState {
  /** 提供商列表 */
  providers: ProviderItem[]
  /** 是否正在拉取 providers 中 */
  loading: boolean
  /** 最近一次拉取的错误信息 */
  error: string | null

  /**
   * 各 provider 的模型缓存。
   * key = provider_id，value = 该 provider 下的模型列表
   */
  providerModels: Record<string, Model[]>
  /** 正在拉取模型的 provider_id 集合 */
  modelsLoading: Record<string, boolean>

  /** 操作 */
  setProviders: (providers: ProviderItem[]) => void

  /** 从后端 GET /providers 拉取并更新列表，成功后自动拉取各 enabled provider 的模型 */
  fetchProviders: () => Promise<void>

  /** 拉取单个 provider 的可用模型并写入缓存 */
  fetchProviderModels: (provider_id: string) => Promise<void>
}

export const useProviderStore = create<ProviderStoreState>()(
  persist(
    (set, get) => ({
      providers: [],
      loading: false,
      error: null,
      providerModels: {},
      modelsLoading: {},

      setProviders: (providers) => set({ providers }),

      fetchProviders: async () => {
        set({ loading: true, error: null })
        try {
          const res = await http.get('/providers')
          const data: ProviderItem[] = res.data.data ?? res.data
          set({ providers: data, loading: false })
          // 对所有 enabled provider 自动拉取模型列表
          const enabledIds = data.filter(p => p.enabled).map(p => p.id)
          await Promise.all(enabledIds.map(id => get().fetchProviderModels(id)))
        } catch (e) {
          const msg = e instanceof Error ? e.message : '未知错误'
          set({ error: msg, loading: false })
        }
      },

      fetchProviderModels: async (provider_id: string) => {
        // 防止重复请求
        if (get().modelsLoading[provider_id]) return
        set(state => ({
          modelsLoading: { ...state.modelsLoading, [provider_id]: true },
        }))
        try {
          const res = await http.get(`/providers/${provider_id}/models`)
          const payload = res.data.data ?? res.data
          const models: Model[] = Array.isArray(payload.models) ? payload.models : []
          set(state => ({
            providerModels: { ...state.providerModels, [provider_id]: models },
            modelsLoading: { ...state.modelsLoading, [provider_id]: false },
          }))
        } catch {
          // 静默失败：保留空数组，不影响页面渲染
          set(state => ({
            providerModels: { ...state.providerModels, [provider_id]: [] },
            modelsLoading: { ...state.modelsLoading, [provider_id]: false },
          }))
        }
      },
    }),
    {
      name: 'provider-storage',
      // 只持久化 providers 列表和模型缓存，不持久化 loading/error 状态
      partialize: (state) => ({
        providers: state.providers,
        providerModels: state.providerModels,
      }),
    },
  ),
)

