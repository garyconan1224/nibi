import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** 笔记生成质量：fast=快速 / medium=平衡 / slow=精细 */
export type Quality = 'fast' | 'medium' | 'slow'

/** 笔记格式：可多选 */
export type NoteFormat =
  | 'bulleted'
  | 'mindmap'
  | 'quiz'
  | 'summary'
  | 'key_points'

/** 笔记风格 */
export type NoteStyle = 'academic' | 'minimalist' | 'creative'

/** 用户偏好配置（全部持久化到 localStorage） */
export interface ConfigState {
  /** 默认质量 */
  defaultQuality: Quality
  /** 默认格式（多选） */
  defaultFormats: NoteFormat[]
  /** 默认风格 */
  defaultStyle: NoteStyle

  /** 是否插入截图 */
  screenshot: boolean
  /** 是否保留原始链接 */
  link: boolean
  /** 是否开启视觉理解（多模态抽帧分析） */
  video_understanding: boolean
  /** 抽帧间隔（秒） */
  video_interval: number
  /** 网格拼图尺寸 [列数, 行数] */
  grid_size: [number, number]
  /** 额外 prompt 补充说明 */
  extras: string

  /** 操作 */
  setConfig: (patch: Partial<Omit<ConfigState, 'setConfig' | 'resetConfig'>>) => void
  /** 将所有字段重置为初始默认值 */
  resetConfig: () => void
}

/** 初始默认值（setConfig/resetConfig 共用同一份） */
const DEFAULT_CONFIG: Omit<ConfigState, 'setConfig' | 'resetConfig'> = {
  defaultQuality: 'medium',
  defaultFormats: ['bulleted', 'summary'],
  defaultStyle: 'academic',

  screenshot: false,
  link: false,
  video_understanding: false,
  video_interval: 30,
  grid_size: [2, 2],
  extras: '',
}

export const useConfigStore = create<ConfigState>()(
  persist(
    (set) => ({
      ...DEFAULT_CONFIG,

      setConfig: (patch) => set((state) => ({ ...state, ...patch })),
      resetConfig: () => set((state) => ({ ...state, ...DEFAULT_CONFIG })),
    }),
    { name: 'config-storage' },
  ),
)

