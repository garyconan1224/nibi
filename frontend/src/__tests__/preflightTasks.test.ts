import { describe, expect, it } from 'vitest'
import { applyCascades, buildInitialTasks } from '@/pages/WorkbenchPage/preflightTasks'
import type { MediaKind, TaskState } from '@/pages/WorkbenchPage/preflightTasks'

function makeState(kind: MediaKind, overrides: Record<string, Partial<{ on: boolean; [k: string]: unknown }>> = {}): TaskState {
  const base = buildInitialTasks(kind)
  for (const [gid, patch] of Object.entries(overrides)) {
    base[gid] = { ...base[gid], ...patch } as TaskState[string]
  }
  return base
}

describe('applyCascades', () => {
  it('video: 路径 2 (音视频合并) → 强制 frame_prompt on + locked', () => {
    const state = makeState('video', {
      frame_prompt: { on: false },
      summary: { on: true, summary_path: '音视频合并 · 最详细' },
    })
    const { state: eff, locks } = applyCascades('video', state)
    expect(eff.frame_prompt.on).toBe(true)
    expect(locks.frame_prompt).toBe('路径 2 复用截帧 · 强制开启')
  })

  it('video: 路径 1 (字幕总结) 不触发级联', () => {
    const state = makeState('video', {
      frame_prompt: { on: false },
      summary: { on: true, summary_path: '字幕直接总结' },
    })
    const { state: eff, locks } = applyCascades('video', state)
    expect(eff.frame_prompt.on).toBe(false)
    expect(locks.frame_prompt).toBeUndefined()
  })

  it('video: 路径 3 (视频模型直跑) 不触发级联', () => {
    const state = makeState('video', {
      summary: { on: true, summary_path: '视频模型直接分析' },
    })
    const { locks } = applyCascades('video', state)
    expect(locks.frame_prompt).toBeUndefined()
  })

  it('audio: voiceprint.on → 强制 asr.on + locked', () => {
    const state = makeState('audio', {
      asr: { on: false },
      voiceprint: { on: true },
    })
    const { state: eff, locks } = applyCascades('audio', state)
    expect(eff.asr.on).toBe(true)
    expect(locks.asr).toBe('说话人区分需要先转写')
  })

  it('audio: srt.on → 强制 asr.on + locked', () => {
    const state = makeState('audio', {
      asr: { on: false },
      voiceprint: { on: false },
      srt: { on: true },
    })
    const { state: eff, locks } = applyCascades('audio', state)
    expect(eff.asr.on).toBe(true)
    expect(locks.asr).toBe('字幕导出需要转写')
  })

  it('audio: voiceprint 和 srt 都关时 asr 不受影响', () => {
    const state = makeState('audio', {
      asr: { on: false },
      voiceprint: { on: false },
      srt: { on: false },
    })
    const { state: eff, locks } = applyCascades('audio', state)
    expect(eff.asr.on).toBe(false)
    expect(locks.asr).toBeUndefined()
  })

  it('audio: asr 已 on 时 srt.on 不重复设置（voiceprint 锁优先）', () => {
    const state = makeState('audio', {
      asr: { on: true },
      voiceprint: { on: true },
      srt: { on: true },
    })
    const { state: eff, locks } = applyCascades('audio', state)
    expect(eff.asr.on).toBe(true)
    expect(locks.asr).toBe('说话人区分需要先转写')
  })

  it('image: 1 张图片时 compare 强制 off + disabled', () => {
    const state = makeState('image', { compare: { on: true } })
    const { state: eff, disabled } = applyCascades('image', state, 1)
    expect(eff.compare.on).toBe(false)
    expect(disabled.compare).toBe('仅 1 张图片 · 至少需要 2 张')
  })

  it('image: 2 张图片时 compare 不限制', () => {
    const state = makeState('image', { compare: { on: true } })
    const { state: eff, locks, disabled } = applyCascades('image', state, 2)
    expect(eff.compare.on).toBe(true)
    expect(locks.compare).toBeUndefined()
    expect(disabled.compare).toBeUndefined()
  })

  it('text: 1 篇素材时 multi 强制 off + disabled', () => {
    const state = makeState('text', { multi: { on: true } })
    const { state: eff, disabled } = applyCascades('text', state, 1)
    expect(eff.multi.on).toBe(false)
    expect(disabled.multi).toBe('仅 1 篇 · 至少需要 2 篇')
  })

  it('text: 3 篇素材时 multi 不限制', () => {
    const state = makeState('text', { multi: { on: true } })
    const { state: eff, locks, disabled } = applyCascades('text', state, 3)
    expect(eff.multi.on).toBe(true)
    expect(locks.multi).toBeUndefined()
    expect(disabled.multi).toBeUndefined()
  })

  it('不修改原始引用 (structuredClone)', () => {
    const state = makeState('video', {
      summary: { on: true, summary_path: '音视频合并 · 最详细' },
    })
    const snapshot = state.summary.on
    applyCascades('video', state)
    expect(state.summary.on).toBe(snapshot)
  })
})

describe('buildInitialTasks', () => {
  it('video 初始化 4 个任务且 on 值等于 TASK_GROUPS default', () => {
    const tasks = buildInitialTasks('video')
    expect(Object.keys(tasks)).toHaveLength(4)
    expect(tasks.frame_prompt.on).toBe(true)
    expect(tasks.summary.on).toBe(true)
    expect(tasks.music.on).toBe(false)
    expect(tasks.srt.on).toBe(true)
  })

  it('video frame_prompt 包含子参数默认值', () => {
    const tasks = buildInitialTasks('video')
    expect(tasks.frame_prompt.frame_mode).toBe('AI 镜头分析')
    expect(tasks.frame_prompt.shot_frames).toBe('3 帧 · 首+中+尾')
  })

  it('audio 初始化 4 个任务', () => {
    const tasks = buildInitialTasks('audio')
    expect(Object.keys(tasks)).toHaveLength(4)
    expect(tasks.asr.on).toBe(true)
    expect(tasks.asr.asr_lang).toBe('自动检测')
  })

  it('image 初始化 5 个任务', () => {
    const tasks = buildInitialTasks('image')
    expect(Object.keys(tasks)).toHaveLength(5)
  })

  it('text 初始化 5 个任务', () => {
    const tasks = buildInitialTasks('text')
    expect(Object.keys(tasks)).toHaveLength(5)
    expect(tasks.summary.on).toBe(true)
    expect(tasks.translate.on).toBe(false)
    expect(tasks.translate.tr_lang).toBe('English')
  })
})
