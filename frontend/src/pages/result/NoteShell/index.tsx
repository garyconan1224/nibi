/**
 * NoteShell — R1.3 Markdown 编辑保存 + 总结风格面板
 *
 * 统一笔记壳：读 R0 的 GET …/note 渲染 note.md + 标签概览。
 * R1.3 新增：Markdown 编辑态（CodeMirror + debounce 自动保存）、
 * 总结风格面板（SummariesTab + 应用到主笔记）。
 * 先只接 text 跑通，与旧 TextResultPage 并存（灰度）。
 *
 * 子组件拆分：
 *   - TagChips：frontmatter.tags → 标签 chips 展示
 *   - SourcePanel：source.md 只读区（可折叠）
 *   - NoteEditor：轻量 CodeMirror 编辑器（注册到 lnEditorStore，复用截图插入能力）
 *   - SummariesPanel：总结风格面板（可折叠，含应用到主笔记）
 */
import { cloneElement, isValidElement, useCallback, useEffect, useMemo, useSyncExternalStore, useRef, useState } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ArrowLeft, BookOpenCheck, ChevronDown, ChevronRight, Download, FileCode, FileText, RefreshCw } from 'lucide-react'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, Decoration, ViewPlugin, MatchDecorator, type ViewUpdate } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown as cmMarkdown } from '@codemirror/lang-markdown'
import { toast } from 'sonner'

import { exportItemNoteObsidian, getItemNote, putItemNote } from '@/services/workspaces'
import type { VideoResultTranscriptLine } from '@/services/workspaces'
import type { ItemNote } from '@/types/workspace'
import type { ItemSummary } from '@/services/summaries'
import { TS_RE, parseTs } from '@/pages/results/LearningNotesPage/HtmlView'
import { Badge } from '@/components/ui/badge'
import { SYSTEM_TAG_DIMENSIONS } from '@/constants/tagDimensions'
import NoteMediaCompanion, { type NoteMediaCompanionHandle } from './NoteMediaCompanion'
import MilkdownEditor from './MilkdownEditor'
import LNVideoPanel, { type LNVideoPanelHandle } from '@/pages/results/LearningNotesPage/LNVideoPanel'
import LNTranscriptPanel from '@/pages/results/LearningNotesPage/LNTranscriptPanel'
import '@/pages/results/LearningNotesPage/learning-notes.css'
import { SummariesTab } from '@/components/SummariesTab'
import NoteChatDrawer from '@/components/NoteChatDrawer'
import { SourceMdModal } from './SourceMdModal'
import { FloatingAskAi } from './FloatingAskAi'
import { useLnEditorStore } from '@/store/lnEditorStore'

// remarkGfm 类型与 react-markdown 不完全兼容

/** remark 插件：将被 remark 错误当 text 的 ![alt](url) 修正为 image 节点。 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fixBrokenImagesPlugin = () => (tree: any) => {
  const IMG_RE = /!\[([^\]]*)\]\(([^)]+)\)/g
  for (const node of tree.children || []) {
    if (node.type !== 'paragraph') continue
    const children = node.children || []
    // 只处理纯 text paragraph，把 text 里的 ![alt](url) 拆成 image 节点
    const newChildren: any[] = []
    for (const child of children) {
      if (child.type !== 'text') { newChildren.push(child); continue }
      let lastIdx = 0
      let m: RegExpExecArray | null
      IMG_RE.lastIndex = 0
      while ((m = IMG_RE.exec(child.value))) {
        if (m.index > lastIdx) newChildren.push({ type: 'text', value: child.value.slice(lastIdx, m.index) })
        newChildren.push({ type: 'image', url: m[2], alt: m[1], title: null, children: [{ type: 'text', value: m[1] }] })
        lastIdx = m.index + m[0].length
      }
      if (lastIdx < child.value.length) newChildren.push({ type: 'text', value: child.value.slice(lastIdx) })
    }
    if (newChildren.length) node.children = newChildren
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const remarkPlugins: any[] = [remarkGfm, fixBrokenImagesPlugin]

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

const VIEW_MODE_KEY = 'nibi-note-view-mode'

type ViewMode = 'edit' | 'compare' | 'wysiwyg'
type SaveStatus = 'idle' | 'saving' | 'saved' | 'failed'

/** 格式化 HH:mm */
function formatTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
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

