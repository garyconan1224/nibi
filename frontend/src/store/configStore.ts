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

/** 下载策略预设（由前端映射到下载引擎的 format selector） */
export type DownloadMode = 'balanced' | 'speed' | 'quality' | 'audio'

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

  /** 网络代理服务器地址，例如 "http://127.0.0.1:7890"，用于访问海外站点（全局设置） */
  httpProxy: string
  /** 双模型：文本处理模型 provider_id（脚本/摘要/总结） */
  textProviderId: string
  /** 双模型：文本处理模型 ID（脚本/摘要/总结） */
  textModelId: string
  /** 双模型：视频处理模型 provider_id（视觉分析/抽帧描述，如 Qwen-VL） */
  visionProviderId: string
  /** 双模型：视频处理模型 ID（视觉分析/抽帧描述，如 Qwen-VL） */
  videoModelId: string
  /** 注：音频转录已改用本地 faster-whisper，不再需要 provider/model 配置 */

  /** 下载策略预设（均衡/优先速度/优先画质/仅提取音频） */
  downloadMode: DownloadMode
  /** YouTube PO Token（可选，用于突破限流） */
  poToken: string
  /** YouTube Visitor Data（可选，用于突破限流） */
  visitorData: string
  /** Cookie 基目录（多行，每行一个绝对路径；为空则使用默认目录） */
  cookieBaseDirs: string

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

  // 全局代理 & 双模型 provider/model 记忆（首次加载为空，用户使用后自动填充并持久化）
  httpProxy: '',
  textProviderId: '',
  textModelId: '',
  visionProviderId: '',
  videoModelId: '',

  // 下载偏好（默认均衡；高级字段留空，仅在用户显式填写后生效）
  downloadMode: 'balanced',
  poToken: '',
  visitorData: '',
  cookieBaseDirs: '',
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

