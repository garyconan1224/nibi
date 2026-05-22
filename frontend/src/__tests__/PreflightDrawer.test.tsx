import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorkspaceItem, WorkspaceRecord } from '@/types/workspace'
import { PreflightDrawer } from '@/pages/WorkbenchPage/PreflightDrawer'

const {
  addTaskMock,
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
  addTaskMock: vi.fn(),
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
  addWorkspaceItem: addWorkspaceItemMock,
  autoCreateWorkspace: autoCreateWorkspaceMock,
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

vi.mock('@/store/taskStore', () => ({
  useTaskStore: (selector: (state: { addTask: typeof addTaskMock }) => unknown) =>
    selector({ addTask: addTaskMock }),
}))

vi.mock('sonner', () => ({
  toast: {
    success: successToastMock,
    warning: warningToastMock,
    error: errorToastMock,
    info: infoToastMock,
  },
}))

function makeItem(overrides: Partial<WorkspaceItem>): WorkspaceItem {
  return {
    item_id: 'item-1',
    type: 'video',
    source: 'url',
    source_value: 'https://example.com/source',
    name: 'item',
    status: 'pending',
    preflight: {
      background_overrides: {},
      models: {},
      tasks: {},
    },
    results: {},
    related_task_ids: [],
    tags: {},
    created_at: '2026-05-22T00:00:00.000Z',
    updated_at: '2026-05-22T00:00:00.000Z',
    ...overrides,
  }
}

function makeWorkspace(items: WorkspaceItem[]): WorkspaceRecord {
  return {
    workspace_id: 'ws-1',
    name: '测试工作空间',
    status: 'active',
    trashed: false,
    background: {
      content_type: '',
      participants: [],
      topic: '',
      glossary: [],
      purpose: '',
    },
    items,
    favorites: [],
    created_at: '2026-05-22T00:00:00.000Z',
    updated_at: '2026-05-22T00:00:00.000Z',
  }
}

const defaultProps = {
  open: true,
  url: 'https://example.com/post/abc',
  platformName: '示例平台',
  workspaceId: 'ws-1',
  onClose: vi.fn(),
  onCreated: vi.fn(),
}

describe('PreflightDrawer F4.3', () => {
  beforeEach(() => {
    addTaskMock.mockReset()
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

  it('优先使用用户在 mixed modal 里的单项选择，而不是 possible_types 全量拆分', async () => {
    addWorkspaceItemMock.mockResolvedValue(
      makeWorkspace([
        makeItem({
          item_id: 'item-image',
          type: 'image',
          source_value: defaultProps.url,
          name: 'abc (图片)',
        }),
      ]),
    )
    savePreflightMock.mockResolvedValue(makeWorkspace([]))
    startItemPipelineMock.mockResolvedValue({
      workspace: makeWorkspace([]),
      task_id: 'task-image',
      task_type: 'image',
    })

    render(
      <PreflightDrawer
        {...defaultProps}
        selectedTypes={['image']}
        sniffResult={{
          primary_type: 'image',
          possible_types: ['image', 'text'],
          platform: 'xiaohongshu',
          title: null,
          thumbnail: null,
          content_type_header: 'text/html',
        }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /开始解析/ }))

    await waitFor(() => {
      expect(addWorkspaceItemMock).toHaveBeenCalledTimes(1)
    })
    expect(addWorkspaceItemMock).toHaveBeenCalledWith('ws-1', expect.objectContaining({
      type: 'image',
      source_value: defaultProps.url,
    }))
    expect(startItemPipelineMock).toHaveBeenCalledTimes(1)
  })

  it('多 item 创建时按类型和名称命中刚创建的素材，而不是复用第一个同 URL item', async () => {
    const url = 'https://www.bilibili.com/video/BV1qA5j6jEJC'
    addWorkspaceItemMock
      .mockResolvedValueOnce(
        makeWorkspace([
          makeItem({
            item_id: 'item-video',
            type: 'video',
            source_value: url,
            name: 'BV1qA5j6jEJC (视频)',
          }),
        ]),
      )
      .mockResolvedValueOnce(
        makeWorkspace([
          makeItem({
            item_id: 'item-video',
            type: 'video',
            source_value: url,
            name: 'BV1qA5j6jEJC (视频)',
          }),
          makeItem({
            item_id: 'item-audio',
            type: 'audio',
            source_value: url,
            name: 'BV1qA5j6jEJC (音频)',
          }),
        ]),
      )
    savePreflightMock.mockResolvedValue(makeWorkspace([]))
    startItemPipelineMock
      .mockResolvedValueOnce({
        workspace: makeWorkspace([]),
        task_id: 'task-video',
        task_type: 'download',
      })
      .mockResolvedValueOnce({
        workspace: makeWorkspace([]),
        task_id: 'task-audio',
        task_type: 'audio',
      })

    render(
      <PreflightDrawer
        {...defaultProps}
        url={url}
        platformName="Bilibili"
        sniffResult={{
          primary_type: 'video',
          possible_types: ['video', 'audio'],
          platform: 'bilibili',
          title: null,
          thumbnail: null,
          content_type_header: null,
        }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /开始解析/ }))

    await waitFor(() => {
      expect(addWorkspaceItemMock).toHaveBeenCalledTimes(2)
    })

    expect(savePreflightMock).toHaveBeenNthCalledWith(
      1,
      'ws-1',
      'item-video',
      expect.objectContaining({
        tasks: expect.objectContaining({
          summary: expect.objectContaining({ path: 'detailed' }),
        }),
      }),
    )
    expect(savePreflightMock).toHaveBeenNthCalledWith(
      2,
      'ws-1',
      'item-audio',
      expect.objectContaining({
        tasks: {},
      }),
    )
    expect(startItemPipelineMock).toHaveBeenNthCalledWith(1, 'ws-1', 'item-video')
    expect(startItemPipelineMock).toHaveBeenNthCalledWith(2, 'ws-1', 'item-audio')
    expect(navigateMock).toHaveBeenCalledWith('/processing/task-video', {
      state: { url, workspaceId: 'ws-1', itemId: 'item-video' },
    })
  })
})
