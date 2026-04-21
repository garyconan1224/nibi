import { describe, expect, it, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'

// Radix UI 在 jsdom 下所需 Web API 的最小补齐，必须在组件 import 之前执行
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => undefined
  }
})

// 依赖 mock 必须在 import 被测组件之前通过 vi.hoisted + vi.mock 注入
const { getMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(() => Promise.resolve({ data: [] })),
  postMock: vi.fn(() => Promise.resolve({ data: {} })),
}))

vi.mock('@/services/client', () => ({
  http: { get: getMock, post: postMock, put: vi.fn(), delete: vi.fn() },
}))

vi.mock('@/services/pipeline', () => ({
  createPipelineTask: vi.fn(() => Promise.resolve({ task_id: 'mock-task' })),
}))

vi.mock('@/services/upload', () => ({
  uploadLocalFile: vi.fn(() =>
    Promise.resolve({ video_path: '/tmp/mock.mp4', project_id: 'p-mock' }),
  ),
}))

import NoteForm from '@/pages/HomePage/NoteForm'
import { useTaskStore } from '@/store/taskStore'
import { useProviderStore } from '@/store/providerStore'

describe('NoteForm smoke tests', () => {
  beforeEach(() => {
    getMock.mockClear()
    postMock.mockClear()
    // 清掉可能持久化的 store 状态，避免跨用例污染
    useTaskStore.setState({ tasks: [], currentTaskId: null, isPolling: false })
    useProviderStore.setState({
      providers: [],
      providerModels: {},
      modelsLoading: {},
      loading: false,
      error: null,
    })
  })

  it('能在 jsdom 环境下渲染而不抛错', () => {
    const { container } = render(<NoteForm />)
    expect(container.firstChild).toBeTruthy()
  })

  it('渲染后包含「新建笔记」标题与「开始处理」提交按钮', () => {
    render(<NoteForm />)
    expect(screen.getByText('新建笔记')).toBeTruthy()
    expect(screen.getByRole('button', { name: /开始处理/ })).toBeTruthy()
  })

  it('挂载后会触发 provider 列表拉取（useEffect → fetchProviders）', () => {
    render(<NoteForm />)
    // providerStore.fetchProviders 内部走 http.get('/providers')
    expect(getMock).toHaveBeenCalledWith('/providers')
  })
})

