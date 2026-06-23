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
import { cloneElement, isValidElement, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, BookOpenCheck, Brain, Check, ChevronDown, ChevronRight, Download, FileCode, FileDown, FileText, FileType, Image, List, Network, Pencil, Presentation, RefreshCw, Sparkles, Subtitles, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { downloadSubtitles, exportItemNoteObsidian, getItemNote, putItemNote } from '@/services/workspaces'
import type { VideoResultTranscriptLine } from '@/services/workspaces'
import type { ItemNote } from '@/types/workspace'
import { createSummary, deleteSummary, listSummaries, renameSummary, type ItemSummary } from '@/services/summaries'
import { TS_RE, parseTs } from '@/pages/results/LearningNotesPage/HtmlView'
import { Badge } from '@/components/ui/badge'
import { SYSTEM_TAG_DIMENSIONS } from '@/constants/tagDimensions'
import NoteMediaCompanion, { type NoteMediaCompanionHandle } from './NoteMediaCompanion'
import MilkdownEditor from './MilkdownEditor'
import LNVideoPanel, { type LNVideoPanelHandle } from '@/pages/results/LearningNotesPage/LNVideoPanel'
import LNTranscriptPanel from '@/pages/results/LearningNotesPage/LNTranscriptPanel'
import '@/pages/results/LearningNotesPage/learning-notes.css'
import { NewSummaryModal } from '@/components/NewSummaryModal'
import NoteChatDrawer from '@/components/NoteChatDrawer'
import { SourceMdModal } from './SourceMdModal'
import { FloatingAskAi } from './FloatingAskAi'

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

// 从 source_url 域名派生视频平台显示名。
export function platformLabelFromUrl(url: string): string {
  const host = url.replace(/^https?:\/\//, '').split('/')[0].toLowerCase()
  if (host.includes('bilibili')) return 'Bilibili'
  if (host.includes('youtube') || host.includes('youtu.be')) return 'YouTube'
  if (host.includes('douyin')) return '抖音'
  if (host.includes('xiaohongshu') || host.includes('xhslink')) return '小红书'
  return '网页'
}

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
  const [exportOpen, setExportOpen] = useState(false)
  // VN4.3 AI 工具下拉
  const [aiToolsOpen, setAiToolsOpen] = useState(false)
  const aiToolsDropRef = useRef<HTMLDivElement>(null)
  // 新建总结（复用 NewSummaryModal）
  const [showNewSummaryModal, setShowNewSummaryModal] = useState(false)
  const [creatingSummary, setCreatingSummary] = useState(false)

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
  const [sourceModalOpen, setSourceModalOpen] = useState(false)
  const [activeSummaryId, setActiveSummaryId] = useState<string | undefined>(undefined)
  // VN4.1 版本下拉 + 风格/版本两层
  const [summaries, setSummaries] = useState<ItemSummary[]>([])
  const [summariesVersion, setSummariesVersion] = useState(0)
  const [versionDropOpen, setVersionDropOpen] = useState(false)
  const versionDropRef = useRef<HTMLDivElement>(null)
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

  // 点击外部关闭版本下拉
  useEffect(() => {
    if (!versionDropOpen) return
    const handle = (e: MouseEvent) => {
      if (versionDropRef.current && !versionDropRef.current.contains(e.target as Node)) {
        setVersionDropOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [versionDropOpen])

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

  // 图文笔记：图片索引 + 加载错误
  const [selectedImageIdx, setSelectedImageIdx] = useState(0)
  const [imageLoadError, setImageLoadError] = useState<Record<number, boolean>>({})
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

  const handleExportTranscript = useCallback(async () => {
    try {
      await downloadSubtitles(workspaceId, itemId, 'srt', true)
      setExportOpen(false)
    } catch (err) {
      console.error('原文对照导出失败:', err)
      toast.error('原文对照导出失败，请重试')
    }
  }, [workspaceId, itemId])

  // VN4.3 新建总结（从 AI 工具菜单触发，复用 NewSummaryModal）
  const handleCreateSummary = useCallback(async (opts: {
    template: string; background: string; providerId: string; model: string; searchWeb: boolean
  }) => {
    setShowNewSummaryModal(false)
    setCreatingSummary(true)
    try {
      const s = await createSummary(workspaceId, itemId, opts.template, opts.background, {
        provider_id: opts.providerId,
        model: opts.model,
        search_web: opts.searchWeb,
      })
      toast.success(`v${s.version} 总结生成完成`)
      refreshSummaries()
    } catch (err: unknown) {
      const axiosData = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      if (axiosData && axiosData.includes('chat model')) {
        toast.error('请先在设置中配置 LLM 模型', {
          action: { label: '去设置', onClick: () => navigate('/settings/models') },
        })
      } else {
        const msg = err instanceof Error ? err.message : '生成失败'
        toast.error(msg)
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
  const sourceUrl = String(fm.source_url ?? '') || undefined
  const itemType = String(fm.type ?? 'text')
  const tags = (fm.tags ?? {}) as Record<string, unknown>
  const hasTags = tags && Object.keys(tags).length > 0

  // 7.3: 视频笔记三列布局标志
  const isVideoNote = itemType === 'video' && !!note.media?.video?.url
  // 图文笔记三列布局标志
  const isImageNote = itemType === 'image' && (note.media?.images?.length ?? 0) > 0
  const images = note.media?.images ?? []
  const imageInfos = note.media?.image_infos ?? []
  const currentInfo = imageInfos[selectedImageIdx]

  // ── 提取正文 JSX（视频 / 非视频布局复用）──
  const noteContent = (
    <div style={{
      flex: 1, minWidth: 0,
      padding: '20px 24px',
      overflowY: 'auto',
    }}>
      <MilkdownEditor key={milkdownKey} markdown={editingBody} onMarkdownChange={handleEditorChange} onSeek={handleSeek} />
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
        <span className="kw mono" style={{ fontSize: 10, flexShrink: 0 }}>
          {TYPE_LABEL[itemType] ?? itemType.toUpperCase()}
        </span>

        <div style={{ flex: 1 }} />

        {/* ── 总结风格▾ + 版本▾ 两层联动下拉 ── */}
        {summaries.length > 0 && (() => {
          const TEMPLATE_LABELS: Record<string, string> = {
            concise: '简洁摘要', detailed: '详细要点', quotes: '金句提取',
            meeting: '会议纪要', xhs: '小红书风格', longform: '公众号长文',
            lecture: '教学笔记', interview: '访谈整理', shownotes: '播客 shownotes',
            oral: '口播稿', steps: '步骤教程', outline: '大纲',
            qa: '问答卡(Anki)', actions: '行动清单', tool_recommendation: '工具推荐',
            science_popularization: '知识科普', standard: '标准总结',
          }
          const tl = (id: string) => TEMPLATE_LABELS[id] ?? id
          const currentVersions = templateGroups.get(activeTemplate) ?? []
          const activeS = summaries.find(x => x.summary_id === activeSummaryId)

          return (
            <>
              {/* 总结风格▾ */}
              <div ref={templateDropRef} style={{ position: 'relative' }}>
                <button
                  className="btn-ghost"
                  onClick={() => { setTemplateDropOpen((v) => !v); setVersionDropOpen(false) }}
                  style={{ height: 28, padding: '0 10px', fontSize: 12, color: 'var(--accent-2)' }}
                  title="切换总结风格"
                >
                  <List size={13} /> {tl(activeTemplate)}
                  <ChevronDown size={11} style={{ marginLeft: 2 }} />
                </button>
                {templateDropOpen && (
                  <div style={{
                    position: 'absolute', left: 0, top: 34, zIndex: 20,
                    minWidth: 180, maxHeight: 300, overflowY: 'auto',
                    padding: '4px',
                    border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg)', boxShadow: 'var(--shadow-md)',
                  }}>
                    {[...templateGroups.keys()].map((tmpl) => (
                      <button
                        key={tmpl}
                        className="btn-ghost"
                        onClick={() => {
                          const first = templateGroups.get(tmpl)?.[0]
                          if (first) handleApplyToNote(first)
                          setTemplateDropOpen(false)
                        }}
                        style={{
                          width: '100%', justifyContent: 'space-between', height: 30,
                          padding: '0 10px', fontSize: 12,
                          color: tmpl === activeTemplate ? 'var(--accent-2)' : undefined,
                          fontWeight: tmpl === activeTemplate ? 600 : undefined,
                        }}
                      >
                        <span>{tl(tmpl)}</span>
                        <span style={{ color: 'var(--ink-4)', fontSize: 10 }}>({(templateGroups.get(tmpl) ?? []).length})</span>
                      </button>
                    ))}
                    <div style={{ height: 1, background: 'var(--line)', margin: '4px 0' }} />
                    <button
                      className="btn-ghost"
                      onClick={() => { setShowNewSummaryModal(true); setTemplateDropOpen(false) }}
                      style={{ width: '100%', justifyContent: 'flex-start', height: 30, padding: '0 10px', fontSize: 12 }}
                    >
                      + 新建风格
                    </button>
                  </div>
                )}
              </div>

              {/* 版本▾ */}
              <div ref={versionDropRef} style={{ position: 'relative' }}>
                <button
                  className="btn-ghost"
                  onClick={() => { setVersionDropOpen((v) => !v); setTemplateDropOpen(false) }}
                  style={{
                    height: 28, padding: '0 10px', fontSize: 12,
                    color: activeSummaryId ? 'var(--accent-2)' : undefined,
                  }}
                  title="切换版本"
                >
                  <RefreshCw size={13} /> {activeS ? (activeS.name || `v${activeS.version}`) : '版本'}
                  <ChevronDown size={11} style={{ marginLeft: 2 }} />
                </button>
                {versionDropOpen && (
                  <div style={{
                    position: 'absolute', right: 0, top: 34, zIndex: 20,
                    minWidth: 220, maxHeight: 320, overflowY: 'auto',
                    padding: '4px',
                    border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg)', boxShadow: 'var(--shadow-md)',
                  }}>
                    {currentVersions.map((s) => {
                      const isActive = s.summary_id === activeSummaryId
                      const isRenaming = renameTargetId === s.summary_id
                      return (
                        <div key={s.summary_id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {isRenaming ? (
                            <input
                              autoFocus
                              value={renameName}
                              onChange={(e) => setRenameName(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') { setRenameTargetId(null); setRenameName('') } }}
                              onBlur={commitRename}
                              style={{ flex: 1, height: 30, padding: '0 8px', fontSize: 12, border: '1px solid var(--accent-2)', borderRadius: 4, background: 'var(--bg)', outline: 'none' }}
                            />
                          ) : (
                            <button
                              className="btn-ghost"
                              onClick={() => { handleApplyToNote(s); setVersionDropOpen(false) }}
                              style={{
                                flex: 1, justifyContent: 'flex-start', height: 30,
                                padding: '0 8px', fontSize: 12,
                                color: isActive ? 'var(--accent-2)' : undefined,
                                fontWeight: isActive ? 600 : undefined,
                              }}
                            >
                              {isActive && <Check size={12} style={{ marginRight: 4, flexShrink: 0 }} />}
                              {s.name || `v${s.version}`}
                            </button>
                          )}
                          {!isRenaming && (
                            <>
                              <button
                                className="btn-ghost"
                                title="改名"
                                onClick={(e) => { e.stopPropagation(); setRenameTargetId(s.summary_id); setRenameName(s.name || '') }}
                                style={{ padding: 4, height: 24, width: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                              >
                                <Pencil size={11} />
                              </button>
                              <button
                                className="btn-ghost"
                                title="删除"
                                onClick={(e) => { e.stopPropagation(); handleDeleteSummary(s.summary_id) }}
                                style={{ padding: 4, height: 24, width: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--ink-4)' }}
                              >
                                <Trash2 size={11} />
                              </button>
                            </>
                          )}
                        </div>
                      )
                    })}
                    <div style={{ height: 1, background: 'var(--line)', margin: '4px 0' }} />
                    <button
                      className="btn-ghost"
                      onClick={() => { setShowNewSummaryModal(true); setVersionDropOpen(false) }}
                      style={{ width: '100%', justifyContent: 'flex-start', height: 30, padding: '0 10px', fontSize: 12 }}
                    >
                      + 新建版本
                    </button>
                  </div>
                )}
              </div>
            </>
          )
        })()}

        {/* 空态：尚无总结时的入口按钮 */}
        {summaries.length === 0 && (
          <button
            className="btn-ghost"
            onClick={() => setShowNewSummaryModal(true)}
            style={{ height: 28, padding: '0 10px', fontSize: 12 }}
            title="新建总结"
          >
            <RefreshCw size={13} /> 新建总结
          </button>
        )}

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
              {isVideoNote && (
                <button
                  className="btn-ghost"
                  onClick={() => void handleExportTranscript()}
                  style={{ width: '100%', justifyContent: 'flex-start', height: 30, padding: '0 10px', fontSize: 12 }}
                >
                  <Subtitles size={13} /> 原文对照（txt）
                </button>
              )}
              {/* ── 占位导出项（灰显 disabled） ── */}
              {[
                { icon: <FileDown size={13} />, label: 'PDF' },
                { icon: <FileType size={13} />, label: 'Word' },
                { icon: <Image size={13} />, label: '长图' },
                { icon: <Presentation size={13} />, label: 'PPT' },
                { icon: <Sparkles size={13} />, label: '沉浸式笔记' },
              ].map((item) => (
                <button
                  key={item.label}
                  disabled
                  title="敬请期待"
                  style={{
                    width: '100%', justifyContent: 'flex-start', height: 30, padding: '0 10px', fontSize: 12,
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: 'none', border: 'none', cursor: 'not-allowed',
                    color: 'var(--ink-3)', opacity: 0.45,
                  }}
                >
                  {item.icon} {item.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* VN4.3 AI 工具（视频+图文共用） */}
        <div ref={aiToolsDropRef} style={{ position: 'relative' }}>
          <button
            className="btn-ghost"
            onClick={() => setAiToolsOpen((v) => !v)}
            style={{ height: 28, padding: '0 10px', fontSize: 12 }}
            title="AI 工具"
          >
            <Brain size={13} /> AI 工具
            <ChevronDown size={11} style={{ marginLeft: 2 }} />
          </button>
          {aiToolsOpen && (
            <div
              style={{
                position: 'absolute', right: 0, top: 34, zIndex: 20,
                minWidth: 160, padding: '4px',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg)',
                boxShadow: 'var(--shadow-md)',
              }}
            >
              {/* ── 占位项（灰显 disabled） ── */}
              {[
                { icon: <Network size={13} />, label: '思维导图' },
                { icon: <Image size={13} />, label: '总结海报' },
              ].map((item) => (
                <button
                  key={item.label}
                  disabled
                  title="敬请期待"
                  style={{
                    width: '100%', justifyContent: 'flex-start', height: 30, padding: '0 10px', fontSize: 12,
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: 'none', border: 'none', cursor: 'not-allowed',
                    color: 'var(--ink-3)', opacity: 0.45,
                  }}
                >
                  {item.icon} {item.label}
                </button>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* ════════ 标签概览（所有笔记类型通用）════════ */}
      {hasTags && (
        <div style={{ padding: '4px 20px 2px', flexShrink: 0 }}>
          <TagChips tags={tags} />
        </div>
      )}

      {/* ════════ 主内容区（视频笔记 = 三列 / 图文笔记 = 三列 / 其余 = 通用布局）════════ */}
      {isVideoNote ? (
        /* ── 视频笔记 banner + 三列布局 ── */
        <>
          {/* ── 视频 banner：标题 + 平台 + 原视频链接 + 标签 ── */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
            padding: '6px 20px',
            borderBottom: '1px solid var(--line)',
            background: 'var(--bg-sunken)',
            flexShrink: 0,
          }}>
            <span style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {title}
            </span>
            {sourceUrl && (
              <span className="kw mono" style={{ fontSize: 10, flexShrink: 0 }}>
                {platformLabelFromUrl(sourceUrl)}
              </span>
            )}
            <div style={{ flex: 1 }} />
            {sourceUrl && (
              <a
                className="btn-ghost"
                href={sourceUrl}
                target="_blank"
                rel="noreferrer"
                style={{ height: 26, padding: '0 10px', fontSize: 12, flexShrink: 0 }}
              >
                原视频 ↗
              </a>
            )}
          </div>

        {/* ── 视频笔记三列布局（蓝图 §3.5）：左播放器+字幕 / 中正文 / 右操作 ── */}
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
                  sourceMd={note.source_md ?? undefined}
                />
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-4)', fontSize: 12, borderTop: '1px solid var(--line)' }}>
                暂无字幕
              </div>
            )}
          </div>

          {/* ── 中列：正文（视频无 tab 切换）+ TOC ── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
            {/* 保存状态（顶栏右侧） */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '0 24px', flexShrink: 0, borderBottom: '1px solid var(--line)', height: 36 }}>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-4)' }}>
                {saveStatus === 'saving' && '保存中…'}
                {saveStatus === 'saved' && `已保存 ${savedAt}`}
                {saveStatus === 'failed' && <span style={{ color: 'var(--accent)' }}>保存失败</span>}
              </span>
            </div>
            {/* 正文 */}
            <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden', minHeight: 0 }}>
              {noteContent}
            </div>
          </div>
        </div>
        </>
      ) : isImageNote ? (
        /* ── 图文笔记三列布局：左图片浏览 / 中正文 / 右操作区 ── */
        (() => {
          return (
            <div style={{ flex: 1, overflow: 'hidden', minHeight: 0, display: 'flex', position: 'relative' }}>

              {/* ── 左列：图片浏览区 ── */}
              <div style={{
                width: '25%', minWidth: 200, maxWidth: 380, flexShrink: 0,
                display: 'flex', flexDirection: 'column',
                borderRight: '1px solid var(--line)',
                overflow: 'hidden', background: 'var(--bg-sunken)',
              }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 12, minHeight: 0 }}>
                  {/* 大图预览 */}
                  <div style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'var(--bg)', borderRadius: 8, overflow: 'hidden', minHeight: 0,
                  }}>
                    {imageLoadError[selectedImageIdx] ? (
                      <span style={{ color: 'var(--ink-4)', fontSize: 12 }}>图片加载失败</span>
                    ) : (
                      <img
                        src={images[selectedImageIdx]}
                        alt={title ? `${title}（${selectedImageIdx + 1}）` : `图片 ${selectedImageIdx + 1}`}
                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                        onError={() => setImageLoadError((prev) => ({ ...prev, [selectedImageIdx]: true }))}
                      />
                    )}
                  </div>
                  {/* 缩略图列表 */}
                  {images.length > 1 && (
                    <div style={{
                      display: 'flex', gap: 4, overflowX: 'auto', paddingTop: 8, flexShrink: 0,
                    }}>
                      {images.map((img, idx) => (
                        <button
                          key={idx}
                          onClick={() => setSelectedImageIdx(idx)}
                          style={{
                            flexShrink: 0, width: 44, height: 44, padding: 0, border: 'none', borderRadius: 4,
                            overflow: 'hidden', cursor: 'pointer', opacity: idx === selectedImageIdx ? 1 : 0.5,
                            outline: idx === selectedImageIdx ? '2px solid var(--accent-2)' : 'none',
                          }}
                        >
                          <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </button>
                      ))}
                    </div>
                  )}
                  {images.length > 1 && (
                    <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--ink-4)', marginTop: 4 }}>
                      {selectedImageIdx + 1} / {images.length}
                    </div>
                  )}
                  {/* 源 md 入口（移自右列操作区） */}
                  {note.source_md && (
                    <button
                      className="btn-ghost"
                      onClick={() => setSourceModalOpen(true)}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', height: 28, fontSize: 11, marginTop: 6, flexShrink: 0 }}
                    >
                      <FileCode size={12} /> 源 md
                    </button>
                  )}
                </div>
              </div>

              {/* ── 中列：正文（图文/视频统一，无 tab 切换）+ TOC ── */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', padding: '0 24px', flexShrink: 0, borderBottom: '1px solid var(--line)', height: 36 }}>
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-4)' }}>
                    {saveStatus === 'saving' && '保存中…'}
                    {saveStatus === 'saved' && `已保存 ${savedAt}`}
                    {saveStatus === 'failed' && <span style={{ color: 'var(--accent)' }}>保存失败</span>}
                  </span>
                </div>
                <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden', minHeight: 0 }}>
                  {noteContent}
                </div>
              </div>

              {/* ── 右列：操作区（图文笔记） ── */}
              <div style={{
                width: 280, flexShrink: 0,
                borderLeft: '1px solid var(--line)',
                display: 'flex', flexDirection: 'column',
                overflow: 'hidden', background: 'var(--bg-elev)',
              }}>
                <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent-2)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--mono)' }}>
                    操作区
                  </span>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', padding: '12px 14px', gap: 8 }}>

                  {/* OCR 识别文本（默认折叠，仅当非空时显示） */}
                  {currentInfo?.ocr_text && (
                    <details style={{ marginTop: 4 }}>
                      <summary style={{ fontSize: 11, color: 'var(--ink-4)', cursor: 'pointer', userSelect: 'none', padding: '4px 0' }}>
                        识别文本
                      </summary>
                      <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5, whiteSpace: 'pre-wrap', maxHeight: 200, overflowY: 'auto', padding: '4px 0' }}>
                        {currentInfo.ocr_text}
                      </div>
                    </details>
                  )}
                </div>
              </div>
            </div>
          )
        })()
      ) : (
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

      {/* VN4.3 新建/重新生成总结弹窗（从 AI 工具菜单触发） */}
      {showNewSummaryModal && (
        <NewSummaryModal
          creating={creatingSummary}
          onSubmit={handleCreateSummary}
          onClose={() => setShowNewSummaryModal(false)}
        />
      )}
    </div>
  )
}
