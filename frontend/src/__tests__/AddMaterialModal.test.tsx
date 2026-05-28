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

vi.mock('@/lib/modelMemory', () => ({
  loadModelMemory: vi.fn(() => ({ textProviderId: '', textModelId: '', visionProviderId: '', visionModelId: '' })),
  saveModelMemory: vi.fn(),
}))

vi.mock('@/services/linkPreview', () => ({
  fetchLinkPreview: vi.fn(),
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

    // ① 区域：图片和文字类型卡都应该 active
    const imageCard = screen.getByRole('button', { name: /^图片/ })
    const textCard = screen.getByRole('button', { name: /^文字/ })
    expect(imageCard.dataset.active).toBe('true')
    expect(textCard.dataset.active).toBe('true')
    // 图片采集模式应显示
    expect(screen.getByText('图片采集模式')).toBeTruthy()
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

  // ── R21.P2.v2: 任务旁模型/截帧 picker ──

  it('av_combined 勾选画面分析 → 显示图片模型下拉 + 截帧模式', () => {
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

    // 画面分析默认勾上 → picker 出现
    const visualChip = screen.getByText('画面分析').closest('button')!
    expect(visualChip.dataset.on).toBe('true')
    // 图片模型 provider 下拉
    expect(screen.getByDisplayValue('图片模型 Provider')).toBeTruthy()
    // 截帧模式 radio
    expect(screen.getByLabelText('AI 镜头分析')).toBeTruthy()
    expect(screen.getByLabelText('按秒截帧')).toBeTruthy()
  })

  it('av_combined 不勾画面分析 → 图片模型下拉消失', () => {
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

    // 先取消画面分析
    const visualChip = screen.getByText('画面分析').closest('button')!
    fireEvent.click(visualChip)
    expect(visualChip.dataset.on).toBe('false')

    // 图片模型 provider 下拉应不存在
    expect(screen.queryByDisplayValue('图片模型 Provider')).toBeNull()
    // 截帧模式仍在③-b 视频用途模式的复刻模式下显示，不受影响
    expect(screen.getByLabelText('AI 镜头分析')).toBeTruthy()
  })

  it('av_combined 勾选综合笔记 → 显示文本模型下拉', () => {
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

    // 综合笔记默认勾上 → 文本模型下拉出现
    expect(screen.getByDisplayValue('文本模型 Provider')).toBeTruthy()

    // 取消综合笔记 → 下拉消失
    const synthesisChip = screen.getByText(/综合笔记/).closest('button')!
    fireEvent.click(synthesisChip)
    expect(screen.queryByDisplayValue('文本模型 Provider')).toBeNull()
  })

  it('sniff 单一 image 类型 → 无视频/音频 chip → 无模型 picker', () => {
    render(
      <AddMaterialModal
        open={true}
        onOpenChange={vi.fn()}
        workspaceIds={['ws-1']}
        sniffResult={{
          primary_type: 'image',
          possible_types: ['image'],
          platform: null,
          title: null,
          thumbnail: null,
          content_type_header: null,
        }}
      />,
    )

    // image 类型没有综合笔记/画面分析 chip → 无 picker
    expect(screen.queryByDisplayValue('文本模型 Provider')).toBeNull()
    expect(screen.queryByDisplayValue('图片模型 Provider')).toBeNull()
  })

  // ── R21.P3.S1 新增用例 ──

  it('文字素材跳过③④区域，直接显示提交按钮', () => {
    render(
      <AddMaterialModal
        open={true}
        onOpenChange={vi.fn()}
        workspaceIds={['ws-1']}
        sniffResult={{
          primary_type: 'text',
          possible_types: ['text'],
          platform: null,
          title: null,
          thumbnail: null,
          content_type_header: null,
        }}
      />,
    )

    // 文字素材不显示③ 分析任务和④ 识别用背景
    expect(screen.queryByText(/勾选分析任务/)).toBeNull()
    expect(screen.queryByText(/识别用背景/)).toBeNull()
    // 但仍显示提交按钮
    expect(screen.getByText('一键解析')).toBeTruthy()
  })

  it('图片素材必须选「复刻 or OCR」其一', () => {
    render(
      <AddMaterialModal
        open={true}
        onOpenChange={vi.fn()}
        workspaceIds={['ws-1']}
        sniffResult={{
          primary_type: 'image',
          possible_types: ['image'],
          platform: null,
          title: null,
          thumbnail: null,
          content_type_header: null,
        }}
      />,
    )

    // 图片采集模式应显示
    expect(screen.getByText('图片采集模式')).toBeTruthy()
    // 默认选中「提示词复刻」
    const replicaBtn = screen.getByRole('button', { name: /提示词复刻/ })
    expect(replicaBtn.dataset.active).toBe('true')
    // 切换到 OCR
    const ocrBtn = screen.getByRole('button', { name: /OCR 识别/ })
    fireEvent.click(ocrBtn)
    expect(ocrBtn.dataset.active).toBe('true')
    expect(replicaBtn.dataset.active).toBe('false')
  })

  it('视频素材学习/复刻切换 → 子参数变化', () => {
    render(
      <AddMaterialModal
        open={true}
        onOpenChange={vi.fn()}
        workspaceIds={['ws-1']}
        sniffResult={{
          primary_type: 'video',
          possible_types: ['video'],
          platform: 'bilibili',
          title: 'test video',
          thumbnail: null,
          content_type_header: null,
        }}
      />,
    )

    // 视频用途模式应显示
    expect(screen.getByText('视频用途模式')).toBeTruthy()
    // 默认选中「复刻/创作」
    const replicaBtn = screen.getByRole('button', { name: /复刻\/创作/ })
    expect(replicaBtn.dataset.active).toBe('true')
    // 复刻模式下应显示截帧策略
    expect(screen.getByLabelText('AI 镜头分析')).toBeTruthy()

    // 切换到学习模式
    const learningBtn = screen.getByRole('button', { name: /学习\/课程/ })
    fireEvent.click(learningBtn)
    expect(learningBtn.dataset.active).toBe('true')
    // 学习模式下应显示 ASR 必开 + 说话人 + 音乐分析
    expect(screen.getByText(/ASR 转写（学习模式必开）/)).toBeTruthy()
    expect(screen.getByText(/区分说话人音色/)).toBeTruthy()
    // 音乐分析在③ 区域和③-b 区域都可能出现，用 getAllByText
    expect(screen.getAllByText(/音乐分析/).length).toBeGreaterThanOrEqual(1)
  })

  it('链接预填回填识别用背景', async () => {
    const { fetchLinkPreview } = await import('@/services/linkPreview')
    vi.mocked(fetchLinkPreview).mockResolvedValue({
      title: '测试标题',
      description: '测试描述',
      image_url: null,
      source: 'og',
    })

    render(
      <AddMaterialModal
        open={true}
        onOpenChange={vi.fn()}
        workspaceIds={['ws-1']}
        urlValue="https://example.com/article"
        sniffResult={{
          primary_type: 'video',
          possible_types: ['video'],
          platform: null,
          title: null,
          thumbnail: null,
          content_type_header: null,
        }}
      />,
    )

    // 等待 debounce + 异步回填
    const textarea = await screen.findByDisplayValue(/测试标题/)
    expect(textarea).toBeTruthy()
    expect(screen.getByText(/已自动从网页抓取/)).toBeTruthy()
  })
})
