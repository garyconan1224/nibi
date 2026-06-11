import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, FileText, Link2, Settings2, Wand2, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
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

const TYPE_LABEL: Record<ItemType, string> = {
  video: '视频',
  audio: '音频',
  image: '图片',
  text: '文字',
}

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

const ALL_TYPES: ItemType[] = ['video', 'audio', 'image', 'text']

function getSniffTypes(sniffResult: SniffResult | null | undefined): ItemType[] {
  if (!sniffResult) return []
  return sniffResult.possible_types.filter((t): t is ItemType =>
    ALL_TYPES.includes(t as ItemType),
  )
}

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
  const [internalUrl, setInternalUrl] = useState('')
  const [internalSniff, setInternalSniff] = useState<SniffResult | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [embedFrames, setEmbedFrames] = useState(true)
  const [frameInterval, setFrameInterval] = useState(5)
  const [noteExpanded, setNoteExpanded] = useState(false)
  const [captureMode, setCaptureMode] = useState<'auto' | 'manual'>('auto')
  const [videoDuration, setVideoDuration] = useState(0) // 探测到的视频时长（秒），0=未知
  const [error, setError] = useState<string | null>(null)
  const sniffTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const effectiveUrl = (urlValue ?? internalUrl).trim()
  const effectiveSniff = sniffResult ?? internalSniff
  const sniffTypes = getSniffTypes(effectiveSniff)
  const workspaceSummary =
    workspaceIds.length > 1
      ? `${workspaceIds.length} 个工作空间`
      : workspaceIds.length === 1
        ? '当前工作空间'
        : '未选择工作空间'
  const sourceSummary = effectiveSniff?.title
    ? `${effectiveSniff.platform ?? '未知平台'} · ${effectiveSniff.title}`
    : effectiveUrl
      ? '网络链接'
      : '输入素材链接'

  const doSniff = useCallback(async (url: string) => {
    try {
      setInternalSniff(await sniffUrl(url))
    } catch {
      setInternalSniff(null)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    setInternalUrl('')
    setInternalSniff(null)
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
        toast.info(`已自动创建工作空间「${ws.name}」`)
      }

      // SniffResult 暂无 duration 字段，智能档兜底默认 10 秒
      const effInterval =
        captureMode === 'auto' ? computeAutoInterval(videoDuration) : frameInterval
      const result = await generateNote(
        wsId, effectiveUrl, effectiveSniff?.title ?? undefined, embedFrames, 'vision', effInterval,
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

          <div className="m-section">
            <div className="eyebrow" style={{ marginBottom: 10 }}>① 输入源</div>
            {urlValue ? (
              <div className="composer-url modal-composer-url">
                <div className="platform">
                  <Link2 size={16} />
                </div>
                <span className="modal-source-value">{urlValue}</span>
                <span className="kw">Composer 传入</span>
              </div>
            ) : (
              <div className="composer-url modal-composer-url">
                <div className="platform">
                  <Link2 size={16} />
                </div>
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
            {!urlValue && (
              <div className="modal-kw-row">
                <span className="kw">
                  <Link2 size={11} />
                  支持网络链接
                </span>
                <span className="kw">本地版无大小限制</span>
                <span className="kw" data-state={internalSniff ? 'recognized' : undefined}>
                  {internalSniff ? '已识别' : '输入后自动识别'}
                </span>
              </div>
            )}
            {effectiveSniff && sniffTypes.length > 0 && (
              <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 6 }}>
                已识别为 {sniffTypes.map((t) => TYPE_LABEL[t]).join(' + ')}
                {effectiveSniff.title ? ` · ${effectiveSniff.title}` : ''}
              </div>
            )}
          </div>

        <div className="m-section">
          <div className="eyebrow" style={{ marginBottom: 10 }}>② 生成笔记</div>

          {/* 一体折叠卡：边框包裹「卡头 + 展开内容」，点击卡头切换 */}
          <div style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', background: 'var(--bg)' }}>
            <button
              type="button"
              onClick={() => setNoteExpanded((v) => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                padding: '14px 16px', border: 'none', background: 'transparent',
                cursor: 'pointer', textAlign: 'left',
                borderBottom: noteExpanded ? '1px solid var(--line)' : 'none',
              }}
            >
              <FileText size={18} style={{ color: 'var(--accent-2)' }} />
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>生成笔记</span>
                <span className="kw" style={{ fontSize: 11 }}>下载 · 转写 · 整理成图文笔记</span>
              </span>
              <ChevronDown size={16} style={{ transform: noteExpanded ? 'rotate(180deg)' : 'none', transition: 'transform .15s', color: 'var(--ink-3)' }} />
            </button>

            {noteExpanded && (
              <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <label htmlFor="add-material-embed" style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <Switch id="add-material-embed" checked={embedFrames} onCheckedChange={setEmbedFrames} />
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span className="mono" style={{ fontSize: 12 }}>笔记里配图</span>
                    <span className="kw" style={{ fontSize: 11 }}>打开＝带图笔记（自动挑有信息的画面）；关闭＝纯文字笔记</span>
                  </span>
                </label>

                {embedFrames && (() => {
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
              </div>
            )}
          </div>
        </div>
        </div>

        <div className="m-foot">
          <span className="mono modal-foot-status">
            <span className="chip-dot" style={{ marginRight: 6 }} />
            生成笔记 · 智能识别
          </span>
          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleGenerateNote}
              disabled={!effectiveUrl || submitting}
              title="自动识别内容类型，生成图文笔记"
            >
              {submitting ? (
                '处理中…'
              ) : (
                <>
                  <Wand2 size={14} />
                  生成笔记
                </>
              )}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
