import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, ArrowRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useProviderStore } from '@/store/providerStore'
import { useTaskStore } from '@/store/taskStore'
import {
  addWorkspaceItem,
  autoCreateWorkspace,
  savePreflight,
  startItemPipeline,
} from '@/services/workspaces'
import type { SniffResult } from '@/services/workspaces'
import type { ItemType } from '@/types/workspace'
import type { ComposerDefaults, QualityOption } from './types'

const QUALITY_MAP: Record<QualityOption, string> = {
  '最高画质': 'best',
  '1080p': '1080',
  '720p': '720',
  '仅音频': 'audio',
}

const CONTENT_TYPES = ['课程', '会议', '宣传片', 'Vlog', '访谈', '纯音乐', '其他']
const PURPOSES = ['复刻参考', '竞品分析', '内容学习', '其他']
const VIDEO_TEMPLATES = ['教程', 'Vlog', '访谈', '影视点评', '产品评测', '其它']
type SummaryPath = 'subtitle' | 'detailed' | 'video_model'

interface PreflightDrawerProps {
  open: boolean
  url: string
  platformName: string | null
  /** 当混合内容场景下用户选了多种类型时传入 */
  selectedTypes?: string[]
  /** Composer 高级参数默认值 */
  composerDefaults?: ComposerDefaults
  /** F4.2: URL 嗅探结果——用于自动确定 item type */
  sniffResult?: SniffResult | null
  /** IP.6: 选中的工作空间 ID（简化方案：只传第一个） */
  workspaceId?: string
  onClose: () => void
  onCreated: () => void
}

