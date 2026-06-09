import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Link2, Wand2, X } from 'lucide-react'
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

      const result = await generateNote(wsId, effectiveUrl, effectiveSniff?.title ?? undefined, embedFrames)
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
            <div className="mono" style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.7 }}>
              系统会自动识别素材类型，并创建一个 note task 完成下载、转写、画面分析和笔记整理。
            </div>
            <label
              htmlFor="add-material-embed"
              style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, cursor: 'pointer' }}
            >
              <Switch
                id="add-material-embed"
                checked={embedFrames}
                onCheckedChange={setEmbedFrames}
              />
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span className="mono" style={{ fontSize: 12 }}>智能嵌入关键画面配图</span>
                <span className="kw" style={{ fontSize: 11 }}>
                  视频笔记按需配图（自动去重、只放有信息的画面）；关闭则纯文字
                </span>
              </span>
            </label>
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
