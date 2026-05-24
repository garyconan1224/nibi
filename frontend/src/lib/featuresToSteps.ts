import type { ItemType } from '@/types/workspace'

// ── Feature 定义（SPEC §2.6 一级勾选项）─────────────────────

export type Feature =
  | 'visual_prompt'
  | 'video_summary'
  | 'subtitle_export'
  | 'music_analysis'
  | 'transcribe_summary'
  | 'speaker_diarize'
  | 'describe'
  | 'ocr'
  | 'prompt'
  | 'assoc'
  | 'summary_keypoints'
  | 'rewrite'
  | 'translate'
  | 'multi_compare'

export interface FeatureDef {
  id: Feature
  label: string
  defaultChecked: boolean
}

export const FEATURES_BY_TYPE: Record<ItemType, FeatureDef[]> = {
  video: [
    { id: 'visual_prompt', label: '画面提示词', defaultChecked: true },
    { id: 'video_summary', label: '文案总结', defaultChecked: true },
    { id: 'subtitle_export', label: '字幕导出', defaultChecked: true },
    { id: 'music_analysis', label: '音乐分析', defaultChecked: false },
  ],
  audio: [
    { id: 'transcribe_summary', label: '转写+总结', defaultChecked: true },
    { id: 'speaker_diarize', label: '说话人音色', defaultChecked: false },
    { id: 'subtitle_export', label: '字幕导出', defaultChecked: true },
    { id: 'music_analysis', label: '音乐分析', defaultChecked: false },
  ],
  image: [
    { id: 'describe', label: '内容识别', defaultChecked: true },
    { id: 'ocr', label: 'OCR', defaultChecked: false },
    { id: 'prompt', label: '提示词', defaultChecked: true },
    { id: 'assoc', label: '联想总结', defaultChecked: false },
  ],
  text: [
    { id: 'summary_keypoints', label: '摘要+要点+金句', defaultChecked: true },
    { id: 'rewrite', label: '改写', defaultChecked: false },
    { id: 'translate', label: '翻译', defaultChecked: false },
    { id: 'multi_compare', label: '多文对比', defaultChecked: false },
  ],
}

// ── Feature → 后端 steps 映射 ──────────────────────────────
// 后端 handle_note_task 当前支持: download / transcribe / analyze / note
// "transcribe" 步骤仅对依赖 ASR 转写的 feature 启用

const NEEDS_TRANSCRIBE: ReadonlySet<Feature> = new Set([
  'video_summary',
  'subtitle_export',
  'transcribe_summary',
  'speaker_diarize',
])

/**
 * 将前端一级勾选的 features 翻译为后端 pipeline steps。
 * 始终包含 download + analyze + note；仅当任一 feature 需要转写时才加入 transcribe。
 */
export function featuresToSteps(_type: ItemType, features: Feature[]): string[] {
  const steps = ['download', 'analyze', 'note']
  const needsTranscribe = features.some((f) => NEEDS_TRANSCRIBE.has(f))
  if (needsTranscribe) {
    // transcribe 插在 download 之后、analyze 之前
    steps.splice(1, 0, 'transcribe')
  }
  return steps
}

/** 返回某素材类型的默认勾选 feature ID 列表 */
export function getDefaultFeatures(type: ItemType): Feature[] {
  return FEATURES_BY_TYPE[type]
    .filter((f) => f.defaultChecked)
    .map((f) => f.id)
}

/** 返回某类型所有可用的 feature ID 列表 */
export function getAllFeatures(type: ItemType): Feature[] {
  return FEATURES_BY_TYPE[type].map((f) => f.id)
}
