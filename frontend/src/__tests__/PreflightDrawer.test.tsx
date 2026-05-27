import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PreflightDrawer } from '@/pages/WorkbenchPage/PreflightDrawer'

const {
  addWorkspaceItemMock,
  autoCreateWorkspaceMock,
  errorToastMock,
  fetchProvidersMock,
  infoToastMock,
  navigateMock,
  savePreflightMock,
  startItemPipelineMock,
  successToastMock,
  warningToastMock,
} = vi.hoisted(() => ({
  addWorkspaceItemMock: vi.fn(),
  autoCreateWorkspaceMock: vi.fn(),
  errorToastMock: vi.fn(),
  fetchProvidersMock: vi.fn(),
  infoToastMock: vi.fn(),
  navigateMock: vi.fn(),
  savePreflightMock: vi.fn(),
  startItemPipelineMock: vi.fn(),
  successToastMock: vi.fn(),
  warningToastMock: vi.fn(),
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}))

vi.mock('@/services/workspaces', () => ({
  autoCreateWorkspace: autoCreateWorkspaceMock,
  addWorkspaceItem: addWorkspaceItemMock,
  savePreflight: savePreflightMock,
  startItemPipeline: startItemPipelineMock,
}))

vi.mock('@/store/providerStore', () => ({
  useProviderStore: () => ({
    providers: [],
    providerModels: {},
    fetchProviders: fetchProvidersMock,
    modelsLoading: {},
  }),
}))

const fetchTemplatesMock = vi.fn()

vi.mock('@/store/templateStore', () => ({
  useTemplateStore: (selector?: (s: Record<string, unknown>) => unknown) => {
    const state = {
      getOptions: () => ['auto'],
      fetch: fetchTemplatesMock,
      templates: [],
      loading: false,
    }
    return selector ? selector(state) : state
  },
}))

vi.mock('sonner', () => ({
  toast: {
    success: successToastMock,
    warning: warningToastMock,
    error: errorToastMock,
    info: infoToastMock,
  },
}))

const defaultProps = {
  open: true,
  url: 'https://example.com/post/abc',
  platformName: '示例平台',
  workspaceId: 'ws-1',
  onClose: vi.fn(),
  onCreated: vi.fn(),
}

