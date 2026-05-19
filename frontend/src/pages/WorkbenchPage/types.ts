export interface PlatformInfo {
  name: string
  color: string
  types: Array<'video' | 'audio' | 'image' | 'article'>
}

export type QualityOption = '最高画质' | '1080p' | '720p' | '仅音频'
export type FrameMode = 'A' | 'B'
export type PipelineTone = 'pink' | 'purple' | 'blue' | 'amber' | null

export interface PipelineStep {
  n: string
  t: string
  s: string
  tone: PipelineTone
  defaultOn: boolean
}

export interface TaskCard {
  id: string
  title: string
  src: string
  type: string
  state: 'done' | 'running' | 'error' | 'queued'
  thumb?: string
}
