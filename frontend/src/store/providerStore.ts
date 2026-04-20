import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** Provider 条目（与后端 GET /providers 响应字段对齐） */
export interface ProviderItem {
  id: string          // 提供商唯一标识（provider_id）
  name: string        // 显示名称
  base_url: string    // 接口地址
  enabled: boolean    // 是否启用
  kind: string        // openai_compatible | anthropic | ...
  logo?: string       // 可选 logo URL
}

interface ProviderStoreState {
  /** 提供商列表 */
  providers: ProviderItem[]
  /** 是否正在拉取中 */
  loading: boolean
  /** 最近一次拉取的错误信息 */
  error: string | null

  /** 操作 */
  setProviders: (providers: ProviderItem[]) => void

  /** 从后端 GET /providers 拉取并更新列表 */
  fetchProviders: () => Promise<void>
}

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

export const useProviderStore = create<ProviderStoreState>()(
  persist(
    (set) => ({
      providers: [],
      loading: false,
      error: null,

      setProviders: (providers) => set({ providers }),

      fetchProviders: async () => {
        set({ loading: true, error: null })
        try {
          const res = await fetch(`${API_BASE}/providers`)
          if (!res.ok) throw new Error(`获取提供商列表失败 (${res.status})`)
          const data: ProviderItem[] = await res.json()
          set({ providers: data, loading: false })
        } catch (e) {
          const msg = e instanceof Error ? e.message : '未知错误'
          set({ error: msg, loading: false })
        }
      },
    }),
    {
      name: 'provider-storage',
      // 只持久化列表数据，不持久化 loading/error 状态
      partialize: (state) => ({ providers: state.providers }),
    },
  ),
)

