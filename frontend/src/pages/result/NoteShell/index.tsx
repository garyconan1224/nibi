/**
 * NoteShell — R1.2 壳骨架 + 路由 + 读渲染 + 概览条
 *
 * 统一笔记壳：读 R0 的 GET …/note 渲染 note.md + 标签概览。
 * 先只接 text 跑通，与旧 TextResultPage 并存（灰度）。
 *
 * 子组件拆分：
 *   - TagChips：frontmatter.tags → 标签 chips 展示
 *   - SourcePanel：source.md 只读区（可折叠）
 */
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ArrowLeft, ChevronDown, ChevronRight, FileText } from 'lucide-react'

import { getItemNote } from '@/services/workspaces'
import type { ItemNote } from '@/types/workspace'
import { Badge } from '@/components/ui/badge'
import { SYSTEM_TAG_DIMENSIONS } from '@/constants/tagDimensions'

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

  const fetchNote = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getItemNote(workspaceId, itemId)
      setNote(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '加载笔记失败')
    } finally {
      setLoading(false)
    }
  }, [workspaceId, itemId])

  useEffect(() => { fetchNote() }, [fetchNote])

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

      {/* ════════ 正文区（阅读态）════════ */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-2)' }}>
          <ReactMarkdown remarkPlugins={remarkPlugins}>
            {body}
          </ReactMarkdown>
        </div>
      </div>

      {/* ════════ 伴随区：source.md ════════ */}
      <div style={{ flexShrink: 0, maxHeight: '35%', overflowY: 'auto' }}>
        <SourcePanel sourceMd={note.source_md} />
      </div>
    </div>
  )
}
