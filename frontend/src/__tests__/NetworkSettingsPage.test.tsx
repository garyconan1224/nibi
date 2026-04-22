import { describe, expect, it, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'

// 测试环境需要 i18n 实例，否则 t(...) 会回退为 key 字面量
import '@/locales/i18n'

// Radix UI 在 jsdom 下的 Web API 兜底
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

// sonner mock
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import NetworkSettingsPage from '@/pages/SettingPage/NetworkSettingsPage'
import { useSettingsShellStore } from '@/store/settingsShellStore'
import { useConfigStore } from '@/store/configStore'

function renderPage() {
  const router = createMemoryRouter(
    [{ path: '/', element: <NetworkSettingsPage /> }],
    { initialEntries: ['/'] },
  )
  return render(<RouterProvider router={router} />)
}

describe('NetworkSettingsPage · SaveBar & DirtyDot', () => {
  beforeEach(() => {
    useSettingsShellStore.getState().resetSaveBar()
    // 重置 configStore 到初始状态
    useConfigStore.getState().resetConfig()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('① 键入 httpProxy 后 dirtyCount 变为 1，并出现 DirtyDot', async () => {
    renderPage()

    // 等待代理地址输入框就绪
    const proxyInput = (await screen.findByPlaceholderText(
      /示例|Example/,
    )) as HTMLInputElement

    // 初始状态：dirtyCount 为 0
    await waitFor(() => {
      expect(useSettingsShellStore.getState().saveBarState.dirtyCount).toBe(0)
    })

    // 键入新值
    fireEvent.change(proxyInput, { target: { value: 'http://127.0.0.1:7890' } })

    await waitFor(() => {
      expect(proxyInput.value).toBe('http://127.0.0.1:7890')
    })

    // dirtyCount 应变为 1
    await waitFor(() => {
      expect(useSettingsShellStore.getState().saveBarState.dirtyCount).toBe(1)
    })

    // DirtyDot 应出现在 httpProxy label 右侧
    const dirtyDots = screen.queryAllByRole('img', { hidden: true })
    // 由于 DirtyDot 是自绘 SVG，检查 [data-slot="dirty-dot"] 选择器
    const dirtyDotElement = document.querySelector('[data-slot="dirty-dot"]')
    expect(dirtyDotElement).not.toBeNull()
  })

  it('② 调用 onSave() 后 configStore 四字段与草稿一致，dirtyCount 归零', async () => {
    renderPage()

    const proxyInput = (await screen.findByPlaceholderText(
      /示例|Example/,
    )) as HTMLInputElement

    // 键入代理地址
    const proxyValue = 'http://127.0.0.1:7890'
    fireEvent.change(proxyInput, { target: { value: proxyValue } })

    await waitFor(() => {
      expect(proxyInput.value).toBe(proxyValue)
    })

    // 取得 SaveBar 状态
    let saveBarState = useSettingsShellStore.getState().saveBarState

    // 调用 onSave
    expect(saveBarState.onSave).toBeDefined()
    saveBarState.onSave?.()

    // 验证 configStore 已更新
    const config = useConfigStore.getState()
    expect(config.httpProxy).toBe(proxyValue)

    // dirtyCount 应归零
    await waitFor(() => {
      const state = useSettingsShellStore.getState().saveBarState
      expect(state.dirtyCount).toBe(0)
    })
  })

  it('③ 脏态下调用 onReset() 草稿回落到 baseline，dirtyCount 归零', async () => {
    renderPage()

    const proxyInput = (await screen.findByPlaceholderText(
      /示例|Example/,
    )) as HTMLInputElement

    // 初始值为空
    expect(proxyInput.value).toBe('')

    // 键入脏值
    fireEvent.change(proxyInput, { target: { value: 'http://evil.proxy:9999' } })

    await waitFor(() => {
      expect(useSettingsShellStore.getState().saveBarState.dirtyCount).toBe(1)
    })

    // 调用 onReset
    let saveBarState = useSettingsShellStore.getState().saveBarState
    expect(saveBarState.onReset).toBeDefined()
    saveBarState.onReset?.()

    // 草稿应回落到基线（即空字符串）
    await waitFor(() => {
      expect((proxyInput as HTMLInputElement).value).toBe('')
    })

    // dirtyCount 应归零
    await waitFor(() => {
      expect(useSettingsShellStore.getState().saveBarState.dirtyCount).toBe(0)
    })
  })
})

