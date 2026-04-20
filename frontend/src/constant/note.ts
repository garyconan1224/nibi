import type { Quality, NoteFormat, NoteStyle } from '@/store/configStore'

/** 质量选项 */
export const QUALITY_OPTIONS: { value: Quality; label: string; description: string }[] = [
  { value: 'fast',   label: '快速',  description: '速度优先，适合长视频预览' },
  { value: 'medium', label: '平衡',  description: '质量与速度均衡（推荐）' },
  { value: 'slow',   label: '精细',  description: '精细分析，适合重要内容' },
]

/** 格式选项（多选） */
export const FORMAT_OPTIONS: { value: NoteFormat; label: string }[] = [
  { value: 'bulleted',   label: '要点列表' },
  { value: 'mindmap',    label: '思维导图' },
  { value: 'quiz',       label: '问答题' },
  { value: 'summary',    label: '摘要总结' },
  { value: 'key_points', label: '关键词' },
]

/** 风格选项 */
export const STYLE_OPTIONS: { value: NoteStyle; label: string; description: string }[] = [
  { value: 'academic',   label: '学术',  description: '结构严谨、术语准确' },
  { value: 'minimalist', label: '极简',  description: '简洁扼要、无冗余' },
  { value: 'creative',   label: '创意',  description: '生动有趣、易于记忆' },
]

