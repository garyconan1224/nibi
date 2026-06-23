import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Clock, Copy, FileText, Film, Image as ImageIcon, LayoutTemplate, Link2, Lock, PenTool, PlayCircle, Settings2, Target, Video, Wand2, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useProviderStore } from '@/store/providerStore'
import type { SniffResult } from '@/services/workspaces'
import {
  autoCreateWorkspace,
  generateNote,
  probeDuration,
  probeItemMedia,
  savePreflight,
  sniffUrl,
  startItemPipeline,
} from '@/services/workspaces'
import { fetchLinkPreview } from '@/services/linkPreview'
import type {
  AnalysisScope,
  ItemType,
  WorkspaceBackground,
} from '@/types/workspace'

export interface StagedConfig {
  types: ItemType[]
  features: Partial<Record<ItemType, Record<string, boolean>>>
  tasks?: Partial<Record<ItemType, Record<string, unknown>>>
  models?: Record<string, string>
  background: Partial<WorkspaceBackground>
  workspaceIds: string[]
  urlValue?: string
  analysisScope?: AnalysisScope
  videoIntent?: 'learning' | 'replica'
  imageMode?: 'replica_prompt' | 'ocr'
}

interface AddMaterialModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceIds: string[]
  workspaceBackgrounds?: Record<string, WorkspaceBackground>
  sniffResult?: SniffResult | null
  urlValue?: string
  onAdded?: () => void
  /** 本地文件：上传后的 item ID */
  localFile?: string
  /** 本地文件：原始文件名 */
  localFileName?: string
  /** 本地文件：所在 workspace ID */
  localWsId?: string
}

type NoteMediaKind = 'auto' | 'video' | 'image_text' | 'audio'
type ActionType = 'note' | 'replica' | 'ai_video' | 'storyboard' | 'rewrite'

const NOTE_TYPE_CARDS: { value: NoteMediaKind; label: string; desc: string }[] = [
  { value: 'auto', label: '自动识别', desc: '由系统判断笔记类型' },
  { value: 'video', label: '视频笔记', desc: '视频转写 + 时间戳 + 截帧' },
  { value: 'image_text', label: '图文笔记', desc: '逐图视觉理解 + 文字提取 + 按类型总结' },
  { value: 'audio', label: '音频笔记', desc: '音频转写 + 章节整理' },
]

const NOTE_STYLE_OPTIONS: { id: string; label: string }[] = [
  { id: 'standard', label: '标准总结' },
  { id: 'concise', label: '精简摘要' },
  { id: 'detailed', label: '详细要点' },
  { id: 'quotes', label: '金句提取' },
  { id: 'outline', label: '大纲' },
  { id: 'meeting', label: '会议纪要' },
  { id: 'lecture', label: '教学笔记' },
  { id: 'interview', label: '访谈整理' },
  { id: 'shownotes', label: '播客 shownotes' },
  { id: 'oral', label: '口播稿' },
  { id: 'steps', label: '步骤教程' },
  { id: 'xhs', label: '小红书风格' },
  { id: 'longform', label: '公众号长文' },
  { id: 'qa', label: '问答卡(Anki)' },
  { id: 'actions', label: '行动清单' },
  { id: 'tool_recommendation', label: '工具推荐' },
  { id: 'science_popularization', label: '知识科普' },
]

/** 智能截帧间隔：按时长取约 25 张画面，clamp 到 5~60 秒；拿不到时长默认 10 */
function computeAutoInterval(durationSec?: number): number {
  if (!durationSec || durationSec <= 0) return 10
  return Math.min(60, Math.max(5, Math.round(durationSec / 25)))
}

/** 预估帧数：时长 ÷ 间隔，四舍五入、至少 1；拿不到时长返回 0（UI 显示「识别后显示」）*/
function estimateFrames(durationSec: number, intervalSec: number): number {
  if (durationSec <= 0 || intervalSec <= 0) return 0
  return Math.max(1, Math.round(durationSec / intervalSec))
}

