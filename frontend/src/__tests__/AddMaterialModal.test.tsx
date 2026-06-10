import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AddMaterialModal } from '@/components/workspace/AddMaterialModal'

const {
  navigateMock,
  sniffUrlMock,
  autoCreateWorkspaceMock,
  generateNoteMock,
  addWorkspaceItemMock,
  savePreflightMock,
  startItemPipelineMock,
} = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  sniffUrlMock: vi.fn(),
  autoCreateWorkspaceMock: vi.fn(),
  generateNoteMock: vi.fn(),
  addWorkspaceItemMock: vi.fn(),
  savePreflightMock: vi.fn(),
  startItemPipelineMock: vi.fn(),
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}))

vi.mock('@/services/workspaces', () => ({
  sniffUrl: sniffUrlMock,
  autoCreateWorkspace: autoCreateWorkspaceMock,
  addWorkspaceItem: addWorkspaceItemMock,
  savePreflight: savePreflightMock,
  startItemPipeline: startItemPipelineMock,
  generateNote: generateNoteMock,
}))

describe('AddMaterialModal', () => {
  beforeEach(() => {
    navigateMock.mockClear()
    sniffUrlMock.mockReset()
    autoCreateWorkspaceMock.mockReset()
    generateNoteMock.mockReset()
    addWorkspaceItemMock.mockReset()
    savePreflightMock.mockReset()
    startItemPipelineMock.mockReset()
    generateNoteMock.mockResolvedValue({
      task_id: 'task-note-1',
      task_type: 'note',
      item_type: 'video',
      item_id: 'item-1',
      workspace: {},
    })
  })

  it('只显示生成笔记入口，不显示手动分析模式', () => {
    render(
      <AddMaterialModal
        open={true}
        onOpenChange={vi.fn()}
        workspaceIds={['ws-1']}
        sniffResult={{
          primary_type: 'video',
          possible_types: ['video', 'audio'],
          platform: 'bilibili',
          title: 'test video',
          thumbnail: null,
          content_type_header: null,
        }}
      />,
    )

    expect(screen.getByText('② 生成笔记')).toBeTruthy()
    expect(screen.getByRole('button', { name: /生成笔记/ })).toBeTruthy()
    expect(screen.queryByText(/分析范围/)).toBeNull()
    expect(screen.queryByText(/勾选分析任务/)).toBeNull()
    expect(screen.queryByText(/音视频综合/)).toBeNull()
    expect(screen.queryByText(/综合笔记/)).toBeNull()
    expect(screen.queryByText('一键解析')).toBeNull()
  })

  it('提交时只调用 generateNote 并跳转到 note task processing', async () => {
    const onAdded = vi.fn()
    const onOpenChange = vi.fn()

    render(
      <AddMaterialModal
        open={true}
        onOpenChange={onOpenChange}
        workspaceIds={['ws-1']}
        urlValue="https://example.com/video"
        onAdded={onAdded}
        sniffResult={{
          primary_type: 'video',
          possible_types: ['video'],
          platform: 'bilibili',
          title: '测试视频',
          thumbnail: null,
          content_type_header: null,
        }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /生成笔记/ }))

    await waitFor(() => {
      expect(generateNoteMock).toHaveBeenCalledWith('ws-1', 'https://example.com/video', '测试视频', true)
    })
    expect(addWorkspaceItemMock).not.toHaveBeenCalled()
    expect(savePreflightMock).not.toHaveBeenCalled()
    expect(startItemPipelineMock).not.toHaveBeenCalled()
    expect(onAdded).toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(navigateMock).toHaveBeenCalledWith('/processing/task-note-1', {
      state: {
        url: 'https://example.com/video',
        workspaceId: 'ws-1',
        taskType: 'note',
        itemId: 'item-1',
      },
    })
  })

  it('没有工作空间时先自动创建，再生成笔记', async () => {
    autoCreateWorkspaceMock.mockResolvedValue({ workspace_id: 'ws-new', name: '新工作空间' })

    render(
      <AddMaterialModal
        open={true}
        onOpenChange={vi.fn()}
        workspaceIds={[]}
        urlValue="https://example.com/article"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /生成笔记/ }))

    await waitFor(() => {
      expect(autoCreateWorkspaceMock).toHaveBeenCalledWith({ hint_url: 'https://example.com/article' })
      expect(generateNoteMock).toHaveBeenCalledWith('ws-new', 'https://example.com/article', undefined, true)
    })
  })

  it('内部输入链接后自动嗅探并展示识别结果', async () => {
    sniffUrlMock.mockResolvedValue({
      primary_type: 'text',
      possible_types: ['text'],
      platform: 'web',
      title: '文章标题',
      thumbnail: null,
      content_type_header: null,
    })

    render(
      <AddMaterialModal
        open={true}
        onOpenChange={vi.fn()}
        workspaceIds={['ws-1']}
      />,
    )

    fireEvent.change(screen.getByPlaceholderText(/B站/), {
      target: { value: 'https://example.com/article' },
    })

    await waitFor(() => {
      expect(screen.getByText(/已识别为 文字 · 文章标题/)).toBeTruthy()
    })
  })
})
