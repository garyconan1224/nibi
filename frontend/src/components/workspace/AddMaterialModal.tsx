import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, CheckCircle2, ChevronDown, Clock, Copy, FileAudio, FileText, Film, Image as ImageIcon, Layers, LayoutTemplate, Link2, Lock, PenTool, PlayCircle, Plus, Search, Settings2, Target, Upload, Video, Wand2, X } from 'lucide-react'
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useProviderStore } from '@/store/providerStore'
import type { SniffResult } from '@/services/workspaces'
import {
  createWorkspace as createWorkspaceSvc,
  ensureInbox,
  generateNote,
  probeDuration,
  probeItemMedia,
  savePreflight,
  sniffUrl,
  startItemPipeline,
  updateWorkspace as updateWorkspaceSvc,
} from '@/services/workspaces'
import { fetchLinkPreview } from '@/services/linkPreview'
import { batchAddItemsToWorkspace, fetchLibrary, type LibraryItem } from '@/services/library'
import type {
  AnalysisScope,
  ItemType,
  WorkspaceBackground,
  WorkspaceRecord,
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
  availableWorkspaces?: WorkspaceRecord[]
  onWorkspaceIdsChange?: (workspaceIds: string[]) => void
  onCreateWorkspace?: (name: string, kind?: 'note' | 'replica') => Promise<WorkspaceRecord>
  onWorkspaceUpdated?: (workspace: WorkspaceRecord) => void
  sniffResult?: SniffResult | null
  urlValue?: string
  onAdded?: () => void
  /** 本地文件：上传后的 item ID */
  localFile?: string
  /** 本地文件：原始文件名 */
  localFileName?: string
  /** 本地文件：素材类型 */
  localFileType?: ItemType
  /** 本地文件：所在 workspace ID */
  localWsId?: string
  /** 从全局弹窗选择并上传本地文件 */
  onPickLocalFile?: () => void
  localUploadPending?: boolean
  /** 合集类型，从合集详情页传入时启用硬锁 */
  workspaceKind?: 'note' | 'replica'
}

type NoteMediaKind = 'auto' | 'video' | 'image_text' | 'audio'
type ActionType = 'note' | 'replica' | 'ai_video' | 'storyboard' | 'rewrite'

const NOTE_TYPE_CARDS: { value: NoteMediaKind; label: string; desc: string }[] = [
  { value: 'auto', label: '自动识别', desc: '由系统判断笔记类型' },
  { value: 'video', label: '视频笔记', desc: '视频转写 + 时间戳 + 截帧' },
  { value: 'image_text', label: '图文笔记', desc: '逐图视觉理解 + 文字提取 + 按类型总结' },
  { value: 'audio', label: '音频笔记', desc: '音频转写 + 章节整理' },
]

/** 7 个常用风格（主显） */
const PRIMARY_STYLES = [
  { id: 'standard', label: '标准总结' },
  { id: 'concise', label: '精简摘要' },
  { id: 'detailed', label: '详细要点' },
  { id: 'outline', label: '大纲' },
  { id: 'lecture', label: '教学笔记' },
  { id: 'steps', label: '步骤教程' },
  { id: 'quotes', label: '金句提取' },
] as const

/** 其余风格（折叠在「更多」里，不删） */
const MORE_STYLES = [
  { id: 'meeting', label: '会议纪要' },
  { id: 'interview', label: '访谈整理' },
  { id: 'shownotes', label: '播客 shownotes' },
  { id: 'oral', label: '口播稿' },
  { id: 'xhs', label: '小红书风格' },
  { id: 'longform', label: '公众号长文' },
  { id: 'qa', label: '问答卡(Anki)' },
  { id: 'actions', label: '行动清单' },
  { id: 'tool_recommendation', label: '工具推荐' },
  { id: 'science_popularization', label: '知识科普' },
] as const

