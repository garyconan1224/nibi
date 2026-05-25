import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AddMaterialModal } from '@/components/workspace/AddMaterialModal'

const { navigateMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}))

vi.mock('@/services/workspaces', () => ({
  sniffUrl: vi.fn(),
  autoCreateWorkspace: vi.fn(),
  addWorkspaceItem: vi.fn(),
  savePreflight: vi.fn(),
  startItemPipeline: vi.fn(),
}))

describe('AddMaterialModal — R7.2 单 URL 多类型默认全勾', () => {
  it('sniff 返回 image+text 两种类型时应默认全选', () => {
    render(
      <AddMaterialModal
        open={true}
        onOpenChange={vi.fn()}
        workspaceIds={['ws-1']}
        sniffResult={{
          primary_type: 'image',
          possible_types: ['image', 'text'],
          platform: null,
          title: null,
          thumbnail: null,
          content_type_header: null,
        }}
      />,
    )

    // 两种类型的 type-card 都应为 data-active 态
    const cards = screen.getAllByRole('button', { name: /图片|文字/ })
    expect(cards).toHaveLength(2)
    for (const card of cards) {
      expect(card.dataset.active).toBe('true')
    }
  })

  it('sniff 返回单一类型时 locked 单选', () => {
    render(
      <AddMaterialModal
        open={true}
        onOpenChange={vi.fn()}
        workspaceIds={['ws-1']}
        sniffResult={{
          primary_type: 'video',
          possible_types: ['video'],
          platform: 'bilibili',
          title: 'test',
          thumbnail: null,
          content_type_header: null,
        }}
      />,
    )

    const card = screen.getByRole('button', { name: /视频/ })
    expect(card.dataset.active).toBe('true')
  })
})
