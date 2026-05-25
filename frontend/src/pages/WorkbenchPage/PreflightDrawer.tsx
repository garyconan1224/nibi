import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, ArrowRight, Loader2, Settings } from 'lucide-react'
import { toast } from 'sonner'
import { useProviderStore } from '@/store/providerStore'
import { useTemplateStore } from '@/store/templateStore'
import {
  autoCreateWorkspace,
  addWorkspaceItem,
  savePreflight,
  startItemPipeline,
} from '@/services/workspaces'
import type { SniffResult } from '@/services/workspaces'
import type { ItemType, WorkspaceBackground } from '@/types/workspace'
import type { StagedConfig } from '@/components/workspace/AddMaterialModal'
import { FEATURES_BY_TYPE, type Feature } from '@/lib/featuresToSteps'
import { OUTPUT_FORMAT_OPTIONS } from '@/lib/preflightTasks'
import type { RewriteStyle, VideoOutputFormat } from '@/lib/preflightTasks'
import {
  TASK_GROUPS,
  MEDIA_KINDS,
  CONTENT_TYPES,
  PURPOSES,
  buildInitialTasks,
} from './preflightTasks'
import type { MediaKind } from './preflightTasks'

const ITEM_TYPE_ALIASES: Record<string, ItemType> = {
  article: 'text',
  audio: 'audio',
  image: 'image',
  text: 'text',
  video: 'video',
}
const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  video: '视频',
  audio: '音频',
  image: '图片',
  text: '文字',
}
type SummaryPath = 'subtitle' | 'detailed' | 'video_model'

interface PreflightDrawerProps {
  open: boolean
  url: string
  platformName: string | null
  selectedTypes?: string[]
  sniffResult?: SniffResult | null
  workspaceId?: string
  stagedConfig?: StagedConfig
  mode?: 'execute' | 'stage'
  onSaveStaged?: (staged: StagedConfig) => void
  onClose: () => void
  onCreated: () => void
}

/* ─── Preset bar data (R8 simplified) ─── */
const PRESETS: { id: string; label: string; apply: Record<MediaKind, Record<string, Partial<{ on: boolean }>>> | null }[] = [
  { id: 'custom', label: '自定义', apply: null },
  {
    id: 'standard', label: '标准',
    apply: {
      video: { frame_prompt: { on: true }, summary: { on: true }, music: { on: false }, srt: { on: true } },
      audio: { asr: { on: true }, voiceprint: { on: true }, srt: { on: true }, music: { on: false } },
      image: { describe: { on: true }, ocr: { on: false }, prompt: { on: true }, assoc: { on: false }, compare: { on: false } },
      text: { summary: { on: true }, assoc: { on: true }, rewrite: { on: false }, translate: { on: false }, multi: { on: false } },
    },
  },
  {
    id: 'minimal', label: '极简',
    apply: {
      video: { frame_prompt: { on: false }, summary: { on: true }, music: { on: false }, srt: { on: false } },
      audio: { asr: { on: true }, voiceprint: { on: false }, srt: { on: false }, music: { on: false } },
      image: { describe: { on: true }, ocr: { on: false }, prompt: { on: false }, assoc: { on: false }, compare: { on: false } },
      text: { summary: { on: true }, assoc: { on: false }, rewrite: { on: false }, translate: { on: false }, multi: { on: false } },
    },
  },
]