describe('PreflightDrawer R4', () => {
  beforeEach(() => {
    addWorkspaceItemMock.mockReset()
    autoCreateWorkspaceMock.mockReset()
    errorToastMock.mockReset()
    fetchProvidersMock.mockReset()
    infoToastMock.mockReset()
    navigateMock.mockReset()
    savePreflightMock.mockReset()
    startItemPipelineMock.mockReset()
    successToastMock.mockReset()
    warningToastMock.mockReset()
  })

  it('R4: 提交时走标准 workspace flow（add→savePreflight→start→navigate）', async () => {
    autoCreateWorkspaceMock.mockResolvedValue({
      workspace_id: 'ws-1',
      name: '自动工作空间',
    })
    addWorkspaceItemMock.mockResolvedValue({
      items: [{ item_id: 'item-1', type: 'video', source: 'url', source_value: 'https://example.com/post/abc' }],
    })
    savePreflightMock.mockResolvedValue({})
    startItemPipelineMock.mockResolvedValue({ task_id: 'task-video', task_type: 'note' })
    render(<PreflightDrawer {...defaultProps} />)

    fireEvent.click(screen.getByRole('button', { name: /开始解析/ }))

    await waitFor(() => {
      expect(startItemPipelineMock).toHaveBeenCalledTimes(1)
    })
    expect(addWorkspaceItemMock).toHaveBeenCalledWith('ws-1', expect.objectContaining({
      type: 'video',
      source: 'url',
      source_value: defaultProps.url,
    }))
    expect(savePreflightMock).toHaveBeenCalledTimes(1)
    expect(startItemPipelineMock).toHaveBeenCalledWith('ws-1', 'item-1')
    expect(navigateMock).toHaveBeenCalledWith('/processing/task-video', expect.anything())
  })

  it('R4: 优先使用 stagedConfig.types 决定素材类型', async () => {
    autoCreateWorkspaceMock.mockResolvedValue({
      workspace_id: 'ws-1',
      name: '自动工作空间',
    })
    addWorkspaceItemMock.mockResolvedValue({
      items: [{ item_id: 'item-img', type: 'image' }, { item_id: 'item-txt', type: 'text' }],
    })
    savePreflightMock.mockResolvedValue({})
    startItemPipelineMock.mockResolvedValue({ task_id: 'task-image' })

    render(
      <PreflightDrawer
        {...defaultProps}
        stagedConfig={{
          types: ['image', 'text'],
          features: {
            image: { describe: true, ocr: false, prompt: true, assoc: false },
            text: { summary_keypoints: true, rewrite: false, translate: false, multi_compare: false },
          },
          background: {},
          workspaceIds: ['ws-1'],
        }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /开始解析/ }))

    await waitFor(() => {
      expect(startItemPipelineMock).toHaveBeenCalledTimes(2)
    })
    expect(addWorkspaceItemMock).toHaveBeenCalledWith('ws-1', expect.objectContaining({ type: 'image' }))
    expect(addWorkspaceItemMock).toHaveBeenCalledWith('ws-1', expect.objectContaining({ type: 'text' }))
  })

  it('R4: stagedConfig 的 background 预填表单字段', () => {
    render(
      <PreflightDrawer
        {...defaultProps}
        stagedConfig={{
          types: ['video'],
          features: { video: { visual_prompt: true, video_summary: true, subtitle_export: true, music_analysis: false } },
          background: { content_type: '课程', purpose: '内容学习', topic: '深度学习' },
          workspaceIds: ['ws-1'],
        }}
      />,
    )

    expect((screen.getByDisplayValue('课程') as HTMLSelectElement).value).toBe('课程')
    expect((screen.getByDisplayValue('内容学习') as HTMLSelectElement).value).toBe('内容学习')
    expect((screen.getByDisplayValue('深度学习') as HTMLInputElement).value).toBe('深度学习')
  })

  it('R4: 视频素材传入 tasks 配置到 preflight（R8 新格式）', async () => {
    autoCreateWorkspaceMock.mockResolvedValue({
      workspace_id: 'ws-1',
      name: '自动工作空间',
    })
    addWorkspaceItemMock.mockResolvedValue({
      items: [{ item_id: 'item-1', type: 'video' }],
    })
    savePreflightMock.mockResolvedValue({})
    startItemPipelineMock.mockResolvedValue({ task_id: 'task-video' })
    render(<PreflightDrawer {...defaultProps} />)

    fireEvent.click(screen.getByRole('button', { name: /开始解析/ }))

    await waitFor(() => {
      expect(savePreflightMock).toHaveBeenCalledTimes(1)
    })

    expect(savePreflightMock).toHaveBeenCalledWith(
      'ws-1',
      'item-1',
      expect.objectContaining({
        tasks: expect.objectContaining({
          material_type: 'video',
          enabled_features: expect.arrayContaining(['frame_prompt', 'summary', 'srt']),
          summary: expect.objectContaining({
            on: true,
            summary_path: '音视频综合',
          }),
        }),
      }),
    )
  })
})