/** 风格适用范围说明（hover ? 显示），内容来自后端 summary_templates.py */
const STYLE_DESCRIPTIONS: Record<string, string> = {
  standard: '自适应教学笔记，短内容精简、长内容完整结构',
  concise: '100-200 字，适合快速浏览',
  detailed: '多级要点 + 关键词，适合深度学习',
  outline: '多级层次提纲，一眼看清结构',
  lecture: '知识点/例子/重点/延伸阅读，适合课程录音',
  steps: '前置条件→步骤→常见坑→验收标准，适合操作类内容',
  quotes: '5-10 条独立金句卡片，适合短视频/社媒',
  meeting: '议题/结论/待办(负责人·截止)/风险，适合工作录音',
  interview: 'Q&A 对话 + 嘉宾观点摘录，适合播客/采访',
  shownotes: '时间戳章节 + 嘉宾介绍 + 推荐链接，适合自媒体',
  oral: '可直接念的口语化文案，适合短视频/直播',
  xhs: '标题党+emoji+分段+话题 tag，适合转笔记',
  longform: '引言/正文(H2分节)/结尾，适合内容创作',
  qa: 'Q/A 卡片，便于记忆复习',
  actions: '目标→行动项→依赖→完成标准，适合会议/规划',
  tool_recommendation: '工具名称/功能/适用场景/对比，适合工具测评',
  science_popularization: '通俗语言讲原理+类比+常见误区，适合科普',
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

function noteTypeFromLocalFile(type?: ItemType): NoteMediaKind {
  if (type === 'audio') return 'audio'
  if (type === 'image' || type === 'text') return 'image_text'
  return 'video'
}

function localFileTypeLabel(type?: ItemType): string {
  if (type === 'audio') return '音频'
  if (type === 'image') return '图片'
  if (type === 'text') return '文本'
  return '视频'
}

function itemTypeLabel(type?: ItemType | string): string {
  if (type === 'audio') return '音频'
  if (type === 'image') return '图片'
  if (type === 'text') return '文本'
  return '视频'
}

function libraryItemKey(item: LibraryItem): string {
  return `${item.workspace_id}:${item.item_id}`
}

export function AddMaterialModal({
  open,
  onOpenChange,
  workspaceIds,
  availableWorkspaces,
  onWorkspaceIdsChange,
  onCreateWorkspace,
  onWorkspaceUpdated,
  sniffResult,
  urlValue,
  onAdded,
  localFile,
  localFileName,
  localFileType,
  localWsId,
  onPickLocalFile,
  localUploadPending,
  workspaceKind,
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
  const [linkTitle, setLinkTitle] = useState('') // sniff 没给标题时，用 link-preview 补的标题
  const [linkDesc, setLinkDesc] = useState('') // link-preview 的简介（B站含 UP主/播放量等）
  const [localCover, setLocalCover] = useState('') // 本地文件：后端 cv2 探测的首帧封面 static URL
  const [error, setError] = useState<string | null>(null)
  const [sniffFailed, setSniffFailed] = useState(false)
  const [diarizeOn, setDiarizeOn] = useState(false)
  const [userNotes, setUserNotes] = useState('')
  const [noteStyle, setNoteStyle] = useState('standard')
  const [workspacePickerOpen, setWorkspacePickerOpen] = useState(false)
  const [workspaceQuery, setWorkspaceQuery] = useState('')
  const [creatingWorkspace, setCreatingWorkspace] = useState(false)
  const [renamingWorkspaceId, setRenamingWorkspaceId] = useState<string | null>(null)
  const [workspaceNameDraft, setWorkspaceNameDraft] = useState('')
  const [workspaceNameOverrides, setWorkspaceNameOverrides] = useState<Record<string, string>>({})
  const [advancedOpen, setAdvancedOpen] = useState(false) // 「高级设置」折叠
  const [existingPanelOpen, setExistingPanelOpen] = useState(false)
  const [existingLoading, setExistingLoading] = useState(false)
  const [existingAdding, setExistingAdding] = useState(false)
  const [existingItems, setExistingItems] = useState<LibraryItem[]>([])
  const [existingSelectedIds, setExistingSelectedIds] = useState<Set<string>>(new Set())
  const [existingQuery, setExistingQuery] = useState('')
  const sniffTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // R4.7: 收集所有可用视觉模型（provider 有 vision 能力 + 模型有 vision 标签）
  const visionModels = providers
    .filter(p => p.enabled && p.capabilities?.includes('vision'))
    .flatMap(p => (providerModels[p.id] ?? [])
      .filter(m => !m.capabilities || m.capabilities.includes('vision'))
      .map(m => ({ providerId: p.id, providerName: p.name, modelId: m.id, modelName: m.name }))
    )
  const hasVisionModel = visionModels.length > 0

  const workspaceLookup = useMemo(
    () => new Map((availableWorkspaces ?? []).map((ws) => [ws.workspace_id, ws])),
    [availableWorkspaces],
  )
  const selectedWorkspaces = useMemo(
    () => workspaceIds.map((id) => workspaceLookup.get(id)).filter((ws): ws is WorkspaceRecord => Boolean(ws)),
    [workspaceIds, workspaceLookup],
  )
  const getWorkspaceLabel = useCallback((workspaceId: string, fallback = '当前合集') => {
    return workspaceNameOverrides[workspaceId] ?? workspaceLookup.get(workspaceId)?.name ?? fallback
  }, [workspaceLookup, workspaceNameOverrides])
  const targetWorkspaceId = workspaceIds[0] ?? ''
  const targetExistingItemIds = useMemo(
    () => new Set(workspaceLookup.get(targetWorkspaceId)?.items.map((item) => item.item_id) ?? []),
    [targetWorkspaceId, workspaceLookup],
  )
  const lockedWorkspaceKind = workspaceKind ?? selectedWorkspaces[0]?.kind
  const targetWorkspaceKind: 'note' | 'replica' = lockedWorkspaceKind ?? (selectedAction === 'replica' ? 'replica' : 'note')
  const selectableWorkspaces = useMemo(
    () => (availableWorkspaces ?? []).filter((ws) => ws.kind === targetWorkspaceKind),
    [availableWorkspaces, targetWorkspaceKind],
  )
  const filteredWorkspaces = useMemo(() => {
    const q = workspaceQuery.trim().toLowerCase()
    if (!q) return selectableWorkspaces
    return selectableWorkspaces.filter((ws) => ws.name.toLowerCase().includes(q))
  }, [selectableWorkspaces, workspaceQuery])

  const filteredExistingItems = useMemo(() => {
    const q = existingQuery.trim().toLowerCase()
    const list = q
      ? existingItems.filter((item) => {
        const haystack = [item.name, item.source_value, item.workspace_name, item.description ?? ''].join(' ').toLowerCase()
        return haystack.includes(q)
      })
      : existingItems
    return list.slice(0, 60)
  }, [existingItems, existingQuery])

  const selectedExistingRefs = useMemo(
    () => existingItems
      .filter((item) => existingSelectedIds.has(libraryItemKey(item)))
      .map((item) => ({ workspace_id: item.workspace_id, item_id: item.item_id })),
    [existingItems, existingSelectedIds],
  )

  // 硬锁：仅「从合集详情页进入」(workspaceKind prop) 才把动作锁成合集 kind。
  // 普通添加流程（未选合集）不锁，笔记/复刻自由选。
  useEffect(() => {
    if (workspaceKind && open) {
      setSelectedAction(workspaceKind)
    }
  }, [workspaceKind, open])

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
  // 稳定原始值供 link-preview effect 依赖（避免 effectiveSniff 对象身份抖动）
  const sniffThumbnail = effectiveSniff?.thumbnail ?? null
  const sniffTitle = effectiveSniff?.title ?? null
  const workspaceSummary = workspaceIds[0] ? getWorkspaceLabel(workspaceIds[0], '当前合集') : ''
  const sourceSummary = isLocalFile
    ? (localFileName || '本地文件')
    : (effectiveSniff?.title || linkTitle)
      ? `${effectiveSniff?.platform ?? '未知平台'} · ${effectiveSniff?.title || linkTitle}`
      : effectiveUrl
        ? '网络链接'
        : '输入素材链接'
  const autoResolvedNoteType: NoteMediaKind =
    isLocalFile
      ? noteTypeFromLocalFile(localFileType)
      : effectiveSniff?.primary_type === 'video'
        ? 'video'
        : effectiveSniff?.primary_type === 'audio'
          ? 'audio'
          : effectiveSniff?.primary_type === 'image' || effectiveSniff?.primary_type === 'text'
            ? 'image_text'
            : 'auto'
  const showVideoNoteSettings =
    selectedAction === 'note' && (selectedNoteType === 'video' || (selectedNoteType === 'auto' && autoResolvedNoteType === 'video'))
  const showAudioNoteSettings =
    selectedAction === 'note' && (selectedNoteType === 'audio' || (selectedNoteType === 'auto' && autoResolvedNoteType === 'audio'))
  const showFrameAnalysisSettings = selectedAction === 'replica' || showVideoNoteSettings
  const showSpeakerSettings = selectedAction === 'note' && (showVideoNoteSettings || showAudioNoteSettings)
  const advancedSummaryParts = [
    ...(showSpeakerSettings ? ['发言人'] : []),
    '补充说明',
  ]
  const advancedSummary = advancedSummaryParts.join(' · ')

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
    setSelectedNoteType('auto')
    setReplicaKind('prompt')
    setCaptureMode('auto')
    setFrameInterval(5)
    setSelectedVisionModel('')
    setAdvancedOpen(false)
    setWorkspaceQuery('')
    setWorkspacePickerOpen(false)
    setError(null)
    setSubmitting(false)
    setRenamingWorkspaceId(null)
    setWorkspaceNameDraft('')
    setExistingPanelOpen(false)
    setExistingItems([])
    setExistingSelectedIds(new Set())
    setExistingQuery('')
    setExistingAdding(false)
    setLinkDesc('')
    setCoverUrl('')
    setLinkTitle('')
    userToggledRef.current = false
    // 每次重开恢复到当前 provider 能力下的默认值，避免上次展开/切换残留到这次弹框。
    setEmbedFrames(hasVisionModel)
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

  // URL 变化时才清空补抓的封面/标题/简介（避免 effectiveSniff 对象身份抖动反复重置）
  useEffect(() => {
    setCoverUrl('')
    setLinkTitle('')
    setLinkDesc('')
  }, [effectiveUrl])

  // sniff 对已知平台（B站等）只做 O(1) 类型判断、不返回封面/标题 → 用 link-preview 补
  // 依赖用稳定原始值（effectiveUrl + 缺失标志），不放入 effectiveSniff 对象，否则父组件每次 sniff
  // 重渲染会重置 state、cancel 掉异步结果 → 封面/标题永远填不上。
  useEffect(() => {
    if (!open || !effectiveUrl) return
    // sniff 已返回封面+标题（非已知平台场景）→ 不需要 link-preview 补
    if (sniffThumbnail && sniffTitle) return
    let cancelled = false
    fetchLinkPreview(effectiveUrl)
      .then((p) => {
        if (cancelled) return
        if (p.image_url && !sniffThumbnail) {
          // B站封面是协议相对 URL（//i1.hdslb.com/...），补 https 否则 localhost(http) 下加载失败
          setCoverUrl(p.image_url.startsWith('//') ? `https:${p.image_url}` : p.image_url)
        }
        if (p.title && !sniffTitle) setLinkTitle(p.title)
        if (p.description) setLinkDesc(p.description)
      })
      .catch(() => { /* link-preview 已内部兜底，忽略 */ })
    return () => { cancelled = true }
  }, [open, effectiveUrl, sniffThumbnail, sniffTitle])

  const selectWorkspace = useCallback((workspaceId: string) => {
    if (!onWorkspaceIdsChange) return
    const ws = workspaceLookup.get(workspaceId)
    const next = workspaceIds[0] === workspaceId ? [] : [workspaceId]
    onWorkspaceIdsChange(next)
    if (!workspaceKind && ws) setSelectedAction(ws.kind)
    setWorkspacePickerOpen(false)
  }, [onWorkspaceIdsChange, workspaceIds, workspaceKind, workspaceLookup])

  const clearWorkspace = useCallback(() => {
    onWorkspaceIdsChange?.([])
    setWorkspacePickerOpen(false)
  }, [onWorkspaceIdsChange])

  const handleCreateWorkspace = useCallback(async () => {
    if (creatingWorkspace) return
    setCreatingWorkspace(true)
    setError(null)
    try {
      if (onCreateWorkspace) {
        const created = await onCreateWorkspace(workspaceQuery, targetWorkspaceKind)
        onWorkspaceIdsChange?.([created.workspace_id])
        if (!workspaceKind) setSelectedAction(created.kind)
      } else {
        // 降级：直接用 createWorkspace 创建（TaskboardPage 场景）
        const name = workspaceQuery.trim() || (targetWorkspaceKind === 'replica' ? '新复刻合集' : '新笔记合集')
        const created = await createWorkspaceSvc({ name, kind: targetWorkspaceKind })
        onWorkspaceIdsChange?.([created.workspace_id])
        if (!workspaceKind) setSelectedAction(created.kind)
        toast.success(`合集「${name}」已创建`)
      }
      setWorkspaceQuery('')
      setWorkspacePickerOpen(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : '创建合集失败'
      setError(msg)
      toast.error(msg)
    } finally {
      setCreatingWorkspace(false)
    }
  }, [creatingWorkspace, onCreateWorkspace, onWorkspaceIdsChange, targetWorkspaceKind, workspaceKind, workspaceQuery])

  const handleSaveWorkspaceRename = useCallback(async () => {
    const workspaceId = renamingWorkspaceId
    const nextName = workspaceNameDraft.trim()
    if (!workspaceId) return
    if (!nextName) {
      setRenamingWorkspaceId(null)
      setWorkspaceNameDraft('')
      return
    }
    try {
      const updated = await updateWorkspaceSvc(workspaceId, { name: nextName })
      setWorkspaceNameOverrides((prev) => ({ ...prev, [workspaceId]: updated.name }))
      onWorkspaceUpdated?.(updated)
      setRenamingWorkspaceId(null)
      setWorkspaceNameDraft('')
      toast.success(`合集已重命名为「${updated.name}」`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : '重命名合集失败'
      setError(msg)
      toast.error(msg)
    }
  }, [onWorkspaceUpdated, renamingWorkspaceId, workspaceNameDraft])

  const loadExistingMaterials = useCallback(async () => {
    if (!targetWorkspaceId) {
      toast.info('请先选择一个合集')
      return
    }
    setExistingPanelOpen(true)
    setExistingLoading(true)
    setError(null)
    try {
      const library = await fetchLibrary(false)
      const candidates = library.items.filter((item) => (
        item.workspace_kind === targetWorkspaceKind
        && item.status === 'done'
        && item.workspace_id !== targetWorkspaceId
        && !targetExistingItemIds.has(item.item_id)
      ))
      setExistingItems(candidates)
      setExistingSelectedIds(new Set())
    } catch (err) {
      const msg = err instanceof Error ? err.message : '读取已分析内容失败'
      setError(msg)
      toast.error(msg)
    } finally {
      setExistingLoading(false)
    }
  }, [targetExistingItemIds, targetWorkspaceId, targetWorkspaceKind])

  const toggleExistingItem = useCallback((itemKey: string) => {
    setExistingSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(itemKey)) next.delete(itemKey)
      else next.add(itemKey)
      return next
    })
  }, [])

  const handleAddExistingMaterials = useCallback(async () => {
    if (!targetWorkspaceId) {
      toast.info('请先选择一个合集')
      return
    }
    if (selectedExistingRefs.length === 0) {
      toast.info('请先选择要加入的内容')
      return
    }
    const toastId = `workspace-add-existing-${targetWorkspaceId}`
    setExistingAdding(true)
    toast.loading('正在加入已分析内容…', { id: toastId })
    try {
      const result = await batchAddItemsToWorkspace(targetWorkspaceId, selectedExistingRefs)
      toast.success(`已加入 ${result.added} 项内容${result.skipped ? `，跳过 ${result.skipped} 项` : ''}`, { id: toastId })
      onAdded?.()
      setExistingSelectedIds(new Set())
      setExistingPanelOpen(false)
      onOpenChange(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加入内容失败'
      toast.error(msg, { id: toastId })
    } finally {
      setExistingAdding(false)
    }
  }, [onAdded, onOpenChange, selectedExistingRefs, targetWorkspaceId])

  const handleGenerateNote = async () => {
    if (isLocalFile) {
      // 本地文件：savePreflight + startItemPipeline，绕开 generateNote 的 URL 校验
      if (!localFile) return
      setSubmitting(true)
      setError(null)
      try {
        const wsId = localWsId || workspaceIds[0]
        if (!wsId) { setError('未找到合集'); return }
        const resolvedNoteType = selectedNoteType === 'auto' ? autoResolvedNoteType : selectedNoteType
        const videoTask = resolvedNoteType === 'video'
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
        navigate(`/processing/${task_id}`, {
          state: {
            url: localFileName || '',
            workspaceId: wsId,
            itemId: localFile,
            taskType: selectedAction === 'replica' ? 'replica' : 'note',
            itemType: localFileType ?? (resolvedNoteType === 'audio' ? 'audio' : resolvedNoteType === 'image_text' ? 'image' : 'video'),
          },
        })
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
        const ws = await ensureInbox()
        wsId = ws.workspace_id
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
            <p className="modal-subtitle">{[workspaceSummary, sourceSummary].filter(Boolean).join(' · ')}</p>
          </div>
          <DialogClose className="btn btn-ghost modal-close">
            <X size={16} />
          </DialogClose>
        </div>

        <div className="m-body">
          {error && <div className="modal-error">{error}</div>}

          {/* ① 素材源 */}
          <div className="m-section">
            <div className="eyebrow" style={{ marginBottom: 10 }}>① 素材源</div>
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
                    localFileType === 'audio' ? (
                      <FileAudio size={20} style={{ color: 'var(--mut)' }} />
                    ) : localFileType === 'image' ? (
                      <ImageIcon size={20} style={{ color: 'var(--mut)' }} />
                    ) : localFileType === 'text' ? (
                      <FileText size={20} style={{ color: 'var(--mut)' }} />
                    ) : (
                      <PlayCircle size={20} style={{ color: 'var(--mut)' }} />
                    )
                  )}
                </div>
                <div className="sniff-meta">
                  <div className="sniff-title">{localFileName || '本地文件'}</div>
                  <div className="sniff-tags">
                    <span className="kw" style={{ fontSize: 11 }}>
                      本地{localFileTypeLabel(localFileType)}
                    </span>
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
                {onPickLocalFile && (
                  <button
                    type="button"
                    className="pp-add"
                    onClick={onPickLocalFile}
                    disabled={localUploadPending}
                  >
                    <Upload size={11} />
                    {localUploadPending ? '上传中…' : '本地上传'}
                  </button>
                )}
              </div>
            )}
            {!isLocalFile && !urlValue && !effectiveSniff && (
              <div className="modal-kw-row">
                <span className="kw"><Link2 size={11} /> 支持网络链接</span>
                <span className="kw"><Upload size={11} /> 支持本地上传</span>
                <span className="kw" data-state={internalSniff ? 'recognized' : undefined}>
                  {internalSniff ? '已识别' : '输入后自动识别'}
                </span>
              </div>
            )}
            {!isLocalFile && targetWorkspaceId && (
              <div className="existing-material-entry">
                <button
                  type="button"
                  className="pp-add"
                  onClick={() => {
                    if (existingPanelOpen) {
                      setExistingPanelOpen(false)
                      return
                    }
                    void loadExistingMaterials()
                  }}
                >
                  <Layers size={11} />
                  已分析内容
                </button>
                <span className="kw">从笔记库选择已完成内容加入当前合集</span>
              </div>
            )}
            {existingPanelOpen && (
              <div className="existing-material-panel">
                <div className="pp-search">
                  <Search size={14} />
                  <input
                    placeholder="搜索标题、来源或合集..."
                    value={existingQuery}
                    onChange={(event) => setExistingQuery(event.target.value)}
                  />
                </div>
                <div className="existing-material-list">
                  {existingLoading ? (
                    <div className="existing-material-empty">正在读取已分析内容…</div>
                  ) : filteredExistingItems.length === 0 ? (
                    <div className="existing-material-empty">暂无可加入的已完成内容</div>
                  ) : (
                    filteredExistingItems.map((item) => {
                      const itemKey = libraryItemKey(item)
                      return (
                        <button
                          key={itemKey}
                          type="button"
                          className="existing-material-row"
                          data-on={existingSelectedIds.has(itemKey)}
                          onClick={() => toggleExistingItem(itemKey)}
                        >
                          <span className="pp-check">
                            <Check size={11} strokeWidth={3} />
                          </span>
                          <span className="existing-material-thumb">
                            {item.thumbnail ? (
                              <img src={item.thumbnail} alt="" loading="lazy" />
                            ) : (
                              itemTypeLabel(item.type).slice(0, 1)
                            )}
                          </span>
                          <span className="existing-material-main">
                            <strong>{item.name || '未命名内容'}</strong>
                            <em>{item.workspace_name} · {itemTypeLabel(item.type)} · {item.source === 'local' ? '本地' : '链接'}</em>
                          </span>
                        </button>
                      )
                    })
                  )}
                </div>
                <div className="existing-material-foot">
                  <span>已选 {selectedExistingRefs.length} 项</span>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={existingAdding || selectedExistingRefs.length === 0}
                    onClick={() => void handleAddExistingMaterials()}
                  >
                    {existingAdding ? '加入中…' : '加入当前合集'}
                  </button>
                </div>
              </div>
            )}
            {effectiveSniff && effectiveSniff.confident === false && (
              <div style={{ fontSize: 12, color: 'var(--mut)', marginTop: 6 }}>
                无法确认链接类型，将自动识别
              </div>
            )}
            {effectiveSniff && effectiveSniff.confident !== false && (
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
                    <ImageIcon size={20} style={{ color: 'var(--mut)' }} />
                  )}
                  {effectiveSniff.primary_type === 'video' && <PlayCircle size={22} className="sniff-play" />}
                </div>
                <div className="sniff-meta">
                  <div className="sniff-title">
                    {effectiveSniff.title || linkTitle || `已识别${{ video: '视频', audio: '音频', image: '图片', text: '网页' }[effectiveSniff.primary_type] ?? '内容'}`}
                  </div>
                  {linkDesc && <div className="sniff-desc">{linkDesc}</div>}
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
                      <CheckCircle2 size={11} /> 已识别{{ video: '视频', audio: '音频', image: '图片', text: '网页' }[effectiveSniff.primary_type] ?? '内容'}
                    </span>
                  </div>
                </div>
              </div>
            )}
            {sniffFailed && !effectiveSniff && effectiveUrl && (
              <div style={{ fontSize: 12, color: 'var(--mut)', marginTop: 6 }}>
                无法识别该链接，可仍尝试提交
              </div>
            )}
          </div>

          <div className="m-section">
            <div className="eyebrow" style={{ marginBottom: 10 }}>② 合集归属</div>
            <div className="modal-workspace-picker">
              <div className="modal-workspace-row">
                {workspaceIds[0] ? (
                  <div className="modal-workspace-current">
                    <Layers size={15} />
                    {renamingWorkspaceId === workspaceIds[0] ? (
                      <input
                        autoFocus
                        className="modal-inline-name-input"
                        value={workspaceNameDraft}
                        onChange={(event) => setWorkspaceNameDraft(event.target.value)}
                        onClick={(event) => event.stopPropagation()}
                        onBlur={() => void handleSaveWorkspaceRename()}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            void handleSaveWorkspaceRename()
                          }
                          if (event.key === 'Escape') {
                            setRenamingWorkspaceId(null)
                            setWorkspaceNameDraft('')
                          }
                        }}
                      />
                    ) : (
                      <span
                        onDoubleClick={() => {
                          setRenamingWorkspaceId(workspaceIds[0])
                          setWorkspaceNameDraft(getWorkspaceLabel(workspaceIds[0], '当前合集'))
                        }}
                      >
                        {getWorkspaceLabel(workspaceIds[0], '当前合集')}
                      </span>
                    )}
                    <span className="kw">{targetWorkspaceKind === 'replica' ? '复刻' : '笔记'}</span>
                  </div>
                ) : (
                  <div className="modal-workspace-current modal-workspace-current--empty" aria-hidden="true" />
                )}
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {onWorkspaceIdsChange && (availableWorkspaces?.length ?? 0) > 0 && (
                    <button
                      type="button"
                      className="pp-add"
                      onClick={() => setWorkspacePickerOpen((value) => !value)}
                    >
                      <Layers size={11} />
                      {workspaceIds.length ? '更换合集' : '选择合集'}
                    </button>
                  )}
                  {(onWorkspaceIdsChange || !onCreateWorkspace) && (
                    <button
                      type="button"
                      className="pp-add"
                      onClick={handleCreateWorkspace}
                      disabled={creatingWorkspace}
                    >
                      <Plus size={11} />
                      {creatingWorkspace ? '创建中…' : '新建合集'}
                    </button>
                  )}
                </div>
              </div>

              {workspacePickerOpen && onWorkspaceIdsChange && (
                <div className="pp-popover modal-workspace-popover">
                  <div className="pp-search">
                    <Search size={14} />
                    <input
                      autoFocus
                      placeholder="搜索合集..."
                      value={workspaceQuery}
                      onChange={(e) => setWorkspaceQuery(e.target.value)}
                    />
                    {workspaceIds.length > 0 && (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={clearWorkspace}
                        style={{ height: 24, padding: '0 8px', fontSize: 11 }}
                      >
                        清空
                      </button>
                    )}
                  </div>
                  <div className="pp-list">
                    {filteredWorkspaces.length === 0 && (
                      <div className="modal-workspace-empty">无匹配合集</div>
                    )}
                    {filteredWorkspaces.map((ws) => {
                      const on = workspaceIds[0] === ws.workspace_id
                      return (
                        <button
                          key={ws.workspace_id}
                          type="button"
                          className="pp-row"
                          data-on={on}
                          onClick={() => selectWorkspace(ws.workspace_id)}
                        >
                          <span className="pp-check">
                            <Check size={11} strokeWidth={3} />
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <div className="pp-name">{getWorkspaceLabel(ws.workspace_id, ws.name)}</div>
                          </div>
                          <span className="pp-count">{ws.items.length} 项</span>
                        </button>
                      )
                    })}
                  </div>
                  <div className="pp-foot">
                    <button
                      type="button"
                      className="pp-new"
                      onClick={handleCreateWorkspace}
                      disabled={!onCreateWorkspace || creatingWorkspace}
                    >
                      <Plus size={11} />
                      {creatingWorkspace ? '创建中…' : `新建合集${workspaceQuery ? ` "${workspaceQuery}"` : ''}`}
                    </button>
                    <button type="button" className="pp-done" onClick={() => setWorkspacePickerOpen(false)}>
                      完成
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ③ 你要做什么 */}
          <div className="m-section">
            <div className="eyebrow" style={{ marginBottom: 10 }}>③ 你要做什么</div>
            {workspaceKind && (
              <div style={{ fontSize: 12, color: 'var(--mut)', marginBottom: 8 }}>
                动作已锁定为「{workspaceKind === 'replica' ? '复刻' : '笔记'}」合集类型
              </div>
            )}
            <div className="note-type-grid" style={{ marginBottom: 14 }}>
              <button
                type="button"
                className="note-type-card"
                data-active={selectedAction === 'note'}
                disabled={workspaceKind === 'replica'}
                style={workspaceKind === 'replica' ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
                onClick={() => {
                  if (workspaceKind === 'replica') return
                  setSelectedAction('note')
                  // 选了复刻合集却切回笔记 → 清掉冲突的合集选择（变为新建/单独）
                  if (selectedWorkspaces[0]?.kind === 'replica') onWorkspaceIdsChange?.([])
                }}
              >
                <div className="ntc-l"><FileText size={16} style={{ display: 'inline', verticalAlign: '-3px', marginRight: 4 }} /> 学习笔记</div>
                <div className="ntc-d">沉浸式阅读与总结提取</div>
              </button>
              <button
                type="button"
                className="note-type-card"
                data-active={selectedAction === 'replica'}
                disabled={workspaceKind === 'note'}
                style={workspaceKind === 'note' ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
                onClick={() => {
                  if (workspaceKind === 'note') return
                  setSelectedAction('replica')
                  // 选了笔记合集却切到复刻 → 清掉冲突的合集选择（变为新建/单独）
                  if (selectedWorkspaces[0]?.kind === 'note') onWorkspaceIdsChange?.([])
                }}
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
                  <div className="ntc-l"><Film size={16} style={{ display: 'inline', verticalAlign: '-3px', marginRight: 4 }} /> 拉片分析 <span style={{ fontSize: 11, color: 'var(--mut)' }}>即将上线</span></div>
                  <div className="ntc-d">逐镜头拆解景别/构图/运镜/转场</div>
                </button>
                <button
                  type="button"
                  className="note-type-card"
                  data-active={false}
                  disabled
                  style={{ opacity: 0.5, cursor: 'not-allowed' }}
                >
                  <div className="ntc-l"><Target size={16} style={{ display: 'inline', verticalAlign: '-3px', marginRight: 4 }} /> 竞品对标 <span style={{ fontSize: 11, color: 'var(--mut)' }}>即将上线</span></div>
                  <div className="ntc-d">内容结构/爆点/钩子/节奏拆解</div>
                </button>
              </div>
            )}

            {(selectedAction === 'note' || selectedAction === 'replica') && (
              <>
                <div className="eyebrow" style={{ marginBottom: 10 }}>
                  {selectedAction === 'replica' ? '④ 复刻设置' : '④ 笔记设置'}
                </div>
                {selectedAction === 'note' && (
                  <>
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
                    <div style={{ marginTop: 14 }}>
                      <div className="gen-field">
                        <span className="gen-field-label">笔记风格</span>
                        <Select value={noteStyle} onValueChange={setNoteStyle}>
                          <SelectTrigger style={{ fontSize: 13 }}>
                            <SelectValue placeholder="选择风格" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectLabel style={{ fontSize: 11, color: 'var(--mut)' }}>常用风格</SelectLabel>
                              {PRIMARY_STYLES.map(opt => (
                                <SelectItem key={opt.id} value={opt.id}>
                                  {opt.label}
                                  <span style={{ fontSize: 11, color: 'var(--mut)', marginLeft: 6 }}>{STYLE_DESCRIPTIONS[opt.id]}</span>
                                </SelectItem>
                              ))}
                            </SelectGroup>
                            <SelectSeparator />
                            <SelectGroup>
                              <SelectLabel style={{ fontSize: 11, color: 'var(--mut)' }}>更多风格</SelectLabel>
                              {MORE_STYLES.map(opt => (
                                <SelectItem key={opt.id} value={opt.id}>
                                  {opt.label}
                                  <span style={{ fontSize: 11, color: 'var(--mut)', marginLeft: 6 }}>{STYLE_DESCRIPTIONS[opt.id]}</span>
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </>
                )}
                {showFrameAnalysisSettings && (
                  <div className="capture-panel" data-enabled={embedFrames}>
                    <div className="capture-head">
                      <label htmlFor="add-material-embed" className="capture-main-toggle">
                        <Switch
                          id="add-material-embed"
                          checked={embedFrames}
                          onCheckedChange={(v) => {
                            userToggledRef.current = true
                            setEmbedFrames(v)
                          }}
                        />
                        <span className="gen-toggle-text">
                          <span className="gen-field-label">{selectedAction === 'replica' ? '画面分析' : '笔记里配图'}</span>
                          <span className="kw">
                            {selectedAction === 'replica' ? '关键画面参与复刻' : '带图笔记'}
                          </span>
                        </span>
                      </label>
                      {!embedFrames && (
                        <span className="kw">纯文字模式</span>
                      )}
                    </div>

                    {embedFrames ? (
                      <div className="capture-tools">
                        {visionModels.length > 0 ? (
                          <div className="capture-model-row">
                            <span className="gen-field-label">视觉模型</span>
                            <Select value={selectedVisionModel} onValueChange={setSelectedVisionModel}>
                              <SelectTrigger className="capture-model-trigger">
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
                        ) : (
                          <span className="kw capture-warning">
                            未检测到视觉模型，将使用纯文字总结。可在「设置 → 模型」中添加。
                          </span>
                        )}

                        {hasVisionModel && (() => {
                          const autoInterval = computeAutoInterval(videoDuration)
                          const activeInterval = captureMode === 'auto' ? autoInterval : frameInterval
                          const frameEstimate = estimateFrames(videoDuration, activeInterval)
                          return (
                            <div className="capture-strip">
                              <span className="gen-field-label">取画面</span>
                              <div className="capture-segment" role="group" aria-label="取画面模式">
                                <button
                                  type="button"
                                  data-active={captureMode === 'auto'}
                                  onClick={() => setCaptureMode('auto')}
                                >
                                  <Wand2 size={12} />
                                  智能
                                </button>
                                <button
                                  type="button"
                                  data-active={captureMode === 'manual'}
                                  onClick={() => setCaptureMode('manual')}
                                >
                                  <Settings2 size={12} />
                                  手动
                                </button>
                              </div>
                              <label className="capture-interval">
                                <span>每</span>
                                <input
                                  type="number"
                                  min={1}
                                  max={60}
                                  value={activeInterval}
                                  disabled={captureMode === 'auto'}
                                  onChange={(e) => {
                                    const next = Number(e.target.value)
                                    setFrameInterval(Number.isFinite(next) ? Math.min(60, Math.max(1, next)) : 5)
                                  }}
                                />
                                <span>秒</span>
                              </label>
                              <span className="capture-estimate">
                                {videoDuration > 0 ? `约 ${frameEstimate} 张` : '识别后估算'}
                              </span>
                              {videoDuration > 0 && (
                                <span className="kw">时长 {formatDuration(videoDuration)}</span>
                              )}
                            </div>
                          )
                        })()}
                      </div>
                    ) : null}
                  </div>
                )}
                <div style={{ marginTop: showFrameAnalysisSettings ? 12 : selectedAction === 'note' ? 14 : 0 }}>
                  <button
                    type="button"
                    className="accordion-trigger"
                    onClick={() => setAdvancedOpen(v => !v)}
                  >
                    <Settings2 size={14} />
                    <span>高级设置</span>
                    <span className="kw" style={{ fontSize: 11 }}>{advancedSummary}</span>
                    <ChevronDown
                      size={14}
                      style={{
                        marginLeft: 'auto',
                        transition: 'transform 0.2s',
                        transform: advancedOpen ? 'rotate(180deg)' : undefined,
                        color: 'var(--mut)',
                      }}
                    />
                  </button>
                  {advancedOpen && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
                      {showSpeakerSettings && (
                        <label className="gen-toggle">
                          <Switch checked={diarizeOn} onCheckedChange={setDiarizeOn} />
                          <span className="gen-toggle-text">
                            <span className="gen-field-label">区分发言人</span>
                            <span className="kw" style={{ fontSize: 11 }}>开启后在转写中标注不同说话人（实验功能）</span>
                          </span>
                        </label>
                      )}
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
                  )}
                </div>
              </>
            )}

            <div className="modal-future-actions">
              {[{ id: 'ai_video', label: 'AI视频', icon: <Video size={12} /> },
                { id: 'storyboard', label: '分镜脚本', icon: <LayoutTemplate size={12} /> },
                { id: 'rewrite', label: '二创改写', icon: <PenTool size={12} /> }].map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toast('该功能即将上线')}
                >
                  {item.icon} {item.label} <Lock size={10} />
                </button>
              ))}
            </div>
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