export function PreflightDrawer({
  open,
  url,
  platformName,
  selectedTypes,
  sniffResult,
  workspaceId,
  stagedConfig,
  mode = 'execute',
  onSaveStaged,
  onClose,
  onCreated,
}: PreflightDrawerProps) {
  // ── Old state (kept for R8.2-R8.6 old ad-hoc sections) ──
  const [contentType, setContentType] = useState('')
  const [purpose, setPurpose] = useState('')
  const [topic, setTopic] = useState('')
  const [textProviderId, setTextProviderId] = useState('')
  const [textModelId, setTextModelId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [summaryPath, setSummaryPath] = useState<SummaryPath>('detailed')
  const [videoTemplate, setVideoTemplate] = useState('auto')
  const [outputFormat, setOutputFormat] = useState<VideoOutputFormat>('summary')
  const [textRewriteEnabled, setTextRewriteEnabled] = useState(false)
  const [textRewriteStyle, setTextRewriteStyle] = useState<RewriteStyle>('formal')
  const [textTranslateEnabled, setTextTranslateEnabled] = useState(false)
  const [textTranslateLang, setTextTranslateLang] = useState('en')
  const navigate = useNavigate()

  // ── New state (R8 Remix structure) ──
  const resolvedType = sniffResult?.primary_type ?? 'video'
  const kindFromType: MediaKind = (ITEM_TYPE_ALIASES[resolvedType] ?? resolvedType) as MediaKind
  const [kind, setKind] = useState<MediaKind>(kindFromType)
  const [activePreset, setActivePreset] = useState<string | null>(null)
  const [bg, setBg] = useState({
    contentType: '',
    people: '',
    theme: '',
    terms: '',
    purpose: '',
  })
  const [models, setModels] = useState({
    vision: '',
    text: '',
    video: '',
  })
  const [tasks, setTasks] = useState(() => {
    const init: Record<MediaKind, Record<string, unknown>> = {} as Record<MediaKind, Record<string, unknown>>
    for (const k of Object.keys(TASK_GROUPS) as MediaKind[]) {
      init[k] = buildInitialTasks(k) as unknown as Record<string, unknown>
    }
    return init
  })

  const sc = stagedConfig

  const { providers, providerModels, fetchProviders, modelsLoading } = useProviderStore()
  const templateOptions = useTemplateStore((s) => s.getOptions)
  const fetchTemplates = useTemplateStore((s) => s.fetch)

  useEffect(() => {
    if (open && providers.length === 0) fetchProviders()
  }, [open, providers.length, fetchProviders])

  useEffect(() => {
    if (open) fetchTemplates()
  }, [open, fetchTemplates])

  // Reset form on open
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (open) {
      // old state
      setContentType(sc?.background?.content_type ?? '')
      setPurpose(sc?.background?.purpose ?? '')
      setTopic(sc?.background?.topic ?? '')
      setTextProviderId('')
      setTextModelId('')
      setSummaryPath('detailed')
      setVideoTemplate('auto')
      setOutputFormat('summary')
      setTextRewriteEnabled(sc?.features?.text?.rewrite ?? false)
      setTextRewriteStyle('formal')
      setTextTranslateEnabled(sc?.features?.text?.translate ?? false)
      setTextTranslateLang('en')
      // new state
      setKind(kindFromType)
      setActivePreset(null)
      setBg({
        contentType: sc?.background?.content_type ?? '',
        people: '',
        theme: sc?.background?.topic ?? '',
        terms: '',
        purpose: sc?.background?.purpose ?? '',
      })
      const init: Record<MediaKind, Record<string, unknown>> = {} as Record<MediaKind, Record<string, unknown>>
      for (const k of Object.keys(TASK_GROUPS) as MediaKind[]) {
        init[k] = buildInitialTasks(k) as unknown as Record<string, unknown>
      }
      setTasks(init)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  /* eslint-enable react-hooks/set-state-in-effect */

  const enabledProviders = providers.filter((p) => p.enabled && p.has_api_key)
  const textProviders = useMemo(
    () => enabledProviders.filter((p) => (p.capabilities ?? []).includes('chat')),
    [enabledProviders],
  )
  const textModels = textProviderId ? (providerModels[textProviderId] ?? []) : []

  const normalizeItemType = (type: string): ItemType => ITEM_TYPE_ALIASES[type] ?? (type as ItemType)

  const typesToCreate: ItemType[] = (() => {
    if (sc?.types?.length) return sc.types
    const rawTypes = selectedTypes?.length
      ? selectedTypes
      : sniffResult?.possible_types?.length
        ? sniffResult.possible_types
        : [resolvedType]
    return Array.from(new Set(rawTypes.map(normalizeItemType)))
  })()

  const typeLabel = (type: ItemType): string => ITEM_TYPE_LABELS[type]

  // ── New: current kind task state & counts ──
  const groups = TASK_GROUPS[kind] ?? []
  const currentTasks = (tasks[kind] ?? {}) as Record<string, { on?: boolean; [k: string]: unknown }>
  const enabledCount = Object.values(currentTasks).filter(v => v && (v as { on?: boolean }).on).length

  // ── Preset apply ──
  const applyPreset = useCallback((preset: typeof PRESETS[number]) => {
    setActivePreset(preset.id)
    if (preset.apply === null) return
    const patch = preset.apply[kind]
    if (!patch) return
    setTasks(s => {
      const next: Record<string, unknown> = { ...s[kind] }
      for (const [gid, gp] of Object.entries(patch)) {
        next[gid] = { ...(next[gid] as Record<string, unknown>), ...gp }
      }
      return { ...s, [kind]: next }
    })
  }, [kind])

  // ── handleConfirm (keep old logic) ──
  const stagedFeaturesForType = (type: ItemType): Feature[] => {
    if (!stagedConfig?.features?.[type]) return []
    return (Object.entries(stagedConfig.features[type]) as [Feature, boolean][])
      .filter(([, enabled]) => enabled)
      .map(([id]) => id)
  }

  const handleConfirm = async () => {
    setSubmitting(true)
    try {
      let wsId = workspaceId
      if (!wsId) {
        const ws = await autoCreateWorkspace({ hint_url: url })
        wsId = ws.workspace_id
        toast.info(`已自动创建工作空间「${ws.name}」`)
      }

      let firstTaskId: string | null = null
      let firstItemId: string | null = null
      let successCount = 0
      const errors: string[] = []

      for (const itemType of typesToCreate) {
        try {
          const ws = await addWorkspaceItem(wsId, {
            type: itemType,
            source: 'url',
            source_value: url,
            name: url,
          })
          const item = ws.items[ws.items.length - 1]
          const itemId = item.item_id

          const features: Feature[] = stagedFeaturesForType(itemType).length > 0
            ? stagedFeaturesForType(itemType)
            : FEATURES_BY_TYPE[itemType].filter(f => f.defaultChecked).map(f => f.id)

          const bgPayload: Partial<WorkspaceBackground> = {}
          if (contentType) bgPayload.content_type = contentType
          if (purpose) bgPayload.purpose = purpose
          if (topic) bgPayload.topic = topic

          const tasksPayload: Record<string, unknown> = {
            material_type: itemType,
            enabled_features: features,
          }
          for (const feat of features) {
            tasksPayload[feat] = true
          }
          if (itemType === 'video') {
            tasksPayload.summary_path = summaryPath
            tasksPayload.video_template = videoTemplate
            tasksPayload.output_format = outputFormat
          }
          if (itemType === 'text') {
            tasksPayload.text_rewrite = { enabled: textRewriteEnabled, style: textRewriteStyle }
            tasksPayload.text_translate = { enabled: textTranslateEnabled, target_lang: textTranslateLang }
          }
          const preflightModels: Record<string, string> = {}
          if (textModelId) preflightModels.text = textModelId

          await savePreflight(wsId, itemId, {
            background_overrides: bgPayload,
            models: preflightModels,
            tasks: tasksPayload,
          })

          const { task_id } = await startItemPipeline(wsId, itemId)

          if (!firstTaskId) { firstTaskId = task_id; firstItemId = itemId }
          successCount++
        } catch (e) {
          errors.push(`${typeLabel(itemType)}: ${e instanceof Error ? e.message : '创建失败'}`)
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

  const handleSaveStaged = () => {
    const features: StagedConfig['features'] = { ...sc?.features }
    if (typesToCreate.includes('text') && (textRewriteEnabled || textTranslateEnabled)) {
      features.text = {
        ...(features.text ?? {}),
        ...(textRewriteEnabled && { rewrite: true }),
        ...(textTranslateEnabled && { translate: true }),
      }
    }
    const bgPayload: Partial<WorkspaceBackground> = {}
    if (contentType) bgPayload.content_type = contentType
    if (purpose) bgPayload.purpose = purpose
    if (topic) bgPayload.topic = topic

    onSaveStaged?.({
      types: typesToCreate,
      features,
      background: bgPayload,
      workspaceIds: workspaceId ? [workspaceId] : [],
      urlValue: url,
    })
  }

  return (
    <>
      <div className="wb-modal-backdrop" data-open={open} onClick={onClose} />
      <aside className="pf-drawer" data-open={open}>
        {/* ── Head ── */}
        <div className="pf-drawer-head">
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Preflight · 前置配置 · §4</div>
            <h3 className="display" style={{ fontSize: 22, margin: 0 }}>开始解析前</h3>
            <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 6 }}>
              {url || '从工作台传入'} · {platformName || 'auto'}
            </div>
          </div>
          <button className="btn btn-ghost" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="pf-drawer-body" style={{ padding: '4px 22px 16px' }}>
          {/* ── Media kind tabs ── */}
          <div style={{ display: 'flex', gap: 6, padding: '14px 0 18px' }}>
            {MEDIA_KINDS.map(m => {
              const active = kind === m.id
              return (
                <button key={m.id}
                  onClick={() => setKind(m.id)}
                  className="btn"
                  style={{
                    flex: 1, height: 42, justifyContent: 'center',
                    background: active ? 'var(--ink)' : 'var(--bg-elev)',
                    color: active ? 'var(--bg)' : 'var(--ink)',
                    borderColor: active ? 'var(--ink)' : 'var(--line)',
                  }}>
                  {m.label}
                </button>
              )
            })}
          </div>

          {/* ── Section 01: 背景信息 ── */}
          <PFSection num="01" title="背景信息" sub="Context · 注入到所有 AI 调用">
            <PFGrid>
              <PFField label="内容类型" hint="影响总结结构">
                <select className="pf-sel" value={bg.contentType} onChange={e => setBg(s => ({ ...s, contentType: e.target.value }))}>
                  <option value="">不指定</option>
                  {CONTENT_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </PFField>
              <PFField label="分析目的" hint="影响 LLM 风格">
                <select className="pf-sel" value={bg.purpose} onChange={e => setBg(s => ({ ...s, purpose: e.target.value }))}>
                  <option value="">不指定</option>
                  {PURPOSES.map(t => <option key={t}>{t}</option>)}
                </select>
              </PFField>
            </PFGrid>
            <PFField label="参与人员" hint="逗号分隔 · 用于声纹匹配">
              <input className="pf-inp" value={bg.people} onChange={e => setBg(s => ({ ...s, people: e.target.value }))} />
            </PFField>
            <PFField label="主题背景" hint="一句话上下文">
              <input className="pf-inp" value={bg.theme} onChange={e => setBg(s => ({ ...s, theme: e.target.value }))} />
            </PFField>
            <PFField label="专有名词" hint="影响 Whisper 识别准确率">
              <input className="pf-inp" value={bg.terms} onChange={e => setBg(s => ({ ...s, terms: e.target.value }))} />
            </PFField>
          </PFSection>

          {/* ── Section 02: 模型选择 ── */}
          <PFSection num="02" title="模型选择" sub="Models · 仅可选已配置项" extra={
            <button className="btn btn-ghost" style={{ height: 26, padding: '0 10px', fontSize: 11 }}>
              <Settings size={11} />
              管理模型
            </button>
          }>
            {enabledProviders.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--ink-3)', padding: '8px 0' }}>
                还没有可用的 provider，请先去设置页面添加
              </div>
            ) : (
              <>
                <PFField label="视觉大模型" hint="VLM · 截帧 / 图片分析">
                  <select className="pf-sel" value={models.vision} onChange={e => setModels(s => ({ ...s, vision: e.target.value }))}>
                    <option value="">默认</option>
                    <option value="GPT-4o · OpenAI">GPT-4o · OpenAI</option>
                    <option value="Claude 3.5 Sonnet · Anthropic">Claude 3.5 Sonnet · Anthropic</option>
                  </select>
                </PFField>
                <PFField label="文本大模型" hint="LLM · 总结 / 归纳 / 对话">
                  <div className="pf-model-row">
                    <select value={textProviderId} onChange={(e) => { setTextProviderId(e.target.value); setTextModelId('') }}>
                      <option value="">选择 provider</option>
                      {textProviders.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <select value={textModelId} onChange={(e) => setTextModelId(e.target.value)} disabled={!textProviderId}>
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
                </PFField>
              </>
            )}
          </PFSection>

          {/* ── Section 03: 任务勾选 ── */}
          <PFSection num="03" title="任务勾选" sub={`Tasks · 已选 ${enabledCount} / ${groups.length} · 依赖级联自动锁定`}>
            <PresetBar current={activePreset} onPick={applyPreset} />
            <div style={{ height: 1, background: 'var(--line)', margin: '4px 0' }} />
            <div style={{ display: 'grid', gap: 10 }}>
              {groups.map(g => (
                <div key={g.id} style={{
                  border: '1px solid var(--line)', borderRadius: 14, padding: 14,
                  background: currentTasks[g.id]?.on ? 'var(--bg-elev)' : 'transparent',
                }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{g.label}</span>
                  {g.sub && <span className="mono" style={{ fontSize: 10, color: 'var(--ink-3)', marginLeft: 8 }}>{g.sub}</span>}
                </div>
              ))}
            </div>
          </PFSection>

          {/* ── Old ad-hoc sections (kept until R8.7) ── */}
          {/* Section: Video summary path */}
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
                <>
                  <div className="pf-field">
                    <label>视频类型模板</label>
                    <select value={videoTemplate} onChange={(e) => setVideoTemplate(e.target.value)}>
                      {templateOptions().map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="pf-field">
                    <label>输出格式</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {OUTPUT_FORMAT_OPTIONS.map((opt) => (
                        <label
                          key={opt.value}
                          style={{
                            display: 'flex', alignItems: 'flex-start', gap: 8,
                            padding: '6px 10px',
                            border: `1px solid ${outputFormat === opt.value ? 'var(--accent)' : 'var(--border)'}`,
                            borderRadius: 6, cursor: 'pointer',
                            background: outputFormat === opt.value ? 'var(--accent-bg)' : 'transparent',
                          }}
                        >
                          <input
                            type="radio"
                            name="outputFormat"
                            value={opt.value}
                            checked={outputFormat === opt.value}
                            onChange={() => setOutputFormat(opt.value)}
                          />
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 500 }}>{opt.label}</div>
                            <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{opt.desc}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </section>
          )}

          {/* Section: Text processing options */}
          {(selectedTypes?.length
            ? selectedTypes.some((t) => t === '文字' || t === 'text')
            : resolvedType === 'text') && (
            <section className="pf-section">
              <h4 className="pf-section-title">文本处理选项</h4>
              <div className="pf-field">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={textRewriteEnabled}
                    onChange={(e) => setTextRewriteEnabled(e.target.checked)}
                  />
                  改写 / 润色
                </label>
                {textRewriteEnabled && (
                  <select
                    value={textRewriteStyle}
                    onChange={(e) => setTextRewriteStyle(e.target.value as RewriteStyle)}
                    style={{ marginTop: 6 }}
                  >
                    <option value="formal">正式</option>
                    <option value="casual">口语</option>
                    <option value="concise">简洁</option>
                    <option value="rich">丰富</option>
                  </select>
                )}
              </div>
              <div className="pf-field">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={textTranslateEnabled}
                    onChange={(e) => setTextTranslateEnabled(e.target.checked)}
                  />
                  翻译
                </label>
                {textTranslateEnabled && (
                  <select
                    value={textTranslateLang}
                    onChange={(e) => setTextTranslateLang(e.target.value)}
                    style={{ marginTop: 6 }}
                  >
                    <option value="en">英文</option>
                    <option value="ja">日文</option>
                    <option value="ko">韩文</option>
                    <option value="zh">中文</option>
                    <option value="es">西班牙文</option>
                    <option value="fr">法文</option>
                    <option value="de">德文</option>
                    <option value="ru">俄文</option>
                    <option value="pt">葡萄牙文</option>
                  </select>
                )}
              </div>
            </section>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="pf-drawer-foot">
          <button className="btn btn-ghost" onClick={onClose}>取消</button>
          {mode === 'stage' ? (
            <button className="wb-btn-run" onClick={handleSaveStaged}>
              保存配置 & 返回
            </button>
          ) : (
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
          )}
        </div>
      </aside>
    </>
  )
}

/* ─── R8 Sub-components ─── */

function PFSection({ num, title, sub, extra, children }: {
  num: string
  title: string
  sub?: string
  extra?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span className="mono" style={{
            fontSize: 10, padding: '3px 8px', borderRadius: 6,
            background: 'var(--bg-sunken)', color: 'var(--ink-2)',
            fontWeight: 600, letterSpacing: '0.08em',
          }}>{num}</span>
          <h4 style={{ margin: 0, fontFamily: 'var(--display)', fontSize: 22, fontWeight: 500 }}>{title}</h4>
          {sub && <span className="mono" style={{ fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.06em' }}>{sub}</span>}
        </div>
        {extra}
      </div>
      <div style={{ display: 'grid', gap: 12 }}>{children}</div>
    </section>
  )
}

function PFGrid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{children}</div>
  )
}

function PFField({ label, hint, children }: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink)' }}>{label}</span>
        {hint && <span className="mono" style={{ fontSize: 10, color: 'var(--ink-3)' }}>{hint}</span>}
      </div>
      {children}
    </label>
  )
}

function PresetBar({ current, onPick }: {
  current: string | null
  onPick: (preset: typeof PRESETS[number]) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
      {PRESETS.map(p => {
        const active = current === p.id
        return (
          <button key={p.id}
            onClick={() => onPick(p)}
            className="btn"
            style={{
              height: 28, padding: '0 14px', fontSize: 12, borderRadius: 99,
              background: active ? 'var(--ink)' : 'var(--bg-sunken)',
              color: active ? 'var(--bg)' : 'var(--ink-2)',
              borderColor: active ? 'var(--ink)' : 'var(--line)',
            }}>
            {p.label}
          </button>
        )
      })}
    </div>
  )
}