/** 把 ReactMarkdown children 里的 [mm:ss] / [mm:ss~mm:ss] 渲染为可点击跳转 chip。 */
export function renderNoteTimestampChildren(
  children: ReactNode,
  onSeek: (sec: number) => void,
): ReactNode {
  if (typeof children === 'string') {
    return replaceNoteTimestampString(children, onSeek)
  }
  if (Array.isArray(children)) {
    return children.map((child, idx) => (
      <span key={`ts-child-${idx}`}>
        {renderNoteTimestampChildren(child, onSeek)}
      </span>
    ))
  }
  if (isValidElement(children)) {
    if (children.type === 'code' || children.type === 'pre') return children
    const el = children as ReactElement<{ children?: ReactNode }>
    const nextChildren = renderNoteTimestampChildren(el.props.children, onSeek)
    if (nextChildren === el.props.children) return children
    return cloneElement(el, undefined, nextChildren)
  }
  return children
}

function replaceNoteTimestampString(text: string, onSeek: (sec: number) => void): ReactNode {
  const parts: ReactNode[] = []
  let lastIdx = 0
  let match: RegExpExecArray | null

  TS_RE.lastIndex = 0
  while ((match = TS_RE.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(text.slice(lastIdx, match.index))
    }

    const ts = match[1]
    const sec = parseTs(ts)
    const display = match[0]

    parts.push(
      <button
        key={`note-ts-${match.index}`}
        type="button"
        className="ln-ts-chip"
        onClick={(event) => {
          event.preventDefault()
          onSeek(sec)
        }}
        title={match[2] ? `跳转到 ${ts}（区间 ${ts} ~ ${match[2]}）` : `跳转到 ${ts}`}
      >
        {display}
      </button>,
    )
    lastIdx = match.index + match[0].length
  }

  if (lastIdx < text.length) {
    parts.push(text.slice(lastIdx))
  }

  return parts.length > 0 ? parts : text
}

/** useSyncExternalStore 兼容的媒体查询 hook，窄屏降级用 */
function useMediaQuery(query: string): boolean {
  const mql = typeof window !== 'undefined' ? window.matchMedia(query) : null
  return useSyncExternalStore(
    (cb: () => void) => {
      mql?.addEventListener('change', cb)
      return () => { mql?.removeEventListener('change', cb) }
    },
    () => mql?.matches ?? false,
    () => false,
  )
}

/** 视频笔记视图标签：中列只展示「标准总结」，两种格式（蓝图 §3.5）。
 *  富文本 = 渲染态（ReactMarkdown）；md格式 = 源码态（CodeMirror，可编辑）。
 *  源 md（转写+截帧原始内容）在右侧操作区，不是中列标签。 */
const videoViewModeLabels: Record<ViewMode, string> = {
  edit: 'md格式',
  compare: '源md对照',
  wysiwyg: '所见即所得',
}

/* ────────────────── NoteEditor ────────────────── */

/** CodeMirror 时间戳跳转扩展：给裸 [mm:ss] 加 note-ts-chip，点击调 onSeek。 */
function makeTimestampExtension(getOnSeek: () => ((sec: number) => void) | undefined) {
  const matcher = new MatchDecorator({
    regexp: new RegExp(TS_RE.source, 'g'),
    decoration: (m) =>
      Decoration.mark({ class: 'note-ts-chip', attributes: { 'data-sec': String(parseTs(m[1])) } }),
  })
  return ViewPlugin.fromClass(
    class {
      decorations
      constructor(view: EditorView) { this.decorations = matcher.createDeco(view) }
      update(u: ViewUpdate) { this.decorations = matcher.updateDeco(u, this.decorations) }
    },
    {
      decorations: (v) => v.decorations,
      eventHandlers: {
        mousedown(e) {
          const t = e.target as HTMLElement
          if (t?.classList?.contains('note-ts-chip')) {
            const sec = Number(t.getAttribute('data-sec'))
            if (!Number.isNaN(sec)) { getOnSeek()?.(sec); e.preventDefault(); return true }
          }
          return false
        },
      },
    },
  )
}

