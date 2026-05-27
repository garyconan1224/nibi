import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const { getAVSynthesisMarkdownMock } = vi.hoisted(() => ({
  getAVSynthesisMarkdownMock: vi.fn(),
}))

vi.mock('@/services/workspaces', () => ({
  getAVSynthesisMarkdown: getAVSynthesisMarkdownMock,
  downloadAVSynthesisMd: vi.fn(),
}))

// remark-gfm 的 mdast-util-gfm-table 在 jsdom 环境下有兼容性问题（this.setData），
// mock react-markdown 直接渲染 children 以避免崩溃。
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <div data-testid="md">{children}</div>,
}))
vi.mock('remark-gfm', () => ({ default: () => (tree: unknown) => tree }))

import AVSynthesisResultPage from '../AVSynthesisResultPage'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/workspaces/:workspaceId/av-synthesis" element={<AVSynthesisResultPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AVSynthesisResultPage', () => {
  beforeEach(() => {
    getAVSynthesisMarkdownMock.mockReset()
  })

  it('渲染 markdown 内容 + 导出按钮', async () => {
    const md = '# 综合笔记\n\n## 全局摘要\n\n这是一段摘要文本。\n\n## 章节正文\n\n正文内容。'
    getAVSynthesisMarkdownMock.mockResolvedValue(md)

    renderAt('/workspaces/ws-1/av-synthesis')

    await waitFor(() => {
      expect(screen.getByTestId('md')).toBeTruthy()
    })

    // 验证 markdown 原文被传入渲染器
    expect(screen.getByTestId('md').textContent).toContain('全局摘要')
    expect(screen.getByTestId('md').textContent).toContain('摘要文本')

    // 验证 TOC 章节列表
    expect(screen.getByText('全局摘要')).toBeTruthy()
    expect(screen.getByText('章节正文')).toBeTruthy()

    // 验证导出按钮存在
    expect(screen.getByText('Markdown')).toBeTruthy()
    expect(screen.getByText('PDF')).toBeTruthy()
    expect(screen.getByText('Word')).toBeTruthy()
    expect(screen.getByText('Obsidian Vault')).toBeTruthy()

    // Markdown 按钮可点击（无 disabled 属性），其他灰态
    const mdBtn = screen.getByText('Markdown').closest('button')
    expect(mdBtn?.hasAttribute('disabled')).toBe(false)
    expect(screen.getByText('PDF').closest('button')?.hasAttribute('disabled')).toBe(true)
  })

  it('加载失败时显示错误信息', async () => {
    getAVSynthesisMarkdownMock.mockRejectedValue(new Error('综合笔记尚未生成'))

    renderAt('/workspaces/ws-1/av-synthesis')

    await waitFor(() => {
      expect(document.querySelector('.av-error')).toBeTruthy()
    })

    expect(document.querySelector('.av-error')!.textContent).toBe('综合笔记尚未生成')
    expect(screen.queryByTestId('md')).toBeNull()
  })
})
