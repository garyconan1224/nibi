// L3 chip 筛选状态 + L4 排序/视图预留扩展
import { create } from 'zustand'

export type FilterKey = 'all' | 'video' | 'audio' | 'image' | 'text' | 'workspace'

export const FILTER_OPTIONS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'video', label: '视频' },
  { key: 'audio', label: '音频' },
  { key: 'image', label: '图片' },
  { key: 'text', label: '文字' },
  { key: 'workspace', label: '工作空间' },
]

interface LibraryStore {
  selectedFilters: FilterKey[]
  toggleFilter: (key: FilterKey) => void
}

export const useLibraryStore = create<LibraryStore>((set) => ({
  selectedFilters: ['all'],

  toggleFilter: (key) =>
    set((s) => {
      const prev = s.selectedFilters
      const has = prev.includes(key)

      if (key === 'all') {
        // 「全部」与其它互斥：点击「全部」→ 清空其它，只留全部
        return { selectedFilters: ['all'] }
      }

      if (has) {
        // 移除当前 chip
        const next = prev.filter((k) => k !== key)
        // 如果全没了，自动回「全部」
        return { selectedFilters: next.length > 0 ? next : ['all'] }
      }

      // 添加当前 chip，同时移除「全部」
      const next = prev.filter((k) => k !== 'all').concat(key)
      return { selectedFilters: next }
    }),
}))
