import { describe, expect, it, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'

// 测试环境需要 i18n 实例，否则 t(...) 会回退为 key 字面量
import '@/locales/i18n'

// Radix UI 在 jsdom 下的 Web API 兜底：Dialog 触发器走 Portal 时需要
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

// 依赖 mock 必须在组件 import 之前通过 vi.hoisted + vi.mock 注入
const { getMock, putMock, postMock, deleteMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  putMock: vi.fn(),
  postMock: vi.fn(),
  deleteMock: vi.fn(),
}))

vi.mock('@/services/client', () => ({
  http: { get: getMock, post: postMock, put: putMock, delete: deleteMock },
}))

// sonner 在 jsdom 下依赖浏览器 API，最小化为 no-op
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import ProvidersManagementPage from '@/pages/SettingPage/ProvidersManagementPage'
import { useSettingsShellStore } from '@/store/settingsShellStore'

/** 组装两个种子 provider：list 接口返回；/providers/:id 返回详情 */
function primeHttp() {
  getMock.mockReset()
  getMock.mockImplementation((url: string) => {
    if (url === '/providers') {
      return Promise.resolve({
        data: [
          {
            id: 'p-a',
            name: 'Provider A',
            kind: 'openai_compatible',
            base_url: 'https://a.test/v1',
            enabled: true,
            has_api_key: true,
          },
          {
            id: 'p-b',
            name: 'Provider B',
            kind: 'anthropic',
            base_url: 'https://b.test',
            enabled: false,
            has_api_key: false,
          },
        ],
      })
    }
    if (url === '/providers/p-a') {
      return Promise.resolve({
        data: {
          id: 'p-a',
          name: 'Provider A',
          kind: 'openai_compatible',
          base_url: 'https://a.test/v1',
          enabled: true,
          has_api_key: true,
          default_models: {},
        },
      })
    }
    if (url === '/providers/p-b') {
      return Promise.resolve({
        data: {
          id: 'p-b',
          name: 'Provider B',
          kind: 'anthropic',
          base_url: 'https://b.test',
          enabled: false,
          has_api_key: false,
          default_models: {},
        },
      })
    }
    return Promise.reject(new Error(`unexpected url: ${url}`))
  })
}

function renderPage() {
  const router = createMemoryRouter(
    [{ path: '/', element: <ProvidersManagementPage /> }],
    { initialEntries: ['/'] },
  )
  return render(<RouterProvider router={router} />)
}

describe('ProvidersManagementPage · 脏态切换拦截', () => {
  beforeEach(() => {
    putMock.mockReset()
    postMock.mockReset()
    deleteMock.mockReset()
    useSettingsShellStore.getState().resetSaveBar()
    primeHttp()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('脏态下切换 Provider 会触发 window.confirm；取消则保持当前选中', async () => {
    renderPage()

    // 等待列表与详情首屏加载完成；限定在左侧 listbox 里查找，避免右侧详情 header 重名
    const listbox = await screen.findByRole('listbox', { name: 'providers' })
    await waitFor(() => {
      expect(within(listbox).getByText('Provider A')).toBeTruthy()
      expect(within(listbox).getByText('Provider B')).toBeTruthy()
    })
    // 详情中的 name 输入框（受控于 draft.name）就绪
    const nameInput = (await screen.findByDisplayValue(
      'Provider A',
    )) as HTMLInputElement

    // 修改 name 让当前 provider 进入脏态（直接派发 change 事件即可驱动受控组件）
    fireEvent.change(nameInput, { target: { value: 'Provider A Dirty' } })
    await waitFor(() => {
      expect((nameInput as HTMLInputElement).value).toBe('Provider A Dirty')
    })

    // 切换前安装 confirm stub，先返回 false（取消）
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

    // 点击左侧列表里的「Provider B」条目
    fireEvent.click(within(listbox).getByText('Provider B'))

    // confirm 被调用且被取消：仍处在 Provider A 的详情
    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(screen.getByDisplayValue('Provider A Dirty')).toBeTruthy()

    // 再次点击，这次确认离开
    confirmSpy.mockReturnValue(true)
    fireEvent.click(within(listbox).getByText('Provider B'))

    expect(confirmSpy).toHaveBeenCalledTimes(2)
    // 切换成功：详情表单切到 Provider B（基线 name）
    await waitFor(() => {
      expect(screen.getByDisplayValue('Provider B')).toBeTruthy()
    })
  })

  it('未脏时切换 Provider 不触发 confirm', async () => {
    renderPage()

    const listbox = await screen.findByRole('listbox', { name: 'providers' })
    await waitFor(() => {
      expect(within(listbox).getByText('Provider A')).toBeTruthy()
    })
    await screen.findByDisplayValue('Provider A')

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

    fireEvent.click(within(listbox).getByText('Provider B'))

    expect(confirmSpy).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(screen.getByDisplayValue('Provider B')).toBeTruthy()
    })
  })

  it('SaveBar dirtyCount 会随草稿变更推送到 settingsShellStore', async () => {
    renderPage()

    const nameInput = (await screen.findByDisplayValue(
      'Provider A',
    )) as HTMLInputElement

    // 初次落基线：dirtyCount 应为 0
    await waitFor(() => {
      expect(useSettingsShellStore.getState().saveBarState.dirtyCount).toBe(0)
    })

    fireEvent.change(nameInput, { target: { value: 'Provider A - Edited' } })

    await waitFor(() => {
      expect(
        useSettingsShellStore.getState().saveBarState.dirtyCount,
      ).toBeGreaterThan(0)
    })
  })
})

