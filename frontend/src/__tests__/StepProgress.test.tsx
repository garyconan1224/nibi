import { describe, expect, it } from 'vitest'
import { deriveSteps } from '@/pages/result/ProcessingPage/StepProgress'

const STEP_IDS = ['PENDING', 'DOWNLOAD', 'TRANSCRIBE', 'ANALYZE_NOTE', 'SUCCESS']
const STEP_IDS_NO_ASR = ['PENDING', 'DOWNLOAD', 'ANALYZE_NOTE', 'SUCCESS']

describe('deriveSteps', () => {
  // ── 基本 5 步映射（hasTranscriptStep=true，默认） ──

  it('5 步顺序固定：PENDING → DOWNLOAD → TRANSCRIBE → ANALYZE_NOTE → SUCCESS', () => {
    const steps = deriveSteps('PENDING', 0)
    expect(steps.map(s => s.id)).toEqual(STEP_IDS)
  })

  it('PENDING, progress=0 → 排队 running，其余 queued', () => {
    const steps = deriveSteps('PENDING', 0)
    expect(steps[0]).toMatchObject({ id: 'PENDING', state: 'running', pct: 0 })
    steps.slice(1).forEach(s => {
      expect(s.state).toBe('queued')
      expect(s.pct).toBe(0)
    })
  })

  it('DOWNLOAD, progress=0.05 → 排队 done，下载 running(pct=0.05)', () => {
    const steps = deriveSteps('DOWNLOAD', 0.05)
    expect(steps[0]).toMatchObject({ id: 'PENDING', state: 'done', pct: 1 })
    expect(steps[1]).toMatchObject({ id: 'DOWNLOAD', state: 'running', pct: 0.05 })
    steps.slice(2).forEach(s => {
      expect(s.state).toBe('queued')
      expect(s.pct).toBe(0)
    })
  })

  it('ASR, progress=0.25 → 排队+下载 done，转录 running(pct=0.25)', () => {
    const steps = deriveSteps('ASR', 0.25)
    expect(steps[0]).toMatchObject({ id: 'PENDING', state: 'done', pct: 1 })
    expect(steps[1]).toMatchObject({ id: 'DOWNLOAD', state: 'done', pct: 1 })
    expect(steps[2]).toMatchObject({ id: 'TRANSCRIBE', state: 'running', pct: 0.25 })
    expect(steps[3]).toMatchObject({ id: 'ANALYZE_NOTE', state: 'queued', pct: 0 })
    expect(steps[4]).toMatchObject({ id: 'SUCCESS', state: 'queued', pct: 0 })
  })

  it('SUM(note task), progress=0.8 → 排队+下载+转录 done，生成笔记 running(pct=0.8)', () => {
    const steps = deriveSteps('SUM', 0.8)
    expect(steps.slice(0, 3).map(s => s.state)).toEqual(['done', 'done', 'done'])
    expect(steps[3]).toMatchObject({ id: 'ANALYZE_NOTE', state: 'running', pct: 0.8 })
    expect(steps[4]).toMatchObject({ id: 'SUCCESS', state: 'queued', pct: 0 })
  })

  it('SUCCESS, progress=1.0 → 全部 done', () => {
    const steps = deriveSteps('SUCCESS', 1.0)
    steps.forEach(s => {
      expect(s.state).toBe('done')
      expect(s.pct).toBe(1)
    })
  })

  it('FAILED → 全部 queued', () => {
    const steps = deriveSteps('FAILED', 0.5)
    steps.forEach(s => {
      expect(s.state).toBe('queued')
      expect(s.pct).toBe(0)
    })
  })

  it('CANCELLED → 全部 queued', () => {
    const steps = deriveSteps('CANCELLED', 0.5)
    steps.forEach(s => {
      expect(s.state).toBe('queued')
      expect(s.pct).toBe(0)
    })
  })

  it('未知状态 → 排队 running', () => {
    const steps = deriveSteps('UNKNOWN', 0.5)
    expect(steps[0]).toMatchObject({ id: 'PENDING', state: 'running', pct: 0.5 })
    steps.slice(1).forEach(s => {
      expect(s.state).toBe('queued')
      expect(s.pct).toBe(0)
    })
  })

  // ── PROBE 映射：归入「下载」步骤，不回退 PENDING ──

  it('PROBE → 下载 running，不应落回 PENDING', () => {
    const steps = deriveSteps('PROBE', 0.06)
    expect(steps[0]).toMatchObject({ id: 'PENDING', state: 'done', pct: 1 })
    expect(steps[1]).toMatchObject({ id: 'DOWNLOAD', state: 'running', pct: 0.06 })
    expect(steps[2]).toMatchObject({ id: 'TRANSCRIBE', state: 'queued', pct: 0 })
  })

  // ── 无 ASR 流程（hasTranscriptStep=false，图片笔记等） ──

  it('hasTranscriptStep=false → 产出 4 步，不含 TRANSCRIBE', () => {
    const steps = deriveSteps('PENDING', 0, { hasTranscriptStep: false })
    expect(steps.map(s => s.id)).toEqual(STEP_IDS_NO_ASR)
  })

  it('hasTranscriptStep=false + VLM → 下载 done，生成笔记 running，TRANSCRIBE 不出现', () => {
    const steps = deriveSteps('VLM', 0.6, { hasTranscriptStep: false })
    expect(steps.map(s => s.id)).toEqual(STEP_IDS_NO_ASR)
    expect(steps[0]).toMatchObject({ id: 'PENDING', state: 'done', pct: 1 })
    expect(steps[1]).toMatchObject({ id: 'DOWNLOAD', state: 'done', pct: 1 })
    expect(steps[2]).toMatchObject({ id: 'ANALYZE_NOTE', state: 'running', pct: 0.6 })
    expect(steps[3]).toMatchObject({ id: 'SUCCESS', state: 'queued', pct: 0 })
  })

  it('hasTranscriptStep=false + SUM → 下载 done，生成笔记 running', () => {
    const steps = deriveSteps('SUM', 0.9, { hasTranscriptStep: false })
    expect(steps.map(s => s.id)).toEqual(STEP_IDS_NO_ASR)
    expect(steps[2]).toMatchObject({ id: 'ANALYZE_NOTE', state: 'running', pct: 0.9 })
  })

  // ── AWAITING_CONFIRM：deriveSteps 不处理，由 UI 层单独分支 ──

  it('AWAITING_CONFIRM → 全部 queued（UI 层应单独处理此状态，不走普通进度条）', () => {
    const steps = deriveSteps('AWAITING_CONFIRM', 0)
    steps.forEach(s => {
      expect(s.state).toBe('queued')
      expect(s.pct).toBe(0)
    })
  })
})