describe('PreflightDrawer R7.4 stage 模式', () => {
  beforeEach(() => {
    addWorkspaceItemMock.mockReset()
    autoCreateWorkspaceMock.mockReset()
    startItemPipelineMock.mockReset()
    savePreflightMock.mockReset()
  })

  it('mode="stage" 时按钮文案是「保存配置 & 返回」，点击后调 onSaveStaged 不调后端', () => {
    const onSaveStaged = vi.fn()
    render(
      <PreflightDrawer
        {...defaultProps}
        mode="stage"
        onSaveStaged={onSaveStaged}
      />,
    )

    const btn = screen.getByRole('button', { name: /保存配置 & 返回/ })
    expect(btn).toBeDefined()
    fireEvent.click(btn)

    expect(onSaveStaged).toHaveBeenCalledTimes(1)
    expect(onSaveStaged).toHaveBeenCalledWith(
      expect.objectContaining({
        types: expect.any(Array),
        features: expect.any(Object),
        background: expect.any(Object),
      }),
    )
    // 不应调后端 pipeline
    expect(startItemPipelineMock).not.toHaveBeenCalled()
    expect(savePreflightMock).not.toHaveBeenCalled()
  })

  it('不传 mode 时保持原有 execute 行为（按钮文案「开始解析」）', () => {
    render(<PreflightDrawer {...defaultProps} />)

    const btn = screen.getByRole('button', { name: /开始解析/ })
    expect(btn).toBeDefined()
  })
})

describe('PreflightDrawer analysisScope', () => {
  beforeEach(() => {
    addWorkspaceItemMock.mockReset()
    autoCreateWorkspaceMock.mockReset()
    startItemPipelineMock.mockReset()
    savePreflightMock.mockReset()
  })

  it('analysisScope=visual_only 时 summary_path 为 只看画面', async () => {
    autoCreateWorkspaceMock.mockResolvedValue({
      workspace_id: 'ws-1',
      name: '自动工作空间',
    })
    addWorkspaceItemMock.mockResolvedValue({
      items: [{ item_id: 'item-1', type: 'video' }],
    })
    savePreflightMock.mockResolvedValue({})
    startItemPipelineMock.mockResolvedValue({ task_id: 'task-video' })

    render(
      <PreflightDrawer
        {...defaultProps}
        stagedConfig={{
          types: ['video'],
          features: {},
          background: {},
          workspaceIds: ['ws-1'],
          analysisScope: 'visual_only',
        }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /开始解析/ }))

    await waitFor(() => {
      expect(savePreflightMock).toHaveBeenCalledTimes(1)
    })

    expect(savePreflightMock).toHaveBeenCalledWith(
      'ws-1',
      'item-1',
      expect.objectContaining({
        tasks: expect.objectContaining({
          summary: expect.objectContaining({
            summary_path: '只看画面',
          }),
        }),
      }),
    )
  })

  it('analysisScope=av_combined 时 summary_path 为 音视频综合', async () => {
    autoCreateWorkspaceMock.mockResolvedValue({
      workspace_id: 'ws-1',
      name: '自动工作空间',
    })
    addWorkspaceItemMock.mockResolvedValue({
      items: [{ item_id: 'item-1', type: 'video' }],
    })
    savePreflightMock.mockResolvedValue({})
    startItemPipelineMock.mockResolvedValue({ task_id: 'task-video' })

    render(
      <PreflightDrawer
        {...defaultProps}
        stagedConfig={{
          types: ['video'],
          features: {},
          background: {},
          workspaceIds: ['ws-1'],
          analysisScope: 'av_combined',
        }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /开始解析/ }))

    await waitFor(() => {
      expect(savePreflightMock).toHaveBeenCalledTimes(1)
    })

    expect(savePreflightMock).toHaveBeenCalledWith(
      'ws-1',
      'item-1',
      expect.objectContaining({
        tasks: expect.objectContaining({
          summary: expect.objectContaining({
            summary_path: '音视频综合',
          }),
        }),
      }),
    )
  })

  it('stage 模式传递 analysisScope 到 onSaveStaged', () => {
    const onSaveStaged = vi.fn()
    render(
      <PreflightDrawer
        {...defaultProps}
        mode="stage"
        onSaveStaged={onSaveStaged}
        stagedConfig={{
          types: ['video'],
          features: {},
          background: {},
          workspaceIds: ['ws-1'],
          analysisScope: 'visual_only',
        }}
      />,
    )

    const btn = screen.getByRole('button', { name: /保存配置 & 返回/ })
    fireEvent.click(btn)

    expect(onSaveStaged).toHaveBeenCalledWith(
      expect.objectContaining({
        analysisScope: 'visual_only',
      }),
    )
  })
})