interface NoteEditorProps {
  markdown: string
  onMarkdownChange: (md: string) => void
  onSeek?: (sec: number) => void
}

/** 轻量 CodeMirror 编辑器（复用 lnEditorStore 让截图按钮插入到当前光标）。 */
function NoteEditor({ markdown: md, onMarkdownChange, onSeek }: NoteEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  // 用 ref 追踪最新回调，避免 EditorView updateListener 闭包捕获旧回调
  const cbRef = useRef(onMarkdownChange)
  cbRef.current = onMarkdownChange
  const seekRef = useRef(onSeek)
  seekRef.current = onSeek

  useEffect(() => {
    if (!hostRef.current) return
    const state = EditorState.create({
      doc: md,
      extensions: [
        lineNumbers(),
        history(),
        cmMarkdown(),
        EditorView.lineWrapping,
        makeTimestampExtension(() => seekRef.current),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) {
            cbRef.current(u.state.doc.toString())
          }
        }),
      ],
    })
    const view = new EditorView({ state, parent: hostRef.current })
    viewRef.current = view
    useLnEditorStore.getState().setCmView(view)
    return () => {
      const store = useLnEditorStore.getState()
      if (store.cmView === view) store.setCmView(null)
      view.destroy()
      viewRef.current = null
    }
    // 只挂载一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 外部 md 变化时同步到 CodeMirror（如「应用到主笔记」后刷新）
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    if (view.state.doc.toString() !== md) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: md },
      })
    }
  }, [md])

  return <div ref={hostRef} className="ln-md-view" />
}

/* ────────────────── CompareView（R2.1 对照视图）────────────────── */

interface CompareViewProps {
  markdown: string
  onMarkdownChange: (md: string) => void
  sourceMd?: string
  onSeek?: (sec: number) => void
}

/** 左 CodeMirror 编辑 + 右 ReactMarkdown 实时预览，各占 50%。右栏可切 source 原文。 */
function CompareView({ markdown, onMarkdownChange, sourceMd, onSeek }: CompareViewProps) {
  const [rightMode, setRightMode] = useState<'preview' | 'source'>('preview')
  const hasSource = !!sourceMd

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0, gap: 1, background: 'var(--line)' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>
        <NoteEditor markdown={markdown} onMarkdownChange={onMarkdownChange} onSeek={onSeek} />
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
        {/* 右栏顶栏：预览 / source 切换 */}
        {hasSource && (
          <div style={{ display: 'flex', gap: 0, padding: '4px 12px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
            {(['preview', 'source'] as const).map((rm) => (
              <button
                key={rm}
                onClick={() => setRightMode(rm)}
                style={{
                  padding: '2px 10px', fontSize: 11, border: 'none', cursor: 'pointer',
                  background: rightMode === rm ? 'var(--accent)' : 'transparent',
                  color: rightMode === rm ? '#fff' : 'var(--ink-2)',
                  borderRadius: 3,
                }}
              >
                {rm === 'preview' ? '预览' : 'source 原文'}
              </button>
            ))}
          </div>
        )}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, fontSize: 14, lineHeight: 1.8, color: 'var(--ink-2)' }}>
          {rightMode === 'preview' || !hasSource ? (
            <ReactMarkdown remarkPlugins={remarkPlugins}>
              {markdown}
            </ReactMarkdown>
          ) : (
            <ReactMarkdown remarkPlugins={remarkPlugins}>
              {sourceMd!}
            </ReactMarkdown>
          )}
        </div>
      </div>
    </div>
  )
}

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
    <div style={{ borderTop: '1px solid var(--line)' }}>
      <button
        onClick={toggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          width: '100%', padding: '10px 20px',
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 13, fontWeight: 600, color: 'var(--ink-2)',
        }}
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        Source（原始依据）
      </button>
      {open && (
        <div style={{ padding: '0 20px 16px', fontSize: 13, lineHeight: 1.7, color: 'var(--ink-3)' }}>
          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>
            {sourceMd}
          </pre>
        </div>
      )}
    </div>
  )
}

