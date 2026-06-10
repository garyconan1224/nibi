import { describe, it, expect } from 'vitest'
import { nextEta } from '@/hooks/useGlobalEta'

describe('nextEta（ETA 单调递减规则）', () => {
  it('无活跃/无速率且未显示 → -1（隐藏）', () => {
    expect(nextEta(-1, 0, false)).toBe(-1)
  })
  it('首次（prev<0）有 target → 校准到 target', () => {
    expect(nextEta(-1, 30, false)).toBe(30)
  })
  it('稳定期每秒至少减 1', () => {
    expect(nextEta(30, 30, false)).toBe(29)
  })
  it('永不上跳：target 暴涨也只减 1', () => {
    expect(nextEta(10, 100, false)).toBe(9)
  })
  it('真实更快完成 → 跟降到 target', () => {
    expect(nextEta(30, 5, false)).toBe(5)
  })
  it('活跃任务集合变化 → 校准（允许跳到 target）', () => {
    expect(nextEta(3, 80, true)).toBe(80)
  })
  it('不落 0：减到 1 后保持 1', () => {
    expect(nextEta(1, 30, false)).toBe(1)
  })
  it('显示中但 target 掉到 0 → 继续减 1 不低于 1', () => {
    expect(nextEta(5, 0, false)).toBe(4)
  })
})
