import { describe, it, expect } from 'vitest'
import { normalizeMediaUrl } from '@/lib/url'

describe('normalizeMediaUrl', () => {
  it('纯 BV 号 → 完整 B 站 URL', () => {
    expect(normalizeMediaUrl('BV1qA5j6jEJC')).toBe(
      'https://www.bilibili.com/video/BV1qA5j6jEJC'
    )
  })

  it('缺 scheme → 补 https://', () => {
    expect(normalizeMediaUrl('bilibili.com/video/BV1xx/')).toBe(
      'https://bilibili.com/video/BV1xx'
    )
  })

  it('带追踪参数 → 参数被移除', () => {
    const raw = 'https://www.bilibili.com/video/BV1qA5j6jEJC/?spm_id_from=333.1007&vd_source=d0c732f14ae6900c501b38a4d1c34b7d'
    expect(normalizeMediaUrl(raw)).toBe(
      'https://www.bilibili.com/video/BV1qA5j6jEJC'
    )
  })

  it('已规整 URL → 无变化', () => {
    const clean = 'https://www.bilibili.com/video/BV1qA5j6jEJC'
    expect(normalizeMediaUrl(clean)).toBe(clean)
  })

  it('末尾斜杠 → 移除', () => {
    expect(normalizeMediaUrl('https://www.bilibili.com/video/BV1qA5j6jEJC/')).toBe(
      'https://www.bilibili.com/video/BV1qA5j6jEJC'
    )
  })

  it('保留非追踪参数', () => {
    const raw = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLxxx'
    const result = normalizeMediaUrl(raw)
    expect(result).toContain('v=dQw4w9WgXcQ')
    expect(result).toContain('list=PLxxx')
  })
})
