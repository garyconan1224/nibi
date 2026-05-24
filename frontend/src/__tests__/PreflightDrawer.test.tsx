import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PreflightDrawer } from '@/pages/WorkbenchPage/PreflightDrawer'

const {
  addTaskMock,
  autoCreateWorkspaceMock,
  createNoteTaskMock,
  errorToastMock,
  fetchProvidersMock,
  infoToastMock,
  navigateMock,
  successToastMock,
  warningToastMock,
} = vi.hoisted(() => ({
  addTaskMock: vi.fn(),
  autoCreateWorkspaceMock: vi.fn(),
  createNoteTaskMock: vi.fn(),
  errorToastMock: vi.fn(),
  fetchProvidersMock: vi.fn(),
  infoToastMock: vi.fn(),
  navigateMock: vi.fn(),
  successToastMock: vi.fn(),
  warningToastMock: vi.fn(),
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}))

vi.mock('@/services/pipeline', () => ({
  createNoteTask: createNoteTaskMock,
}))

vi.mock('@/services/workspaces', () => ({
  autoCreateWorkspace: autoCreateWorkspaceMock,
}))

vi.mock('@/store/providerStore', () => ({
  useProviderStore: () => ({
    providers: [],
    providerModels: {},
    fetchProviders: fetchProvidersMock,
    modelsLoading: {},
  }),
}))

vi.mock('@/store/taskStore', () => ({
  useTaskStore: (selector: (state: { addTask: typeof addTaskMock }) => unknown) =>
    selector({ addTask: addTaskMock }),
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
    addTaskMock.mockReset()
    autoCreateWorkspaceMock.mockReset()
    createNoteTaskMock.mockReset()
    errorToastMock.mockReset()
    fetchProvidersMock.mockReset()
    infoToastMock.mockReset()
    navigateMock.mockReset()
    successToastMock.mockReset()
    warningToastMock.mockReset()
  })

  it('R4: 提交时调用 createNoteTask（替代旧三步流程）', async () => {
    autoCreateWorkspaceMock.mockResolvedValue({
      workspace_id: 'ws-1',
      name: '自动工作空间',
    })
    createNoteTaskMock.mockResolvedValue({ status: 'created', task_id: 'task-video' })

    render(<PreflightDrawer {...defaultProps} />)

    fireEvent.click(screen.getByRole('button', { name: /开始解析/ }))

    await waitFor(() => {
      expect(createNoteTaskMock).toHaveBeenCalledTimes(1)
    })
    expect(createNoteTaskMock).toHaveBeenCalledWith(
      expect.objectContaining({
        url: defaultProps.url,
        material_type: 'video',
        workspace_id: 'ws-1',
      }),
    )
    expect(navigateMock).toHaveBeenCalledWith('/processing/task-video', expect.anything())
  })

  it('R4: 优先使用 stagedConfig.types 决定素材类型', async () => {
    autoCreateWorkspaceMock.mockResolvedValue({
      workspace_id: 'ws-1',
      name: '自动工作空间',
    })
    createNoteTaskMock.mockResolvedValue({ status: 'created', task_id: 'task-image' })

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
      expect(createNoteTaskMock).toHaveBeenCalledTimes(2)
    })
    expect(createNoteTaskMock).toHaveBeenCalledWith(
      expect.objectContaining({ material_type: 'image' }),
    )
    expect(createNoteTaskMock).toHaveBeenCalledWith(
      expect.objectContaining({ material_type: 'text' }),
    )
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

  it('R4: 视频素材传入 preflight summary 配置', async () => {
    autoCreateWorkspaceMock.mockResolvedValue({
      workspace_id: 'ws-1',
      name: '自动工作空间',
    })
    createNoteTaskMock.mockResolvedValue({ status: 'created', task_id: 'task-video' })

    render(<PreflightDrawer {...defaultProps} />)

    // 切换到路径 1
    fireEvent.click(screen.getByLabelText(/路径 1：字幕直接总结/))
    fireEvent.click(screen.getByRole('button', { name: /开始解析/ }))

    await waitFor(() => {
      expect(createNoteTaskMock).toHaveBeenCalledTimes(1)
    })

    expect(createNoteTaskMock).toHaveBeenCalledWith(
      expect.objectContaining({
        preflight: expect.objectContaining({
          summary: expect.objectContaining({
            path: 'subtitle',
            video_template: 'auto',
          }),
        }),
      }),
    )
  })
})
