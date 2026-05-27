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

  it('visual_only 范围下只显示 1 个 chip「画面分析」', () => {
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

    fireEvent.click(screen.getByRole('button', { name: /只看画面/ }))

    // R17: visual_only 只有 1 个 chip「画面分析」
    expect(screen.getByText('画面分析')).toBeTruthy()
    expect(screen.queryByText('文案总结')).toBeNull()
    expect(screen.queryByText('字幕导出')).toBeNull()
    expect(screen.queryByText('音乐分析')).toBeNull()
  })

  it('audio_only 范围下显示 2 个 chip「人声转写+总结 / 音乐分析」', () => {
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

    fireEvent.click(screen.getByRole('button', { name: /只听音频/ }))

    expect(screen.getByText('人声转写+总结')).toBeTruthy()
    expect(screen.getByText('音乐分析')).toBeTruthy()
    expect(screen.queryByText('说话人音色')).toBeNull()
    expect(screen.queryByText('字幕导出')).toBeNull()
  })

  it('av_combined 范围下显示「综合笔记 ⭐」+ 3 个子 chip', () => {
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

    // 默认就是 av_combined
    expect(screen.getByText(/综合笔记/)).toBeTruthy()
    expect(screen.getByText('画面分析')).toBeTruthy()
    expect(screen.getByText('人声转写+总结')).toBeTruthy()
    expect(screen.getByText('音乐分析')).toBeTruthy()
  })

  it('勾选综合笔记自动联动勾上画面分析 + 人声转写', async () => {
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

    // 默认 av_combined：综合笔记默认勾上
    const synthesisChip = screen.getByText(/综合笔记/).closest('button')!
    expect(synthesisChip.dataset.on).toBe('true')

    // 先取消综合笔记
    fireEvent.click(synthesisChip)
    expect(synthesisChip.dataset.on).toBe('false')

    // 手动取消画面分析
    const visualChip = screen.getByText('画面分析').closest('button')!
    fireEvent.click(visualChip)
    expect(visualChip.dataset.on).toBe('false')

    // 再勾上综合笔记 → 画面+转写应自动跟着勾上
    fireEvent.click(synthesisChip)
    expect(synthesisChip.dataset.on).toBe('true')
    expect(visualChip.dataset.on).toBe('true')
    const transcribeChip = screen.getByText('人声转写+总结').closest('button')!
    expect(transcribeChip.dataset.on).toBe('true')
  })

  it('综合笔记勾上 + 手动取消画面分析 → 显示精度下降 hint', async () => {
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

    // 默认 av_combined：综合笔记勾上
    // 手动取消画面分析
    const visualChip = screen.getByText('画面分析').closest('button')!
    fireEvent.click(visualChip)
    expect(visualChip.dataset.on).toBe('false')

    // 综合笔记 chip 下方应出现精度下降 hint
    expect(screen.getByText(/精度可能下降/)).toBeTruthy()
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

    // 点击 visual_only
    fireEvent.click(screen.getByRole('button', { name: /只看画面/ }))

    // 切回 av_combined
    fireEvent.click(screen.getByRole('button', { name: /音视频综合/ }))

    // 综合笔记应恢复默认勾选
    const synthesisChip = screen.getByText(/综合笔记/).closest('button')!
    expect(synthesisChip.dataset.on).toBe('true')
  })
})