/* ────────────────── SummariesPanel ────────────────── */

interface SummariesPanelProps {
  workspaceId: string
  itemId: string
  onApplyToNote: (summary: ItemSummary) => void
  /** 外部受控开关（可选）；不传则内部自管 */
  open?: boolean
  onToggle?: () => void
}

/** 总结风格面板（可折叠），内嵌 SummariesTab。 */
function SummariesPanel({ workspaceId, itemId, onApplyToNote, open: controlledOpen, onToggle }: SummariesPanelProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const toggle = onToggle ?? (() => setInternalOpen((v) => !v))

  return (
    <div style={{ borderTop: '1px solid var(--line)', flexShrink: 0 }}>
      <button
        onClick={toggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          width: '100%', padding: '10px 20px',
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 13, fontWeight: 600, color: 'var(--ink-2)',
        }}
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        总结风格
      </button>
      {open && (
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          <SummariesTab
            workspaceId={workspaceId}
            itemId={itemId}
            onApplyToNote={onApplyToNote}
          />
        </div>
      )}
    </div>
  )
}

/* ────────────────── NoteShell ────────────────── */

export default function NoteShell() {
  const { workspaceId = '', itemId = '' } = useParams<{
    workspaceId: string
    itemId: string
  }>()
  const navigate = useNavigate()

  const [note, setNote] = useState<ItemNote | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tagsOpen, setTagsOpen] = useState(true)
  const [chatOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)

  // R1.3 + R2.1: 视图模式 + 保存状态（兼容三值 + 窄屏降级 compare → wysiwyg）
  const isWide = useMediaQuery('(min-width: 1024px)')
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem(VIEW_MODE_KEY)
    // 旧版 'read' 回退到 wysiwyg（阶段三移除富文本只读模式）
    if (saved === 'read') return 'wysiwyg'
    const valid = saved === 'edit' || saved === 'compare' || saved === 'wysiwyg'
    if (saved === 'compare' && !window.matchMedia('(min-width: 1024px)').matches) return 'wysiwyg'
    return valid ? (saved as ViewMode) : 'wysiwyg'
  })
  // R2.1 窄屏运行时降级：已在对照态时缩窗到 <1024px → 自动切回所见即所得
  useEffect(() => {
    if (!isWide && viewMode === 'compare') {
      setViewMode('wysiwyg')
      localStorage.setItem(VIEW_MODE_KEY, 'wysiwyg')
    }
  }, [isWide, viewMode])
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
  const [currentTime, setCurrentTime] = useState(0)
  const [summariesOpen, setSummariesOpen] = useState(false)
  const [sourceModalOpen, setSourceModalOpen] = useState(false)
  const [activeSummaryId, setActiveSummaryId] = useState<string | undefined>(undefined)
  const handleTimeUpdate = useCallback((t: number) => setCurrentTime(t), [])
  const handleSeek = useCallback((sec: number) => {
    videoRef.current?.seekTo(sec)
    mediaCompanionRef.current?.seekTo(sec)
  }, [])

  const fetchNote = useCallback(async () => {
    setLoading(true)
    setError(null)
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

  // 视频笔记默认富文本（read），加载时强制归位
  const videoDefaultedRef = useRef(false)
  useEffect(() => {
    if (!note || videoDefaultedRef.current) return
    const fmType = String(((note.frontmatter ?? {}) as Record<string, unknown>).type ?? '')
    const isVid = fmType === 'video' && !!note.media?.video?.url
    if (isVid) {
      videoDefaultedRef.current = true
      setViewMode('wysiwyg')
      localStorage.setItem(VIEW_MODE_KEY, 'wysiwyg')
    }
  }, [note])

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
  const switchView = useCallback((mode: ViewMode) => {
    setViewMode(mode)
    localStorage.setItem(VIEW_MODE_KEY, mode)
    // 切换模式时同步 editingBody（以防内容被外部更新）
    if (note) {
      setEditingBody(extractBody(note.note_md))
    }
  }, [note])

  const currentBody = editingBody
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

  // ─── loading / error ───
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--ink-3)' }}>
        加载中…
      </div>
    )
  }
  if (error || !note) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', gap: 12 }}>
        <span style={{ color: 'var(--accent-pink)', fontWeight: 600 }}>
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
  const itemType = String(fm.type ?? 'text')
  const tags = (fm.tags ?? {}) as Record<string, unknown>
  const hasTags = tags && Object.keys(tags).length > 0

  // 7.3: 视频笔记三列布局标志
  const isVideoNote = itemType === 'video' && !!note.media?.video?.url

  // ── 提取正文 JSX（视频 / 非视频布局复用）──
  const noteContent = (
    <div style={{
      flex: 1, minWidth: 0,
      padding: viewMode === 'compare' ? 0 : '20px 24px',
      overflowY: viewMode === 'compare' ? 'hidden' : 'auto',
      // compare 模式需要 100% 高度让 CompareView 能正确 flex 撑满
      height: viewMode === 'compare' ? '100%' : undefined,
    }}>
      {viewMode === 'compare' ? (
        <CompareView markdown={editingBody} onMarkdownChange={handleEditorChange} sourceMd={note.source_md} onSeek={handleSeek} />
      ) : viewMode === 'wysiwyg' ? (
        <MilkdownEditor key={milkdownKey} markdown={editingBody} onMarkdownChange={handleEditorChange} onSeek={handleSeek} />
      ) : (
        <NoteEditor markdown={editingBody} onMarkdownChange={handleEditorChange} onSeek={handleSeek} />
      )}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* ════════ 顶栏 ════════ */}
      <div className="vd-nav" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 20px', flexShrink: 0 }}>
        <button className="btn-ghost" onClick={() => navigate(-1)} style={{ height: 28, padding: '0 10px', fontSize: 12 }}>
          <ArrowLeft size={13} /> 返回
        </button>
        <span className="vd-sep" />
        <span className="vd-title" style={{ fontWeight: 600 }}>{title}</span>
        <span className="kw mono" style={{ fontSize: 10, flexShrink: 0 }}>
          {TYPE_LABEL[itemType] ?? itemType.toUpperCase()}
        </span>

        <div style={{ flex: 1 }} />

        {/* 导出（所有类型都在顶栏右上角） */}
        <div style={{ position: 'relative' }}>
          <button
            className="btn-ghost"
            onClick={() => setExportOpen((open) => !open)}
            style={{ height: 28, padding: '0 10px', fontSize: 12 }}
            title="导出当前笔记"
          >
            <Download size={13} /> 导出
          </button>
          {exportOpen && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: 34,
                zIndex: 20,
                minWidth: 160,
                padding: '4px',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg)',
                boxShadow: 'var(--shadow-md)',
              }}
            >
              <button
                className="btn-ghost"
                onClick={handleExportMarkdown}
                style={{ width: '100%', justifyContent: 'flex-start', height: 30, padding: '0 10px', fontSize: 12 }}
              >
                <FileText size={13} /> Markdown
              </button>
              <button
                className="btn-ghost"
                onClick={() => void handleExportObsidian()}
                style={{ width: '100%', justifyContent: 'flex-start', height: 30, padding: '0 10px', fontSize: 12 }}
              >
                <BookOpenCheck size={13} /> Obsidian 包
              </button>
            </div>
          )}
        </div>
        <Badge variant="outline" style={{ fontSize: 10 }}>
          <FileText size={10} /> NoteShell
        </Badge>
      </div>

      {/* ════════ 标签概览条（可折叠）════════ */}
      {hasTags && (
        <div style={{ borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
          <button
            onClick={() => setTagsOpen(!tagsOpen)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              width: '100%', padding: '8px 20px',
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, color: 'var(--ink-3)',
            }}
          >
            {tagsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            标签概览
          </button>
          {tagsOpen && (
            <div style={{ padding: '0 20px 10px' }}>
              <TagChips tags={tags} />
            </div>
          )}
        </div>
      )}

      {/* ════════ R3.1: image 类型 — 正文上方显示原图 ════════ */}
      {itemType === 'image' && note.media?.images?.[0] && (
        <div style={{ padding: '0 24px', flexShrink: 0, maxHeight: '40%', overflow: 'auto', borderBottom: '1px solid var(--line)' }}>
          <img
            src={note.media.images[0]}
            alt={title || '原图'}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block', margin: '12px auto', borderRadius: 6 }}
          />
        </div>
      )}

      {/* ════════ 主内容区（视频笔记 = 三列布局，其余 = 通用布局）════════ */}
      {isVideoNote ? (
        /* ── 视频笔记三列布局（蓝图 §3.5）：左播放器+字幕 / 中正文 / 右操作 ── */
        <div style={{ flex: 1, overflow: 'hidden', minHeight: 0, display: 'flex', position: 'relative' }}>

          {/* ── 左列：视频播放器 + 实时字幕 ── */}
          <div className="vm-ln-scope" style={{
            width: '30%', minWidth: 260, maxWidth: 420, flexShrink: 0,
            display: 'flex', flexDirection: 'column',
            borderRight: '1px solid var(--line)',
            overflow: 'hidden',
            background: 'var(--bg-sunken)',
          }}>
            <div style={{ flex: '0 0 auto', maxHeight: '55%', overflow: 'hidden' }}>
              <LNVideoPanel
                ref={videoRef}
                src={note.media!.video?.url?.startsWith('/static/') ? note.media!.video!.url : ''}
                externalUrl={!note.media!.video?.url?.startsWith('/static/') ? ((note.frontmatter as Record<string, unknown>)?.source_url as string || note.media!.video?.url) : undefined}
                title=""
                workspaceId={workspaceId}
                onTimeUpdate={handleTimeUpdate}
              />
            </div>
            {/* 字幕区 — 独立挂载，不受中列 re-render 影响 */}
            {Array.isArray(note.transcript) && (note.transcript as VideoResultTranscriptLine[]).length > 0 ? (
              <div style={{ flex: 1, overflowY: 'auto', borderTop: '1px solid var(--line)' }}>
                <LNTranscriptPanel
                  transcript={note.transcript as VideoResultTranscriptLine[]}
                  currentTime={currentTime}
                  onSeek={handleSeek}
                  workspaceId={workspaceId}
                  itemId={itemId}
                  onSaved={refreshAfterTranscriptEdit}
                />
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-4)', fontSize: 12, borderTop: '1px solid var(--line)' }}>
                暂无字幕
              </div>
            )}
          </div>

          {/* ── 中列：视图切换 tab + 正文（富文本/md格式）+ TOC ── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
            {/* 视图切换 tab（点1：移到中列内容正上方） */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '0 24px', flexShrink: 0, borderBottom: '1px solid var(--line)', height: 36 }}>
              {(['wysiwyg', 'edit'] as ViewMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => switchView(m)}
                  style={{
                    padding: '6px 16px', fontSize: 12, border: 'none', cursor: 'pointer', background: 'transparent',
                    color: viewMode === m ? 'var(--accent-2)' : 'var(--ink-4)',
                    fontWeight: viewMode === m ? 600 : 400,
                    borderBottom: viewMode === m ? '2px solid var(--accent-2)' : '2px solid transparent',
                    transition: 'color .15s, border-color .15s',
                  }}
                >
                  {videoViewModeLabels[m]}
                </button>
              ))}
              {/* 保存状态（编辑态 + 所见即所得态才显示） */}
              {(viewMode === 'edit' || viewMode === 'wysiwyg') && (
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-4)' }}>
                  {saveStatus === 'saving' && '保存中…'}
                  {saveStatus === 'saved' && `已保存 ${savedAt}`}
                  {saveStatus === 'failed' && <span style={{ color: 'var(--accent)' }}>保存失败</span>}
                </span>
              )}
            </div>
            {/* 正文 */}
            <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden', minHeight: 0 }}>
              {noteContent}
            </div>
          </div>

          {/* ── 右列：操作区（瘦身后只剩 源md悬浮触发 + 换总结）── */}
          <div style={{
            width: 220, flexShrink: 0,
            borderLeft: '1px solid var(--line)',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
            background: 'var(--bg-elev)',
          }}>
            {/* 操作区顶部标题栏 */}
            <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent-2)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--mono)' }}>操作区</span>
            </div>

            {/* 可滚动内容区 */}
            <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column' }}>

              {/* 源 md → 点击弹悬浮框（点4） */}
              <button
                className="btn-ghost"
                onClick={() => note.source_md && setSourceModalOpen(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', justifyContent: 'flex-start', height: 36, padding: '0 14px', fontSize: 12, borderRadius: 0, borderBottom: '1px solid var(--line)', flexShrink: 0 }}
              >
                <FileCode size={13} /> 源 md
              </button>

              {/* 换总结 */}
              <button
                className="btn-ghost"
                onClick={() => setSummariesOpen((v) => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', justifyContent: 'flex-start', height: 36, padding: '0 14px', fontSize: 12, borderRadius: 0, borderBottom: '1px solid var(--line)', flexShrink: 0, color: summariesOpen ? 'var(--accent-2)' : undefined }}
              >
                <RefreshCw size={13} /> 换总结
              </button>
              {summariesOpen && (
                <div style={{ borderBottom: '1px solid var(--line)', maxHeight: 300, overflowY: 'auto' }}>
                  <SummariesTab
                    workspaceId={workspaceId}
                    itemId={itemId}
                    onApplyToNote={handleApplyToNote}
                    activeSummaryId={activeSummaryId}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ── 通用布局（文字/图片/音频）：左正文 + 右伴随 ── */
        <>
          <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden', minHeight: 0 }}>
            {noteContent}
          </div>
          <div style={{ flexShrink: 0, maxHeight: '40%', overflowY: 'auto' }}>
            {chatOpen && (
              <div style={{ height: 320, borderTop: '1px solid var(--line)', display: 'flex', overflow: 'hidden' }}>
                <NoteChatDrawer
                  workspaceId={workspaceId}
                  systemPrompt={chatSystemPrompt}
                  scopeHint="仅基于当前 note.md 与转录上下文回答"
                  mode="inline"
                />
              </div>
            )}
            {(itemType === 'audio' && note.media?.audio) && (
              <NoteMediaCompanion
                ref={mediaCompanionRef}
                media={note.media}
                transcript={Array.isArray(note.transcript) ? note.transcript as never : []}
                workspaceId={workspaceId}
                itemId={itemId}
                sourceUrl={(note.frontmatter as Record<string, unknown>)?.source_url as string || ''}
              />
            )}
            <SummariesPanel
              workspaceId={workspaceId}
              itemId={itemId}
              onApplyToNote={handleApplyToNote}
            />
            <SourcePanel sourceMd={note.source_md} />
          </div>
        </>
      )}

      {/* 问 AI 悬浮泡泡（点6：仅视频笔记，仿 FloatingTaskQueue） */}
      {isVideoNote && (
        <FloatingAskAi
          workspaceId={workspaceId}
          systemPrompt={chatSystemPrompt}
          scopeHint="仅基于当前 note.md 与转录上下文回答"
        />
      )}

      {/* 源 md 悬浮框（点4：仿 TranscriptPreviewModal） */}
      <SourceMdModal
        open={sourceModalOpen}
        sourceMd={note.source_md ?? ''}
        onClose={() => setSourceModalOpen(false)}
      />
    </div>
  )
}
