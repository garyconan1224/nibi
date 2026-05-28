import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Check,
  FileAudio,
  FileImage,
  FileText,
  FileVideo,
  Link2,
  Sparkles,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { FEATURES_BY_SCOPE_V2, FEATURES_BY_TYPE, expandFeatureIds, type FeatureDef } from '@/lib/featuresToSteps'
import { loadModelMemory, saveModelMemory, saveTextModel, saveVisionModel } from '@/lib/modelMemory'
import type { SniffResult } from '@/services/workspaces'
import {
  sniffUrl,
  autoCreateWorkspace,
  addWorkspaceItem,
  savePreflight,
  startItemPipeline,
} from '@/services/workspaces'
import type {
  AnalysisScope,
  ItemType,
  WorkspaceBackground,
} from '@/types/workspace'
import { useProviderStore } from '@/store/providerStore'

const TYPE_META: Record<ItemType, { icon: typeof FileVideo; label: string; sub: string }> = {
  video: { icon: FileVideo, label: '视频', sub: 'Video · URL/文件' },
  audio: { icon: FileAudio, label: '音频', sub: 'Audio · MP3/WAV' },
  image: { icon: FileImage, label: '图片', sub: 'Image · 批量' },
  text:  { icon: FileText,  label: '文字', sub: 'Text · 链接/粘贴' },
}

// ── Analysis Scope ─────────────────────────────────────────

const SCOPE_META: Record<AnalysisScope, { icon: typeof FileVideo; label: string; sub: string; itemType: ItemType }> = {
  audio_only:  { icon: FileAudio, label: '只听音频', sub: '抽取音频 · 转写 · 音乐分析', itemType: 'audio' },
  visual_only: { icon: FileVideo, label: '只看画面', sub: '截帧 · VLM 视觉分析 · 无 ASR', itemType: 'video' },
  av_combined: { icon: Sparkles,  label: '音视频综合', sub: 'ASR 转写 + 截帧 VLM + 合并总结', itemType: 'video' },
}

// ── Props ──────────────────────────────────────────────────

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
  /** R7.4: stage 回写配置，modal 打开时用其回填 selectedTypes / features / bgOverrides */
  initialStaged?: StagedConfig
  onAdded?: () => void
  onFineTune?: (staged: StagedConfig) => void
}

// ── 辅助 ──────────────────────────────────────────────────

const ALL_TYPES: ItemType[] = ['video', 'audio', 'image', 'text']

function resolveInitialTypes(
  sniffResult: SniffResult | null | undefined,
): { types: ItemType[]; locked: boolean } {
  if (sniffResult && sniffResult.possible_types.length > 0) {
    const types = sniffResult.possible_types.filter((t): t is ItemType =>
      ALL_TYPES.includes(t as ItemType),
    )
    if (types.length === 0) return { types: ['video'], locked: false }
    return { types, locked: types.length === 1 }
  }
  return { types: ['video'], locked: false }
}

function getSniffTypes(sniffResult: SniffResult | null | undefined): ItemType[] {
  if (!sniffResult) return []
  return sniffResult.possible_types.filter((t): t is ItemType =>
    ALL_TYPES.includes(t as ItemType),
  )
}

// ── R21.P2.v2: 任务旁 picker 组件 ─────────────────────────

interface ModelPickerProps {
  providerId: string
  modelId: string
  providers: Array<{ id: string; name: string }>
  models: Array<{ id: string; name: string }>
  loading?: boolean
  onPickProvider: (id: string) => void
  onPickModel: (id: string) => void
}

function TextModelPicker({ providerId, modelId, providers, models, loading, onPickProvider, onPickModel }: ModelPickerProps) {
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 6, marginBottom: 4 }}>
      <select
        className="field-input"
        style={{ flex: 1 }}
        value={providerId}
        onChange={(e) => onPickProvider(e.target.value)}
      >
        <option value="">文本模型 Provider</option>
        {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <select
        className="field-input"
        style={{ flex: 1 }}
        value={modelId}
        onChange={(e) => onPickModel(e.target.value)}
        disabled={!providerId}
      >
        <option value="">{providerId ? '选择模型' : '请先选 Provider'}</option>
        {loading ? <option value="" disabled>加载中…</option> : models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
    </div>
  )
}

function VisionModelPicker({ providerId, modelId, providers, models, loading, onPickProvider, onPickModel }: ModelPickerProps) {
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 6, marginBottom: 4 }}>
      <select
        className="field-input"
        style={{ flex: 1 }}
        value={providerId}
        onChange={(e) => onPickProvider(e.target.value)}
      >
        <option value="">图片模型 Provider</option>
        {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <select
        className="field-input"
        style={{ flex: 1 }}
        value={modelId}
        onChange={(e) => onPickModel(e.target.value)}
        disabled={!providerId}
      >
        <option value="">{providerId ? '选择模型' : '请先选 Provider'}</option>
        {loading ? <option value="" disabled>加载中…</option> : models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
    </div>
  )
}

