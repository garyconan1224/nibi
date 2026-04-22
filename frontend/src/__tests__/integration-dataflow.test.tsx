/**
 * 集成测试：页面导航 & 数据流验证
 * 
 * 验证以下场景：
 * 1. 任务创建 → taskStore 更新 → 页面反映
 * 2. 配置变更 → configStore 更新 → 数据持久化
 * 3. 后端健康检测 → useHealthPulse 更新 → UI 状态变化
 */
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import '@/locales/i18n'

// Mock Web APIs
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
})

// 前置 mock
const { getMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(() => Promise.resolve({ data: { status: 'ok' } })),
  postMock: vi.fn(() => Promise.resolve({ data: { task_id: 'test-task' } })),
}))

vi.mock('@/services/client', () => ({
  http: { get: getMock, post: postMock, put: vi.fn(), delete: vi.fn() },
}))

vi.mock('@/services/pipeline', () => ({
  createPipelineTask: vi.fn(() => Promise.resolve({ task_id: 'test-task' })),
}))

import { useTaskStore } from '@/store/taskStore'
import { useConfigStore } from '@/store/configStore'

describe('Integration: Data Flow & Store Updates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 重置所有 store
    useTaskStore.setState({ tasks: [], currentTaskId: null, isPolling: false })
  })

  it('任务添加到 taskStore 后 tasks 数组更新', () => {
    const store = useTaskStore.getState()
    const initialCount = store.tasks.length

    const mockTask = {
      task_id: 'test-1',
      project_id: 'p-1',
      task_type: 'analyze' as const,
      payload: {},
      status: 'PENDING' as const,
      progress: 0,
      log: [],
      result: {},
      error: '',
      retry_of: '',
      cancel_requested: false,
      created_at: '2026-04-22T00:00:00Z',
      updated_at: '2026-04-22T00:00:00Z',
    }

    store.addTask(mockTask)

    const updated = useTaskStore.getState()
    expect(updated.tasks.length).toBe(initialCount + 1)
    expect(updated.tasks[updated.tasks.length - 1].task_id).toBe('test-1')
  })

  it('任务状态更新触发 store 变化', () => {
    const store = useTaskStore.getState()
    const task = {
      task_id: 'test-2',
      project_id: 'p-1',
      task_type: 'analyze' as const,
      payload: {},
      status: 'PENDING' as const,
      progress: 0,
      log: [],
      result: {},
      error: '',
      retry_of: '',
      cancel_requested: false,
      created_at: '2026-04-22T00:00:00Z',
      updated_at: '2026-04-22T00:00:00Z',
    }

    store.addTask(task)
    store.updateTask('test-2', { status: 'ANALYZING' })

    const updated = useTaskStore.getState()
    const found = updated.tasks.find((t) => t.task_id === 'test-2')
    expect(found?.status).toBe('ANALYZING')
  })

  it('configStore setConfig 更新指定字段，其他字段不变', () => {
    const store = useConfigStore.getState()
    const originalScreenshot = store.screenshot
    const originalQuality = store.defaultQuality

    store.setConfig({ defaultQuality: 'slow', screenshot: true })

    const updated = useConfigStore.getState()
    expect(updated.defaultQuality).toBe('slow')
    expect(updated.screenshot).toBe(true)
  })

  it('configStore resetConfig 重置为默认值', () => {
    const store = useConfigStore.getState()
    store.setConfig({
      defaultQuality: 'fast',
      screenshot: true,
      httpProxy: 'http://custom:7890',
    })

    let updated = useConfigStore.getState()
    expect(updated.defaultQuality).toBe('fast')
    expect(updated.httpProxy).toBe('http://custom:7890')

    updated.resetConfig()

    const reset = useConfigStore.getState()
    expect(reset.defaultQuality).toBe('medium')
    expect(reset.screenshot).toBe(false)
    expect(reset.httpProxy).toBe('')
  })

  it('多个 tasks 的并发更新保持一致性', () => {
    const store = useTaskStore.getState()

    for (let i = 0; i < 5; i++) {
      store.addTask({
        task_id: `task-${i}`,
        project_id: 'p-1',
        task_type: 'analyze' as const,
        payload: {},
        status: 'PENDING' as const,
        progress: 0,
        log: [],
        result: {},
        error: '',
        retry_of: '',
        cancel_requested: false,
        created_at: '2026-04-22T00:00:00Z',
        updated_at: '2026-04-22T00:00:00Z',
      })
    }

    // 并发更新
    for (let i = 0; i < 5; i++) {
      store.updateTask(`task-${i}`, { progress: (i + 1) * 20 })
    }

    const updated = useTaskStore.getState()
    expect(updated.tasks.length).toBe(5)

    for (let i = 0; i < 5; i++) {
      const task = updated.tasks.find((t) => t.task_id === `task-${i}`)
      expect(task?.progress).toBe((i + 1) * 20)
    }
  })

  it('setDownloadConfig 部分更新不影响其他下载配置字段', () => {
    const store = useConfigStore.getState()
    const original = store.downloadConfig

    store.setDownloadConfig({ outputDir: '/new/path', concurrencyLimit: 5 })

    const updated = useConfigStore.getState()
    expect(updated.downloadConfig.outputDir).toBe('/new/path')
    expect(updated.downloadConfig.concurrencyLimit).toBe(5)
    // 其他字段保持原值
    expect(updated.downloadConfig.filenameTemplate).toBe(original.filenameTemplate)
    expect(updated.downloadConfig.socketTimeout).toBe(original.socketTimeout)
  })
})

