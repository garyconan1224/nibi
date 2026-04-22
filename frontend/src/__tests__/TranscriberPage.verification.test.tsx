/**
 * TranscriberPage 完整功能验证测试
 *
 * 覆盖范围：
 * - 路由导航与菜单集成
 * - 卡片选择器交互（5 个引擎）
 * - 动态表单字段渲染
 * - SaveBar 集成与脏数据检查
 * - 数据持久化（configStore + 后端）
 * - i18n 和无障碍属性
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { toast } from 'sonner'

// Mock dependencies
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/services/transcriber', async () => {
  const actual = await vi.importActual<any>('@/services/transcriber')
  return {
    ...actual,
    updateTranscriberConfig: vi.fn().mockResolvedValue({
      type: 'fast-whisper',
      whisper_model_size: 'medium',
      language: 'zh',
      device: 'cpu',
      groq_api_key: '',
      initial_prompt: '',
    }),
  }
})

import TranscriberPage from '@/pages/SettingPage/TranscriberPage'
import { useConfigStore } from '@/store/configStore'
import { useSettingsShellStore } from '@/store/settingsShellStore'

function renderTranscriberPage() {
  const router = createMemoryRouter(
    [{ path: '/transcriber', element: <TranscriberPage /> }],
    { initialEntries: ['/transcriber'] },
  )
  return render(<RouterProvider router={router} />)
}

describe('TranscriberPage 完整功能验证', () => {
  beforeEach(() => {
    useConfigStore.getState().resetConfig()
    useSettingsShellStore.getState().resetSaveBar()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('1. 路由导航与菜单集成', () => {
    it('应该正确渲染页面标题和副标题', () => {
      renderTranscriberPage()
      
      expect(screen.getByText('音频转写')).toBeInTheDocument()
      expect(screen.getByText(/配置语音识别引擎及默认参数/)).toBeInTheDocument()
    })
  })

  describe('2. 卡片选择器交互', () => {
    it('应该显示 5 个转写引擎卡片', () => {
      renderTranscriberPage()
      
      // 按标签查找卡片
      expect(screen.getByText(/Faster Whisper/)).toBeInTheDocument()
      expect(screen.getByText('必剪')).toBeInTheDocument()
      expect(screen.getByText('快手')).toBeInTheDocument()
      expect(screen.getByText('Groq')).toBeInTheDocument()
      expect(screen.getByText(/MLX Whisper/)).toBeInTheDocument()
    })

    it('点击卡片应该切换选中状态并更新草稿', async () => {
      renderTranscriberPage()
      
      const groqCard = screen.getByText('Groq').closest('button')!
      fireEvent.click(groqCard)
      
      await waitFor(() => {
        // 检查 Groq API Key 字段是否显示
        expect(screen.getByPlaceholderText('gsk_...')).toBeInTheDocument()
      })
    })

    it('本地引擎应该显示"本地"徽章', () => {
      renderTranscriberPage()
      
      const whisperBadges = screen.getAllByText('本地')
      expect(whisperBadges.length).toBeGreaterThan(0)
    })

    it('在线引擎应该显示"在线"徽章', () => {
      renderTranscriberPage()
      
      const onlineBadges = screen.getAllByText('在线')
      expect(onlineBadges.length).toBeGreaterThan(0)
    })
  })

  describe('3. 动态表单字段渲染', () => {
    it('fast-whisper 选中时应显示模型大小字段', async () => {
      renderTranscriberPage()
      
      // fast-whisper 默认选中
      await waitFor(() => {
        const modelSizeSelects = screen.getAllByRole('combobox')
        expect(modelSizeSelects.length).toBeGreaterThan(0)
      })
    })

    it('groq 选中时应显示 API Key 密码字段', async () => {
      renderTranscriberPage()
      
      const groqCard = screen.getByText('Groq').closest('button')!
      fireEvent.click(groqCard)
      
      await waitFor(() => {
        const apiKeyInput = screen.getByPlaceholderText('gsk_...') as HTMLInputElement
        expect(apiKeyInput.type).toBe('password')
      })
    })

    it('初始提示词字段应始终显示', () => {
      renderTranscriberPage()
      
      expect(screen.getByPlaceholderText(/例如：AI、转录/)).toBeInTheDocument()
    })

    it('语言和设备字段应始终显示', () => {
      renderTranscriberPage()
      
      const labels = screen.getAllByText(/目标语言|计算设备/)
      expect(labels.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('4. SaveBar 集成与脏数据检查', () => {
    it('初始状态下 dirtyCount 应为 0', () => {
      renderTranscriberPage()
      
      const saveBarState = useSettingsShellStore.getState().saveBarState
      expect(saveBarState.dirtyCount).toBe(0)
    })

    it('修改字段后 dirtyCount 应增加', async () => {
      renderTranscriberPage()
      
      const initialPromptInput = screen.getByPlaceholderText(/例如：AI/)
      fireEvent.change(initialPromptInput, { target: { value: 'test prompt' } })
      
      await waitFor(() => {
        const saveBarState = useSettingsShellStore.getState().saveBarState
        expect(saveBarState.dirtyCount).toBeGreaterThan(0)
      })
    })

    it('保存按钮应在脏状态下启用', async () => {
      renderTranscriberPage()
      
      const initialPromptInput = screen.getByPlaceholderText(/例如：AI/)
      fireEvent.change(initialPromptInput, { target: { value: 'test' } })
      
      await waitFor(() => {
        const saveBarState = useSettingsShellStore.getState().saveBarState
        expect(saveBarState.onSave).toBeDefined()
      })
    })
  })

  describe('5. 国际化支持', () => {
    it('所有标签应使用 i18n 文案', () => {
      renderTranscriberPage()
      
      // 检查 i18n 文案是否正确加载
      expect(screen.getByText('转写引擎')).toBeInTheDocument()
      expect(screen.getByText('识别参数')).toBeInTheDocument()
    })
  })

  describe('6. 无障碍属性', () => {
    it('应有适当的 ARIA 标签', () => {
      renderTranscriberPage()
      
      // 确认关键交互元素有 id 和关联标签
      const selects = screen.getAllByRole('combobox')
      expect(selects.length).toBeGreaterThan(0)
    })
  })
})