function FrameModePicker({ params, onChange }: {
  params: { frame_mode: 'AI 镜头分析' | '按秒截帧'; shot_frames: '2 帧 · 首+尾' | '3 帧 · 首+中+尾'; sec_per_frame: number; max_frames: number }
  onChange: (p: { frame_mode: 'AI 镜头分析' | '按秒截帧'; shot_frames: '2 帧 · 首+尾' | '3 帧 · 首+中+尾'; sec_per_frame: number; max_frames: number }) => void
}) {
  return (
    <div style={{ marginTop: 4, marginBottom: 4, padding: '8px 10px', background: 'var(--fill-1)', borderRadius: 8, fontSize: 12 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
          <input type="radio" name="frameMode" checked={params.frame_mode === 'AI 镜头分析'} onChange={() => onChange({ ...params, frame_mode: 'AI 镜头分析' })} />
          AI 镜头分析
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
          <input type="radio" name="frameMode" checked={params.frame_mode === '按秒截帧'} onChange={() => onChange({ ...params, frame_mode: '按秒截帧' })} />
          按秒截帧
        </label>
      </div>
      {params.frame_mode === 'AI 镜头分析' ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: 'var(--ink-3)' }}>每镜头取</span>
          <select
            className="field-input"
            style={{ width: 120 }}
            value={params.shot_frames}
            onChange={(e) => onChange({ ...params, shot_frames: e.target.value as typeof params.shot_frames })}
          >
            <option value="2 帧 · 首+尾">2 帧 · 首+尾</option>
            <option value="3 帧 · 首+中+尾">3 帧 · 首+中+尾</option>
          </select>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: 'var(--ink-3)' }}>间隔</span>
          <input
            type="number"
            className="field-input"
            style={{ width: 60 }}
            min={1}
            value={params.sec_per_frame}
            onChange={(e) => onChange({ ...params, sec_per_frame: Number(e.target.value) })}
          />
          <span style={{ color: 'var(--ink-3)' }}>秒，最大</span>
          <input
            type="number"
            className="field-input"
            style={{ width: 60 }}
            min={1}
            value={params.max_frames}
            onChange={(e) => onChange({ ...params, max_frames: Number(e.target.value) })}
          />
          <span style={{ color: 'var(--ink-3)' }}>帧</span>
        </div>
      )}
    </div>
  )
}

// ── 组件 ──────────────────────────────────────────────────