/** 秒数 → M:SS */
function formatDuration(sec: number): string {
  if (sec <= 0) return ''
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function AddMaterialModal({
  open,
  onOpenChange,
  workspaceIds,
  sniffResult,
  urlValue,
  onAdded,
  localFile,
  localFileName,
  localWsId,
}: AddMaterialModalProps) {
  const isLocalFile = !!localFile
  const navigate = useNavigate()
  const { providers, providerModels, fetchProviders } = useProviderStore()
  const [internalUrl, setInternalUrl] = useState('')
  const [internalSniff, setInternalSniff] = useState<SniffResult | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [selectedAction, setSelectedAction] = useState<ActionType>('note')
  const [selectedNoteType, setSelectedNoteType] = useState<NoteMediaKind>('auto')
  const [replicaKind, setReplicaKind] = useState<'prompt' | 'story' | 'compete'>('prompt')
  const [embedFrames, setEmbedFrames] = useState(false) // R4.7: 默认关，检测到视觉模型后自动开
  const [selectedVisionModel, setSelectedVisionModel] = useState('') // 空=用系统默认
  const [frameInterval, setFrameInterval] = useState(5)
  const [captureMode, setCaptureMode] = useState<'auto' | 'manual'>('auto')
  const [videoDuration, setVideoDuration] = useState(0) // 探测到的视频时长（秒），0=未知
  const [coverUrl, setCoverUrl] = useState('') // sniff 没给封面时，用 link-preview 补的封面
  const [localCover, setLocalCover] = useState('') // 本地文件：后端 cv2 探测的首帧封面 static URL
  const [error, setError] = useState<string | null>(null)
  const [sniffFailed, setSniffFailed] = useState(false)
  const [diarizeOn, setDiarizeOn] = useState(false)
  const [userNotes, setUserNotes] = useState('')
  const [noteStyle, setNoteStyle] = useState('standard')
  const sniffTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // R4.7: 收集所有可用视觉模型（provider 有 vision 能力 + 模型有 vision 标签）
  const visionModels = providers
    .filter(p => p.enabled && p.capabilities?.includes('vision'))
    .flatMap(p => (providerModels[p.id] ?? [])
      .filter(m => !m.capabilities || m.capabilities.includes('vision'))
      .map(m => ({ providerId: p.id, providerName: p.name, modelId: m.id, modelName: m.name }))
    )
  const hasVisionModel = visionModels.length > 0

  // 首次打开弹窗时：拉最新 providers；有视觉模型则默认开配图
  useEffect(() => {
    if (open) {
      fetchProviders()
    }
  }, [open, fetchProviders])

  // providers 加载完成后，若用户还没手动改过开关，自动设置默认值
  const userToggledRef = useRef(false)
  useEffect(() => {
    if (!userToggledRef.current) {
      setEmbedFrames(hasVisionModel)
    }
  }, [hasVisionModel])

  // 本地文件不参与链接识别：屏蔽 url/sniff，避免残留的 sniffResult 误显示「已识别视频」卡片、
  // 也避免链接探测 useEffect 把 probeItemMedia 探到的本地时长清零覆盖。
  const effectiveUrl = isLocalFile ? '' : (urlValue ?? internalUrl).trim()
  const effectiveSniff = isLocalFile ? null : (sniffResult ?? internalSniff)
  const workspaceSummary =
    workspaceIds.length > 1
      ? `${workspaceIds.length} 个合集`
      : workspaceIds.length === 1
        ? '当前合集'
        : '未选择合集'
  const sourceSummary = isLocalFile
    ? (localFileName || '本地文件')
    : effectiveSniff?.title
      ? `${effectiveSniff.platform ?? '未知平台'} · ${effectiveSniff.title}`
      : effectiveUrl
        ? '网络链接'
        : '输入素材链接'

  const doSniff = useCallback(async (url: string) => {
    try {
      setSniffFailed(false)
      setInternalSniff(await sniffUrl(url))
    } catch {
      setInternalSniff(null)
      setSniffFailed(true)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    setInternalUrl('')
    setInternalSniff(null)
    setSniffFailed(false)
    setDiarizeOn(false)
    setUserNotes('')
    setNoteStyle('standard')
    setSelectedAction('note')
    setError(null)
    setSubmitting(false)
    // embedFrames 由 auto-detect effect 根据 hasVisionModel 设置，不在这里强制
  }, [open, urlValue])

  useEffect(() => {
    if (!open || !urlValue?.trim()) return
    void doSniff(urlValue.trim())
  }, [open, urlValue, doSniff])

  useEffect(() => {
    if (!open || urlValue || !internalUrl.trim()) return
    clearTimeout(sniffTimer.current)
    sniffTimer.current = setTimeout(() => {
      void doSniff(internalUrl.trim())
    }, 500)
    return () => clearTimeout(sniffTimer.current)
  }, [open, internalUrl, urlValue, doSniff])

  // 识别为视频后，轻量探测时长（供「取画面」算预估帧数）；非视频/拿不到 → 0
  useEffect(() => {
    if (isLocalFile) return // 本地文件时长由下方 probeItemMedia useEffect 负责，不在此清零
    if (!open || !effectiveUrl || effectiveSniff?.primary_type !== 'video') {
      setVideoDuration(0)
      return
    }
    let cancelled = false
    probeDuration(effectiveUrl)
      .then((r) => { if (!cancelled) setVideoDuration(r.duration_sec || 0) })
      .catch(() => { if (!cancelled) setVideoDuration(0) })
    return () => { cancelled = true }
  }, [open, effectiveUrl, effectiveSniff?.primary_type, isLocalFile])

  // 本地文件：上传后用后端 cv2 探测时长 + 首帧封面（支持 flv 等 HTML5 video 播不了的格式）
  useEffect(() => {
    if (!open || !isLocalFile || !localFile || !localWsId) return
    let cancelled = false
    setVideoDuration(0)
    setLocalCover('')
    probeItemMedia(localWsId, localFile)
      .then((r) => {
        if (cancelled) return
        setVideoDuration(r.duration_sec || 0)
        setLocalCover(r.cover_url || '')
      })
      .catch(() => { /* 探测失败降级，不阻塞添加 */ })
    return () => { cancelled = true }
  }, [open, isLocalFile, localFile, localWsId])

  // sniff 对已知平台（B站等）只做 O(1) 类型判断、不返回封面 → 用 link-preview 补封面
  useEffect(() => {
    setCoverUrl('')
    if (!open || !effectiveUrl || !effectiveSniff || effectiveSniff.thumbnail) return
    let cancelled = false
    fetchLinkPreview(effectiveUrl)
      .then((p) => {
        if (cancelled || !p.image_url) return
        // B站封面是协议相对 URL（//i1.hdslb.com/...），补 https 否则 localhost(http) 下加载失败
        setCoverUrl(p.image_url.startsWith('//') ? `https:${p.image_url}` : p.image_url)
      })
      .catch(() => { /* link-preview 已内部兜底，忽略 */ })
    return () => { cancelled = true }
  }, [open, effectiveUrl, effectiveSniff, effectiveSniff?.thumbnail])

  const handleGenerateNote = async () => {
    if (isLocalFile) {
      // 本地文件：savePreflight + startItemPipeline，绕开 generateNote 的 URL 校验
      if (!localFile) return
      setSubmitting(true)
      setError(null)
      try {
        const wsId = localWsId || workspaceIds[0]
        if (!wsId) { setError('未找到合集'); return }
        const videoTask = selectedNoteType === 'auto' || selectedNoteType === 'video'
        const effInterval = videoTask
          ? (captureMode === 'auto' ? computeAutoInterval(videoDuration) : frameInterval)
          : undefined
        const videoModelId = selectedVisionModel === '__default__' || !selectedVisionModel ? undefined : selectedVisionModel
        await savePreflight(wsId, localFile, {
          intent: selectedAction === 'replica' ? 'replica' : 'learning',
          background_overrides: {
            // 后端 /start 从 background_overrides 读 frame_interval_sec
            ...(effInterval != null ? { frame_interval_sec: effInterval } : {}),
          },
          models: {
            ...(videoModelId ? { vision: videoModelId } : {}),
          },
          tasks: {
            // 后端 /start 从 tasks.summary 读 embed_frames → payload.preflight.embed_frames
            summary: {
              embed_frames: videoTask ? embedFrames : false,
              summary_template: noteStyle,
              diarize: diarizeOn,
            },
            // 复刻二级类型（后端 /start 透传到 payload）
            ...(selectedAction === 'replica' ? { replica_kind: replicaKind } : {}),
          },
        })
        const { task_id } = await startItemPipeline(wsId, localFile)
        toast.success('任务已创建', { description: localFileName || '本地文件' })
        onAdded?.()
        onOpenChange(false)
        navigate(`/processing/${task_id}`, { state: { url: localFileName || '', workspaceId: wsId, itemId: localFile, taskType: selectedAction === 'replica' ? 'replica' : 'note' } })
      } catch (e) {
        const msg = e instanceof Error ? e.message : '提交失败'
        setError(msg)
        toast.error(msg)
      } finally {
        setSubmitting(false)
      }
      return
    }

    // 链接提交：维持原有 generateNote 路径
    if (!effectiveUrl) {
      setError('请先输入素材链接')
      return
    }
    setSubmitting(true)
    setError(null)

    try {
      let wsId = workspaceIds[0]
      if (!wsId) {
        const ws = await autoCreateWorkspace({ hint_url: effectiveUrl })
        wsId = ws.workspace_id
        toast.info(`已自动创建合集「${ws.name}」`)
      }

      // SniffResult 暂无 duration 字段，智能档兜底默认 10 秒
      const effInterval =
        captureMode === 'auto' ? computeAutoInterval(videoDuration) : frameInterval
      const effVisionModel = selectedVisionModel === '__default__' ? '' : selectedVisionModel
      const result = await generateNote(
        wsId, effectiveUrl, effectiveSniff?.title ?? undefined,
        embedFrames, selectedAction === 'replica' ? 'replica_prompt' : 'vision', effInterval, effVisionModel,
        selectedAction === 'replica' ? 'replica' : 'note', selectedNoteType,
        { diarize: diarizeOn, summary_template: noteStyle, user_notes: userNotes, ...(selectedAction === 'replica' ? { replica_kind: replicaKind } : {}) },
      )
      toast.success(selectedAction === 'replica' ? '复刻任务已创建' : '笔记生成中', { description: `${result.item_type} · ${effectiveUrl}` })

      onAdded?.()
      onOpenChange(false)
      navigate(`/processing/${result.task_id}`, {
        state: { url: effectiveUrl, workspaceId: wsId, taskType: selectedAction === 'replica' ? 'replica' : 'note', itemId: result.item_id, itemType: result.item_type },
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '任务创建失败'
      setError(msg)
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="remix-modal-content"
        overlayClassName="remix-modal-backdrop"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">添加素材</DialogTitle>
        <DialogDescription className="sr-only">
          输入素材链接并生成笔记或复刻
        </DialogDescription>

        <div className="m-head">
          <div>
            <div className="eyebrow">ADD MATERIAL · 添加素材</div>
            <h3 className="display" style={{ fontSize: 28, margin: '4px 0 0' }}>
              添加素材
            </h3>
            <p className="modal-subtitle">{workspaceSummary} · {sourceSummary}</p>
          </div>
          <DialogClose className="btn btn-ghost modal-close">
            <X size={16} />
          </DialogClose>
        </div>

        <div className="m-body">
          {error && <div className="modal-error">{error}</div>}

          {/* ① 视频源 */}
          <div className="m-section">
            <div className="eyebrow" style={{ marginBottom: 10 }}>① 视频源</div>
            {isLocalFile ? (
              <div className="sniff-card">
                <div className="sniff-thumb">
                  {localCover ? (
                    <img
                      src={localCover}
                      alt=""
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  ) : (
                    <PlayCircle size={20} style={{ color: 'var(--ink-3)' }} />
                  )}
                </div>
                <div className="sniff-meta">
                  <div className="sniff-title">{localFileName || '本地文件'}</div>
                  <div className="sniff-tags">
                    {videoDuration > 0 && (
                      <span className="kw" style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        <Clock size={11} /> {formatDuration(videoDuration)}
                      </span>
                    )}
                    <span className="sniff-ok">
                      <CheckCircle2 size={11} /> 已上传
                    </span>
                  </div>
                </div>
              </div>
            ) : urlValue ? (
              <div className="composer-url modal-composer-url">
                <div className="platform"><Link2 size={16} /></div>
                <span className="modal-source-value">{urlValue}</span>
                <span className="kw">Composer 传入</span>
              </div>
            ) : (
              <div className="composer-url modal-composer-url">
                <div className="platform"><Link2 size={16} /></div>
                <input
                  value={internalUrl}
                  onChange={(e) => {
                    setInternalUrl(e.target.value)
                    setError(null)
                    setInternalSniff(null)
                  }}
                  placeholder="B站 / 小红书 / 抖音 / YouTube / 本地文件路径"
                />
              </div>
            )}
            {!isLocalFile && !urlValue && !effectiveSniff && (
              <div className="modal-kw-row">
                <span className="kw"><Link2 size={11} /> 支持网络链接</span>
                <span className="kw">本地版无大小限制</span>
                <span className="kw" data-state={internalSniff ? 'recognized' : undefined}>
                  {internalSniff ? '已识别' : '输入后自动识别'}
                </span>
              </div>
            )}
            {effectiveSniff && (
              <div className="sniff-card">
                <div className="sniff-thumb">
                  {(effectiveSniff.thumbnail || coverUrl) ? (
                    <img
                      src={effectiveSniff.thumbnail || coverUrl}
                      alt=""
                      referrerPolicy="no-referrer"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  ) : (
                    <ImageIcon size={20} style={{ color: 'var(--ink-3)' }} />
                  )}
                  <PlayCircle size={22} className="sniff-play" />
                </div>
                <div className="sniff-meta">
                  <div className="sniff-title">
                    {effectiveSniff.title || '已识别视频'}
                  </div>
                  <div className="sniff-tags">
                    {effectiveSniff.platform && (
                      <span className="kw" style={{ fontSize: 11 }}>{effectiveSniff.platform}</span>
                    )}
                    {videoDuration > 0 && (
                      <span className="kw" style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        <Clock size={11} /> {formatDuration(videoDuration)}
                      </span>
                    )}
                    <span className="sniff-ok">
                      <CheckCircle2 size={11} /> 链接有效
                    </span>
                  </div>
                </div>
              </div>
            )}
            {sniffFailed && !effectiveSniff && effectiveUrl && (
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 6 }}>
                无法识别该链接，可仍尝试提交
              </div>
            )}
          </div>

          {/* ② 你要做什么 */}
          <div className="m-section">
            <div className="eyebrow" style={{ marginBottom: 10 }}>② 你要做什么</div>
            <div className="note-type-grid" style={{ marginBottom: 14 }}>
              <button
                type="button"
                className="note-type-card"
                data-active={selectedAction === 'note'}
                onClick={() => setSelectedAction('note')}
              >
                <div className="ntc-l"><FileText size={16} style={{ display: 'inline', verticalAlign: '-3px', marginRight: 4 }} /> 学习笔记</div>
                <div className="ntc-d">沉浸式阅读与总结提取</div>
              </button>
              <button
                type="button"
                className="note-type-card"
                data-active={selectedAction === 'replica'}
                onClick={() => setSelectedAction('replica')}
              >
                <div className="ntc-l"><Copy size={16} style={{ display: 'inline', verticalAlign: '-3px', marginRight: 4 }} /> 逐帧复刻</div>
                <div className="ntc-d">提取画面提示词与详细信息</div>
              </button>
            </div>

            {/* 复刻二级：选择复刻类型 */}
            {selectedAction === 'replica' && (
              <div className="note-type-grid" style={{ marginBottom: 14 }}>
                <button
                  type="button"
                  className="note-type-card"
                  data-active={replicaKind === 'prompt'}
                  onClick={() => setReplicaKind('prompt')}
                >
                  <div className="ntc-l"><Copy size={16} style={{ display: 'inline', verticalAlign: '-3px', marginRight: 4 }} /> 复刻提示词</div>
                  <div className="ntc-d">逐帧画面描述 → AI 生图/生视频提示词</div>
                </button>
                <button
                  type="button"
                  className="note-type-card"
                  data-active={false}
                  disabled
                  style={{ opacity: 0.5, cursor: 'not-allowed' }}
                >
                  <div className="ntc-l"><Film size={16} style={{ display: 'inline', verticalAlign: '-3px', marginRight: 4 }} /> 拉片分析 <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>即将上线</span></div>
                  <div className="ntc-d">逐镜头拆解景别/构图/运镜/转场</div>
                </button>
                <button
                  type="button"
                  className="note-type-card"
                  data-active={false}
                  disabled
                  style={{ opacity: 0.5, cursor: 'not-allowed' }}
                >
                  <div className="ntc-l"><Target size={16} style={{ display: 'inline', verticalAlign: '-3px', marginRight: 4 }} /> 竞品对标 <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>即将上线</span></div>
                  <div className="ntc-d">内容结构/爆点/钩子/节奏拆解</div>
                </button>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginBottom: selectedAction === 'note' ? 24 : 0 }}>
              {[{ id: 'ai_video', label: 'AI视频', icon: <Video size={12} /> },
                { id: 'storyboard', label: '分镜脚本', icon: <LayoutTemplate size={12} /> },
                { id: 'rewrite', label: '二创改写', icon: <PenTool size={12} /> }].map(item => (
                <button
                  key={item.id}
                  type="button"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '6px 10px', fontSize: 12, color: 'var(--ink-3)',
                    border: '1px dashed var(--border)', borderRadius: 6,
                    background: 'var(--bg-subtle)'
                  }}
                  onClick={() => toast('该功能即将上线')}
                >
                  {item.icon} {item.label} <Lock size={10} style={{ marginLeft: 2 }} />
                </button>
              ))}
            </div>

            {selectedAction === 'note' && (
              <>
                <div className="eyebrow" style={{ marginBottom: 10 }}>③ 笔记设置</div>
                <div className="note-type-grid">
                  {NOTE_TYPE_CARDS.map(card => {
                    const active = selectedNoteType === card.value
                    return (
                      <button
                        key={card.value}
                        type="button"
                        className="note-type-card"
                        data-active={active}
                        onClick={() => setSelectedNoteType(card.value)}
                      >
                        <div className="ntc-l">{card.label}</div>
                        <div className="ntc-d">{card.desc}</div>
                      </button>
                    )
                  })}
                </div>
                <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="gen-field">
                    <span className="gen-field-label">笔记风格</span>
                    <Select value={noteStyle} onValueChange={setNoteStyle}>
                      <SelectTrigger style={{ fontSize: 13 }}>
                        <SelectValue placeholder="选择风格" />
                      </SelectTrigger>
                      <SelectContent>
                        {NOTE_STYLE_OPTIONS.map(opt => (
                          <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <label htmlFor="add-material-embed" className="gen-toggle">
                    <Switch id="add-material-embed" checked={embedFrames} onCheckedChange={(v) => { userToggledRef.current = true; setEmbedFrames(v) }} />
                    <span className="gen-toggle-text">
                      <span className="gen-field-label">笔记里配图</span>
                      <span className="kw" style={{ fontSize: 11 }}>打开＝带图笔记（自动挑有信息的画面）；关闭＝纯文字笔记</span>
                    </span>
                  </label>
                  {embedFrames && visionModels.length > 0 && (
                    <div className="gen-field">
                      <span className="gen-field-label">视觉模型</span>
                      <Select value={selectedVisionModel} onValueChange={setSelectedVisionModel}>
                        <SelectTrigger style={{ fontSize: 13 }}>
                          <SelectValue placeholder="系统默认" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__default__">系统默认</SelectItem>
                          {visionModels.map(vm => (
                            <SelectItem key={vm.modelId} value={vm.modelId}>
                              {vm.providerName} · {vm.modelName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {embedFrames && !hasVisionModel && (
                    <span className="kw" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                      未检测到视觉模型，将使用纯文字总结。可在「设置 → 模型」中添加。
                    </span>
                  )}
                  {(selectedNoteType === 'auto' || selectedNoteType === 'video') && embedFrames && hasVisionModel && (() => {
                    const autoInterval = computeAutoInterval(videoDuration)
                    const autoFrames = estimateFrames(videoDuration, autoInterval)
                    const manualFrames = estimateFrames(videoDuration, frameInterval)
                    return (
                      <div className="gen-field">
                        <span className="gen-field-label">取画面</span>
                        <div className="gen-card-grid">
                          <div className="gen-card" data-on={captureMode === 'auto'} onClick={() => setCaptureMode('auto')}>
                            <div className="gen-card-head">
                              <Wand2 size={15} style={{ color: 'var(--accent-warm)' }} />
                              <span className="gen-card-title">智能</span>
                            </div>
                            <div className="kw" style={{ fontSize: 11 }}>按时长自动</div>
                            <div className="kw" style={{ fontSize: 11, marginTop: 4 }}>
                              {videoDuration > 0 ? `每 ${autoInterval} 秒 · 约 ${autoFrames} 张` : '识别后显示'}
                            </div>
                          </div>
                          <div className="gen-card" data-on={captureMode === 'manual'} onClick={() => setCaptureMode('manual')}>
                            <div className="gen-card-head">
                              <Settings2 size={15} style={{ color: captureMode === 'manual' ? 'var(--accent-warm)' : 'var(--ink-3)' }} />
                              <span className="gen-card-title">手动</span>
                            </div>
                            <div className="kw" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                              每隔
                              <input
                                className="gen-num-input"
                                type="number" min={1} max={60} value={frameInterval}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => setFrameInterval(Number(e.target.value) || 5)}
                              />
                              秒
                            </div>
                            <div className="kw" style={{ fontSize: 11, marginTop: 4 }}>
                              {videoDuration > 0 ? `约 ${manualFrames} 张` : '识别后显示'}
                            </div>
                          </div>
                        </div>
                        {videoDuration > 0 && (
                          <div className="kw" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                            视频时长 {formatDuration(videoDuration)} · 识别时获取
                          </div>
                        )}
                      </div>
                    )
                  })()}
                  <label className="gen-toggle">
                    <Switch checked={diarizeOn} onCheckedChange={setDiarizeOn} />
                    <span className="gen-toggle-text">
                      <span className="gen-field-label">区分发言人</span>
                      <span className="kw" style={{ fontSize: 11 }}>开启后在转写中标注不同说话人（实验功能）</span>
                    </span>
                  </label>
                  <div className="gen-field">
                    <span className="gen-field-label">补充说明</span>
                    <Textarea
                      value={userNotes}
                      onChange={(e) => setUserNotes(e.target.value)}
                      placeholder="可选：输入额外要求或上下文，会在生成时附加给模型"
                      style={{ fontSize: 13, minHeight: 60 }}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="m-foot">
          <span className="mono modal-foot-status">
            <span className="chip-dot" style={{ marginRight: 6 }} />
            {selectedAction === 'replica' ? '复刻' : '笔记'}
            {selectedAction === 'note' && selectedNoteType !== 'auto'
              ? ` · ${NOTE_TYPE_CARDS.find(c => c.value === selectedNoteType)?.label ?? ''}`
              : ''}
          </span>
          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleGenerateNote}
              disabled={(!isLocalFile && !effectiveUrl) || submitting}
              title="开始生成"
            >
              {submitting ? (
                '处理中…'
              ) : (
                <>
                  <Wand2 size={14} />
                  开始生成
                </>
              )}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
