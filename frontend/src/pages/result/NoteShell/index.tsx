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
 *   - NoteEditor：轻量 CodeMirror 编辑器（不依赖 lnEditorStore）
 *   - SummariesPanel：总结风格面板（可折叠，含应用到主笔记）
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ArrowLeft, ChevronDown, ChevronRight, FileText } from 'lucide-react'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown as cmMarkdown } from '@codemirror/lang-markdown'

import { getItemNote, putItemNote } from '@/services/workspaces'
import type { ItemNote } from '@/types/workspace'
import type { ItemSummary } from '@/services/summaries'
import { Badge } from '@/components/ui/badge'
import { SYSTEM_TAG_DIMENSIONS } from '@/constants/tagDimensions'
import { SummariesTab } from '@/components/SummariesTab'

// remarkGfm 类型与 react-markdown 不完全兼容
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

const VIEW_MODE_KEY = 'nibi-note-view-mode'

type ViewMode = 'read' | 'edit'
type SaveStatus = 'idle' | 'saving' | 'saved' | 'failed'

/** 格式化 HH:mm */
function formatTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/* ────────────────── NoteEditor ────────────────── */

interface NoteEditorProps {
  markdown: string
  onMarkdownChange: (md: string) => void
}

/** 轻量 CodeMirror 编辑器（独立于 ln 的 MdView，不依赖 lnEditorStore）。 */
function NoteEditor({ markdown: md, onMarkdownChange }: NoteEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  // 用 ref 追踪最新回调，避免 EditorView updateListener 闭包捕获旧回调
  const cbRef = useRef(onMarkdownChange)
  cbRef.current = onMarkdownChange

  useEffect(() => {
    if (!hostRef.current) return
    const state = EditorState.create({
      doc: md,
      extensions: [
        lineNumbers(),
        history(),
        cmMarkdown(),
        EditorView.lineWrapping,
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
    return () => { view.destroy(); viewRef.current = null }
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
}

/** source.md 只读区（可折叠）。 */
function SourcePanel({ sourceMd }: SourcePanelProps) {
  const [open, setOpen] = useState(false)

  if (!sourceMd) return null

  return (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <button
        onClick={() => setOpen(!open)}
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
}

/** 总结风格面板（可折叠），内嵌 SummariesTab。 */
function SummariesPanel({ workspaceId, itemId, onApplyToNote }: SummariesPanelProps) {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ borderTop: '1px solid var(--border)', flexShrink: 0 }}>
      <button
        onClick={() => setOpen(!open)}
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

  // R1.3: 视图模式 + 保存状态
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem(VIEW_MODE_KEY)
    return saved === 'edit' ? 'edit' : 'read'
  })
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [savedAt, setSavedAt] = useState<string>('')

  // 编辑中的 body 文本（debounce 源头）
  const [editingBody, setEditingBody] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 标记是否从「应用到主笔记」触发的刷新，避免 debounce 冲突
  const applyingRef = useRef(false)

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
    // 切到编辑态时，同步 editingBody（以防阅读态下 note 被外部更新）
    if (mode === 'edit' && note) {
      setEditingBody(extractBody(note.note_md))
    }
  }, [note])

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
  const body = extractBody(note.note_md)
  const hasTags = tags && Object.keys(tags).length > 0

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

        {/* 视图切换 */}
        <div style={{ display: 'flex', marginLeft: 12, borderRadius: 4, overflow: 'hidden', border: '1px solid var(--border)' }}>
          {(['read', 'edit'] as ViewMode[]).map((m) => (
            <button
              key={m}
              onClick={() => switchView(m)}
              style={{
                padding: '2px 10px', fontSize: 11, border: 'none', cursor: 'pointer',
                background: viewMode === m ? 'var(--ink-1)' : 'transparent',
                color: viewMode === m ? '#fff' : 'var(--ink-3)',
                fontWeight: viewMode === m ? 600 : 400,
              }}
            >
              {m === 'read' ? '阅读' : 'Markdown'}
            </button>
          ))}
        </div>

        {/* 保存状态 */}
        {viewMode === 'edit' && (
          <span style={{ fontSize: 11, color: 'var(--ink-3)', marginLeft: 4 }}>
            {saveStatus === 'saving' && '保存中…'}
            {saveStatus === 'saved' && `已保存 ${savedAt}`}
            {saveStatus === 'failed' && <span style={{ color: 'var(--accent-pink)' }}>保存失败</span>}
          </span>
        )}

        <div style={{ flex: 1 }} />
        <Badge variant="outline" style={{ fontSize: 10 }}>
          <FileText size={10} /> NoteShell
        </Badge>
      </div>

      {/* ════════ 标签概览条（可折叠）════════ */}
      {hasTags && (
        <div style={{ borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
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

      {/* ════════ 正文区（阅读态 / Markdown 编辑态）════════ */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {viewMode === 'read' ? (
          <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-2)' }}>
            <ReactMarkdown remarkPlugins={remarkPlugins}>
              {body}
            </ReactMarkdown>
          </div>
        ) : (
          <NoteEditor markdown={editingBody} onMarkdownChange={handleEditorChange} />
        )}
      </div>

      {/* ════════ 伴随区 ════════ */}
      <div style={{ flexShrink: 0, maxHeight: '40%', overflowY: 'auto' }}>
        {/* 总结风格面板 */}
        <SummariesPanel
          workspaceId={workspaceId}
          itemId={itemId}
          onApplyToNote={handleApplyToNote}
        />
        {/* source.md */}
        <SourcePanel sourceMd={note.source_md} />
      </div>
    </div>
  )
}