export function AddMaterialModal({
  open,
  onOpenChange,
  workspaceIds,
  workspaceBackgrounds,
  sniffResult,
  urlValue,
  initialStaged,
  onAdded,
  onFineTune,
}: AddMaterialModalProps) {
  void onFineTune // 保留 prop 供 Composer 调用，当前 modal 内未直接使用
  const navigate = useNavigate()
  // ── 类型选择 ──
  const propInitial = useMemo(() => resolveInitialTypes(sniffResult), [sniffResult])
  const [selectedTypes, setSelectedTypes] = useState<ItemType[]>(propInitial.types)
  const [analysisScope, setAnalysisScope] = useState<AnalysisScope>('av_combined')

  // ── Feature 勾选（按类型）──
  const [features, setFeatures] = useState<Record<ItemType, Record<string, boolean>>>(
    () => buildDefaults(propInitial.types),
  )

  // ── 识别用背景 ──
  const [backgroundForRecognition, setBackgroundForRecognition] = useState('')

  // ── 视频用途模式 + 图片采集模式 ──
  const [videoIntent, setVideoIntent] = useState<'learning' | 'replica'>('replica')
  const [imageMode, setImageMode] = useState<'replica_prompt' | 'ocr'>('replica_prompt')

  // ── 链接预填来源 hint ──
  const [linkPreviewSource, setLinkPreviewSource] = useState<string | null>(null)

  // ── 背景信息（legacy，保留用于 workspaceBackgrounds 回填）──
  const mergedBg = useMemo(() => {
    if (!workspaceBackgrounds || workspaceIds.length === 0) return undefined
    return workspaceBackgrounds[workspaceIds[0]]
  }, [workspaceBackgrounds, workspaceIds])

  // ── 模型选择 + 截帧模式（R21.P2.v2：分散到任务旁）──
  const { providers, providerModels, fetchProviders, modelsLoading } = useProviderStore()
  const [textProviderId, setTextProviderId] = useState<string>('')
  const [textModelId, setTextModelId] = useState<string>('')
  const [visionProviderId, setVisionProviderId] = useState<string>('')
  const [visionModelId, setVisionModelId] = useState<string>('')
  const [framePromptParams, setFramePromptParams] = useState<{
    frame_mode: 'AI 镜头分析' | '按秒截帧'
    shot_frames: '2 帧 · 首+尾' | '3 帧 · 首+中+尾'
    sec_per_frame: number
    max_frames: number
  }>({
    frame_mode: 'AI 镜头分析',
    shot_frames: '3 帧 · 首+中+尾',
    sec_per_frame: 2,
    max_frames: 120,
  })

  // ── R21.P2.v3: 高级选项（替代细调里的子字段）──
  const [advOpts, setAdvOpts] = useState({
    summary_depth: '详细' as string,
    summary_template: 'concise' as string,
    music_suno: true,
    subtitle_with_ts: true,
    speaker_diarize: false,
  })
  const setAdv = (patch: Partial<typeof advOpts>) => setAdvOpts((p) => ({ ...p, ...patch }))

  // ── 提交状态 ──
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── 内部 URL 输入（调用方未传 urlValue 时使用）──
  const [internalUrl, setInternalUrl] = useState('')
  const [internalSniff, setInternalSniff] = useState<SniffResult | null>(null)
  const sniffTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const effectiveSniff = sniffResult ?? internalSniff
  const effectiveUrl = (urlValue ?? internalUrl).trim()
  const sniffTypes = useMemo(() => getSniffTypes(effectiveSniff), [effectiveSniff])
  const effectiveInitial = useMemo(() => resolveInitialTypes(effectiveSniff), [effectiveSniff])
  const typeLocked = sniffTypes.length === 1
  const showScopeCards = sniffTypes.includes('video') && sniffTypes.includes('audio')

  // ── open / sniff / initialStaged 变化时重置类型与 features ──
  useEffect(() => {
    if (!open) return
    const { types } = effectiveInitial
    /* eslint-disable react-hooks/set-state-in-effect */
    // R7.4: initialStaged 回填优先于 sniff 默认值
    if (initialStaged?.types?.length) {
      const scope = initialStaged.analysisScope ?? (showScopeCards ? 'av_combined' : undefined)
      const resetTypes = scope ? [SCOPE_META[scope].itemType] : initialStaged.types
      setSelectedTypes(resetTypes)
      setFeatures({
        ...buildDefaults(resetTypes, scope),
        ...(initialStaged.features ?? {}),
      })
      setAnalysisScope(scope ?? 'av_combined')
      setVideoIntent(initialStaged.videoIntent ?? 'replica')
      setImageMode(initialStaged.imageMode ?? 'replica_prompt')
    } else {
      const scope = showScopeCards ? 'av_combined' : undefined
      const resetTypes = scope ? [SCOPE_META[scope].itemType] : types
      setSelectedTypes(resetTypes)
      setFeatures(buildDefaults(resetTypes, scope))
      setAnalysisScope(scope ?? 'av_combined')
      setVideoIntent('replica')
      setImageMode('replica_prompt')
    }
    setBackgroundForRecognition('')
    setLinkPreviewSource(null)
    setError(null)
    setSubmitting(false)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, effectiveInitial, initialStaged, showScopeCards])

  useEffect(() => {
    if (!open) return
    /* eslint-disable react-hooks/set-state-in-effect */
    setInternalUrl('')
    setInternalSniff(null)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, urlValue])

  // ── R21.P2.v2: open 时拉 providers + 回填 models / framePromptParams ──
  useEffect(() => {
    if (!open) return
    if (providers.length === 0) fetchProviders()
  }, [open, providers.length, fetchProviders])

  useEffect(() => {
    if (!open) return
    /* eslint-disable react-hooks/set-state-in-effect */
    const mem = loadModelMemory()
    setTextProviderId(initialStaged?.models?.textProviderId ?? mem.textProviderId ?? '')
    setTextModelId(initialStaged?.models?.text ?? mem.textModelId ?? '')
    setVisionProviderId(initialStaged?.models?.visionProviderId ?? mem.visionProviderId ?? '')
    setVisionModelId(initialStaged?.models?.vision ?? mem.visionModelId ?? '')
    // 从 staged 的 frame_prompt 回填
    const stagedFp = (initialStaged?.tasks?.video?.frame_prompt ?? {}) as Record<string, unknown>
    setFramePromptParams({
      frame_mode: stagedFp.frame_mode === '按秒截帧' ? '按秒截帧' : 'AI 镜头分析',
      shot_frames: stagedFp.shot_frames === '2 帧 · 首+尾' ? '2 帧 · 首+尾' : '3 帧 · 首+中+尾',
      sec_per_frame: typeof stagedFp.sec_per_frame === 'number' ? stagedFp.sec_per_frame : 2,
      max_frames: typeof stagedFp.max_frames === 'number' ? stagedFp.max_frames : 120,
    })
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, initialStaged])

  // 拉 text/vision provider 的 models 列表（用户选定 provider 后触发）
  useEffect(() => {
    if (!open || !textProviderId) return
    if (!providerModels[textProviderId]) {
      useProviderStore.getState().fetchProviderModels(textProviderId)
    }
  }, [open, textProviderId, providerModels])

  useEffect(() => {
    if (!open || !visionProviderId) return
    if (!providerModels[visionProviderId]) {
      useProviderStore.getState().fetchProviderModels(visionProviderId)
    }
  }, [open, visionProviderId, providerModels])

  const enabledProviders = useMemo(
    () => providers.filter((p) => p.enabled && p.has_api_key),
    [providers],
  )
  const textProviders = useMemo(
    () => enabledProviders.filter((p) => (p.capabilities ?? []).includes('chat')),
    [enabledProviders],
  )
  const textModels = useMemo(() => {
    const all = textProviderId ? (providerModels[textProviderId] ?? []) : []
    // R21.P2.v3: 按 capability 过滤 —— 有标签用标签，没标签排除 embedding/rerank
    return all.filter((m) => {
      if (m.capabilities?.length) return m.capabilities.some((c) => /chat|text|completion/i.test(c))
      return !/embed|rerank/i.test(m.id)
    })
  }, [textProviderId, providerModels])
  const visionProviders = useMemo(
    () => enabledProviders.filter((p) => (p.capabilities ?? []).includes('vision')),
    [enabledProviders],
  )
  const visionModels = useMemo(() => {
    const all = visionProviderId ? (providerModels[visionProviderId] ?? []) : []
    // R21.P2.v3: 按 capability 过滤 —— 有标签用标签，没标签用 id 启发式
    return all.filter((m) => {
      if (/embed|rerank/i.test(m.id)) return false
      if (m.capabilities?.length) return m.capabilities.some((c) => /vision|image|multimodal/i.test(c))
      return /vl|vision|gpt-4o|gemini.*pro|claude-3|claude-sonnet|qwen-vl|qwen2-vl|V[^.\d]/i.test(m.id) || /V$/.test(m.id)
    })
  }, [visionProviderId, providerModels])

  // ── 内部 URL 变化时 debounced 嗅探 + 链接预填 ──
  const doSniff = useCallback(async (url: string) => {
    try {
      const result = await sniffUrl(url)
      setInternalSniff(result)
    } catch {
      setInternalSniff(null)
    }
  }, [])

  const doLinkPreview = useCallback(async (url: string) => {
    try {
      const { fetchLinkPreview } = await import('@/services/linkPreview')
      const result = await fetchLinkPreview(url)
      if (result.title || result.description) {
        setBackgroundForRecognition((prev) => {
          if (prev.trim()) return prev // 已有内容不覆盖
          return [result.title, result.description].filter(Boolean).join('\n\n')
        })
        const sourceMap: Record<string, string> = { bili: 'B 站', og: '网页', fallback: '' }
        setLinkPreviewSource(sourceMap[result.source] || null)
      }
    } catch {
      // 静默失败
    }
  }, [])

  // ── 外部传入 urlValue 时触发链接预填 ──
  useEffect(() => {
    if (!open || !urlValue?.trim()) return
    doLinkPreview(urlValue.trim())
  }, [open, urlValue, doLinkPreview])

  useEffect(() => {
    if (!internalUrl.trim() || urlValue) return
    clearTimeout(sniffTimer.current)
    sniffTimer.current = setTimeout(() => {
      doSniff(internalUrl.trim())
      doLinkPreview(internalUrl.trim())
    }, 500)
    return () => clearTimeout(sniffTimer.current)
  }, [internalUrl, urlValue, doSniff, doLinkPreview])

  const handleInternalUrlChange = (value: string) => {
    setInternalUrl(value)
    setError(null)
    setInternalSniff(null)
  }

  // ── 类型勾选切换 ──
  const toggleType = (t: ItemType) => {
    // 嗅探锁定类型不可切换；嗅探多选时只能选 sniff 返回的类型
    if (typeLocked) return
    if (sniffTypes.length > 1 && !sniffTypes.includes(t)) return

    setSelectedTypes((prev) => {
      if (prev.includes(t) && prev.length === 1) return prev
      const next = prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
      if (!prev.includes(t)) {
        setFeatures((f) => ({ ...f, [t]: buildTypeDefaults(t) }))
      }
      return next
    })
  }

  // ── Feature 勾选切换（R17: 综合笔记联动）──
  const toggleFeature = (type: ItemType, featId: string) => {
    setFeatures((prev) => {
      const next = { ...prev }
      const cur = { ...(next[type] ?? {}) }
      const turningOn = !cur[featId]
      cur[featId] = turningOn
      next[type] = cur

      // 联动：勾上综合笔记 → 自动勾上画面分析 + 人声转写
      if (featId === 'av_synthesis' && turningOn) {
        cur['visual_analysis'] = true
        cur['transcribe_summary'] = true
      }
      return next
    })
  }

  // ── 一键解析（标准 workspace flow）──
  const handleQuickSubmit = async () => {
    if (!effectiveUrl) {
      setError('请先输入素材链接')
      return
    }
    if (!showScopeCards && selectedTypes.length === 0) {
      setError('请至少选择一种素材类型')
      return
    }
    setSubmitting(true)
    setError(null)

    // 分析范围模式下确定创建类型列表
    const typesToCreate: { type: ItemType; summaryPath?: string }[] = showScopeCards
      ? [{ type: SCOPE_META[analysisScope].itemType, summaryPath: analysisScope }]
      : selectedTypes.map((t) => ({ type: t }))

    try {
      // 1. 无选择时自动创建工作空间
      let wsId = workspaceIds[0]
      if (!wsId) {
        const ws = await autoCreateWorkspace({ hint_url: effectiveUrl })
        wsId = ws.workspace_id
        toast.info(`已自动创建工作空间「${ws.name}」`)
      }

      const effectiveBackground: Partial<WorkspaceBackground> = mergedBg ?? {}
      let firstTaskId: string | null = null
      let firstItemId: string | null = null
      let succeeded = 0
      const errors: string[] = []

      for (const { type, summaryPath } of typesToCreate) {
        try {
          const scopedType = showScopeCards ? SCOPE_META[analysisScope].itemType : null
          const allowed: Set<string> | null = showScopeCards && type === scopedType
            ? new Set(FEATURES_BY_SCOPE_V2[analysisScope].map(f => f.id))
            : null
          const rawEnabled = Object.entries(features[type] ?? {})
            .filter(([id, on]) => on && (!allowed || allowed.has(id)))
            .map(([id]) => id)
          const enabledFeatures = expandFeatureIds(rawEnabled)

          // 2. addWorkspaceItem
          const ws = await addWorkspaceItem(wsId, {
            type,
            source: 'url',
            source_value: effectiveUrl,
            name: effectiveSniff?.title ?? effectiveUrl,
          })
          const item = ws.items[ws.items.length - 1]
          const itemId = item.item_id

          // 3. savePreflight — fine-tune 回写时优先保留 R8 任务子参数
          const stagedTasks = initialStaged?.tasks?.[type]
          const tasks: Record<string, unknown> = stagedTasks
            ? { ...stagedTasks }
            : {}
          for (const feat of enabledFeatures) {
            if (!stagedTasks) tasks[feat] = true
          }
          if (type === 'video' || type === 'audio' || stagedTasks) {
            tasks.material_type = type
            tasks.enabled_features = stagedTasks?.enabled_features ?? enabledFeatures
          }
          // analysisScope → canonical summary_path
          if (summaryPath === 'visual_only') {
            tasks.summary = { on: true, summary_path: '只看画面' }
            tasks.frame_prompt = { ...(tasks.frame_prompt as Record<string, unknown> || {}), on: true }
          } else if (summaryPath === 'av_combined') {
            tasks.summary = { on: true, summary_path: '音视频综合' }
            tasks.frame_prompt = { ...(tasks.frame_prompt as Record<string, unknown> || {}), on: true }
            tasks.srt = { ...(tasks.srt as Record<string, unknown> || {}), on: true }
          } else if (summaryPath === 'audio_only') {
            tasks.material_type = 'audio'
          }

          // R21.P2.v2: 写入截帧模式完整参数（仅视频/视觉相关板块）
          const isVideoLike = type === 'video' || summaryPath === 'visual_only' || summaryPath === 'av_combined'
          const visualAnalysisOn = features[type]?.['visual_analysis'] ?? false
          if (isVideoLike && visualAnalysisOn) {
            tasks.frame_prompt = {
              ...(tasks.frame_prompt as Record<string, unknown> || {}),
              on: true,
              frame_mode: framePromptParams.frame_mode,
              shot_frames: framePromptParams.shot_frames,
              sec_per_frame: framePromptParams.sec_per_frame,
              max_frames: framePromptParams.max_frames,
            }
          }

          // R21.P2.v2: 合并主界面选的模型，优先级 主界面 > initialStaged（不含 video）
          const mergedModels: Record<string, string> = { ...(initialStaged?.models ?? {}) }
          if (textModelId) mergedModels.text = textModelId
          if (visionModelId) mergedModels.vision = visionModelId

          // R21.P2.v3: 合并高级选项到 tasks
          const enabledSet = new Set(enabledFeatures)
          if (enabledSet.has('video_summary')) {
            tasks.summary = { ...(tasks.summary as Record<string, unknown> || {}), summary_depth: advOpts.summary_depth }
          }
          if (enabledSet.has('transcribe_summary')) {
            tasks.transcribe_summary = {
              ...(tasks.transcribe_summary as Record<string, unknown> || {}),
              summary_template: advOpts.summary_template,
              speaker_diarize: advOpts.speaker_diarize,
            }
            if (enabledSet.has('subtitle_export')) {
              tasks.subtitle_export = {
                ...(tasks.subtitle_export as Record<string, unknown> || {}),
                on: true,
                include_timestamps: advOpts.subtitle_with_ts,
              }
            }
          }
          if (enabledSet.has('music_analysis')) {
            tasks.music = { ...(tasks.music as Record<string, unknown> || {}), on: true, music_suno: advOpts.music_suno }
          }

          // R21.P3.S1: 写入 preflight 新字段（intent / image_mode / background_for_recognition）
          const preflight: Record<string, unknown> = {}
          if (type === 'video') preflight.intent = videoIntent
          if (type === 'image') preflight.image_mode = imageMode
          if (backgroundForRecognition.trim()) preflight.background_for_recognition = backgroundForRecognition.trim()
          if (Object.keys(preflight).length > 0) {
            tasks.preflight = { ...(tasks.preflight as Record<string, unknown> || {}), ...preflight }
          }

          await savePreflight(wsId, itemId, {
            intent: type === 'video' ? videoIntent : undefined,
            background_overrides: effectiveBackground,
            models: mergedModels,
            tasks,
          })

          // R21.P2.v2: 记忆本次选择到 localStorage
          saveModelMemory({ textProviderId, textModelId, visionProviderId, visionModelId })

          // 4. startItemPipeline
          const { task_id } = await startItemPipeline(wsId, itemId)

          if (!firstTaskId) { firstTaskId = task_id; firstItemId = itemId }
          succeeded++
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : '创建失败'
          errors.push(`${TYPE_META[type].label}: ${msg}`)
          toast.error(`${TYPE_META[type].label}任务创建失败: ${msg}`)
        }
      }

      if (succeeded === 0) throw new Error('所有素材创建失败')

      if (errors.length > 0) {
        toast.warning(`已创建 ${succeeded}/${selectedTypes.length} 个素材`, {
          description: errors.join('；'),
        })
      } else {
        toast.success(
          selectedTypes.length > 1 ? `已创建 ${succeeded} 个素材` : '任务已开始',
          { description: effectiveUrl },
        )
      }

      onAdded?.()
      onOpenChange(false)
      if (firstTaskId) {
        navigate(`/processing/${firstTaskId}`, {
          state: { url: effectiveUrl, workspaceId: wsId, itemId: firstItemId },
        })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '提交失败'
      setError(msg)
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  // ── 派生值 ──
  const hasContent = effectiveUrl.length > 0 && (showScopeCards || selectedTypes.length > 0)
  const enabledCount = useMemo(() => {
    let n = 0
    for (const t of selectedTypes) {
      if (features[t]) {
        n += Object.values(features[t]).filter(Boolean).length
      }
    }
    return n
  }, [selectedTypes, features])

  // R21.P2.v3: 高级选项可见性 —— 任一选中类型含对应 feature 即显示
  const anyHas = (fid: string) => selectedTypes.some((t) => features[t]?.[fid])

  const sourceSummary = effectiveSniff?.title
    ? `${effectiveSniff.platform ?? '未知平台'} · ${effectiveSniff.title}`
    : effectiveUrl
      ? '网络链接'
      : '配置素材类型与分析选项'
  const workspaceSummary =
    workspaceIds.length > 1
      ? `${workspaceIds.length} 个工作空间`
      : workspaceIds.length === 1
        ? '当前工作空间'
        : '未选择工作空间'

  // ── 判断某类型是否可选择 ──
  const isTypeSelectable = (t: ItemType): boolean => {
    if (typeLocked) return selectedTypes.includes(t)
    if (sniffTypes.length > 1) return sniffTypes.includes(t)
    return true
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
          配置素材类型、输入源、分析任务与背景信息
        </DialogDescription>

        {/* ── m-head ── */}
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

        {/* ── m-body ── */}
        <div className="m-body">
          {error && (
            <div className="modal-error">{error}</div>
          )}

          {/* ① 素材类型 / 分析范围 */}
          <div className="m-section">
            <div className="eyebrow" style={{ marginBottom: 10 }}>
              {showScopeCards ? '① 分析范围 · 三选一' : '① 素材类型'}
            </div>
            {showScopeCards ? (
              <div className="type-row">
                {(Object.entries(SCOPE_META) as [AnalysisScope, typeof SCOPE_META[AnalysisScope]][]).map(([scope, meta]) => {
                  const Icon = meta.icon
                  const active = analysisScope === scope
                  return (
                    <button
                      key={scope}
                      type="button"
                      className="type-card"
                      data-active={active ? 'true' : 'false'}
                      onClick={() => {
                        setAnalysisScope(scope)
                        setSelectedTypes([meta.itemType])
                        // 切换 scope 时用新表重建默认值
                        const scopeDefaults: Record<string, boolean> = {}
                        for (const f of FEATURES_BY_SCOPE_V2[scope]) {
                          scopeDefaults[f.id] = f.defaultChecked
                        }
                        setFeatures({ [meta.itemType]: scopeDefaults } as Record<ItemType, Record<string, boolean>>)
                      }}
                    >
                      <Icon size={22} />
                      <div className="tc-l">{meta.label}</div>
                      <div className="mono tc-en">{meta.sub}</div>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="type-row">
                {ALL_TYPES.map((t) => {
                  const meta = TYPE_META[t]
                  const Icon = meta.icon
                  const active = selectedTypes.includes(t)
                  const selectable = isTypeSelectable(t)
                  return (
                    <button
                      key={t}
                      type="button"
                      className="type-card"
                      data-active={active ? 'true' : 'false'}
                      onClick={() => selectable && toggleType(t)}
                      disabled={!selectable}
                    >
                      <Icon size={22} />
                      <div className="tc-l">{meta.label}</div>
                      <div className="mono tc-en">{meta.sub}</div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* ② 输入源 */}
          <div className="m-section">
            <div className="eyebrow" style={{ marginBottom: 10 }}>② 输入源</div>
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
                  onChange={(e) => handleInternalUrlChange(e.target.value)}
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
          </div>

          {/* ③ 分析任务（文字素材跳过） */}
          {selectedTypes.length > 0 && !selectedTypes.every(t => t === 'text') && (
            <div className="m-section">
              <div className="eyebrow" style={{ marginBottom: 10 }}>
                ③ 勾选分析任务 · 已按类型智能默认
              </div>
              {selectedTypes.map((type) => {
                if (type === 'text') return null
                const meta = TYPE_META[type]
                const Icon = meta.icon
                const isScopedType = showScopeCards && type === SCOPE_META[analysisScope].itemType
                const typeFeatures: FeatureDef[] = isScopedType
                  ? FEATURES_BY_SCOPE_V2[analysisScope]
                  : FEATURES_BY_TYPE[type]

                // av_combined 时分组：highlight 项独占一行，然后分视频侧/音频侧
                const splitScopeFeats = isScopedType && analysisScope === 'av_combined'
                const highlightFeats = splitScopeFeats
                  ? typeFeatures.filter(f => f.highlight)
                  : []
                const normalFeats = splitScopeFeats
                  ? typeFeatures.filter(f => !f.highlight)
                  : typeFeatures
                const videoSideFeats = splitScopeFeats
                  ? normalFeats.filter(f => f.id === 'visual_analysis')
                  : []
                const audioSideFeats = splitScopeFeats
                  ? normalFeats.filter(f => f.id !== 'visual_analysis')
                  : []

                // 综合笔记精度下降 hint
                const synthesisOn = features[type]?.['av_synthesis'] ?? false
                const visualOn = features[type]?.['visual_analysis'] ?? false
                const transcribeOn = features[type]?.['transcribe_summary'] ?? false
                const showPrecisionHint = synthesisOn && (!visualOn || !transcribeOn)

                const renderChip = (feat: FeatureDef) => {
                  const on = features[type]?.[feat.id] ?? false
                  return (
                    <button
                      key={feat.id}
                      type="button"
                      className="task-chip"
                      data-on={on ? 'true' : 'false'}
                      data-highlight={feat.highlight ? 'true' : undefined}
                      onClick={() => toggleFeature(type, feat.id)}
                      title={feat.hint}
                    >
                      <span className="tc-box">
                        {on && <Check size={12} strokeWidth={2.5} />}
                      </span>
                      {feat.badge && <span style={{ marginRight: 2 }}>{feat.badge}</span>}
                      {feat.label}
                    </button>
                  )
                }

                return (
                  <div key={type} style={{ marginBottom: 10 }}>
                    <div
                      className="mono"
                      style={{
                        fontSize: 10,
                        color: 'var(--ink-3)',
                        marginBottom: 6,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                      }}
                    >
                      <Icon size={12} />
                      {meta.label}
                    </div>
                    {/* highlight 项（综合笔记）独占一行 */}
                    {highlightFeats.length > 0 && (
                      <div className="task-chips" style={{ marginBottom: 6 }}>
                        {highlightFeats.map(renderChip)}
                        {showPrecisionHint && (
                          <span className="mono" style={{ fontSize: 10, color: 'var(--amber-600, #d97706)', marginLeft: 6 }}>
                            ⚠ 已取消依赖项，精度可能下降
                          </span>
                        )}
                      </div>
                    )}
                    {/* R21.P2.v2: 综合笔记勾选时，下方显示文本模型选择 */}
                    {synthesisOn && (
                      <TextModelPicker
                        providerId={textProviderId}
                        modelId={textModelId}
                        providers={textProviders}
                        models={textModels}
                        loading={modelsLoading[textProviderId]}
                        onPickProvider={(id) => { setTextProviderId(id); setTextModelId(''); saveTextModel(id, '') }}
                        onPickModel={(id) => { setTextModelId(id); saveTextModel(textProviderId, id) }}
                      />
                    )}
                    {/* 视频侧 */}
                    {videoSideFeats.length > 0 && (
                      <>
                        <div className="mono" style={{ fontSize: 9, color: 'var(--ink-4)', marginBottom: 3, marginTop: 4 }}>视频侧</div>
                        <div className="task-chips" style={{ marginBottom: 4 }}>
                          {videoSideFeats.map(renderChip)}
                        </div>
                        {/* R21.P2.v2: 画面分析勾选时，下方显示图片模型 */}
                        {visualOn && (
                          <VisionModelPicker
                            providerId={visionProviderId}
                            modelId={visionModelId}
                            providers={visionProviders}
                            models={visionModels}
                            loading={modelsLoading[visionProviderId]}
                            onPickProvider={(id) => { setVisionProviderId(id); setVisionModelId(''); saveVisionModel(id, '') }}
                            onPickModel={(id) => { setVisionModelId(id); saveVisionModel(visionProviderId, id) }}
                          />
                        )}
                      </>
                    )}
                    {/* 音频侧 */}
                    {/* TODO(r21.P2): ASR 模型选择暂不暴露（方案 A），等用户反馈后再加引擎/模型下拉 */}
                    {audioSideFeats.length > 0 && (
                      <>
                        <div className="mono" style={{ fontSize: 9, color: 'var(--ink-4)', marginBottom: 3 }}>音频侧</div>
                        <div className="task-chips">
                          {audioSideFeats.map(renderChip)}
                        </div>
                      </>
                    )}
                    {/* 非 av_combined 模式：直接渲染全部 chip */}
                    {!splitScopeFeats && (
                      <>
                        <div className="task-chips">
                          {normalFeats.map(renderChip)}
                        </div>
                        {/* R21.P2.v2: 非 av_combined 时也显示对应 picker */}
                        {synthesisOn && (
                          <TextModelPicker
                            providerId={textProviderId}
                            modelId={textModelId}
                            providers={textProviders}
                            models={textModels}
                            loading={modelsLoading[textProviderId]}
                            onPickProvider={(id) => { setTextProviderId(id); setTextModelId(''); saveTextModel(id, '') }}
                            onPickModel={(id) => { setTextModelId(id); saveTextModel(textProviderId, id) }}
                          />
                        )}
                        {visualOn && (
                          <VisionModelPicker
                            providerId={visionProviderId}
                            modelId={visionModelId}
                            providers={visionProviders}
                            models={visionModels}
                            loading={modelsLoading[visionProviderId]}
                            onPickProvider={(id) => { setVisionProviderId(id); setVisionModelId(''); saveVisionModel(id, '') }}
                            onPickModel={(id) => { setVisionModelId(id); saveVisionModel(visionProviderId, id) }}
                          />
                        )}
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* ③-b 视频用途模式（仅视频素材） */}
          {selectedTypes.includes('video') && (
            <div className="m-section">
              <div className="eyebrow" style={{ marginBottom: 10 }}>视频用途模式</div>
              <div className="type-row">
                {[
                  { v: 'learning' as const, label: '学习/课程', sub: '转录为主轴 · 画面按需补图' },
                  { v: 'replica' as const, label: '复刻/创作', sub: '每帧 VLM 描述 + 提示词' },
                ].map(({ v, label, sub }) => (
                  <button
                    key={v}
                    type="button"
                    className="type-card"
                    data-active={videoIntent === v ? 'true' : 'false'}
                    onClick={() => setVideoIntent(v)}
                  >
                    <div className="tc-l">{label}</div>
                    <div className="mono tc-en">{sub}</div>
                  </button>
                ))}
              </div>
              {/* 学习模式子参数 */}
              {videoIntent === 'learning' && (
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--ink-2)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <input type="checkbox" checked disabled /> ASR 转写（学习模式必开）
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <input type="checkbox" checked={advOpts.speaker_diarize}
                      onChange={(e) => setAdv({ speaker_diarize: e.target.checked })} />
                    区分说话人音色
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" checked={advOpts.music_suno}
                      onChange={(e) => setAdv({ music_suno: e.target.checked })} />
                    音乐分析
                  </label>
                </div>
              )}
              {/* 复刻模式子参数 */}
              {videoIntent === 'replica' && (
                <div style={{ marginTop: 8 }}>
                  <FrameModePicker
                    params={framePromptParams}
                    onChange={setFramePromptParams}
                  />
                </div>
              )}
            </div>
          )}

          {/* ③-c 图片采集模式（仅图片素材） */}
          {selectedTypes.includes('image') && !selectedTypes.includes('video') && (
            <div className="m-section">
              <div className="eyebrow" style={{ marginBottom: 10 }}>图片采集模式</div>
              <div className="type-row">
                {[
                  { v: 'replica_prompt' as const, label: '提示词复刻', sub: 'VLM 生成图生图提示词' },
                  { v: 'ocr' as const, label: 'OCR 识别', sub: '提取图中文字' },
                ].map(({ v, label, sub }) => (
                  <button
                    key={v}
                    type="button"
                    className="type-card"
                    data-active={imageMode === v ? 'true' : 'false'}
                    onClick={() => setImageMode(v)}
                  >
                    <div className="tc-l">{label}</div>
                    <div className="mono tc-en">{sub}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* R21.P2.v3: 高级选项（字幕 / 音乐提示词；总结模板移到 S2 结果页）*/}
          {(anyHas('subtitle_export') || anyHas('transcribe_summary') || anyHas('music_analysis')) && (
            <details className="m-section" style={{ marginTop: 8 }}>
              <summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--ink-2)', userSelect: 'none' }}>
                高级选项（字幕 / 说话人 / 音乐提示词）
              </summary>
              <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
                {/* 字幕选项 —— 音频有字幕导出时 */}
                {anyHas('subtitle_export') && (
                  <div>
                    <div className="field-label">字幕选项</div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--ink-2)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={advOpts.subtitle_with_ts}
                        onChange={(e) => setAdv({ subtitle_with_ts: e.target.checked })} />
                      含时间轴（.srt）；取消则导出纯文本 .txt
                    </label>
                  </div>
                )}
                {/* 说话人音色 —— 音频有转写时 */}
                {anyHas('transcribe_summary') && (
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--ink-2)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={advOpts.speaker_diarize}
                        onChange={(e) => setAdv({ speaker_diarize: e.target.checked })} />
                      区分说话人音色（声纹聚类 → 给 segment 加标签）
                    </label>
                  </div>
                )}
                {/* 音乐 Suno 提示词 */}
                {anyHas('music_analysis') && (
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--ink-2)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={advOpts.music_suno}
                        onChange={(e) => setAdv({ music_suno: e.target.checked })} />
                      同时生成 Suno / Udio 格式提示词
                    </label>
                  </div>
                )}
              </div>
            </details>
          )}

          {/* ④ 识别用背景（文字素材跳过） */}
          {!selectedTypes.every(t => t === 'text') && (
            <div className="m-section">
              <div className="eyebrow" style={{ marginBottom: 10 }}>
                ④ 识别用背景（可选 · 喂给 ASR/VLM 提升专有名词识别）
              </div>
              <textarea
                className="field-input"
                style={{ minHeight: 60, resize: 'vertical', width: '100%' }}
                placeholder="主题背景、参与人物、专有名词…（如：Q3 战略会议，张总介绍 Pocket 4 拍摄技巧）"
                value={backgroundForRecognition}
                onChange={(e) => setBackgroundForRecognition(e.target.value)}
              />
              {linkPreviewSource && (
                <div className="mono" style={{ fontSize: 10, color: 'var(--ink-4)', marginTop: 4 }}>
                  已自动从{linkPreviewSource}抓取，可手动修改
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── m-foot ── */}
        <div className="m-foot">
          <span className="mono modal-foot-status">
            <span className="chip-dot" style={{ marginRight: 6 }} />
            {showScopeCards
              ? `${SCOPE_META[analysisScope].label} · ${SCOPE_META[analysisScope].sub}`
              : `已勾选 ${enabledCount} 项 · ${selectedTypes.length} 种素材类型`}
          </span>
          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleQuickSubmit}
              disabled={!hasContent || submitting}
            >
              {submitting ? (
                '提交中…'
              ) : (
                <>
                  <Sparkles size={14} />
                  一键解析
                </>
              )}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── 默认值构建 ──────────────────────────────────────────────

function buildTypeDefaults(type: ItemType, scope?: AnalysisScope): Record<string, boolean> {
  // R17: scope 模式走新表，audio_only 对应 audio，visual/combined 对应 video。
  if (scope && type === SCOPE_META[scope].itemType) {
    const defaults: Record<string, boolean> = {}
    for (const f of FEATURES_BY_SCOPE_V2[scope]) {
      defaults[f.id] = f.defaultChecked
    }
    return defaults
  }
  const defaults: Record<string, boolean> = {}
  for (const f of FEATURES_BY_TYPE[type]) {
    defaults[f.id] = f.defaultChecked
  }
  return defaults
}

function buildDefaults(types: ItemType[], scope?: AnalysisScope): Record<ItemType, Record<string, boolean>> {
  const result = {} as Record<ItemType, Record<string, boolean>>
  for (const t of types) {
    result[t] = buildTypeDefaults(t, scope)
  }
  return result
}
