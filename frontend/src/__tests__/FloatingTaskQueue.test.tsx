import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FloatingTaskQueue } from '@/components/FloatingTaskQueue'
import { useTaskStore } from '@/store/taskStore'
import type { TaskRecord } from '@/types/task'

const { cancelMock, navigateMock, retryMock, routeState } = vi.hoisted(() => ({
  cancelMock: vi.fn(),
  navigateMock: vi.fn(),
  retryMock: vi.fn(),
  routeState: { pathname: '/' },
}))

vi.mock('react-router-dom', () => ({
  useLocation: () => routeState,
  useNavigate: () => navigateMock,
}))

vi.mock('@/hooks/usePipelineTasks', () => ({
  usePipelineTasks: vi.fn(),
}))

vi.mock('@/services/pipeline', () => ({
  cancelPipelineTask: cancelMock,
  retryPipelineTask: retryMock,
}))

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

const makeTask = (overrides: Partial<TaskRecord> = {}): TaskRecord => ({
  task_id: 'task-001',
  project_id: 'workspace-1',
  task_type: 'audio',
  payload: { title: 'Audio task' },
  status: 'PENDING',
  progress: 0.2,
  log: [],
  result: {},
  error: '',
  retry_of: '',
  cancel_requested: false,
  created_at: '2026-05-25T00:00:00.000Z',
  updated_at: '2026-05-25T00:00:00.000Z',
  ...overrides,
})

describe('FloatingTaskQueue v2', () => {
  beforeEach(() => {
    routeState.pathname = '/'
    navigateMock.mockReset()
    cancelMock.mockReset()
    retryMock.mockReset()
    cancelMock.mockResolvedValue({})
    retryMock.mockResolvedValue(makeTask({ task_id: 'task-retry', status: 'PENDING' }))
    useTaskStore.setState({
      tasks: [],
      hiddenTaskIds: [],
      currentTaskId: null,
      isPolling: false,
    })
  })

  it('隐藏 SUCCESS/CANCELLED，只保留活跃任务和 FAILED 任务', () => {
    useTaskStore.setState({
      tasks: [
        makeTask({ task_id: 'done', status: 'SUCCESS', payload: { title: 'Done task' } }),
        makeTask({ task_id: 'cancelled', status: 'CANCELLED', payload: { title: 'Cancelled task' } }),
        makeTask({ task_id: 'failed', status: 'FAILED', payload: { title: 'Failed task' } }),
      ],
    })

    render(<FloatingTaskQueue />)
    fireEvent.click(screen.getByRole('button', { name: /任务/ }))

    expect(screen.getByText('Failed task')).toBeTruthy()
    expect(screen.queryByText('Done task')).toBeNull()
    expect(screen.queryByText('Cancelled task')).toBeNull()
  })

  it('查看全部跳转到现有 /workspaces 入口', () => {
    useTaskStore.setState({
      tasks: [makeTask({ status: 'DOWNLOAD' })],
    })

    render(<FloatingTaskQueue />)
    fireEvent.click(screen.getByRole('button', { name: /任务/ }))
    fireEvent.click(screen.getByRole('button', { name: '查看全部' }))

    expect(navigateMock).toHaveBeenCalledWith('/workspaces')
  })

  it('进行中任务支持单项取消和批量暂停', async () => {
    useTaskStore.setState({
      tasks: [
        makeTask({ task_id: 'task-a', status: 'DOWNLOAD', payload: { title: 'Download task' } }),
        makeTask({ task_id: 'task-b', status: 'ASR', payload: { title: 'Transcribe task' } }),
      ],
    })

    render(<FloatingTaskQueue />)
    fireEvent.click(screen.getByRole('button', { name: /任务/ }))
    fireEvent.click(screen.getByRole('button', { name: '取消任务 Download task' }))
    fireEvent.click(screen.getByRole('button', { name: '暂停全部' }))

    await waitFor(() => {
      expect(cancelMock).toHaveBeenCalledWith('task-a')
      expect(cancelMock).toHaveBeenCalledWith('task-b')
    })
  })

  it('FAILED 任务支持重试和本地隐藏', async () => {
    useTaskStore.setState({
      tasks: [makeTask({ task_id: 'task-failed', status: 'FAILED', payload: { title: 'Failed task' } })],
    })

    render(<FloatingTaskQueue />)
    fireEvent.click(screen.getByRole('button', { name: /任务/ }))
    fireEvent.click(screen.getByRole('button', { name: '重试 Failed task' }))

    await waitFor(() => expect(retryMock).toHaveBeenCalledWith('task-failed'))

    fireEvent.click(screen.getByRole('button', { name: '隐藏失败任务 Failed task' }))

    expect(useTaskStore.getState().tasks.find((t) => t.task_id === 'task-failed')).toBeUndefined()
  })

  it('当前 processing 路由任务显示查看中标记', () => {
    routeState.pathname = '/processing/task-active'
    useTaskStore.setState({
      tasks: [makeTask({ task_id: 'task-active', status: 'SUM', payload: { title: 'Current task' } })],
    })

    render(<FloatingTaskQueue />)
    fireEvent.click(screen.getByRole('button', { name: /任务/ }))

    expect(screen.getByText('查看中')).toBeTruthy()
  })
})
