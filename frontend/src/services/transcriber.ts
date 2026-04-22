/**
 * 音频转写配置 API 服务（DESIGN_NOTES_SETTINGS.md §3.2 冻结契约）。
 *
 * 后端 `GET/POST /transcriber_config` 已统一返回完整 `TranscriberConfig`：
 *   { type, whisper_model_size, language, device, groq_api_key, initial_prompt }
 * POST 支持部分更新语义（缺省字段保留旧值，显式空串可清空）。
 */

import { http } from './client'
import type { WhisperModelSize, TranscriberType } from '@/store/configStore'

/** 冻结契约：后端返回体 = 前端提交体（设置页在 M2 全量对齐） */
export interface TranscriberConfigPayload {
  type: TranscriberType
  whisper_model_size: WhisperModelSize
  language: string
  device: 'cpu' | 'cuda' | 'mps'
  groq_api_key: string
  initial_prompt: string
}

/** 部分更新入参：字段全部可选，后端按"未提供 = 保留"语义处理 */
export type TranscriberConfigPatch = Partial<TranscriberConfigPayload>

/**
 * 获取转写器配置（全量回显）。
 */
export async function fetchTranscriberConfig(): Promise<TranscriberConfigPayload> {
  const res = await http.get<TranscriberConfigPayload>('/transcriber_config')
  return res.data
}

/**
 * 更新转写器配置。
 *
 * 兼容两种签名：
 * - 新：`updateTranscriberConfig(patch)` 传递任意字段子集；
 * - 旧：`updateTranscriberConfig(type, whisperModelSize)` 仅更新这两项。
 */
export async function updateTranscriberConfig(
  patchOrType: TranscriberConfigPatch | TranscriberType,
  whisperModelSize?: WhisperModelSize,
): Promise<TranscriberConfigPayload> {
  const payload: TranscriberConfigPatch =
    typeof patchOrType === 'string'
      ? { type: patchOrType, ...(whisperModelSize ? { whisper_model_size: whisperModelSize } : {}) }
      : patchOrType
  const res = await http.post<TranscriberConfigPayload>('/transcriber_config', payload)
  return res.data
}

/**
 * 获取可用的转写引擎列表（用于 Select 组件）
 */
export function getAvailableTranscriberTypes() {
  return [
    { value: 'fast-whisper', label: 'Faster Whisper（本地）' },
    { value: 'bcut', label: '必剪（在线）' },
    { value: 'kuaishou', label: '快手（在线）' },
    { value: 'groq', label: 'Groq（在线）' },
    { value: 'mlx-whisper', label: 'MLX Whisper（仅macOS）' },
  ]
}

/**
 * 获取 Whisper 模型大小选项
 */
export function getWhisperModelSizes() {
  return ['tiny', 'base', 'small', 'medium', 'large-v3', 'large-v3-turbo']
}

/**
 * 获取设备选项
 */
export function getDeviceOptions() {
  return [
    { value: 'cpu', label: 'CPU' },
    { value: 'cuda', label: 'NVIDIA CUDA' },
    { value: 'mps', label: 'Apple Metal (MPS)' },
  ]
}

/**
 * 获取语言选项（ISO 639-1 代码）
 */
export function getLanguageOptions() {
  return [
    { value: 'zh', label: '中文' },
    { value: 'en', label: 'English' },
    { value: 'ja', label: '日本語' },
    { value: 'ko', label: '한국어' },
    { value: 'auto', label: 'Auto Detect' },
  ]
}

