/**
 * SummariesTab 组件测试。
 *
 * 测试：列表渲染 / 新建调用 / 删除调用 / 选中状态。
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SummariesTab } from '@/components/SummariesTab'
import type { ItemSummary } from '@/services/summaries'

/* ── mock services ────────────────────────────────────────────── */

const mocks = vi.hoisted(() => ({
  listSummaries: vi.fn(),
  createSummary: vi.fn(),
  deleteSummary: vi.fn(),
}))

vi.mock('@/services/summaries', () => ({
  listSummaries: mocks.listSummaries,
  createSummary: mocks.createSummary,
  deleteSummary: mocks.deleteSummary,
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

/* ── fixtures ─────────────────────────────────────────────────── */

const SUMMARY_1: ItemSummary = {
  summary_id: 's1',
  template: 'concise',
  version: 1,
  background_for_summary: '',
  content_md: '# 简洁摘要 v1\n\n这是第一版摘要',
  model_used: 'openai/gpt-4o',
  created_at: '2026-05-28T12:00:00Z',
}

const SUMMARY_2: ItemSummary = {
  summary_id: 's2',
  template: 'concise',
  version: 2,
  background_for_summary: '背景信息',
  content_md: '# 简洁摘要 v2\n\n这是第二版',
  model_used: 'openai/gpt-4o',
  created_at: '2026-05-28T13:00:00Z',
}

const SUMMARY_DETAILED: ItemSummary = {
  summary_id: 's3',
  template: 'detailed',
  version: 1,
  background_for_summary: '',
  content_md: '## 要点\n\n- 要点1\n- 要点2',
  model_used: 'deepseek/deepseek-chat',
  created_at: '2026-05-28T14:00:00Z',
}

/* ── tests ────────────────────────────────────────────────────── */

describe('SummariesTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('加载后显示总结列表', async () => {
    mocks.listSummaries.mockResolvedValue([SUMMARY_1, SUMMARY_2, SUMMARY_DETAILED])

    render(<SummariesTab workspaceId="ws-1" itemId="item-1" />)

    await waitFor(() => {
      expect(screen.getByText('简洁摘要')).toBeTruthy()
      expect(screen.getByText('详细要点')).toBeTruthy()
    })

    // 版本号 — 用 getAllByText 因为列表和主显示区都有
    expect(screen.getAllByText(/v1/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('v2')).toBeTruthy()
  })

  it('自动选中第一项并渲染 markdown', async () => {
    mocks.listSummaries.mockResolvedValue([SUMMARY_1])

    render(<SummariesTab workspaceId="ws-1" itemId="item-1" />)

    await waitFor(() => {
      // 标题和 markdown 内容各出现一次
      expect(screen.getAllByText(/简洁摘要.*v1/).length).toBeGreaterThanOrEqual(1)
    })
    // markdown 内容
    expect(screen.getByText(/这是第一版摘要/)).toBeTruthy()
  })

  it('点击版本切换选中', async () => {
    mocks.listSummaries.mockResolvedValue([SUMMARY_1, SUMMARY_2])

    render(<SummariesTab workspaceId="ws-1" itemId="item-1" />)

    await waitFor(() => {
      expect(screen.getByText('v2')).toBeTruthy()
    })

    // 点击 v2
    fireEvent.click(screen.getByText('v2'))

    await waitFor(() => {
      expect(screen.getByText(/这是第二版/)).toBeTruthy()
    })
  })

  it('点击「+ 新建」展开面板，点击「生成」调用 createSummary', async () => {
    mocks.listSummaries.mockResolvedValue([SUMMARY_1])
    mocks.createSummary.mockResolvedValue(SUMMARY_2)

    render(<SummariesTab workspaceId="ws-1" itemId="item-1" />)

    await waitFor(() => {
      expect(screen.getByText('+ 新建')).toBeTruthy()
    })

    // 展开新建面板
    fireEvent.click(screen.getByText('+ 新建'))

    // 生成按钮
    const generateBtn = screen.getByText('生成')
    expect(generateBtn).toBeTruthy()

    // 点击生成
    fireEvent.click(generateBtn)

    await waitFor(() => {
      expect(mocks.createSummary).toHaveBeenCalledWith(
        'ws-1',
        'item-1',
        'concise',
        '',
      )
    })
  })

  it('点击删除调用 deleteSummary', async () => {
    mocks.listSummaries.mockResolvedValue([SUMMARY_1])
    mocks.deleteSummary.mockResolvedValue(undefined)

    render(<SummariesTab workspaceId="ws-1" itemId="item-1" />)

    await waitFor(() => {
      expect(screen.getByText('v1')).toBeTruthy()
    })

    // 主显示区的删除按钮
    const deleteButtons = screen.getAllByText('删除')
    fireEvent.click(deleteButtons[0])

    await waitFor(() => {
      expect(mocks.deleteSummary).toHaveBeenCalledWith('ws-1', 'item-1', 's1')
    })
  })

  it('空列表显示提示', async () => {
    mocks.listSummaries.mockResolvedValue([])

    render(<SummariesTab workspaceId="ws-1" itemId="item-1" />)

    await waitFor(() => {
      expect(screen.getByText(/暂无总结/)).toBeTruthy()
    })
  })
})
