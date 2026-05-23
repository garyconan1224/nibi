import { create } from 'zustand'
import type { VideoTemplateItem } from '@/services/templates'
import { fetchTemplates } from '@/services/templates'

interface TemplateStoreState {
  templates: VideoTemplateItem[]
  loading: boolean
  error: string | null
  loaded: boolean
  fetch: () => Promise<void>
  /** 标记缓存失效，下次 fetch 强制刷新（设置页 CRUD 后调用） */
  invalidate: () => void
  /** 返回合并后的模板名列表（内置 + 自定义） */
  getOptions: () => string[]
}

export const useTemplateStore = create<TemplateStoreState>((set, get) => ({
  templates: [],
  loading: false,
  error: null,
  loaded: false,

  fetch: async () => {
    if (get().loaded) return
    set({ loading: true, error: null })
    try {
      const data = await fetchTemplates()
      set({ templates: data, loaded: true, loading: false })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '加载模板失败', loading: false })
    }
  },

  invalidate: () => {
    set({ loaded: false })
  },

  getOptions: () => {
    return ['auto', ...get().templates.map((t) => t.name)]
  },
}))
