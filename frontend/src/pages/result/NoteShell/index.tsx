/**
 * NoteShell — R1.3 Markdown 编辑保存 + 总结风格面板
 *
 * 统一笔记壳：读 R0 的 GET …/note 渲染 note.md + 标签概览。
 * R1.3 新增：Markdown 编辑态（CodeMirror + debounce 自动保存）、
 * 顶栏两层下拉（总结风格▾ + 版本▾）管理总结。
 *
 * 子组件拆分：
 *   - TagChips：frontmatter.tags → 标签 chips 展示
 *   - SourcePanel：source.md 只读区（可折叠）
 *   - NoteEditor：轻量 CodeMirror 编辑器（注册到 lnEditorStore，复用截图插入能力）
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ArrowLeft, Bold, BookOpenCheck, Brain, Camera, Check, ChevronDown, ChevronRight, Download, ExternalLink, FileDown, FileText, FileType, Image, List, MessageCircle, Minus, Pause, Pencil, Play, Plus, Presentation, Sparkles, Subtitles, Trash2, Type, X } from 'lucide-react'
import { toast } from 'sonner'

import { downloadItemNoteExport, exportItemNoteObsidian, getItemNote, putItemNote, type ItemNoteExportFormat } from '@/services/workspaces'
import type { VideoResultTranscriptLine } from '@/services/workspaces'
import type { ItemNote } from '@/types/workspace'
import { createSummary, deleteSummary, listSummaries, renameSummary, type ItemSummary } from '@/services/summaries'
import { MarkdownToc, extractToc, flattenText, slugify } from '@/components/MarkdownToc'
import { platformLabelFromUrl, renderNoteTimestampChildren } from './note-shell-utils'
import { Badge } from '@/components/ui/badge'
import { SYSTEM_TAG_DIMENSIONS } from '@/constants/tagDimensions'
import NoteMediaCompanion, { type NoteMediaCompanionHandle } from './NoteMediaCompanion'
import MilkdownEditor from './MilkdownEditor'
import LNVideoPanel, { type LNVideoPanelHandle } from '@/pages/results/LearningNotesPage/LNVideoPanel'
import LNTranscriptPanel from '@/pages/results/LearningNotesPage/LNTranscriptPanel'
import NoteAudioPanel, { type NoteAudioPanelHandle } from './NoteAudioPanel'
import '@/pages/results/LearningNotesPage/learning-notes.css'
import './note-shell.css'
import { NewSummaryModal } from '@/components/NewSummaryModal'
import NoteChatDrawer from '@/components/NoteChatDrawer'
import { FloatingAskAi } from './FloatingAskAi'
import { useLnEditorStore } from '@/store/lnEditorStore'
import { SourceMdModal } from './SourceMdModal'

// remarkGfm 类型与 react-markdown 不完全兼容，统一 cast 一次
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const remarkPlugins: any[] = [remarkGfm]

/* ────────────────── helpers ────────────────── */

/** 从 note_md 提取正文 body（去掉 YAML frontmatter）。 */
function extractBody(noteMd: string): string {
  if (!noteMd.startsWith('---\n')) return noteMd
  const parts = noteMd.split('---\n')
  const rest = parts.slice(1).join('---\n')
  const idx = rest.indexOf('---\n')
  return idx >= 0 ? rest.slice(idx + 4) : noteMd
}

/** type → 中文标签映射。 */
const TYPE_LABEL: Record<string, string> = {
  text: '文本',
  audio: '音频',
  video: '视频',
  image: '图片',
}

/** 总结模板 ID → 中文显示名（唯一定义，顶栏+右栏共用）。 */
const TEMPLATE_LABELS: Record<string, string> = {
  concise: '简洁摘要', detailed: '详细要点', quotes: '金句提取',
  meeting: '会议纪要', xhs: '小红书风格', longform: '公众号长文',
  lecture: '教学笔记', interview: '访谈整理', shownotes: '播客 shownotes',
  oral: '口播稿', steps: '步骤教程', outline: '大纲',
  qa: '问答卡(Anki)', actions: '行动清单', tool_recommendation: '工具推荐',
  science_popularization: '知识科普', standard: '标准总结',
}
const tl = (id: string) => TEMPLATE_LABELS[id] ?? id

type SaveStatus = 'idle' | 'saving' | 'saved' | 'failed'
const VIDEO_SPLIT_MIN = 20
const VIDEO_SPLIT_MAX = 72
const VIDEO_SPLIT_DEFAULT = 60
const VIDEO_SPLIT_STORAGE_KEY = 'nibi.note.videoLeftPct'
const EDITOR_PREFS_STORAGE_KEY = 'nibi.note.editorPrefs'

type NoteEditorPrefs = {
  fontFamily: 'sans' | 'serif' | 'mono'
  fontSize: number
  lineHeight: 1.6 | 1.8 | 2
  textTone: 'ink' | 'muted' | 'soft'
  fontWeight: 'regular' | 'medium' | 'bold'
}

const DEFAULT_EDITOR_PREFS: NoteEditorPrefs = {
  fontFamily: 'sans',
  fontSize: 15,
  lineHeight: 1.8,
  textTone: 'ink',
  fontWeight: 'medium',
}

const FONT_FAMILY_VALUE: Record<NoteEditorPrefs['fontFamily'], string> = {
  sans: 'var(--fb)',
  serif: 'var(--fd)',
  mono: 'var(--fm)',
}

const TEXT_TONE_VALUE: Record<NoteEditorPrefs['textTone'], string> = {
  ink: 'var(--fg2)',
  muted: 'var(--mut)',
  soft: 'var(--ink-2)',
}

const FONT_WEIGHT_VALUE: Record<NoteEditorPrefs['fontWeight'], number> = {
  regular: 400,
  medium: 500,
  bold: 700,
}

const PIP_WIDTHS = [240, 320, 440]

function readEditorPrefs(): NoteEditorPrefs {
  if (typeof window === 'undefined') return DEFAULT_EDITOR_PREFS
  try {
    const raw = window.localStorage.getItem(EDITOR_PREFS_STORAGE_KEY)
    if (!raw) return DEFAULT_EDITOR_PREFS
    const parsed = JSON.parse(raw) as Partial<NoteEditorPrefs>
    return {
      fontFamily: parsed.fontFamily === 'serif' || parsed.fontFamily === 'mono' ? parsed.fontFamily : 'sans',
      fontSize: typeof parsed.fontSize === 'number' ? clampNumber(parsed.fontSize, 13, 20) : DEFAULT_EDITOR_PREFS.fontSize,
      lineHeight: parsed.lineHeight === 1.6 || parsed.lineHeight === 2 ? parsed.lineHeight : 1.8,
      textTone: parsed.textTone === 'muted' || parsed.textTone === 'soft' ? parsed.textTone : 'ink',
      fontWeight: parsed.fontWeight === 'regular' || parsed.fontWeight === 'bold' ? parsed.fontWeight : 'medium',
    }
  } catch {
    return DEFAULT_EDITOR_PREFS
  }
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** 格式化 HH:mm */
function formatTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatDateTime(value: string): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** 秒数 → mm:ss 或 hh:mm:ss */
function formatTimecode(sec: number): string {
  const s = Math.round(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = s % 60
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m)
  return h > 0 ? `${h}:${mm}:${String(ss).padStart(2, '0')}` : `${mm}:${String(ss).padStart(2, '0')}`
}

function safeFilename(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, '_').trim().slice(0, 80) || 'note'
}

function formatTranscriptForPrompt(raw: unknown): string {
  if (typeof raw === 'string') return raw.trim()
  if (!Array.isArray(raw)) return ''
  return raw
    .map((seg) => {
      if (!seg || typeof seg !== 'object') return ''
      const data = seg as Record<string, unknown>
      const time = data.t_str ?? data.start ?? data.t_sec
      const text = data.edited_text ?? data.text
      if (!text) return ''
      return time !== undefined ? `[${String(time)}] ${String(text)}` : String(text)
    })
    .filter(Boolean)
    .join('\n')
}

function buildChatSystemPrompt(body: string, transcript: unknown): string {
  const parts = [
    '你正在协助用户理解一篇单素材笔记。回答时只能基于下方 note.md 正文和转录上下文，不要编造笔记里没有的信息。',
    '',
    '【note.md 正文】',
    body || '（暂无笔记内容）',
  ]
  const transcriptText = formatTranscriptForPrompt(transcript)
  if (transcriptText) {
    parts.push('', '【转录上下文】', transcriptText)
  }
  parts.push('', '回答指引：基于上述笔记作答；如果用户问到时间点，请引用对应转录；回答使用中文。')
  return parts.join('\n')
}

