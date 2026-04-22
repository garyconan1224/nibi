import { describe, expect, it, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'

// i18n 实例必须在页面加载前初始化，否则 t(...) 会回退为 key 字面量
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

// screenshot service mock：避免测试环境向后端发起 HTTP 请求
vi.mock('@/services/screenshot', async () => {
  const actual = await vi.importActual<typeof import('@/services/screenshot')>(
    '@/services/screenshot',
  )
  return {
    ...actual,
    updateScreenshotConfig: vi.fn(async (cfg) => ({
      default_interval: cfg.defaultInterval,
      grid_size: cfg.gridSize,
      jpeg_quality: cfg.jpegQuality,
      embed_in_note: cfg.embedInNote,
    })),
    fetchScreenshotConfig: vi.fn(async () => ({
      default_interval: 6,
      grid_size: [3, 3],
      jpeg_quality: 85,
      embed_in_note: true,
    })),
  }
})

import ScreenshotPage from '@/pages/SettingPage/ScreenshotPage'
import { useSettingsShellStore } from '@/store/settingsShellStore'
import { useConfigStore } from '@/store/configStore'

function renderPage() {
  const router = createMemoryRouter(
    [{ path: '/', element: <ScreenshotPage /> }],
    { initialEntries: ['/'] },
  )
  return render(<RouterProvider router={router} />)
}

describe('ScreenshotPage · SaveBar & DirtyGuard', () => {
  beforeEach(() => {
    useSettingsShellStore.getState().resetSaveBar()
    // 重置 configStore 到初始默认（screenshotSettings 默认 6s / 3x3 / 85 / true）
    useConfigStore.getState().resetConfig()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('① 拖动抽帧间隔滑杆后 dirtyCount=1，并显示 DirtyDot', async () => {
    renderPage()

    const slider = (await screen.findByLabelText(
      /默认抽帧间隔|Default Frame Interval/,
    )) as HTMLInputElement

    await waitFor(() => {
      expect(useSettingsShellStore.getState().saveBarState.dirtyCount).toBe(0)
    })

    fireEvent.change(slider, { target: { value: '12' } })

    await waitFor(() => {
      expect(slider.value).toBe('12')
    })

    await waitFor(() => {
      expect(useSettingsShellStore.getState().saveBarState.dirtyCount).toBe(1)
    })

    expect(document.querySelector('[data-slot="dirty-dot"]')).not.toBeNull()
  })

  it('② onSave 将草稿写入 configStore.screenshotSettings，dirtyCount 归零', async () => {
    renderPage()

    const slider = (await screen.findByLabelText(
      /默认抽帧间隔|Default Frame Interval/,
    )) as HTMLInputElement

    fireEvent.change(slider, { target: { value: '15' } })

    await waitFor(() => {
      expect(useSettingsShellStore.getState().saveBarState.dirtyCount).toBe(1)
    })

    // 调用 SaveBar 暴露的 onSave（异步：await 下一轮以等待 POST 与 store 写入）
    const saveBar = useSettingsShellStore.getState().saveBarState
    expect(saveBar.onSave).toBeDefined()
    await saveBar.onSave?.()

    await waitFor(() => {
      expect(useConfigStore.getState().screenshotSettings.defaultInterval).toBe(15)
    })

    await waitFor(() => {
      expect(useSettingsShellStore.getState().saveBarState.dirtyCount).toBe(0)
    })
  })

  it('③ 脏态下 onReset 将草稿回落基线，dirtyCount 归零', async () => {
    renderPage()

    const slider = (await screen.findByLabelText(
      /默认抽帧间隔|Default Frame Interval/,
    )) as HTMLInputElement
    const initial = slider.value

    fireEvent.change(slider, { target: { value: '30' } })

    await waitFor(() => {
      expect(useSettingsShellStore.getState().saveBarState.dirtyCount).toBe(1)
    })

    const saveBar = useSettingsShellStore.getState().saveBarState
    expect(saveBar.onReset).toBeDefined()
    saveBar.onReset?.()

    await waitFor(() => {
      expect(slider.value).toBe(initial)
    })

    await waitFor(() => {
      expect(useSettingsShellStore.getState().saveBarState.dirtyCount).toBe(0)
    })
  })
})

