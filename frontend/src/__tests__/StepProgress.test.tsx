import { describe, expect, it } from 'vitest'
import { deriveSteps } from '@/pages/result/ProcessingPage/StepProgress'

describe('deriveSteps', () => {
  it('currentStatus=DOWNLOAD, progress=1.0, taskType=video → DOWNLOAD running，其余 queued', () => {
    const steps = deriveSteps('DOWNLOAD', 1.0, 'video')
    const downloadStep = steps.find((s) => s.id === 'DOWNLOAD')
    const otherSteps = steps.filter((s) => s.id !== 'DOWNLOAD')

    expect(downloadStep?.state).toBe('running')
    expect(downloadStep?.pct).toBe(1)
    otherSteps.forEach((step) => {
      expect(step.state).toBe('queued')
      expect(step.pct).toBe(0)
    })
  })

  it('currentStatus=SUCCESS, progress=1.0, taskType=video → 全部 done', () => {
    const steps = deriveSteps('SUCCESS', 1.0, 'video')

    steps.forEach((step) => {
      expect(step.state).toBe('done')
      expect(step.pct).toBe(1)
    })
  })

  it('currentStatus=UNKNOWN_STAGE, progress=0.5, taskType=video → 全部 queued', () => {
    const steps = deriveSteps('UNKNOWN_STAGE', 0.5, 'video')

    steps.forEach((step) => {
      expect(step.state).toBe('queued')
      expect(step.pct).toBe(0)
    })
  })
})