function downloadMarkdownFile(markdown: string, title: string): void {
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${safeFilename(title)}.md`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function downloadTextFile(text: string, title: string, extension = 'txt'): void {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${safeFilename(title)}.${extension}`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function extensionForExport(format: ItemNoteExportFormat): string {
  const map: Record<ItemNoteExportFormat, string> = {
    md: 'md',
    html: 'html',
    pdf: 'pdf',
    docx: 'docx',
    long_image: 'png',
    pptx: 'pptx',
    obsidian: 'zip',
  }
  return map[format]
}

interface ReadOnlyMarkdownProps {
  markdown: string
  onSeek: (sec: number) => void
}

function ReadOnlyMarkdown({ markdown, onSeek }: ReadOnlyMarkdownProps) {
  return (
    <ReactMarkdown
      remarkPlugins={remarkPlugins}
      components={{
        h2({ children }) {
          const text = flattenText(children)
          return <h2 id={slugify(text)}>{renderNoteTimestampChildren(children, onSeek)}</h2>
        },
        h3({ children }) {
          const text = flattenText(children)
          return <h3 id={slugify(text)}>{renderNoteTimestampChildren(children, onSeek)}</h3>
        },
        p({ children }) {
          return <p>{renderNoteTimestampChildren(children, onSeek)}</p>
        },
        li({ children }) {
          return <li>{renderNoteTimestampChildren(children, onSeek)}</li>
        },
        a({ children, href }) {
          return (
            <a href={href} target={href?.startsWith('http') ? '_blank' : undefined} rel="noreferrer">
              {renderNoteTimestampChildren(children, onSeek)}
            </a>
          )
        },
      }}
    >
      {markdown}
    </ReactMarkdown>
  )
}

/** 视频笔记视图标签：中列只展示「标准总结」，两种格式（蓝图 §3.5）。
 *  富文本 = 渲染态（ReactMarkdown）；md格式 = 源码态（CodeMirror，可编辑）。
 *  源 md（转写+截帧原始内容）在右侧操作区，不是中列标签。 */
/* ────────────────── TagChips ────────────────── */

interface TagChipsProps {
  tags: Record<string, unknown>
}

/** 把 frontmatter.tags（6 维系统标签 + custom_tags）渲染为 chips。 */
function TagChips({ tags }: TagChipsProps) {
  if (!tags || typeof tags !== 'object') return null

  const systemChips = SYSTEM_TAG_DIMENSIONS
    .filter((dim) => !!tags[dim.key])
    .map((dim) => (
      <Badge key={dim.key} variant="secondary">
        {dim.label} · {String(tags[dim.key])}
      </Badge>
    ))

  const customRaw = tags.custom_tags
  const customChips = Array.isArray(customRaw)
    ? customRaw.map((ct: string) => (
        <Badge key={ct} variant="outline">{ct}</Badge>
      ))
    : []

  const all = [...systemChips, ...customChips]
  if (all.length === 0) return null

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {all}
    </div>
  )
}

/* ────────────────── SourcePanel ────────────────── */

interface SourcePanelProps {
  sourceMd: string
  /** 外部受控开关（可选）；不传则内部自管 */
  open?: boolean
  onToggle?: () => void
}

/** source.md 只读区（可折叠）。 */
function SourcePanel({ sourceMd, open: controlledOpen, onToggle }: SourcePanelProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const toggle = onToggle ?? (() => setInternalOpen((v) => !v))

  if (!sourceMd) return null

  return (
    <div style={{ borderTop: '1px solid var(--bdr)' }}>
      <button
        onClick={toggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          width: '100%', padding: '10px 20px',
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 13, fontWeight: 600, color: 'var(--fg2)',
        }}
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        原文
      </button>
      {open && (
        <div style={{ padding: '0 20px 16px', fontSize: 13, lineHeight: 1.7, color: 'var(--mut)' }}>
          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>
            {sourceMd}
          </pre>
        </div>
      )}
    </div>
  )
}

/* ────────────────── NoteShell ────────────────── */

