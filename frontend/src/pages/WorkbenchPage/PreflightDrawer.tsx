import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, ArrowRight, Loader2, Check } from 'lucide-react'
import { toast } from 'sonner'
import { useProviderStore } from '@/store/providerStore'
import {
  autoCreateWorkspace,
  addWorkspaceItem,
  savePreflight,
  startItemPipeline,
} from '@/services/workspaces'
import type { SniffResult } from '@/services/workspaces'
import type { ItemType, WorkspaceBackground } from '@/types/workspace'
import type { StagedConfig } from '@/components/workspace/AddMaterialModal'
import {
  TASK_GROUPS,
  MEDIA_KINDS,
  CONTENT_TYPES,
  PURPOSES,
  buildInitialTasks,
  applyCascades,
} from './preflightTasks'
import type { MediaKind, TaskState } from './preflightTasks'

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
const TASK_TO_FEATURE: Record<MediaKind, Record<string, string>> = {
  video: {
    frame_prompt: 'visual_prompt',
    summary: 'video_summary',
    srt: 'subtitle_export',
    music: 'music_analysis',
  },
  audio: {
    transcribe_summary: 'transcribe_summary',
    music: 'music_analysis',
  },
  image: {
    describe: 'describe',
    ocr: 'ocr',
    prompt: 'prompt',
    assoc: 'assoc',
  },
  text: {
    summary: 'summary_keypoints',
    rewrite: 'rewrite',
    translate: 'translate',
    multi: 'multi_compare',
  },
}
interface PreflightDrawerProps {
  open: boolean
  url: string
  platformName: string | null
  selectedTypes?: string[]
  sniffResult?: SniffResult | null
  workspaceId?: string
  /** 本地文件上传场景：item 已由 Composer 预创建，传入后跳过 addWorkspaceItem 步骤 */
  itemId?: string
  stagedConfig?: StagedConfig
  mode?: 'execute' | 'stage'
  onSaveStaged?: (staged: StagedConfig) => void
  /** R8: 当前素材数量（级联用） */
  materialCount?: number
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
      audio: { transcribe_summary: { on: true }, music: { on: false } },
      image: { describe: { on: true }, ocr: { on: false }, prompt: { on: true }, assoc: { on: false }, compare: { on: false } },
      text: { summary: { on: true }, assoc: { on: true }, rewrite: { on: false }, translate: { on: false }, multi: { on: false } },
    },
  },
  {
    id: 'minimal', label: '极简',
    apply: {
      video: { frame_prompt: { on: false }, summary: { on: true }, music: { on: false }, srt: { on: false } },
      audio: { transcribe_summary: { on: true }, music: { on: false } },
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
  itemId,
  stagedConfig,
  mode = 'execute',
  onSaveStaged,
  materialCount = 1,
  onClose,
  onCreated,
}: PreflightDrawerProps) {
  // ── Old state (kept for R8.2-R8.6 old ad-hoc sections) ──
  // R21.P2: textProviderId 已无 UI 入口，仅保留 setter 为 reset 兼容
  const [, setTextProviderId] = useState('')
  const [textModelId, setTextModelId] = useState('')
  const [submitting, setSubmitting] = useState(false)
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
  const [models, setModels] = useState({ text: '', video: '' })
  const [tasks, setTasks] = useState(() => {
    const init: Record<MediaKind, Record<string, unknown>> = {} as Record<MediaKind, Record<string, unknown>>
    for (const k of Object.keys(TASK_GROUPS) as MediaKind[]) {
      init[k] = buildInitialTasks(k) as unknown as Record<string, unknown>
    }
    return init
  })

  const sc = stagedConfig

  // R21.P2: 仍保留 fetchProviders 用于回填 sc.models 兼容；providerModels 由主界面拉取
  const { providers, fetchProviders } = useProviderStore()
  useEffect(() => {
    if (open && providers.length === 0) fetchProviders()
  }, [open, providers.length, fetchProviders])

  const hydrateTasks = (stagedTasks: StagedConfig['tasks'] | undefined, scope?: StagedConfig['analysisScope']) => {
    const init: Record<MediaKind, Record<string, unknown>> = {} as Record<MediaKind, Record<string, unknown>>
    for (const taskKind of Object.keys(TASK_GROUPS) as MediaKind[]) {
      const defaults = buildInitialTasks(taskKind) as unknown as Record<string, unknown>
      const staged = stagedTasks?.[taskKind]
      if (!staged) {
        init[taskKind] = defaults
      } else {
        const next: Record<string, unknown> = { ...defaults }
        const enabled = new Set((staged.enabled_features as string[] | undefined) ?? [])
        for (const group of TASK_GROUPS[taskKind]) {
          const current = (next[group.id] as Record<string, unknown>) ?? {}
          const stagedGroup = staged[group.id]
          next[group.id] = {
            ...current,
            ...(typeof stagedGroup === 'object' && stagedGroup !== null ? stagedGroup as Record<string, unknown> : {}),
            on: enabled.has(group.id) || Boolean((stagedGroup as { on?: unknown } | undefined)?.on),
          }
        }
        init[taskKind] = next
      }

      // 分析范围覆盖：确保 summary_path 和关键 task 的 on/off 与 scope 一致
      if (taskKind === 'video' && scope) {
        const entry = init[taskKind] as Record<string, unknown>
        const summaryGroup = (entry.summary as Record<string, unknown>)
        if (summaryGroup) {
          if (scope === 'visual_only') {
            summaryGroup.on = true
            summaryGroup.summary_path = '只看画面'
            const fp = (entry.frame_prompt as Record<string, unknown>)
            if (fp) fp.on = true
            const srt = (entry.srt as Record<string, unknown>)
            if (srt) srt.on = false
          }
        }
      }
    }
    return init
  }

  const serializeTasksForType = (itemType: ItemType) => {
    const taskKind = itemType as MediaKind
    const raw = (tasks[taskKind] ?? {}) as TaskState
    const sourceFeatures = sc?.features?.[itemType]
    const effective = applyCascades(taskKind, raw, materialCount, sc?.analysisScope, sourceFeatures).state
    const enabledFeatures = Object.entries(effective)
      .filter(([, v]) => v.on)
      .map(([k]) => k)
    const tasksPayload: Record<string, unknown> = {
      material_type: itemType,
      enabled_features: enabledFeatures,
    }
    for (const [gid, gState] of Object.entries(effective)) {
      tasksPayload[gid] = { ...gState }
    }
    return { taskKind, effective, enabledFeatures, tasksPayload }
  }

  const featureMapFromTasks = (taskKind: MediaKind, effective: TaskState) => {
    const map: Record<string, boolean> = {}
    for (const [taskId, featureId] of Object.entries(TASK_TO_FEATURE[taskKind])) {
      map[featureId] = Boolean(effective[taskId]?.on)
    }
    return map
  }

  // Reset form on open
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (open) {
      setTextProviderId('')
      setTextModelId(sc?.models?.text ?? '')
      // analysisScope 决定默认 kind
      if (sc?.analysisScope === 'audio_only') {
        setKind('audio')
      } else if (sc?.analysisScope === 'visual_only') {
        setKind('video')
      } else {
        setKind(kindFromType)
      }
      setActivePreset(null)
      setBg({
        contentType: sc?.background?.content_type ?? '',
        people: '',
        theme: sc?.background?.topic ?? '',
        terms: '',
        purpose: sc?.background?.purpose ?? '',
      })
      setModels({ text: sc?.models?.text ?? '', video: sc?.models?.video ?? '' })
      setTasks(hydrateTasks(sc?.tasks, sc?.analysisScope))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  /* eslint-enable react-hooks/set-state-in-effect */

  // R21.P2: Section 02 模型选择已迁至「添加素材」主界面，
  // enabledProviders/textProviders/textModels/modelsLoading 已废弃

  const normalizeItemType = (type: string): ItemType => ITEM_TYPE_ALIASES[type] ?? (type as ItemType)

  const typesToCreate: ItemType[] = (() => {
    if (sc?.analysisScope) {
      const scopeItemType: ItemType = sc.analysisScope === 'audio_only' ? 'audio' : 'video'
      return [scopeItemType]
    }
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
  // ── Cascade: compute effective state + lock/disabled reasons ──
  const cascaded = applyCascades(
    kind,
    currentTasks as TaskState,
    materialCount,
    sc?.analysisScope,
    sc?.features?.[kind],
  )
  const effState = cascaded.state
  const locks = cascaded.locks
  const disabledReasons = cascaded.disabled
  const enabledCount = Object.values(effState).filter(v => v && v.on).length

  const setKindTask = (gid: string, patch: Record<string, unknown>) => {
    // Block uncheck if locked-on by cascade
    if (patch.on === false && locks[gid]) return
    // Block check if disabled (e.g. multi compare with only 1 material)
    if (patch.on === true && disabledReasons[gid]) return
    setTasks(s => ({ ...s, [kind]: { ...s[kind], [gid]: { ...(s[kind]?.[gid] as Record<string, unknown> ?? {}), ...patch } } }))
  }

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

  // ── handleConfirm ──
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

      // 本地文件场景：item 已由 Composer 预创建，跳过 addWorkspaceItem
      const isLocalItem = Boolean(itemId)

      for (const itemType of typesToCreate) {
        try {
          const currentItemId = isLocalItem
            ? itemId!
            : await (async () => {
                const ws = await addWorkspaceItem(wsId, {
                  type: itemType,
                  source: 'url',
                  source_value: url,
                  name: url,
                })
                return ws.items[ws.items.length - 1].item_id
              })()

          const bgPayload: Partial<WorkspaceBackground> = {}
          if (bg.contentType) bgPayload.content_type = bg.contentType
          if (bg.purpose) bgPayload.purpose = bg.purpose
          if (bg.theme) bgPayload.topic = bg.theme

          const { tasksPayload } = serializeTasksForType(itemType)

          const preflightModels: Record<string, string> = {}
          if (textModelId) preflightModels.text = textModelId
          if (models.video) preflightModels.video = models.video

          await savePreflight(wsId, currentItemId, {
            background_overrides: bgPayload,
            models: preflightModels,
            tasks: tasksPayload,
          })

          const { task_id } = await startItemPipeline(wsId, currentItemId)

          if (!firstTaskId) { firstTaskId = task_id; firstItemId = currentItemId }
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
    const bgPayload: Partial<WorkspaceBackground> = {}
    if (bg.contentType) bgPayload.content_type = bg.contentType
    if (bg.purpose) bgPayload.purpose = bg.purpose
    if (bg.theme) bgPayload.topic = bg.theme

    const stagedTasks: StagedConfig['tasks'] = {}
    const stagedFeatures: StagedConfig['features'] = {}
    for (const itemType of typesToCreate) {
      const { taskKind, effective, tasksPayload } = serializeTasksForType(itemType)
      stagedTasks[itemType] = tasksPayload
      stagedFeatures[itemType] = featureMapFromTasks(taskKind, effective)
    }
    const stagedModels: Record<string, string> = {}
    if (textModelId) stagedModels.text = textModelId
    if (models.video) stagedModels.video = models.video

    onSaveStaged?.({
      types: typesToCreate,
      features: stagedFeatures,
      tasks: stagedTasks,
      models: stagedModels,
      background: bgPayload,
      workspaceIds: workspaceId ? [workspaceId] : [],
      urlValue: url,
      analysisScope: sc?.analysisScope,
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

          {/* Section 02 模型选择已迁至「添加素材」主界面（R21.P2）*/}

          {/* ── Section 02: 任务勾选 ── */}
          <PFSection num="02" title="任务勾选" sub={`Tasks · 已选 ${enabledCount} / ${groups.length} · 依赖级联自动锁定`}>
            <PresetBar current={activePreset} onPick={applyPreset} />
            <div style={{ height: 1, background: 'var(--line)', margin: '4px 0' }} />
            <div style={{ display: 'grid', gap: 10 }}>
              {groups.map(g => {
                const st = (effState[g.id] as Record<string, unknown>) ?? {}
                return (
                  <PFTaskCard
                    key={g.id}
                    group={g}
                    state={st}
                    setState={(p) => setKindTask(g.id, p)}
                    locks={locks}
                    disabledReasons={disabledReasons}
                  />
                )
              })}
            </div>
          </PFSection>
        </div>

        {/* ── Footer ── */}
        <div className="pf-drawer-foot">
          <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
            <span style={{ color: 'var(--accent-green)' }}>●</span> 配置已就绪 · {enabledCount} 项分析任务
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
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

function PFTaskCard({ group, state, setState, locks, disabledReasons }: {
  group: { id: string; label: string; sub?: string; children?: { id: string; label: string; type: string; options?: (string | { value: string; label: string; tooltip?: string })[]; default: unknown; unit?: string; placeholder?: string; hint?: string; whenParent?: string; whenValue?: string | boolean }[] }
  state: Record<string, unknown>
  setState: (patch: Record<string, unknown>) => void
  locks: Record<string, string>
  disabledReasons: Record<string, string>
}) {
  const on = !!state.on
  const lockedReason = locks[group.id]
  const locked = !!lockedReason
  const disabledReason = disabledReasons[group.id]
  const disabled = !!disabledReason
  const [tooltip, setTooltip] = useState<string | null>(null)
  const [radioExpanded, setRadioExpanded] = useState<Record<string, boolean>>({})
  const [tagInput, setTagInput] = useState<Record<string, string>>({})
  const [tagInputVisible, setTagInputVisible] = useState<Record<string, boolean>>({})
  const cardBg = disabled ? 'var(--bg-sunken)'
    : on ? 'var(--bg-elev)'
    : 'transparent'
  return (
    <div style={{
      border: '1px solid var(--line)',
      borderRadius: 14,
      padding: 14,
      background: cardBg,
      opacity: disabled ? 0.55 : 1,
      transition: 'background 140ms ease, border-color 140ms ease, opacity 140ms ease',
      borderColor: locked ? 'var(--accent-pink)' : on ? 'var(--line-strong)' : 'var(--line)',
    }}>
      <label style={{
        display: 'flex', alignItems: 'flex-start', gap: 12,
        cursor: (locked || disabled) ? 'not-allowed' : 'pointer',
      }}>
        <div style={{
          width: 22, height: 22, borderRadius: 7,
          border: `2px solid ${on ? (locked ? 'var(--accent-pink)' : 'var(--ink)') : 'var(--line-strong)'}`,
          background: on ? (locked ? 'var(--accent-pink)' : 'var(--ink)') : 'transparent',
          display: 'grid', placeItems: 'center',
          flexShrink: 0, marginTop: 2,
          transition: 'all 140ms ease',
          position: 'relative',
        }}>
          {on && !locked && <Check size={12} stroke="var(--bg)" strokeWidth={3} />}
          {on && locked && (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
          )}
          <input type="checkbox" checked={on}
            disabled={locked || disabled}
            onChange={e => setState({ on: e.target.checked })}
            style={{ position: 'absolute', opacity: 0, inset: 0, cursor: (locked || disabled) ? 'not-allowed' : 'pointer' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{group.label}</span>
            {locked && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 99,
                background: 'rgba(255,77,126,0.12)', color: 'var(--accent-pink)',
                fontSize: 10, fontFamily: 'var(--mono)', letterSpacing: '0.04em', fontWeight: 600,
              }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
                依赖锁定
              </span>
            )}
            {disabled && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', padding: '2px 7px', borderRadius: 99,
                background: 'var(--bg-sunken)', color: 'var(--ink-3)',
                fontSize: 10, fontFamily: 'var(--mono)', letterSpacing: '0.04em',
              }}>
                条件不满足
              </span>
            )}
          </div>
          {group.sub && (
            <div className="mono" style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 3, letterSpacing: '0.04em' }}>{group.sub}</div>
          )}
          {(lockedReason || disabledReason) && (
            <div style={{ fontSize: 11, color: locked ? 'var(--accent-pink)' : 'var(--ink-3)', marginTop: 5, lineHeight: 1.4 }}>
              {lockedReason || disabledReason}
            </div>
          )}
        </div>
      </label>

      {on && group.children && (
        <div style={{
          marginTop: 14, paddingTop: 14,
          borderTop: '1px dashed var(--line)',
          display: 'grid', gap: 10,
        }}>
          {group.children.map(c => {
            if (c.whenParent && state[c.whenParent] !== c.whenValue) return null

            if (c.type === 'radio') {
              const val = state[c.id] ?? c.default
              const childLockKey = `${group.id}.${c.id}`
              const childLocked = !!locks[childLockKey]
              const opts = (c.options ?? []).map(o => typeof o === 'string' ? { value: o, label: o } : o)
              const expanded = !!radioExpanded[c.id]
              const selectedOpt = opts.find(o => o.value === val)
              const visibleOpts = expanded ? opts : (selectedOpt ? [selectedOpt] : opts)
              return (
                <div key={c.id}>
                  <div style={{ fontSize: 11, color: 'var(--ink-2)', marginBottom: 6, fontWeight: 500 }}>{c.label}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {visibleOpts.map(o => {
                      const active = val === o.value
                      const btn = (
                        <button key={o.value}
                          onClick={() => { if (!childLocked) setState({ [c.id]: o.value }) }}
                          disabled={childLocked}
                          style={{
                            height: 28, padding: '0 12px',
                            borderRadius: 8,
                            border: `1px solid ${active ? 'var(--ink)' : 'var(--line)'}`,
                            background: active ? 'var(--ink)' : 'var(--bg)',
                            color: active ? 'var(--bg)' : 'var(--ink)',
                            fontSize: 11, fontFamily: 'var(--mono)',
                            cursor: childLocked ? 'not-allowed' : 'pointer',
                            opacity: childLocked ? 0.5 : 1,
                          }}>
                          {o.label}
                        </button>
                      )
                      if (!o.tooltip) return btn
                      return (
                        <div key={o.value} style={{ position: 'relative' }}
                          onMouseEnter={() => setTooltip(o.value)}
                          onMouseLeave={() => setTooltip(null)}>
                          {btn}
                          {tooltip === o.value && (
                            <div style={{
                              position: 'absolute', bottom: '100%', left: 0, marginBottom: 6,
                              background: 'var(--ink)', color: 'var(--bg)',
                              fontSize: 11, lineHeight: 1.4, padding: '6px 10px',
                              borderRadius: 8, whiteSpace: 'normal', width: 220, zIndex: 10,
                              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                            }}>
                              {o.tooltip}
                            </div>
                          )}
                        </div>
                      )
                    })}
                    {opts.length > 1 && (
                      <button onClick={() => setRadioExpanded(prev => ({ ...prev, [c.id]: !prev[c.id] }))}
                        style={{
                          height: 28, padding: '0 8px', borderRadius: 8,
                          border: '1px solid var(--line)', background: 'transparent',
                          color: 'var(--ink-3)', fontSize: 11, cursor: 'pointer',
                        }}>
                        {expanded ? '收起' : `${opts.length} 项`}
                      </button>
                    )}
                  </div>
                  {childLocked && (
                    <div style={{ fontSize: 10, color: 'var(--accent-pink)', marginTop: 4 }}>{locks[childLockKey]}</div>
                  )}
                </div>
              )
            }
            if (c.type === 'tag-list') {
              const selected = (Array.isArray(state[c.id]) ? state[c.id] : c.default ?? []) as string[]
              const builtInOpts = (c.options ?? []).map(o => typeof o === 'string' ? o : o.value)
              const storageKey = `nibi_custom_dirs_${group.id}_${c.id}`
              const customOpts: string[] = (() => {
                try { return JSON.parse(localStorage.getItem(storageKey) || '[]') } catch { return [] }
              })()
              const allOpts = [...new Set([...builtInOpts, ...customOpts])]
              const toggleTag = (tag: string) => {
                const next = selected.includes(tag) ? selected.filter(t => t !== tag) : [...selected, tag]
                setState({ [c.id]: next.length > 0 ? next : [builtInOpts[0] ?? tag] })
              }
              const addCustomTag = () => {
                const val = (tagInput[c.id] || '').trim()
                if (!val || allOpts.includes(val)) return
                const updated = [...customOpts, val]
                localStorage.setItem(storageKey, JSON.stringify(updated))
                setState({ [c.id]: [...selected, val] })
                setTagInput(prev => ({ ...prev, [c.id]: '' }))
                setTagInputVisible(prev => ({ ...prev, [c.id]: false }))
              }
              const removeCustomTag = (tag: string) => {
                const updated = customOpts.filter(t => t !== tag)
                localStorage.setItem(storageKey, JSON.stringify(updated))
                if (selected.includes(tag)) {
                  const next = selected.filter(t => t !== tag)
                  setState({ [c.id]: next.length > 0 ? next : [builtInOpts[0] ?? ''] })
                }
              }
              return (
                <div key={c.id}>
                  <div style={{ fontSize: 11, color: 'var(--ink-2)', marginBottom: 6, fontWeight: 500 }}>{c.label}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    {allOpts.map(opt => {
                      const active = selected.includes(opt)
                      const isCustom = !builtInOpts.includes(opt)
                      return (
                        <div key={opt} style={{ position: 'relative', display: 'inline-flex' }}>
                          <button
                            onClick={() => toggleTag(opt)}
                            style={{
                              height: 28, padding: '0 12px', borderRadius: 8,
                              border: `1px solid ${active ? 'var(--ink)' : 'var(--line)'}`,
                              background: active ? 'var(--ink)' : 'var(--bg)',
                              color: active ? 'var(--bg)' : 'var(--ink)',
                              fontSize: 11, fontFamily: 'var(--mono)', cursor: 'pointer',
                            }}>
                            {opt}
                          </button>
                          {isCustom && (
                            <button
                              onClick={() => removeCustomTag(opt)}
                              title="移除自定义方向"
                              style={{
                                position: 'absolute', top: -6, right: -6,
                                width: 16, height: 16, borderRadius: '50%',
                                background: 'var(--accent-pink, #e74c3c)', color: '#fff',
                                fontSize: 10, lineHeight: '16px', textAlign: 'center',
                                border: 'none', cursor: 'pointer', padding: 0,
                              }}>
                              ×
                            </button>
                          )}
                        </div>
                      )
                    })}
                    {tagInputVisible[c.id] ? (
                      <div style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                        <input
                          value={tagInput[c.id] || ''}
                          onChange={e => setTagInput(prev => ({ ...prev, [c.id]: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter') addCustomTag(); if (e.key === 'Escape') setTagInputVisible(prev => ({ ...prev, [c.id]: false })) }}
                          placeholder="自定义方向"
                          autoFocus
                          style={{
                            height: 28, width: 100, padding: '0 8px', borderRadius: 8,
                            border: '1px solid var(--line)', background: 'var(--bg)',
                            color: 'var(--ink)', fontSize: 11, outline: 'none',
                          }}
                        />
                        <button onClick={addCustomTag}
                          style={{
                            height: 28, padding: '0 8px', borderRadius: 8,
                            border: '1px solid var(--line)', background: 'var(--ink)',
                            color: 'var(--bg)', fontSize: 11, cursor: 'pointer',
                          }}>
                          +
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setTagInputVisible(prev => ({ ...prev, [c.id]: true }))}
                        style={{
                          height: 28, padding: '0 8px', borderRadius: 8,
                          border: '1px dashed var(--line)', background: 'transparent',
                          color: 'var(--ink-3)', fontSize: 11, cursor: 'pointer',
                        }}>
                        + 自定义
                      </button>
                    )}
                  </div>
                </div>
              )
            }
            if (c.type === 'check') {
              return (
                <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12 }}>
                  <input type="checkbox" checked={!!state[c.id]} onChange={e => setState({ [c.id]: e.target.checked })}
                    style={{ accentColor: 'var(--ink)', width: 14, height: 14 }} />
                  <span style={{ color: 'var(--ink-2)' }}>{c.label}</span>
                </label>
              )
            }
            if (c.type === 'number') {
              return (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--ink-2)', minWidth: 60 }}>{c.label}</span>
                  <input type="number" value={(state[c.id] ?? c.default) as number}
                    onChange={e => setState({ [c.id]: Number(e.target.value) })}
                    className="pf-inp" style={{ width: 80, height: 28, padding: '0 8px' }} />
                  {c.unit && <span className="mono" style={{ fontSize: 10, color: 'var(--ink-3)' }}>{c.unit}</span>}
                </div>
              )
            }
            if (c.type === 'text') {
              return (
                <div key={c.id}>
                  <div style={{ fontSize: 11, color: 'var(--ink-2)', marginBottom: 6 }}>{c.label}</div>
                  <input className="pf-inp" value={(state[c.id] ?? c.default) as string}
                    placeholder={c.placeholder}
                    onChange={e => setState({ [c.id]: e.target.value })} />
                </div>
              )
            }
            if (c.type === 'textarea') {
              return (
                <div key={c.id}>
                  <div style={{ fontSize: 11, color: 'var(--ink-2)', marginBottom: 6 }}>{c.label}</div>
                  <textarea className="pf-inp" value={(state[c.id] ?? c.default) as string}
                    placeholder={c.placeholder}
                    onChange={e => setState({ [c.id]: e.target.value })}
                    rows={3}
                    style={{ width: '100%', resize: 'vertical', fontSize: 12, padding: '6px 8px' }} />
                  {c.hint && (
                    <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 4 }}>{c.hint}</div>
                  )}
                </div>
              )
            }
            return null
          })}
        </div>
      )}
    </div>
  )
}
