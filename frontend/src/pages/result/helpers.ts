import type { VideoResultFrame } from '@/services/workspaces'

export function nearestFrameIdx(frames: VideoResultFrame[], sec: number): number {
  if (!frames.length) return 0
  let bestIdx = 0
  let bestDiff = Math.abs(frames[0].sec - sec)
  for (let i = 1; i < frames.length; i++) {
    const d = Math.abs(frames[i].sec - sec)
    if (d < bestDiff) {
      bestDiff = d
      bestIdx = i
    }
  }
  return bestIdx
}
