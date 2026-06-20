import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Clock, Image as ImageIcon, Link2, PlayCircle, Settings2, Wand2, X } from 'lucide-react'
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
  sniffUrl,
} from '@/services/workspaces'
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
  initialStaged?: StagedConfig
  onAdded?: () => void
  onFineTune?: (staged: StagedConfig) => void
}

type NoteMediaKind = 'auto' | 'video' | 'image_text' | 'audio'

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
  onFineTune,
}: AddMaterialModalProps) {
  void onFineTune
  const navigate = useNavigate()
  const { providers, providerModels, fetchProviders } = useProviderStore()
  const [internalUrl, setInternalUrl] = useState('')
  const [internalSniff, setInternalSniff] = useState<SniffResult | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [selectedNoteType, setSelectedNoteType] = useState<NoteMediaKind>('auto')
  const [embedFrames, setEmbedFrames] = useState(false) // R4.7: 默认关，检测到视觉模型后自动开
  const [selectedVisionModel, setSelectedVisionModel] = useState('') // 空=用系统默认
  const [frameInterval, setFrameInterval] = useState(5)
  const [captureMode, setCaptureMode] = useState<'auto' | 'manual'>('auto')
  const [videoDuration, setVideoDuration] = useState(0) // 探测到的视频时长（秒），0=未知
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
    if (!userToggledRef.current && hasVisionModel) {
      setEmbedFrames(true)
    }
  }, [hasVisionModel])

  const effectiveUrl = (urlValue ?? internalUrl).trim()
  const effectiveSniff = sniffResult ?? internalSniff
  const workspaceSummary =
    workspaceIds.length > 1
      ? `${workspaceIds.length} 个合集`
      : workspaceIds.length === 1
        ? '当前合集'
        : '未选择合集'
  const sourceSummary = effectiveSniff?.title
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
    setError(null)
    setSubmitting(false)
    setEmbedFrames(true)
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
    if (!open || !effectiveUrl || effectiveSniff?.primary_type !== 'video') {
      setVideoDuration(0)
      return
    }
    let cancelled = false
    probeDuration(effectiveUrl)
      .then((r) => { if (!cancelled) setVideoDuration(r.duration_sec || 0) })
      .catch(() => { if (!cancelled) setVideoDuration(0) })
    return () => { cancelled = true }
  }, [open, effectiveUrl, effectiveSniff?.primary_type])

  const handleGenerateNote = async () => {
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
        embedFrames, 'vision', effInterval, effVisionModel,
        'note', selectedNoteType,
        { diarize: diarizeOn, summary_template: noteStyle, user_notes: userNotes },
      )
      toast.success('笔记生成中', { description: `${result.item_type} · ${effectiveUrl}` })

      onAdded?.()
      onOpenChange(false)
      navigate(`/processing/${result.task_id}`, {
        state: { url: effectiveUrl, workspaceId: wsId, taskType: 'note', itemId: result.item_id },
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '生成笔记失败'
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
          输入素材链接并生成笔记
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
            {urlValue ? (
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
            {!urlValue && !effectiveSniff && (
              <div className="modal-kw-row">
                <span className="kw"><Link2 size={11} /> 支持网络链接</span>
                <span className="kw">本地版无大小限制</span>
                <span className="kw" data-state={internalSniff ? 'recognized' : undefined}>
                  {internalSniff ? '已识别' : '输入后自动识别'}
                </span>
              </div>
            )}
            {effectiveSniff && (
              <div style={{ display: 'flex', gap: 12, marginTop: 8, padding: 10, borderRadius: 10, border: '1px solid var(--line)', background: 'var(--bg)' }}>
                <div style={{ width: 96, height: 64, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: 'var(--surface-2, #f3f4f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  {effectiveSniff.thumbnail ? (
                    <img src={effectiveSniff.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <ImageIcon size={20} style={{ color: 'var(--ink-3)' }} />
                  )}
                  <PlayCircle size={22} style={{ position: 'absolute', color: 'rgba(255,255,255,0.85)', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {effectiveSniff.title || '已识别视频'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {effectiveSniff.platform && (
                      <span className="kw" style={{ fontSize: 11 }}>{effectiveSniff.platform}</span>
                    )}
                    {videoDuration > 0 && (
                      <span className="kw" style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        <Clock size={11} /> {formatDuration(videoDuration)}
                      </span>
                    )}
                    <span style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--green-600, #16a34a)' }}>
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

          {/* ② 生成设置 */}
          <div className="m-section">
            <div className="eyebrow" style={{ marginBottom: 10 }}>② 生成设置</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
                  {NOTE_TYPE_CARDS.map(card => {
                    const active = selectedNoteType === card.value
                    return (
                      <button
                        key={card.value}
                        type="button"
                        onClick={() => setSelectedNoteType(card.value)}
                        style={{
                          textAlign: 'left', padding: '10px 12px', borderRadius: 10,
                          cursor: 'pointer',
                          border: active ? '2px solid var(--accent-warm)' : '1px solid var(--line)',
                          background: active ? 'rgba(255,184,76,0.08)' : 'var(--bg)',
                          transition: 'border-color .15s, background .15s',
                        }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{card.label}</div>
                        <div className="kw" style={{ fontSize: 10 }}>{card.desc}</div>
                      </button>
                    )
                  })}
                </div>
                <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span className="mono" style={{ fontSize: 12 }}>笔记风格</span>
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
                  <label htmlFor="add-material-embed" style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                    <Switch id="add-material-embed" checked={embedFrames} onCheckedChange={(v) => { userToggledRef.current = true; setEmbedFrames(v) }} />
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span className="mono" style={{ fontSize: 12 }}>笔记里配图</span>
                      <span className="kw" style={{ fontSize: 11 }}>打开＝带图笔记（自动挑有信息的画面）；关闭＝纯文字笔记</span>
                    </span>
                  </label>
                  {embedFrames && visionModels.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span className="mono" style={{ fontSize: 12 }}>视觉模型</span>
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
                    const cardBase = {
                      textAlign: 'left' as const, padding: '12px 14px', borderRadius: 10,
                      cursor: 'pointer', background: 'var(--bg)',
                    }
                    const sel = (on: boolean) => ({
                      ...cardBase,
                      border: on ? '2px solid var(--accent-warm)' : '1px solid var(--line)',
                      background: on ? 'rgba(255,184,76,0.08)' : 'var(--bg)',
                    })
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <span className="mono" style={{ fontSize: 12 }}>取画面</span>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          <div onClick={() => setCaptureMode('auto')} style={sel(captureMode === 'auto')}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                              <Wand2 size={15} style={{ color: 'var(--accent-warm)' }} />
                              <span style={{ fontSize: 13, fontWeight: 600 }}>智能</span>
                            </div>
                            <div className="kw" style={{ fontSize: 11 }}>按时长自动</div>
                            <div className="kw" style={{ fontSize: 11, marginTop: 4 }}>
                              {videoDuration > 0 ? `每 ${autoInterval} 秒 · 约 ${autoFrames} 张` : '识别后显示'}
                            </div>
                          </div>
                          <div onClick={() => setCaptureMode('manual')} style={sel(captureMode === 'manual')}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                              <Settings2 size={15} style={{ color: captureMode === 'manual' ? 'var(--accent-warm)' : 'var(--ink-3)' }} />
                              <span style={{ fontSize: 13, fontWeight: 600 }}>手动</span>
                            </div>
                            <div className="kw" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                              每隔
                              <input
                                type="number" min={1} max={60} value={frameInterval}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => setFrameInterval(Number(e.target.value) || 5)}
                                style={{ fontSize: 11, width: 42, padding: '1px 4px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--ink-1)' }}
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
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                    <Switch checked={diarizeOn} onCheckedChange={setDiarizeOn} />
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span className="mono" style={{ fontSize: 12 }}>区分发言人</span>
                      <span className="kw" style={{ fontSize: 11 }}>开启后在转写中标注不同说话人（实验功能）</span>
                    </span>
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span className="mono" style={{ fontSize: 12 }}>补充说明</span>
                    <Textarea
                      value={userNotes}
                      onChange={(e) => setUserNotes(e.target.value)}
                      placeholder="可选：输入额外要求或上下文，会在生成时附加给模型"
                      style={{ fontSize: 13, minHeight: 60 }}
                    />
                  </div>
                </div>
          </div>

          {/* ③ 输出与归类 */}
          <div className="m-section">
            <div className="eyebrow" style={{ marginBottom: 10 }}>③ 输出与归类</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--bg)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span className="mono" style={{ fontSize: 12 }}>存入合集</span>
                  <span className="kw" style={{ fontSize: 11 }}>{workspaceSummary}</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--bg)', opacity: 0.5 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span className="mono" style={{ fontSize: 12 }}>导出预设</span>
                  <span className="kw" style={{ fontSize: 11 }}>生成后在结果页导出</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="m-foot">
          <span className="mono modal-foot-status">
            <span className="chip-dot" style={{ marginRight: 6 }} />
            笔记
            {selectedNoteType !== 'auto'
              ? ` · ${NOTE_TYPE_CARDS.find(c => c.value === selectedNoteType)?.label ?? ''}`
              : ''}
          </span>
          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleGenerateNote}
              disabled={!effectiveUrl || submitting}
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