export function PreflightDrawer({
  open,
  url,
  platformName,
  selectedTypes,
  composerDefaults,
  sniffResult,
  workspaceId,
  onClose,
  onCreated,
}: PreflightDrawerProps) {
  const [contentType, setContentType] = useState('')
  const [purpose, setPurpose] = useState('')
  const [topic, setTopic] = useState('')
  const [visionProviderId, setVisionProviderId] = useState('')
  const [textProviderId, setTextProviderId] = useState('')
  const [visionModelId, setVisionModelId] = useState('')
  const [textModelId, setTextModelId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [summaryPath, setSummaryPath] = useState<SummaryPath>('detailed')
  const [videoTemplate, setVideoTemplate] = useState('其它')
  const navigate = useNavigate()

  // Track which Composer defaults have been applied
  const appliedDefaultsRef = useRef({ vision: false, text: false, asr: false })
  const cd = composerDefaults

  // F4.2: 组件级素材类型——嗅探结果优先，失败退化为 video
  const resolvedType = sniffResult?.primary_type ?? 'video'

  const { providers, providerModels, fetchProviders, modelsLoading } = useProviderStore()
  const addTask = useTaskStore((s) => s.addTask)

  useEffect(() => {
    if (open && providers.length === 0) fetchProviders()
  }, [open, providers.length, fetchProviders])

  // Reset form when opened, applying Composer defaults as initial values
  useEffect(() => {
    if (open) {
      appliedDefaultsRef.current = { vision: false, text: false, asr: false }
      setContentType('')
      setPurpose('')
      setTopic('')
      setVisionProviderId('')
      setTextProviderId('')
      setVisionModelId(cd?.visionModelId ?? '')
      setTextModelId(cd?.textModelId ?? '')
      setSummaryPath('detailed')
      setVideoTemplate('其它')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const enabledProviders = providers.filter((p) => p.enabled && p.has_api_key)
  const visionProviders = useMemo(
    () => enabledProviders.filter((p) => (p.capabilities ?? []).includes('vision')),
    [enabledProviders],
  )
  const textProviders = useMemo(
    () => enabledProviders.filter((p) => (p.capabilities ?? []).includes('chat')),
    [enabledProviders],
  )

  const visionModels = visionProviderId ? (providerModels[visionProviderId] ?? []) : []
  const textModels = textProviderId ? (providerModels[textProviderId] ?? []) : []

  // Reverse-lookup: find provider from default model ID, then set model when loaded
  useEffect(() => {
    if (!open || !cd || appliedDefaultsRef.current.vision) return
    if (cd.visionModelId && !visionProviderId) {
      const found = enabledProviders.find(
        (p) => (providerModels[p.id] ?? []).some((m) => m.id === cd.visionModelId),
      )
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Two-step provider→model requires cascade
      if (found) setVisionProviderId(found.id)
    }
    if (cd.visionModelId && visionProviderId && !visionModelId && !modelsLoading[visionProviderId]) {
      if (visionModels.some((m) => m.id === cd.visionModelId)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Two-step provider→model requires cascade
        setVisionModelId(cd.visionModelId)
        appliedDefaultsRef.current.vision = true
      }
    }
  }, [open, cd, visionProviderId, visionModelId, enabledProviders, providerModels, modelsLoading, visionModels])

  useEffect(() => {
    if (!open || !cd || appliedDefaultsRef.current.text) return
    if (cd.textModelId && !textProviderId) {
      const found = enabledProviders.find(
        (p) => (providerModels[p.id] ?? []).some((m) => m.id === cd.textModelId),
      )
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Two-step provider→model requires cascade
      if (found) setTextProviderId(found.id)
    }
    if (cd.textModelId && textProviderId && !textModelId && !modelsLoading[textProviderId]) {
      if (textModels.some((m) => m.id === cd.textModelId)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Two-step provider→model requires cascade
        setTextModelId(cd.textModelId)
        appliedDefaultsRef.current.text = true
      }
    }
  }, [open, cd, textProviderId, textModelId, enabledProviders, providerModels, modelsLoading, textModels])

  // F4.3: platform types（可能含 'article' 等非 ItemType 值）→ 规范 ItemType
  const _norm = (t: string) => ({ article: 'text' } as Record<string, string>)[t] ?? t

  // F4.3: typesToCreate——嗅探多类型 > selectedTypes > 单 resolvedType
  const typesToCreate: string[] = (() => {
    if (sniffResult?.possible_types && sniffResult.possible_types.length > 1) {
      return sniffResult.possible_types
    }
    if (selectedTypes?.length) {
      return selectedTypes.map(_norm)
    }
    return [resolvedType]
  })()

  const _typeLabel = (t: string) => ({ video: '视频', audio: '音频', image: '图片', text: '文字' } as Record<string, string>)[t] ?? t

  const handleConfirm = async () => {
    setSubmitting(true)
    // shared across all items
    const sharedPayload: Record<string, unknown> = {
      content_type: contentType,
      topic,
      purpose,
    }
    if (cd) {
      sharedPayload.quality = QUALITY_MAP[cd.quality] ?? cd.quality
      sharedPayload.frame_mode = cd.frameMode
      sharedPayload.frame_interval_sec = cd.fps
      sharedPayload.max_frames = cd.maxFrames
      sharedPayload.enabled_steps = cd.stepIds
      sharedPayload.prompt_style = cd.promptStyle
    }
    const sharedModels = {
      ...(visionModelId && { vision: visionModelId }),
      ...(textModelId && { text: textModelId }),
    }
    const baseName = url.split('/').pop()?.split('?')[0] || url

    try {
      // 1. workspace
      let wsId = workspaceId
      if (!wsId) {
        const ws = await autoCreateWorkspace({ hint_url: url })
        wsId = ws.workspace_id
        toast.info(`已自动创建工作空间「${ws.name}」`)
      }

      // 2. for each type: create item → save preflight → start pipeline
      let firstTaskId: string | null = null
      let firstItemId: string | null = null
      let successCount = 0
      const errors: string[] = []

      for (const itemType of typesToCreate) {
        try {
          const itemName = typesToCreate.length > 1
            ? `${baseName} (${_typeLabel(itemType)})`
            : baseName
          const itemRes = await addWorkspaceItem(wsId, {
            type: itemType as ItemType,
            source: 'url',
            source_value: url,
            name: itemName,
          })
          const newItem = itemRes.items.find((it) => it.source_value === url)
          const itemId = newItem?.item_id ?? itemRes.items[itemRes.items.length - 1]?.item_id
          if (!itemId) throw new Error('创建素材失败')

          // type-specific tasks
          const tasks: Record<string, unknown> = {}
          if (itemType === 'video') {
            tasks.summary = {
              enabled: true,
              path: summaryPath,
              depth: 'normal',
              video_template: videoTemplate,
            }
          }

          await savePreflight(wsId, itemId, {
            background_overrides: sharedPayload,
            models: sharedModels,
            tasks,
          })

          const startRes = await startItemPipeline(wsId, itemId)
          addTask({
            task_id: startRes.task_id,
            project_id: '',
            task_type: startRes.task_type,
            payload: {},
            status: 'PENDING',
            progress: 0,
            log: [],
            result: {},
            error: '',
            retry_of: '',
            cancel_requested: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })

          if (!firstTaskId) { firstTaskId = startRes.task_id; firstItemId = itemId }
          successCount++
        } catch (e) {
          errors.push(`${_typeLabel(itemType)}: ${e instanceof Error ? e.message : '创建失败'}`)
        }
      }

      if (successCount === 0) throw new Error('所有素材创建失败')

      if (errors.length > 0) {
        toast.warning(`已创建 ${successCount}/${typesToCreate.length} 个素材`, {
          description: errors.join('；'),
        })
      } else {
        toast.success(
          typesToCreate.length > 1 ? `已创建 ${successCount} 个素材` : '任务已创建',
          { description: url },
        )
      }

      onCreated()
      if (firstTaskId) {
        navigate(`/processing/${firstTaskId}`, {
          state: { url, workspaceId: wsId, itemId: firstItemId },
        })
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div
        className="wb-modal-backdrop"
        data-open={open}
        onClick={onClose}
      />
      <div
        className="pf-drawer"
        data-open={open}
      >
        <div className="pf-drawer-head">
          <div>
            <div className="eyebrow">前置配置</div>
            <h3 className="display" style={{ fontSize: 22, margin: '4px 0 0' }}>
              {platformName ?? '未知来源'}
            </h3>
            {selectedTypes && selectedTypes.length > 0 && (
              <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                {selectedTypes.map((t) => (
                  <span key={t} className="kw">{t}</span>
                ))}
              </div>
            )}
          </div>
          <button className="btn btn-ghost" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="pf-drawer-body">
          {/* Section 1: Background info */}
          <section className="pf-section">
            <h4 className="pf-section-title">背景信息 · 可选</h4>
            <div className="pf-field">
              <label>内容类型</label>
              <select value={contentType} onChange={(e) => setContentType(e.target.value)}>
                <option value="">不指定</option>
                {CONTENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="pf-field">
              <label>分析目的</label>
              <select value={purpose} onChange={(e) => setPurpose(e.target.value)}>
                <option value="">不指定</option>
                {PURPOSES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="pf-field">
              <label>主题背景</label>
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="例：Q3 战略会议"
              />
            </div>
          </section>

          {/* Section 2: Video summary path (F4.2: 用 resolvedType 替代 selectedTypes 的宽松判空) */}
          {(selectedTypes?.length
            ? selectedTypes.some((t) => t === '视频' || t === 'video')
            : resolvedType === 'video') && (
            <section className="pf-section">
              <h4 className="pf-section-title">视频分析路径</h4>
              <div className="pf-field">
                <label>摘要方式</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {([
                    { value: 'subtitle', label: '路径 1：字幕直接总结', desc: '便宜快，适合口播/访谈' },
                    { value: 'detailed', label: '路径 2：详细总结（套模板）', desc: '推荐 · 字幕 + 截帧画面合并分析' },
                    { value: 'video_model', label: '路径 3：视频大模型直传', desc: '~$0.05/min，整段视频送大模型' },
                  ] as const).map((opt) => (
                    <label key={opt.value} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 12px', border: `1px solid ${summaryPath === opt.value ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 8, cursor: 'pointer', background: summaryPath === opt.value ? 'var(--accent-bg)' : 'transparent' }}>
                      <input
                        type="radio"
                        name="summaryPath"
                        value={opt.value}
                        checked={summaryPath === opt.value}
                        onChange={() => setSummaryPath(opt.value)}
                        style={{ marginTop: 2 }}
                      />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{opt.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{opt.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              {summaryPath === 'subtitle' && (
                <div className="pf-field">
                  <label>视频类型模板</label>
                  <select value={videoTemplate} onChange={(e) => setVideoTemplate(e.target.value)}>
                    {VIDEO_TEMPLATES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              )}
            </section>
          )}

          {/* Section 3: Model selection */}
          <section className="pf-section">
            <h4 className="pf-section-title">模型选择</h4>
            {enabledProviders.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--ink-4)', padding: '8px 0' }}>
                还没有可用的 provider，请先去设置页面添加
              </div>
            ) : (
              <>
                <div className="pf-field">
                  <label>视觉大模型</label>
                  <div className="pf-model-row">
                    <select
                      value={visionProviderId}
                      onChange={(e) => { setVisionProviderId(e.target.value); setVisionModelId('') }}
                    >
                      <option value="">选择 provider</option>
                      {visionProviders.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <select
                      value={visionModelId}
                      onChange={(e) => setVisionModelId(e.target.value)}
                      disabled={!visionProviderId}
                    >
                      <option value="">选择模型</option>
                      {modelsLoading[visionProviderId] ? (
                        <option value="" disabled>加载中…</option>
                      ) : (
                        visionModels.map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))
                      )}
                    </select>
                  </div>
                </div>
                <div className="pf-field">
                  <label>文本大模型</label>
                  <div className="pf-model-row">
                    <select
                      value={textProviderId}
                      onChange={(e) => { setTextProviderId(e.target.value); setTextModelId('') }}
                    >
                      <option value="">选择 provider</option>
                      {textProviders.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <select
                      value={textModelId}
                      onChange={(e) => setTextModelId(e.target.value)}
                      disabled={!textProviderId}
                    >
                      <option value="">选择模型</option>
                      {modelsLoading[textProviderId] ? (
                        <option value="" disabled>加载中…</option>
                      ) : (
                        textModels.map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))
                      )}
                    </select>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>

        <div className="pf-drawer-foot">
          <button className="btn btn-ghost" onClick={onClose}>取消</button>
          <button
            className="wb-btn-run"
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting ? (
              <><Loader2 size={14} className="animate-spin" /> 创建中…</>
            ) : (
              <>开始解析 <span className="iconwrap"><ArrowRight size={14} /></span></>
            )}
          </button>
        </div>
      </div>
    </>
  )
}
