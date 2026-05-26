import { render, screen, fireEvent } from '@testing-library/react'
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

describe('AddMaterialModal', () => {
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

  it('sniff 返回 video+audio 时应显示 3 张分析范围卡（非类型卡）', () => {
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

    // 应显示分析范围标题
    expect(screen.getByText(/分析范围/)).toBeTruthy()
    // 三张范围卡应存在
    expect(screen.getByRole('button', { name: /只听音频/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /只看画面/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /音视频综合/ })).toBeTruthy()
    // 默认选中 av_combined
    const avCard = screen.getByRole('button', { name: /音视频综合/ })
    expect(avCard.dataset.active).toBe('true')
  })

  it('sniff 只有 video 时不显示分析范围卡', () => {
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

    // 应显示素材类型标题而非分析范围
    expect(screen.getByText('① 素材类型')).toBeTruthy()
    expect(screen.queryByText(/分析范围/)).toBeNull()
  })

  it('visual_only 范围下隐藏字幕导出和音乐分析 chip', () => {
    render(
      <AddMaterialModal
        open={true}
        onOpenChange={vi.fn()}
        workspaceIds={['ws-1']}
        sniffResult={{
          primary_type: 'video',
          possible_types: ['video', 'audio'],
          platform: 'bilibili',
          title: 'test',
          thumbnail: null,
          content_type_header: null,
        }}
      />,
    )

    // 点击 visual_only 范围卡
    fireEvent.click(screen.getByRole('button', { name: /只看画面/ }))

    // visual_only 下只显示 2 个 chip
    expect(screen.queryByText('字幕导出')).toBeNull()
    expect(screen.queryByText('音乐分析')).toBeNull()
    expect(screen.getByText('画面提示词')).toBeTruthy()
    expect(screen.getByText('文案总结')).toBeTruthy()
  })

  it('av_combined 范围下显示完整 4 个 video chip', () => {
    render(
      <AddMaterialModal
        open={true}
        onOpenChange={vi.fn()}
        workspaceIds={['ws-1']}
        sniffResult={{
          primary_type: 'video',
          possible_types: ['video', 'audio'],
          platform: 'bilibili',
          title: 'test',
          thumbnail: null,
          content_type_header: null,
        }}
      />,
    )

    // 点击 av_combined 确保 selectedTypes 收窄为 video，chips 按 scope 过滤
    fireEvent.click(screen.getByRole('button', { name: /音视频综合/ }))

    // av_combined 显示全部 4 个 chip
    expect(screen.getByText('画面提示词')).toBeTruthy()
    expect(screen.getByText('文案总结')).toBeTruthy()
    expect(screen.getByText('字幕导出')).toBeTruthy()
    expect(screen.getByText('音乐分析')).toBeTruthy()
  })

  it('从 av_combined 切到 visual_only 时清空已勾 features', async () => {
    render(
      <AddMaterialModal
        open={true}
        onOpenChange={vi.fn()}
        workspaceIds={['ws-1']}
        sniffResult={{
          primary_type: 'video',
          possible_types: ['video', 'audio'],
          platform: 'bilibili',
          title: 'test',
          thumbnail: null,
          content_type_header: null,
        }}
      />,
    )

    // 点击 av_combined 收窄到 video，chips 过滤后只有一个音乐分析
    fireEvent.click(screen.getByRole('button', { name: /音视频综合/ }))

    const musicChip = screen.getByText('音乐分析').closest('button')!
    expect(musicChip.dataset.on).toBe('false')

    // 手动勾上音乐分析
    fireEvent.click(musicChip)
    expect(musicChip.dataset.on).toBe('true')

    // 切到 visual_only
    fireEvent.click(screen.getByRole('button', { name: /只看画面/ }))

    // 切回 av_combined
    fireEvent.click(screen.getByRole('button', { name: /音视频综合/ }))

    // 音乐分析应回到未勾状态
    const musicChipAfter = screen.getByText('音乐分析').closest('button')!
    expect(musicChipAfter.dataset.on).toBe('false')
  })
})
