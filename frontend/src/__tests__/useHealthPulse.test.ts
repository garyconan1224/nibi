import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi, MockedFunction } from 'vitest'
import { useHealthPulse } from '@/hooks/useHealthPulse'

// Mock http client
vi.mock('@/services/client', () => ({
  default: {
    get: vi.fn(),
  },
}))

import http from '@/services/client'

const mockHttp = http as unknown as { get: MockedFunction<any> }

describe('useHealthPulse Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('初始状态：online=false, bootstrapping=true, data=null', () => {
    const { result } = renderHook(() => useHealthPulse(5000))
    
    expect(result.current.online).toBe(false)
    expect(result.current.bootstrapping).toBe(true)
    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeNull()
    expect(result.current.lastCheckedAt).toBeNull()
  })

  it('成功请求后：online=true, bootstrapping=false, data 被填充', async () => {
    const mockData = {
      status: 'healthy',
      version: '0.2.0',
      uptime_sec: 12345,
    }
    mockHttp.get.mockResolvedValueOnce({ data: mockData })

    const { result } = renderHook(() => useHealthPulse(5000))

    await waitFor(() => {
      expect(result.current.online).toBe(true)
    })

    expect(result.current.bootstrapping).toBe(false)
    expect(result.current.data).toEqual(mockData)
    expect(result.current.error).toBeNull()
    expect(result.current.lastCheckedAt).not.toBeNull()
  })

  it('请求失败后：online=false, error 被填充, bootstrapping=false', async () => {
    const errMsg = 'Network timeout'
    mockHttp.get.mockRejectedValueOnce(new Error(errMsg))

    const { result } = renderHook(() => useHealthPulse(5000))

    await waitFor(() => {
      expect(result.current.bootstrapping).toBe(false)
    })

    expect(result.current.online).toBe(false)
    expect(result.current.error).toBe(errMsg)
    expect(result.current.lastCheckedAt).not.toBeNull()
  })

  it('intervalMs=0 时仅执行一次请求', async () => {
    mockHttp.get.mockResolvedValueOnce({
      data: { status: 'healthy', version: '0.2.0', uptime_sec: 100 },
    })

    const { result } = renderHook(() => useHealthPulse(0))

    await waitFor(() => {
      expect(result.current.online).toBe(true)
    })

    // 清除定时器
    vi.runAllTimers()
    // 确保没有额外的请求（只有 1 次）
    expect(mockHttp.get).toHaveBeenCalledTimes(1)
  })

  it('组件卸载时清理 timer 和 AbortController', async () => {
    mockHttp.get.mockResolvedValueOnce({
      data: { status: 'healthy', version: '0.2.0', uptime_sec: 100 },
    })

    const { unmount } = renderHook(() => useHealthPulse(5000))

    await waitFor(() => {
      expect(mockHttp.get).toHaveBeenCalled()
    })

    unmount()
    vi.runAllTimers()

    // 卸载后不应该再有新的请求
    const callsBefore = mockHttp.get.mock.calls.length
    vi.advanceTimersByTime(5000)
    expect(mockHttp.get.mock.calls.length).toBe(callsBefore)
  })

  it('轮询间隔正确：多次调用应间隔 intervalMs', async () => {
    mockHttp.get.mockResolvedValue({
      data: { status: 'healthy', version: '0.2.0', uptime_sec: 100 },
    })

    const { result } = renderHook(() => useHealthPulse(3000))

    // 首次立即请求
    await waitFor(() => {
      expect(mockHttp.get).toHaveBeenCalledTimes(1)
    })

    // 推进 3000ms，应触发第二次请求
    vi.advanceTimersByTime(3000)
    await waitFor(() => {
      expect(mockHttp.get).toHaveBeenCalledTimes(2)
    })

    // 再推进 3000ms，应触发第三次请求
    vi.advanceTimersByTime(3000)
    await waitFor(() => {
      expect(mockHttp.get).toHaveBeenCalledTimes(3)
    })
  })

  it('失败后保留之前的 data（降级策略）', async () => {
    const goodData = {
      status: 'healthy',
      version: '0.2.0',
      uptime_sec: 100,
    }
    mockHttp.get.mockResolvedValueOnce({ data: goodData })

    const { result } = renderHook(() => useHealthPulse(5000))

    await waitFor(() => {
      expect(result.current.online).toBe(true)
    })

    expect(result.current.data).toEqual(goodData)

    // 模拟下一次请求失败
    mockHttp.get.mockRejectedValueOnce(new Error('offline'))

    vi.advanceTimersByTime(5000)

    await waitFor(() => {
      expect(result.current.online).toBe(false)
    })

    // 失败后仍保留之前的 data
    expect(result.current.data).toEqual(goodData)
    expect(result.current.error).toBe('offline')
  })
})