export default function NoteShell({ workspaceId: propWs, itemId: propItem }: { workspaceId?: string; itemId?: string } = {}) {
  const params = useParams<{ workspaceId: string; itemId: string }>()
  const workspaceId = propWs ?? params.workspaceId ?? ''
  const itemId = propItem ?? params.itemId ?? ''
  const navigate = useNavigate()

  const [note, setNote] = useState<ItemNote | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [chatOpen] = useState(false)
  const [askAiOpen, setAskAiOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [exportBusy, setExportBusy] = useState<ItemNoteExportFormat | null>(null)
  const [immersiveOpen, setImmersiveOpen] = useState(false)
  const [sourceMdOpen, setSourceMdOpen] = useState(false)
  // VN4.3 AI 工具下拉
  const [aiToolsOpen, setAiToolsOpen] = useState(false)
  const aiToolsDropRef = useRef<HTMLDivElement>(null)
  const exportDropRef = useRef<HTMLDivElement>(null)
  // 新建总结（复用 NewSummaryModal）
  const [showNewSummaryModal, setShowNewSummaryModal] = useState(false)
  const [creatingSummary, setCreatingSummary] = useState(false)
  const [editorPrefsOpen, setEditorPrefsOpen] = useState(false)
  const editorPrefsRef = useRef<HTMLDivElement>(null)
  const [editorPrefs, setEditorPrefs] = useState<NoteEditorPrefs>(readEditorPrefs)

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [savedAt, setSavedAt] = useState<string>('')

  // 编辑中的 body 文本（debounce 源头）
  const [editingBody, setEditingBody] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mediaCompanionRef = useRef<NoteMediaCompanionHandle>(null)
  // 标记是否从「应用到主笔记」触发的刷新，避免 debounce 冲突
  const applyingRef = useRef(false)

  // Milkdown 重挂 key：noteId 变化（自然由 workspaceId/itemId 驱动）或 seedVersion 递增时重挂
  const [seedVersion, setSeedVersion] = useState(0)
  const milkdownKey = `${workspaceId}/${itemId}-${seedVersion}`

  // 7.3: 视频笔记三列布局 — 播放器 + 转录轴联动
  const videoRef = useRef<LNVideoPanelHandle>(null)
  const notePageRef = useRef<HTMLDivElement>(null)
  const noteScrollRef = useRef<HTMLDivElement>(null)
  const immersiveScrollRef = useRef<HTMLDivElement>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [videoDuration, setVideoDuration] = useState(0)
  const [isPip, setIsPip] = useState(false)
  const [pipSizeIndex, setPipSizeIndex] = useState(1)
  const [pipPosition, setPipPosition] = useState<{ x: number; y: number } | null>(null)
  const [pipDragging, setPipDragging] = useState(false)
  const [pipPlaying, setPipPlaying] = useState(false)
  const [noteLeftPct, setNoteLeftPct] = useState(() => {
    if (typeof window === 'undefined') return VIDEO_SPLIT_DEFAULT
    const storedRaw = window.localStorage.getItem(VIDEO_SPLIT_STORAGE_KEY)
    if (!storedRaw) return VIDEO_SPLIT_DEFAULT
    const stored = Number(storedRaw)
    return Number.isFinite(stored) ? clampNumber(stored, VIDEO_SPLIT_MIN, VIDEO_SPLIT_MAX) : VIDEO_SPLIT_DEFAULT
  })
  const [transportNode, setTransportNode] = useState<ReactNode>(null)
  const handleTransportChange = useCallback(() => {
    setTransportNode(videoRef.current?.transportNode ?? null)
    setPipPlaying(videoRef.current?.isPlaying ?? false)
  }, [])
  const handleVideoDurationChange = useCallback((duration: number) => setVideoDuration(duration), [])

  // Stage 2: 音频笔记双栏布局 — 播放器 + 转录联动
  const audioRef = useRef<NoteAudioPanelHandle>(null)
  const [audioDuration, setAudioDuration] = useState(0)
  const [audioTransportNode, setAudioTransportNode] = useState<ReactNode>(null)
  const handleAudioTransportChange = useCallback(() => {
    setAudioTransportNode(audioRef.current?.transportNode ?? null)
  }, [])
  const handleAudioDurationChange = useCallback((d: number) => setAudioDuration(d), [])

  const [activeSummaryId, setActiveSummaryId] = useState<string | undefined>(undefined)
  // VN4.1 版本下拉 + 风格/版本两层
  const [summaries, setSummaries] = useState<ItemSummary[]>([])
  const [summariesVersion, setSummariesVersion] = useState(0)
  const [templateDropOpen, setTemplateDropOpen] = useState(false)
  const templateDropRef = useRef<HTMLDivElement>(null)
  // 改名（迁入顶栏下拉）
  const [renameTargetId, setRenameTargetId] = useState<string | null>(null)
  const [renameName, setRenameName] = useState('')
  const refreshSummaries = useCallback(() => setSummariesVersion((v) => v + 1), [])

  // 按 template 分组（两层下拉用）
  const templateGroups = useMemo(() => {
    const map = new Map<string, ItemSummary[]>()
    for (const s of summaries) {
      const arr = map.get(s.template) ?? []
      arr.push(s)
      map.set(s.template, arr)
    }
    // 每组内按 version 排序
    for (const arr of map.values()) arr.sort((a, b) => a.version - b.version)
    return map
  }, [summaries])

  const activeTemplate = useMemo(() => {
    if (!activeSummaryId) return templateGroups.keys().next().value ?? ''
    const s = summaries.find((x) => x.summary_id === activeSummaryId)
    return s?.template ?? ''
  }, [activeSummaryId, summaries, templateGroups])

  useEffect(() => {
    let cancelled = false
    listSummaries(workspaceId, itemId)
      .then((data) => { if (!cancelled) setSummaries(data) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [workspaceId, itemId, activeSummaryId, summariesVersion])

  useEffect(() => {
    window.localStorage.setItem(VIDEO_SPLIT_STORAGE_KEY, String(Math.round(noteLeftPct)))
  }, [noteLeftPct])

  useEffect(() => {
    window.localStorage.setItem(EDITOR_PREFS_STORAGE_KEY, JSON.stringify(editorPrefs))
  }, [editorPrefs])

  const notePageStyle = useMemo<CSSProperties>(
    () => ({
      '--note-left-width': `${noteLeftPct}%`,
      '--note-copy-font-family': FONT_FAMILY_VALUE[editorPrefs.fontFamily],
      '--note-copy-font-size': `${editorPrefs.fontSize}px`,
      '--note-copy-line-height': String(editorPrefs.lineHeight),
      '--note-copy-color': TEXT_TONE_VALUE[editorPrefs.textTone],
      '--note-copy-font-weight': String(FONT_WEIGHT_VALUE[editorPrefs.fontWeight]),
    } as CSSProperties),
    [noteLeftPct, editorPrefs],
  )

  const pipWidth = PIP_WIDTHS[pipSizeIndex]

  useEffect(() => {
    if (!isPip || typeof window === 'undefined') return
    const estimatedHeight = Math.round((pipWidth * 9) / 16 + 86)
    setPipPosition((current) => {
      const next = current ?? {
        x: Math.max(12, window.innerWidth - pipWidth - 24),
        y: Math.max(12, window.innerHeight - estimatedHeight - 24),
      }
      return {
        x: clampNumber(next.x, 12, Math.max(12, window.innerWidth - pipWidth - 12)),
        y: clampNumber(next.y, 12, Math.max(12, window.innerHeight - estimatedHeight - 12)),
      }
    })
  }, [isPip, pipWidth])

  useEffect(() => {
    setIsPip(false)
    setPipDragging(false)
    setPipPosition(null)
  }, [workspaceId, itemId])

  const updateNoteSplitFromClientX = useCallback((clientX: number) => {
    const el = notePageRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    if (rect.width <= 0) return
    const next = ((clientX - rect.left) / rect.width) * 100
    setNoteLeftPct(clampNumber(next, VIDEO_SPLIT_MIN, VIDEO_SPLIT_MAX))
  }, [])

  const handleNoteSplitPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const pointerId = event.pointerId
    const target = event.currentTarget
    const prevCursor = document.body.style.cursor
    const prevUserSelect = document.body.style.userSelect
    updateNoteSplitFromClientX(event.clientX)
    target.setPointerCapture(pointerId)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const handleMove = (moveEvent: PointerEvent) => {
      updateNoteSplitFromClientX(moveEvent.clientX)
    }
    const cleanup = () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', cleanup)
      window.removeEventListener('pointercancel', cleanup)
      if (target.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId)
      document.body.style.cursor = prevCursor
      document.body.style.userSelect = prevUserSelect
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', cleanup)
    window.addEventListener('pointercancel', cleanup)
  }, [updateNoteSplitFromClientX])

  const handleNoteSplitKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 6 : 3
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      setNoteLeftPct((value) => clampNumber(value - step, VIDEO_SPLIT_MIN, VIDEO_SPLIT_MAX))
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      setNoteLeftPct((value) => clampNumber(value + step, VIDEO_SPLIT_MIN, VIDEO_SPLIT_MAX))
    } else if (event.key === 'Home') {
      event.preventDefault()
      setNoteLeftPct(VIDEO_SPLIT_MIN)
    } else if (event.key === 'End') {
      event.preventDefault()
      setNoteLeftPct(VIDEO_SPLIT_MAX)
    }
  }, [])

  const togglePip = useCallback(() => {
    setIsPip((current) => !current)
  }, [])

  const closePip = useCallback(() => {
    setIsPip(false)
    setPipDragging(false)
  }, [])

  const cyclePipSize = useCallback(() => {
    setPipSizeIndex((current) => (current + 1) % PIP_WIDTHS.length)
  }, [])

  const handlePipHeaderPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (typeof window === 'undefined') return
    if ((event.target as HTMLElement).closest('button')) return
    const rect = event.currentTarget.parentElement?.getBoundingClientRect()
    if (!rect) return
    const offsetX = event.clientX - rect.left
    const offsetY = event.clientY - rect.top
    setPipDragging(true)

    const handleMove = (moveEvent: PointerEvent) => {
      setPipPosition({
        x: clampNumber(moveEvent.clientX - offsetX, 12, Math.max(12, window.innerWidth - rect.width - 12)),
        y: clampNumber(moveEvent.clientY - offsetY, 12, Math.max(12, window.innerHeight - rect.height - 12)),
      })
    }

    const handleUp = () => {
      setPipDragging(false)
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('pointercancel', handleUp)
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', handleUp)
  }, [])

  const handlePipScreenshot = useCallback(() => {
    videoRef.current?.captureScreenshot()
  }, [])

  const handlePipTogglePlay = useCallback(() => {
    videoRef.current?.togglePlay()
    setPipPlaying(videoRef.current?.isPlaying ?? false)
  }, [])

  const handlePipProgressClick = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (!videoDuration) return
    const rect = event.currentTarget.getBoundingClientRect()
    const pct = clampNumber((event.clientX - rect.left) / rect.width, 0, 1)
    videoRef.current?.seekTo(pct * videoDuration)
  }, [videoDuration])

  // 点击外部关闭模板下拉
  useEffect(() => {
    if (!templateDropOpen) return
    const handle = (e: MouseEvent) => {
      if (templateDropRef.current && !templateDropRef.current.contains(e.target as Node)) {
        setTemplateDropOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [templateDropOpen])

  // 点击外部关闭 AI 工具下拉
  useEffect(() => {
    if (!aiToolsOpen) return
    const handle = (e: MouseEvent) => {
      if (aiToolsDropRef.current && !aiToolsDropRef.current.contains(e.target as Node)) {
        setAiToolsOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [aiToolsOpen])

  useEffect(() => {
    if (!editorPrefsOpen) return
    const handle = (e: MouseEvent) => {
      if (editorPrefsRef.current && !editorPrefsRef.current.contains(e.target as Node)) {
        setEditorPrefsOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [editorPrefsOpen])

  // 图文笔记：图片索引 + 加载错误
  const [selectedImageIdx, setSelectedImageIdx] = useState(0)
  const [imageLoadError, setImageLoadError] = useState<Record<number, boolean>>({})
  const handleTimeUpdate = useCallback((t: number) => setCurrentTime(t), [])
  const handleSeek = useCallback((sec: number) => {
    videoRef.current?.seekTo(sec)
    audioRef.current?.seekTo(sec)
    mediaCompanionRef.current?.seekTo(sec)
  }, [])

  const videoFrames = useMemo(() => note?.media?.frames ?? [], [note?.media?.frames])
  const activeFrameIdx = useMemo(() => {
    let activeIdx = -1
    for (let idx = 0; idx < videoFrames.length; idx += 1) {
      if (videoFrames[idx].sec <= currentTime + 0.5) activeIdx = idx
    }
    return activeIdx
  }, [currentTime, videoFrames])

  const videoSubtitle = useMemo(() => {
    if (!Array.isArray(note?.transcript)) return ''
    const lines = note.transcript as VideoResultTranscriptLine[]
    let active: VideoResultTranscriptLine | null = null
    for (const line of lines) {
      if (line.t_sec <= currentTime + 0.35) active = line
      else break
    }
    return active?.text ?? ''
  }, [currentTime, note?.transcript])

  const fetchNote = useCallback(async () => {
    setLoading(true)
    setError(null)
    setVideoDuration(0)
    try {
      const data = await getItemNote(workspaceId, itemId)
      setNote(data)
      // 同步 editingBody（首次加载 或 应用到主笔记后刷新）
      const body = extractBody(data.note_md)
      setEditingBody(body)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '加载笔记失败')
    } finally {
      setLoading(false)
    }
  }, [workspaceId, itemId])

  useEffect(() => { fetchNote() }, [fetchNote])

  // 字幕保存成功后轻量刷新 source.md（不 setLoading、不重置正文编辑态；字幕编辑只动 source.md/transcript）
  const refreshAfterTranscriptEdit = useCallback(async () => {
    try {
      const data = await getItemNote(workspaceId, itemId)
      setNote(data)
    } catch {
      /* 字幕已落盘，source.md 展示刷新失败不阻塞 */
    }
  }, [workspaceId, itemId])

  // ─── debounce 自动保存 ───
  const doSave = useCallback(async (body: string) => {
    setSaveStatus('saving')
    try {
      const updated = await putItemNote(workspaceId, itemId, body)
      setNote(updated)
      setSaveStatus('saved')
      setSavedAt(formatTime(new Date()))
    } catch {
      setSaveStatus('failed')
    }
  }, [workspaceId, itemId])

  const handleEditorChange = useCallback((md: string) => {
    setEditingBody(md)
    // 「应用到主笔记」触发的刷新已经在 fetchNote 里直接保存了，这里跳过
    if (applyingRef.current) {
      applyingRef.current = false
      return
    }
    // 清除旧定时器，1.5s 后自动保存
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { doSave(md) }, 1500)
  }, [doSave])

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [])

  // ─── 应用到主笔记 ───
  const handleApplyToNote = useCallback(async (summary: ItemSummary) => {
    // 标记 applying，防止 handleEditorChange 的 debounce 触发重复保存
    applyingRef.current = true
    // 清除进行中的 debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    setSaveStatus('saving')
    try {
      const updated = await putItemNote(workspaceId, itemId, summary.content_md)
      setNote(updated)
      setEditingBody(summary.content_md)
      setSeedVersion(v => v + 1) // 触发 Milkdown 重挂，显示新 summary 内容
      setActiveSummaryId(summary.summary_id)
      setSaveStatus('saved')
      setSavedAt(formatTime(new Date()))
    } catch {
      setSaveStatus('failed')
    }
  }, [workspaceId, itemId])

  // 切换视图模式（记忆 localStorage）

  const currentBody = editingBody
  const showInlineToc = useMemo(() => extractToc(currentBody).length > 0, [currentBody])
  const inlineTocNode = showInlineToc ? (
    <aside className="nibi-note-inline-toc" aria-label="正文目录">
      <MarkdownToc markdown={currentBody} scrollRef={noteScrollRef} />
    </aside>
  ) : null

  useEffect(() => {
    const container = noteScrollRef.current
    if (!container) return

    const frame = window.requestAnimationFrame(() => {
      const headings = container.querySelectorAll<HTMLElement>('.note-copy h2, .note-copy h3')
      headings.forEach((heading) => {
        const text = heading.textContent?.trim()
        if (!text) return
        heading.id = slugify(text)
      })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [currentBody, seedVersion])

  const chatSystemPrompt = useMemo(
    () => buildChatSystemPrompt(currentBody, note?.transcript),
    [currentBody, note?.transcript],
  )

  const handleExportMarkdown = useCallback(() => {
    if (!note) return
    const title = String((note.frontmatter as Record<string, unknown>)?.title ?? 'note')
    downloadMarkdownFile(currentBody, title)
    setExportOpen(false)
  }, [currentBody, note])

  const handleExportObsidian = useCallback(async () => {
    try {
      const blob = await exportItemNoteObsidian(workspaceId, itemId)
      const title = String((note?.frontmatter as Record<string, unknown> | undefined)?.title ?? 'note')
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${safeFilename(title)}-obsidian.zip`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setExportOpen(false)
    } catch (err) {
      console.error('Obsidian 导出失败:', err)
      toast.error('Obsidian 包导出失败，请重试')
    }
  }, [workspaceId, itemId, note])

  const handleExportTranscript = useCallback(() => {
    const transcriptText = formatTranscriptForPrompt(note?.transcript)
    if (!transcriptText) {
      toast.error('暂无可导出的原文对照')
      return
    }
    const title = String((note?.frontmatter as Record<string, unknown> | undefined)?.title ?? 'transcript')
    downloadTextFile(transcriptText, `${title}-原文对照`)
    setExportOpen(false)
  }, [note])

  const handleDownloadNoteExport = useCallback(async (format: ItemNoteExportFormat) => {
    const title = String((note?.frontmatter as Record<string, unknown> | undefined)?.title ?? 'note')
    setExportBusy(format)
    try {
      await downloadItemNoteExport(
        workspaceId,
        itemId,
        format,
        `${safeFilename(title)}.${extensionForExport(format)}`,
      )
      setExportOpen(false)
    } catch (err) {
      console.error('笔记导出失败:', err)
      toast.error('导出失败，请稍后重试')
    } finally {
      setExportBusy(null)
    }
  }, [workspaceId, itemId, note])

  const handleDownloadSourceMd = useCallback(() => {
    if (!note?.source_md) {
      toast.error('暂无源 md')
      return
    }
    const title = String((note.frontmatter as Record<string, unknown>)?.title ?? 'source')
    downloadMarkdownFile(note.source_md, `${title}-source`)
  }, [note])

  // VN4.3 新建总结（从 AI 工具菜单触发，复用 NewSummaryModal）
  const handleCreateSummary = useCallback(async (opts: {
    template: string; background: string; providerId: string; model: string; searchWeb: boolean
  }) => {
    const toastId = 'note-summary-creating'
    setCreatingSummary(true)
    setShowNewSummaryModal(false)
    toast.loading('正在生成总结…', { id: toastId })
    try {
      const s = await createSummary(workspaceId, itemId, opts.template, opts.background, {
        provider_id: opts.providerId,
        model: opts.model,
        search_web: opts.searchWeb,
      })
      toast.success(`v${s.version} 总结生成完成`, { id: toastId })
      refreshSummaries()
    } catch (err: unknown) {
      const axiosData = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      if (axiosData && axiosData.includes('chat model')) {
        toast.error('请先在设置中配置 LLM 模型', {
          id: toastId,
          action: { label: '去设置', onClick: () => navigate('/settings/models') },
        })
      } else {
        const msg = err instanceof Error ? err.message : '生成失败'
        toast.error(msg, { id: toastId })
      }
    } finally {
      setCreatingSummary(false)
    }
  }, [workspaceId, itemId, refreshSummaries, navigate])

  // 删除总结（从顶栏版本下拉触发）
  const handleDeleteSummary = useCallback(async (summaryId: string) => {
    try {
      await deleteSummary(workspaceId, itemId, summaryId)
      toast.success('已删除')
      if (activeSummaryId === summaryId) setActiveSummaryId(undefined)
      refreshSummaries()
    } catch {
      toast.error('删除失败')
    }
  }, [workspaceId, itemId, activeSummaryId, refreshSummaries])

  // 改名（从顶栏版本下拉触发）
  const commitRename = useCallback(async () => {
    if (!renameTargetId) return
    const targetId = renameTargetId
    setRenameTargetId(null)
    try {
      await renameSummary(workspaceId, itemId, targetId, renameName.trim())
      toast.success('已改名')
      refreshSummaries()
    } catch {
      toast.error('改名失败')
    } finally {
      setRenameTargetId(null)
      setRenameName('')
    }
  }, [renameTargetId, renameName, workspaceId, itemId, refreshSummaries])

  const updateEditorPrefs = useCallback((patch: Partial<NoteEditorPrefs>) => {
    setEditorPrefs((current) => ({ ...current, ...patch }))
  }, [])

  const adjustEditorFontSize = useCallback((delta: number) => {
    setEditorPrefs((current) => ({
      ...current,
      fontSize: clampNumber(current.fontSize + delta, 13, 20),
    }))
  }, [])

  const handleResetEditorPrefs = useCallback(() => {
    setEditorPrefs(DEFAULT_EDITOR_PREFS)
  }, [])

  const handleApplyBold = useCallback(() => {
    const applied = useLnEditorStore.getState().wrapSelection('**', '**')
    if (!applied) {
      toast.error('未找到可编辑的笔记正文')
      return
    }
    toast.success('已插入加粗标记')
  }, [])

  // ─── loading / error ───
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--mut)' }}>
        加载中…
      </div>
    )
  }
  if (error || !note) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', gap: 12 }}>
        <span style={{ color: 'var(--err)', fontWeight: 600 }}>
          {error ?? '没有可显示的笔记'}
        </span>
        <button className="btn-ghost" style={{ padding: '6px 12px' }} onClick={() => navigate(-1)}>
          <ArrowLeft size={14} /> 返回
        </button>
      </div>
    )
  }

  // ─── 数据解构 ───
  const fm = (note.frontmatter ?? {}) as Record<string, unknown>
  const title = String(fm.title ?? '')
  const sourceUrl = String(fm.source_url ?? '') || undefined
  const itemType = String(fm.type ?? 'text')
  const noteVersion = Number(fm.version ?? 1) || 1
  const noteCreatedAt = formatDateTime(String(fm.created_at ?? ''))
  const tags = (fm.tags ?? {}) as Record<string, unknown>
  const hasTags = tags && Object.keys(tags).length > 0
  const activeSummary = summaries.find((x) => x.summary_id === activeSummaryId)
  const versionButtonLabel = activeSummary
    ? `${tl(activeSummary.template)} · ${activeSummary.name || `v${activeSummary.version}`}`
    : `主笔记 v${noteVersion}`

  // 7.3: 视频笔记三列布局标志
  const isVideoNote = itemType === 'video' && !!note.media?.video?.url
  // Stage 2: 音频笔记双栏布局标志
  const isAudioNote = itemType === 'audio' && !!note.media?.audio
  // 图文笔记三列布局标志
  const isImageNote = itemType === 'image' && (note.media?.images?.length ?? 0) > 0
  // Stage 4: 文本笔记两栏布局标志（无媒体 / 播放器）
  const isTextNote = itemType === 'text'
  const images = note.media?.images ?? []
  const imageInfos = note.media?.image_infos ?? []
  const currentInfo = imageInfos[selectedImageIdx]
  const transcriptCount = Array.isArray(note.transcript) ? note.transcript.length : 0
  const sourceLabel = sourceUrl ? platformLabelFromUrl(sourceUrl) : '本地素材'
  const effectiveVideoDuration = note.media?.video?.duration || videoDuration
  const effectiveAudioDuration = audioDuration
  const saveStatusNode = (
    <span className={`nibi-note-save nibi-note-save--${saveStatus}`}>
      {saveStatus === 'saving' && '保存中…'}
      {saveStatus === 'saved' && `已保存 ${savedAt}`}
      {saveStatus === 'failed' && '保存失败'}
      {saveStatus === 'idle' && '自动保存'}
    </span>
  )

  // ── 提取正文 JSX（视频 / 非视频布局复用）──
  const noteContent = (
    <div className="nibi-note-editor-panel">
      <MilkdownEditor key={milkdownKey} markdown={editingBody} onMarkdownChange={handleEditorChange} onSeek={handleSeek} />
    </div>
  )

  return (
    <div className={`nibi-note-shell nibi-note-shell--${itemType}`}>
      {/* ════════ 顶栏：.note-bar（设计稿 .note-bar 对齐） ════════ */}
      <div className="nibi-note-bar">
        <button className="nibi-note-bar-back" onClick={() => navigate(-1)} title="返回任务中心">
          <ArrowLeft size={15} />
          <span>返回</span>
        </button>
        <h1 className="nibi-note-bar-title">{title || '未命名笔记'}</h1>
        {isVideoNote && (
          <span className="nibi-note-bar-meta">VIDEO{effectiveVideoDuration ? ` · ${formatTimecode(effectiveVideoDuration)}` : ''}</span>
        )}
        {itemType === 'audio' && (
          <span className="nibi-note-bar-meta">AUDIO{effectiveAudioDuration ? ` · ${formatTimecode(effectiveAudioDuration)}` : ''}</span>
        )}
        {!isVideoNote && itemType !== 'audio' && (
          <span className="nibi-note-bar-meta">{(TYPE_LABEL[itemType] ?? itemType).toUpperCase()}</span>
        )}
        <div className="nibi-note-bar-tools">
          <div ref={templateDropRef} style={{ position: 'relative' }}>
            <button
              className="nibi-note-bar-btn nibi-note-bar-btn--label"
              onClick={() => setTemplateDropOpen((v) => !v)}
              title="切换主笔记 / AI 总结版本"
            >
              <List size={13} /> {versionButtonLabel}
              <ChevronDown size={11} style={{ marginLeft: 2 }} />
            </button>
            {templateDropOpen && (
              <div className="nibi-note-version-menu">
                <button
                  className={`nibi-note-version-main${!activeSummaryId ? ' is-active' : ''}`}
                  onClick={() => {
                    setActiveSummaryId(undefined)
                    setTemplateDropOpen(false)
                  }}
                >
                  <span>
                    <strong>主笔记 v{noteVersion}</strong>
                    {noteCreatedAt && <small>{noteCreatedAt}</small>}
                  </span>
                  {!activeSummaryId && <Check size={13} />}
                </button>
                <div className="nibi-note-version-divider" />
                {summaries.length === 0 ? (
                  <div className="nibi-note-version-empty">暂无 AI 总结版本，可点击“新建总结”生成。</div>
                ) : (
                  [...templateGroups.entries()].map(([tmpl, versions], gi) => (
                    <div key={tmpl}>
                      {gi > 0 && <div className="nibi-note-version-divider" />}
                      <div className="nibi-note-version-group">{tl(tmpl)}</div>
                      {versions.map((s) => {
                        const isActive = s.summary_id === activeSummaryId
                        const isRenaming = renameTargetId === s.summary_id
                        return (
                          <div key={s.summary_id} className="nibi-note-version-row">
                            {isRenaming ? (
                              <input
                                autoFocus
                                value={renameName}
                                onChange={(e) => setRenameName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') commitRename()
                                  if (e.key === 'Escape') {
                                    setRenameTargetId(null)
                                    setRenameName('')
                                  }
                                }}
                                onBlur={commitRename}
                              />
                            ) : (
                              <button
                                className={`nibi-note-version-choice${isActive ? ' is-active' : ''}`}
                                onClick={() => {
                                  handleApplyToNote(s)
                                  setTemplateDropOpen(false)
                                }}
                              >
                                <span>
                                  <strong>{s.name || `v${s.version}`}</strong>
                                  <small>
                                    {[s.model_used || '默认模型', formatDateTime(s.created_at)].filter(Boolean).join(' · ')}
                                  </small>
                                </span>
                                {isActive && <Check size={13} />}
                              </button>
                            )}
                            {!isRenaming && (
                              <div className="nibi-note-version-actions">
                                <button title="改名" onClick={(e) => { e.stopPropagation(); setRenameTargetId(s.summary_id); setRenameName(s.name || '') }}><Pencil size={11} /></button>
                                <button title="删除" onClick={(e) => { e.stopPropagation(); handleDeleteSummary(s.summary_id) }}><Trash2 size={11} /></button>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
          <button
            className="nibi-note-bar-btn nibi-note-bar-btn--label nibi-note-bar-btn--accent"
            onClick={() => setShowNewSummaryModal(true)}
            disabled={creatingSummary}
            title="新建总结"
          >
            <Plus size={14} />
            {creatingSummary ? '生成中…' : '新建总结'}
          </button>
          <div style={{ position: 'relative' }} ref={editorPrefsRef}>
            <button className="nibi-note-bar-btn nibi-note-bar-btn--label" onClick={() => setEditorPrefsOpen((value) => !value)} title="正文设置">
              <Type size={14} /> Aa 设置<ChevronDown size={11} />
            </button>
            {editorPrefsOpen && (
              <div className="nibi-note-pref-panel">
                <div className="nibi-note-pref-group">
                  <span className="nibi-note-pref-label">字体</span>
                  <div className="nibi-note-pref-segment">
                    {[
                      { key: 'sans', label: 'Sans' },
                      { key: 'serif', label: 'Serif' },
                      { key: 'mono', label: 'Mono' },
                    ].map((option) => (
                      <button
                        key={option.key}
                        className={`nibi-note-pref-chip${editorPrefs.fontFamily === option.key ? ' is-active' : ''}`}
                        onClick={() => updateEditorPrefs({ fontFamily: option.key as NoteEditorPrefs['fontFamily'] })}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="nibi-note-pref-group">
                  <span className="nibi-note-pref-label">字号</span>
                  <div className="nibi-note-pref-stepper">
                    <button className="nibi-note-pref-icon-btn" onClick={() => adjustEditorFontSize(-1)} title="减小字号">
                      <Minus size={13} />
                    </button>
                    <strong>{editorPrefs.fontSize}px</strong>
                    <button className="nibi-note-pref-icon-btn" onClick={() => adjustEditorFontSize(1)} title="增大字号">
                      <Plus size={13} />
                    </button>
                  </div>
                </div>
                <div className="nibi-note-pref-group">
                  <span className="nibi-note-pref-label">行高</span>
                  <div className="nibi-note-pref-segment">
                    {[1.6, 1.8, 2].map((value) => (
                      <button
                        key={value}
                        className={`nibi-note-pref-chip${editorPrefs.lineHeight === value ? ' is-active' : ''}`}
                        onClick={() => updateEditorPrefs({ lineHeight: value as NoteEditorPrefs['lineHeight'] })}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="nibi-note-pref-group">
                  <span className="nibi-note-pref-label">颜色</span>
                  <div className="nibi-note-pref-swatches">
                    {[
                      { key: 'ink', color: 'var(--fg2)', label: '深' },
                      { key: 'muted', color: 'var(--mut)', label: '柔' },
                      { key: 'soft', color: 'var(--ink-2)', label: '浅' },
                    ].map((option) => (
                      <button
                        key={option.key}
                        className={`nibi-note-pref-swatch${editorPrefs.textTone === option.key ? ' is-active' : ''}`}
                        onClick={() => updateEditorPrefs({ textTone: option.key as NoteEditorPrefs['textTone'] })}
                        style={{ '--swatch-color': option.color } as CSSProperties}
                        title={option.label}
                      >
                        <span>{option.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="nibi-note-pref-group">
                  <span className="nibi-note-pref-label">字重</span>
                  <div className="nibi-note-pref-segment">
                    {[
                      { key: 'regular', label: '常规' },
                      { key: 'medium', label: '中' },
                      { key: 'bold', label: '粗' },
                    ].map((option) => (
                      <button
                        key={option.key}
                        className={`nibi-note-pref-chip${editorPrefs.fontWeight === option.key ? ' is-active' : ''}`}
                        onClick={() => updateEditorPrefs({ fontWeight: option.key as NoteEditorPrefs['fontWeight'] })}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="nibi-note-pref-actions">
                  <button className="nibi-note-pref-ghost" onClick={handleResetEditorPrefs}>重置</button>
                  <button className="nibi-note-pref-ghost nibi-note-pref-ghost--accent" onClick={handleApplyBold}>
                    <Bold size={13} />
                    加粗选中
                  </button>
                </div>
              </div>
            )}
          </div>
          {sourceUrl && (
            <a className="nibi-note-bar-btn nibi-note-bar-btn--label" href={sourceUrl} target="_blank" rel="noreferrer" title="打开原视频">
              <ExternalLink size={14} /> 原视频
            </a>
          )}
          {note.source_md && (
            <button className="nibi-note-bar-btn nibi-note-bar-btn--label" onClick={() => setSourceMdOpen(true)} title="查看源 md">
              <FileText size={14} /> 源 md
            </button>
          )}
          <div style={{ position: 'relative' }} ref={exportDropRef}>
            <button className="nibi-note-bar-btn nibi-note-bar-btn--label" onClick={() => setExportOpen((v) => !v)} title="导出"><Download size={14} /> 导出<ChevronDown size={11} /></button>
            {exportOpen && (
              <div className="nibi-note-export-menu" style={{ position: 'absolute', right: 0, top: 34, zIndex: 20, minWidth: 200, padding: '4px', border: '1px solid var(--bdr)', borderRadius: 'var(--radius-sm)', background: 'var(--bg)', boxShadow: 'var(--shadow-md)' }}>
                <button className="btn-ghost" onClick={() => { handleExportMarkdown(); setExportOpen(false) }} style={{ width: '100%', justifyContent: 'flex-start', height: 30, padding: '0 10px', fontSize: 12 }}><FileText size={13} /> Markdown</button>
                <button className="btn-ghost" onClick={() => handleDownloadNoteExport('md')} style={{ width: '100%', justifyContent: 'flex-start', height: 30, padding: '0 10px', fontSize: 12 }}><FileText size={13} /> 原始 note.md</button>
                <button className="btn-ghost" onClick={() => { handleExportObsidian(); setExportOpen(false) }} style={{ width: '100%', justifyContent: 'flex-start', height: 30, padding: '0 10px', fontSize: 12 }}><BookOpenCheck size={13} /> Obsidian 包</button>
                {(isVideoNote || isAudioNote) && (
                  <button className="btn-ghost" onClick={() => { handleExportTranscript(); setExportOpen(false) }} style={{ width: '100%', justifyContent: 'flex-start', height: 30, padding: '0 10px', fontSize: 12 }}><Subtitles size={13} /> 原文对照（txt）</button>
                )}
                {[
                  { icon: <FileText size={13} />, label: 'HTML', format: 'html' as const },
                  { icon: <FileDown size={13} />, label: 'PDF', format: 'pdf' as const },
                  { icon: <FileType size={13} />, label: 'Word', format: 'docx' as const },
                  { icon: <Image size={13} />, label: '长图', format: 'long_image' as const },
                  { icon: <Presentation size={13} />, label: 'PPT', format: 'pptx' as const },
                ].map((item) => (
                  <button
                    key={item.label}
                    className="btn-ghost"
                    onClick={() => handleDownloadNoteExport(item.format)}
                    disabled={exportBusy === item.format}
                    style={{ width: '100%', justifyContent: 'flex-start', height: 30, padding: '0 10px', fontSize: 12 }}
                  >
                    {item.icon} {exportBusy === item.format ? '导出中…' : item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            className="nibi-note-bar-btn nibi-note-bar-btn--label nibi-note-bar-btn--accent"
            onClick={() => setImmersiveOpen(true)}
            title="打开沉浸式笔记"
          >
            <Sparkles size={14} /> 沉浸式
          </button>
          <div style={{ position: 'relative' }} ref={aiToolsDropRef}>
            <button className="nibi-note-bar-btn nibi-note-bar-btn--label nibi-note-bar-btn--accent" onClick={() => setAiToolsOpen((v) => !v)} title="AI 工具"><Brain size={14} /> AI 工具<ChevronDown size={11} /></button>
            {aiToolsOpen && (
              <div style={{ position: 'absolute', right: 0, top: 34, zIndex: 20, minWidth: 180, padding: '4px', border: '1px solid var(--bdr)', borderRadius: 'var(--radius-sm)', background: 'var(--bg)', boxShadow: 'var(--shadow-md)' }}>
                <button
                  className="btn-ghost"
                  onClick={() => {
                    setAskAiOpen(true)
                    setAiToolsOpen(false)
                  }}
                  style={{ width: '100%', justifyContent: 'flex-start', height: 30, padding: '0 10px', fontSize: 12 }}
                >
                  <MessageCircle size={13} />
                  问 AI
                </button>
                <button className="btn-ghost" disabled title="即将上线" style={{ width: '100%', justifyContent: 'flex-start', height: 30, padding: '0 10px', fontSize: 12, color: 'var(--mut)', cursor: 'not-allowed' }}>更多 AI 工具</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {immersiveOpen && (
        <div className="nibi-note-immersive">
          <div className="nibi-note-immersive-bar">
            <button className="nibi-note-bar-back" onClick={() => setImmersiveOpen(false)} title="返回工作台">
              <ArrowLeft size={15} />
              <span>工作台</span>
            </button>
            <div className="nibi-note-immersive-title">{title || '未命名笔记'}</div>
            <div className="nibi-note-bar-tools">
              {sourceUrl && (
                <a className="nibi-note-bar-btn nibi-note-bar-btn--label" href={sourceUrl} target="_blank" rel="noreferrer">
                  <ExternalLink size={14} /> 原视频
                </a>
              )}
              {note.source_md && (
                <button className="nibi-note-bar-btn nibi-note-bar-btn--label" onClick={() => setSourceMdOpen(true)}>
                  <FileText size={14} /> 源 md
                </button>
              )}
              <button className="nibi-note-bar-btn nibi-note-bar-btn--label" onClick={() => handleDownloadNoteExport('pdf')}>
                <FileDown size={14} /> PDF
              </button>
              <button className="nibi-note-bar-btn" onClick={() => setImmersiveOpen(false)} title="关闭">
                <X size={14} />
              </button>
            </div>
          </div>
          <div className="nibi-note-immersive-body">
            <div className="nibi-note-immersive-scroll" ref={immersiveScrollRef}>
              <section className="nibi-note-source-banner">
                <div className="nibi-note-source-banner-copy">
                  <strong>{title || '未命名笔记'}</strong>
                  <span>
                    {sourceLabel}
                    {isVideoNote && effectiveVideoDuration ? ` · ${formatTimecode(effectiveVideoDuration)}` : ''}
                    {itemType ? ` · ${TYPE_LABEL[itemType] ?? itemType}` : ''}
                  </span>
                </div>
                {sourceUrl && (
                  <a href={sourceUrl} target="_blank" rel="noreferrer">原视频</a>
                )}
              </section>
              <article className="nibi-note-immersive-article">
                <h1>{title || '未命名笔记'}</h1>
                <ReadOnlyMarkdown markdown={currentBody} onSeek={handleSeek} />
              </article>
            </div>
            <aside className="nibi-note-immersive-toc">
              <MarkdownToc markdown={currentBody} scrollRef={immersiveScrollRef} />
            </aside>
          </div>
        </div>
      )}


      {/* ════════ 主内容区（视频笔记 = 三列 / 图文笔记 = 三列 / 其余 = 通用布局）════════ */}
      {isVideoNote ? (
        <>
        {/* ── 视频笔记两栏布局：.note-page（设计稿 pg-note 对齐） ── */}
        <div className={`nibi-note-page${isPip ? ' is-pip' : ''}`} ref={notePageRef} style={notePageStyle}>

          {/* ── 左栏（60%）：播放器 + 控制 + 转录 ── */}
          <div className="nibi-note-left vm-ln-scope">
            <div
              className={`nibi-note-player-shell${isPip ? ' is-pip' : ''}${pipDragging ? ' is-dragging' : ''}`}
              style={isPip && pipPosition ? { width: pipWidth, left: pipPosition.x, top: pipPosition.y, right: 'auto', bottom: 'auto' } : undefined}
            >
              {isPip && (
                <div className="note-pip-head" onPointerDown={handlePipHeaderPointerDown}>
                  <span className="note-pip-badge">画中画</span>
                  <div className="note-pip-head-actions">
                    <button className="note-pip-head-btn" onClick={cyclePipSize} title="切换尺寸">
                      {['小', '中', '大'][pipSizeIndex]}
                    </button>
                    <button className="note-pip-head-btn note-pip-head-btn--danger" onClick={closePip} title="关闭画中画">
                      <X size={13} />
                    </button>
                  </div>
                </div>
              )}
              <div className="nibi-note-player-wrap">
                <LNVideoPanel
                  ref={videoRef}
                  src={note.media!.video?.url?.startsWith('/static/') ? note.media!.video!.url : ''}
                  externalUrl={!note.media!.video?.url?.startsWith('/static/') ? ((note.frontmatter as Record<string, unknown>)?.source_url as string || note.media!.video?.url) : undefined}
                  title=""
                  workspaceId={workspaceId}
                  onTimeUpdate={handleTimeUpdate}
                  onDurationChange={handleVideoDurationChange}
                  markers={videoFrames}
                  renderTransportInline={false}
                  onTransportChange={handleTransportChange}
                  isPipActive={isPip}
                  onTogglePip={togglePip}
                  subtitle={isPip ? undefined : videoSubtitle}
                />
              </div>
              {isPip && (
                <div className="note-pip-simple-controls">
                  <button className="note-pip-control-btn note-pip-control-btn--play" onClick={handlePipTogglePlay} title={pipPlaying ? '暂停' : '播放'}>
                    {pipPlaying ? <Pause size={14} /> : <Play size={14} fill="currentColor" />}
                  </button>
                  <div className="note-pip-simple-progress" onClick={handlePipProgressClick} title={`${formatTimecode(currentTime)} / ${formatTimecode(videoDuration)}`}>
                    <span style={{ width: `${videoDuration ? Math.min(100, Math.max(0, (currentTime / videoDuration) * 100)) : 0}%` }} />
                  </div>
                  <button className="note-pip-control-btn" onClick={handlePipScreenshot} title="截取当前帧">
                    <Camera size={14} />
                  </button>
                </div>
              )}
            </div>
            {/* 控制条 + 时间线（在 player-wrap 外，避免 overflow:hidden 截断） */}
            {!isPip && transportNode}
            {!isPip && videoFrames.length > 0 && (
              <div className="note-chapters" aria-label="关键帧轨">
                {videoFrames.map((frame, idx) => (
                  <button
                    key={`${frame.sec}-${frame.url}`}
                    className={`note-thumb${idx === activeFrameIdx ? ' is-active' : ''}`}
                    onClick={() => handleSeek(frame.sec)}
                    title={`跳转到 ${formatTimecode(frame.sec)}`}
                  >
                    <img src={frame.url} alt="" loading="lazy" />
                    <span>{formatTimecode(frame.sec)}</span>
                  </button>
                ))}
              </div>
            )}
            {/* 转录 */}
            {!isPip && Array.isArray(note.transcript) && (note.transcript as VideoResultTranscriptLine[]).length > 0 ? (
              <div className="nibi-note-transcript-wrap">
                <div className="nibi-note-transcript-head">
                  <span>转录</span>
                  <span className="nibi-note-transcript-count">{transcriptCount} 条</span>
                </div>
                <LNTranscriptPanel
                  transcript={note.transcript as VideoResultTranscriptLine[]}
                  currentTime={currentTime}
                  onSeek={handleSeek}
                  workspaceId={workspaceId}
                  itemId={itemId}
                  onSaved={refreshAfterTranscriptEdit}
                  sourceMd={note.source_md ?? undefined}
                />
              </div>
            ) : !isPip ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mut)', fontSize: 12, padding: 24 }}>暂无字幕</div>
            ) : null}
          </div>

          {!isPip && (
            <div
              className="nibi-note-splitter"
              role="separator"
              aria-label="调整左右栏宽度"
              aria-orientation="vertical"
              aria-valuemin={VIDEO_SPLIT_MIN}
              aria-valuemax={VIDEO_SPLIT_MAX}
              aria-valuenow={Math.round(noteLeftPct)}
              tabIndex={0}
              onPointerDown={handleNoteSplitPointerDown}
              onKeyDown={handleNoteSplitKeyDown}
            >
              <span className="nibi-note-splitter-grip" />
            </div>
          )}

          {/* ── 右栏（40%）：标签 + 结构化笔记 ── */}
          <div className="nibi-note-right">
            <div className={`nibi-note-right-scroll${showInlineToc ? ' has-toc' : ''}`} ref={noteScrollRef}>
              <div className="note-copy">
                <div className="note-copy-head">
                  <h1>{title || '未命名笔记'}</h1>
                </div>
                {/* 标签 + meta */}
                {(hasTags || sourceUrl) && (
                  <div className="note-tags-inline">
                    {hasTags && <TagChips tags={tags} />}
                    {sourceUrl && <span className="note-meta-inline">{platformLabelFromUrl(sourceUrl)} · {note.media?.video?.duration ? formatTimecode(note.media.video.duration) : ''}</span>}
                  </div>
                )}
                {/* 总结版本切换 */}
                {summaries.length > 0 && (() => {

                  return (
                    <div className="note-section" style={{ marginTop: 16 }}>
                      <h2>内容总结</h2>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
                        {[...templateGroups.entries()].map(([tmpl]) => (
                          <button
                            key={tmpl}
                            className="btn-ghost"
                            onClick={() => { const first = templateGroups.get(tmpl)?.[0]; if (first) handleApplyToNote(first) }}
                            style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: tmpl === activeTemplate ? 'var(--accl)' : 'var(--bgalt)', color: tmpl === activeTemplate ? 'var(--acc)' : 'var(--mut)', fontWeight: tmpl === activeTemplate ? 600 : 400 }}
                          >
                            {tl(tmpl)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })()}
                {/* 正文（MilkdownEditor 渲染 h2/h3/p/ul/blockquote → 设计稿 .note-section 自动匹配） */}
                <div className="note-section" style={{ marginTop: summaries.length > 0 ? 0 : 16 }}>
                  <div className="nibi-note-editor-panel">
                    <MilkdownEditor key={milkdownKey} markdown={editingBody} onMarkdownChange={handleEditorChange} onSeek={handleSeek} />
                  </div>
                </div>
                {/* 保存状态 */}
                <div style={{ padding: '12px 0', textAlign: 'right' }}>{saveStatusNode}</div>
              </div>
              {inlineTocNode}
            </div>
          </div>
        </div>
        </>
      ) : isAudioNote ? (
        <>
        {/* ── 音频笔记两栏布局：.note-page（设计稿 pg-audio 对齐） ── */}
        <div className="nibi-note-page nibi-note-page--audio" ref={notePageRef} style={notePageStyle}>

          {/* ── 左栏：播放器 + 波形 + 控制 + 转录 ── */}
          <div className="nibi-note-left nibi-audio-left">
            <div className="nibi-audio-player-wrap">
              <NoteAudioPanel
                ref={audioRef}
                src={note.media!.audio!}
                onTimeUpdate={handleTimeUpdate}
                onDurationChange={handleAudioDurationChange}
                onTransportChange={handleAudioTransportChange}
              />
            </div>
            {/* 波形 + 时间 + 控制条（player 外，overflow 安全） */}
            {audioTransportNode}
            {/* 转录 */}
            {Array.isArray(note.transcript) && (note.transcript as VideoResultTranscriptLine[]).length > 0 ? (
              <div className="nibi-note-transcript-wrap">
                <div className="nibi-note-transcript-head">
                  <span>转录文本</span>
                  <span className="nibi-note-transcript-count">{transcriptCount} 条</span>
                </div>
                <LNTranscriptPanel
                  transcript={note.transcript as VideoResultTranscriptLine[]}
                  currentTime={currentTime}
                  onSeek={handleSeek}
                  workspaceId={workspaceId}
                  itemId={itemId}
                  onSaved={refreshAfterTranscriptEdit}
                  sourceMd={note.source_md ?? undefined}
                />
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mut)', fontSize: 12, padding: 24 }}>暂无转录</div>
            )}
          </div>

          <div
            className="nibi-note-splitter"
            role="separator"
            aria-label="调整左右栏宽度"
            aria-orientation="vertical"
            aria-valuemin={VIDEO_SPLIT_MIN}
            aria-valuemax={VIDEO_SPLIT_MAX}
            aria-valuenow={Math.round(noteLeftPct)}
            tabIndex={0}
            onPointerDown={handleNoteSplitPointerDown}
            onKeyDown={handleNoteSplitKeyDown}
          >
            <span className="nibi-note-splitter-grip" />
          </div>

          {/* ── 右栏：标题 + 标签 + 总结 + 正文 ── */}
          <div className="nibi-note-right">
            <div className={`nibi-note-right-scroll${showInlineToc ? ' has-toc' : ''}`} ref={noteScrollRef}>
              <div className="note-copy">
                <div className="note-copy-head">
                  <h1>{title || '未命名笔记'}</h1>
                </div>
                {/* 标签 + meta */}
                {(hasTags || sourceUrl) && (
                  <div className="note-tags-inline">
                    {hasTags && <TagChips tags={tags} />}
                    {sourceUrl && <span className="note-meta-inline">{platformLabelFromUrl(sourceUrl)}{effectiveAudioDuration ? ` · ${formatTimecode(effectiveAudioDuration)}` : ''}</span>}
                  </div>
                )}
                {/* 总结版本切换 */}
                {summaries.length > 0 && (() => {

                  return (
                    <div className="note-section" style={{ marginTop: 16 }}>
                      <h2>内容总结</h2>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
                        {[...templateGroups.entries()].map(([tmpl]) => (
                          <button
                            key={tmpl}
                            className="btn-ghost"
                            onClick={() => { const first = templateGroups.get(tmpl)?.[0]; if (first) handleApplyToNote(first) }}
                            style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: tmpl === activeTemplate ? 'var(--accl)' : 'var(--bgalt)', color: tmpl === activeTemplate ? 'var(--acc)' : 'var(--mut)', fontWeight: tmpl === activeTemplate ? 600 : 400 }}
                          >
                            {tl(tmpl)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })()}
                {/* 正文 */}
                <div className="note-section" style={{ marginTop: summaries.length > 0 ? 0 : 16 }}>
                  <div className="nibi-note-editor-panel">
                    <MilkdownEditor key={milkdownKey} markdown={editingBody} onMarkdownChange={handleEditorChange} onSeek={handleSeek} />
                  </div>
                </div>
                {/* 保存状态 */}
                <div style={{ padding: '12px 0', textAlign: 'right' }}>{saveStatusNode}</div>
              </div>
              {inlineTocNode}
            </div>
          </div>
        </div>
        </>
      ) : isImageNote ? (
        /* ── 图文笔记两栏布局（设计稿 pg-image 对齐） ── */
        <>
        <div className="nibi-note-page nibi-note-page--image" ref={notePageRef} style={notePageStyle}>

          {/* ── 左栏：画廊 + meta ── */}
          <div className="nibi-note-left nibi-image-left">
            <div className="nibi-image-gallery">
              {/* 主图 */}
              <div className="nibi-image-main">
                {imageLoadError[selectedImageIdx] ? (
                  <span style={{ color: 'var(--mut)', fontSize: 12 }}>图片加载失败</span>
                ) : (
                  <img
                    src={images[selectedImageIdx]}
                    alt={title ? `${title}（${selectedImageIdx + 1}）` : `图片 ${selectedImageIdx + 1}`}
                    onError={() => setImageLoadError((prev) => ({ ...prev, [selectedImageIdx]: true }))}
                  />
                )}
              </div>
              {/* 缩略图列表 */}
              {images.length > 1 && (
                <div className="nibi-image-thumbs">
                  {images.map((img, idx) => (
                    <button
                      key={idx}
                      className={`nibi-image-thumb${idx === selectedImageIdx ? ' is-active' : ''}`}
                      onClick={() => setSelectedImageIdx(idx)}
                    >
                      <img src={img} alt="" />
                    </button>
                  ))}
                </div>
              )}
              {/* 计数 */}
              {images.length > 1 && (
                <div className="nibi-image-counter">
                  {selectedImageIdx + 1} / {images.length}
                </div>
              )}
            </div>
            {/* meta：来源 / 创建时间 / OCR 识别文本 */}
            <div className="nibi-image-meta">
              <div className="nibi-image-meta-row">
                <span className="nibi-image-meta-label">来源</span>
                <span className="nibi-image-meta-value">{sourceLabel}</span>
              </div>
              {/* OCR 识别文本（仅当非空时显示） */}
              {currentInfo?.ocr_text && (
                <details style={{ marginTop: 2 }}>
                  <summary style={{ fontSize: 10, color: 'var(--mut)', cursor: 'pointer', userSelect: 'none', padding: '2px 0' }}>
                    识别文本
                  </summary>
                  <div style={{ fontSize: 11, color: 'var(--fg2)', lineHeight: 1.5, whiteSpace: 'pre-wrap', maxHeight: 160, overflowY: 'auto', padding: '4px 0' }}>
                    {currentInfo.ocr_text}
                  </div>
                </details>
              )}
            </div>
          </div>

          <div
            className="nibi-note-splitter"
            role="separator"
            aria-label="调整左右栏宽度"
            aria-orientation="vertical"
            aria-valuemin={VIDEO_SPLIT_MIN}
            aria-valuemax={VIDEO_SPLIT_MAX}
            aria-valuenow={Math.round(noteLeftPct)}
            tabIndex={0}
            onPointerDown={handleNoteSplitPointerDown}
            onKeyDown={handleNoteSplitKeyDown}
          >
            <span className="nibi-note-splitter-grip" />
          </div>

          {/* ── 右栏：标题 + 标签 + 总结 + 正文 ── */}
          <div className="nibi-note-right">
            <div className={`nibi-note-right-scroll${showInlineToc ? ' has-toc' : ''}`} ref={noteScrollRef}>
              <div className="note-copy">
                <div className="note-copy-head">
                  <h1>{title || '未命名笔记'}</h1>
                </div>
                {/* 标签 + meta */}
                {(hasTags || sourceUrl) && (
                  <div className="note-tags-inline">
                    {hasTags && <TagChips tags={tags} />}
                    {sourceUrl && <span className="note-meta-inline">{platformLabelFromUrl(sourceUrl)}</span>}
                  </div>
                )}
                {/* 总结版本切换 */}
                {summaries.length > 0 && (() => {

                  return (
                    <div className="note-section" style={{ marginTop: 16 }}>
                      <h2>内容总结</h2>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
                        {[...templateGroups.entries()].map(([tmpl]) => (
                          <button
                            key={tmpl}
                            className="btn-ghost"
                            onClick={() => { const first = templateGroups.get(tmpl)?.[0]; if (first) handleApplyToNote(first) }}
                            style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: tmpl === activeTemplate ? 'var(--accl)' : 'var(--bgalt)', color: tmpl === activeTemplate ? 'var(--acc)' : 'var(--mut)', fontWeight: tmpl === activeTemplate ? 600 : 400 }}
                          >
                            {tl(tmpl)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })()}
                {/* 正文 */}
                <div className="note-section" style={{ marginTop: summaries.length > 0 ? 0 : 16 }}>
                  <div className="nibi-note-editor-panel">
                    <MilkdownEditor key={milkdownKey} markdown={editingBody} onMarkdownChange={handleEditorChange} onSeek={handleSeek} />
                  </div>
                </div>
                {/* 保存状态 */}
                <div style={{ padding: '12px 0', textAlign: 'right' }}>{saveStatusNode}</div>
              </div>
              {inlineTocNode}
            </div>
          </div>
        </div>
        </>
      ) : isTextNote ? (
        /* ── 文本笔记两栏布局（设计稿 pg-text 对齐） ── */
        <>
        <div className="nibi-note-page nibi-note-page--text" ref={notePageRef} style={notePageStyle}>

          {/* ── 左栏：工具栏 + 编辑器 ── */}
          <div className="nibi-note-left nibi-text-left">
            <div className="nibi-text-toolbar">
              {/* TODO Stage 4: 核对 Milkdown 已支持的命令，对齐设计稿工具栏 */}
              <button className="btn-ghost" disabled title="加粗（Milkdown 已支持，待接入）">B</button>
              <button className="btn-ghost" disabled title="斜体（Milkdown 已支持，待接入）">I</button>
              <button className="btn-ghost" disabled title="标题（Milkdown 已支持，待接入）">H</button>
              <button className="btn-ghost" disabled title="列表（Milkdown 已支持，待接入）">•</button>
            </div>
            <div className="nibi-text-editor-content">
              <div className="nibi-note-editor-panel">
                <MilkdownEditor key={milkdownKey} markdown={editingBody} onMarkdownChange={handleEditorChange} onSeek={handleSeek} />
              </div>
            </div>
          </div>

          <div
            className="nibi-note-splitter"
            role="separator"
            aria-label="调整左右栏宽度"
            aria-orientation="vertical"
            aria-valuemin={VIDEO_SPLIT_MIN}
            aria-valuemax={VIDEO_SPLIT_MAX}
            aria-valuenow={Math.round(noteLeftPct)}
            tabIndex={0}
            onPointerDown={handleNoteSplitPointerDown}
            onKeyDown={handleNoteSplitKeyDown}
          >
            <span className="nibi-note-splitter-grip" />
          </div>

          {/* ── 右栏：标题 + 标签 + 总结 + 正文 ── */}
          <div className="nibi-note-right nibi-text-right">
            <div className={`nibi-note-right-scroll${showInlineToc ? ' has-toc' : ''}`} ref={noteScrollRef}>
              <div className="note-copy">
                <div className="note-copy-head">
                  <h1>{title || '未命名笔记'}</h1>
                </div>
                {/* 标签 + meta */}
                {(hasTags || sourceUrl) && (
                  <div className="note-tags-inline">
                    {hasTags && <TagChips tags={tags} />}
                    {sourceUrl && <span className="note-meta-inline">{platformLabelFromUrl(sourceUrl)}</span>}
                  </div>
                )}
                {/* 总结版本切换 */}
                {summaries.length > 0 && (() => {

                  return (
                    <div className="note-section" style={{ marginTop: 16 }}>
                      <h2>内容总结</h2>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
                        {[...templateGroups.entries()].map(([tmpl]) => (
                          <button
                            key={tmpl}
                            className="btn-ghost"
                            onClick={() => { const first = templateGroups.get(tmpl)?.[0]; if (first) handleApplyToNote(first) }}
                            style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: tmpl === activeTemplate ? 'var(--accl)' : 'var(--bgalt)', color: tmpl === activeTemplate ? 'var(--acc)' : 'var(--mut)', fontWeight: tmpl === activeTemplate ? 600 : 400 }}
                          >
                            {tl(tmpl)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })()}
                {/* 正文 */}
                <div className="note-section" style={{ marginTop: summaries.length > 0 ? 0 : 16 }}>
                  <div className="nibi-note-editor-panel">
                    <MilkdownEditor key={milkdownKey} markdown={editingBody} onMarkdownChange={handleEditorChange} onSeek={handleSeek} />
                  </div>
                </div>
                {/* 保存状态 */}
                <div style={{ padding: '12px 0', textAlign: 'right' }}>{saveStatusNode}</div>
              </div>
              {inlineTocNode}
            </div>
          </div>
        </div>
        </>
      ) : (
        <div className="nibi-note-workbench nibi-note-workbench--generic">
          <div className="nibi-note-main-panel">
            <div className="nibi-note-panel-head">
              <span>笔记正文</span>
              {saveStatusNode}
            </div>
            <div className="nibi-note-editor-scroll">
              {noteContent}
            </div>
          </div>

          <aside className="nibi-note-aside">
            <section className="nibi-note-side-card">
              <div className="nibi-note-card-kicker">MATERIAL</div>
              <h2>{title || '未命名素材'}</h2>
              <dl>
                <div>
                  <dt>类型</dt>
                  <dd>{TYPE_LABEL[itemType] ?? itemType}</dd>
                </div>
                <div>
                  <dt>来源</dt>
                  <dd>{sourceLabel}</dd>
                </div>
                <div>
                  <dt>转写</dt>
                  <dd>{transcriptCount > 0 ? `${transcriptCount} 句` : '暂无'}</dd>
                </div>
                <div>
                  <dt>总结</dt>
                  <dd>{summaries.length > 0 ? `${summaries.length} 个版本` : '可生成'}</dd>
                </div>
              </dl>
            </section>

            {chatOpen && (
              <div style={{ height: 320, borderTop: '1px solid var(--bdr)', display: 'flex', overflow: 'hidden' }}>
                <NoteChatDrawer
                  workspaceId={workspaceId}
                  systemPrompt={chatSystemPrompt}
                  scopeHint="仅基于当前 note.md 与转录上下文回答"
                  mode="inline"
                />
              </div>
            )}
            {(itemType === 'audio' && note.media?.audio) && (
              <section className="nibi-note-side-card nibi-note-media-card">
                <div className="nibi-note-card-kicker">AUDIO SOURCE</div>
                <NoteMediaCompanion
                  ref={mediaCompanionRef}
                  media={note.media}
                  transcript={Array.isArray(note.transcript) ? note.transcript as never : []}
                  workspaceId={workspaceId}
                  itemId={itemId}
                  sourceUrl={(note.frontmatter as Record<string, unknown>)?.source_url as string || ''}
                />
              </section>
            )}
            {note.source_md && (
              <section className="nibi-note-side-card nibi-note-source-card">
                <SourcePanel sourceMd={note.source_md} open />
              </section>
            )}
          </aside>
        </div>
      )}

      {/* 问 AI 悬浮泡泡（视频/音频/文本笔记） */}
      {(isVideoNote || isAudioNote || isTextNote) && (
        <FloatingAskAi
          workspaceId={workspaceId}
          systemPrompt={chatSystemPrompt}
          scopeHint="仅基于当前 note.md 与转录上下文回答"
          open={askAiOpen}
          onOpenChange={setAskAiOpen}
        />
      )}

      {/* VN4.3 新建/重新生成总结弹窗（从 AI 工具菜单触发） */}
      {showNewSummaryModal && (
        <NewSummaryModal
          creating={creatingSummary}
          onSubmit={handleCreateSummary}
          onClose={() => setShowNewSummaryModal(false)}
        />
      )}
      <SourceMdModal
        open={sourceMdOpen}
        sourceMd={note.source_md}
        onClose={() => setSourceMdOpen(false)}
        onDownload={handleDownloadSourceMd}
      />
    </div>
  )
}
