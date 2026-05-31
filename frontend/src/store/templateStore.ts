import { create } from 'zustand'
import type { VideoTemplateItem, TemplateCategory } from '@/services/templates'
import { fetchTemplates } from '@/services/templates'

interface CategoryCache {
  templates: VideoTemplateItem[]
  loaded: boolean
}

interface TemplateStoreState {
  /** 按 category 分缓存 */
  caches: Record<TemplateCategory, CategoryCache>
  loading: boolean
  error: string | null
  /** 按 category 拉取（有缓存跳过） */
  fetch: (category: TemplateCategory) => Promise<void>
  /** 标记某个 category 缓存失效 */
  invalidate: (category?: TemplateCategory) => void
  /** 返回某个 category 的模板名列表 */
  getOptions: (category: TemplateCategory) => string[]
}

const emptyCache = (): CategoryCache => ({ templates: [], loaded: false })

export const useTemplateStore = create<TemplateStoreState>((set, get) => ({
  caches: { video: emptyCache(), text: emptyCache() },
  loading: false,
  error: null,

  fetch: async (category: TemplateCategory) => {
    if (get().caches[category].loaded) return
    set({ loading: true, error: null })
    try {
      const data = await fetchTemplates(category)
      set((s) => ({
        caches: { ...s.caches, [category]: { templates: data, loaded: true } },
        loading: false,
      }))
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '加载模板失败', loading: false })
    }
  },

  invalidate: (category?: TemplateCategory) => {
    if (category) {
      set((s) => ({ caches: { ...s.caches, [category]: emptyCache() } }))
    } else {
      set({ caches: { video: emptyCache(), text: emptyCache() } })
    }
  },

  getOptions: (category: TemplateCategory) => {
    return ['auto', ...get().caches[category].templates.map((t) => t.name)]
  },
}))
