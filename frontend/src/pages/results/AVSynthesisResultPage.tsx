import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  ArrowLeft,
  FileText,
  FileSpreadsheet,
  FileDown,
  BookOpenCheck,
  Star,
} from 'lucide-react'

import {
  getAVSynthesisMarkdown,
  downloadAVSynthesisMd,
} from '@/services/workspaces'

import './av-synthesis-result.css'

// remarkGfm 类型与 react-markdown 不完全兼容，统一 cast 一次
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const remarkPlugins: any[] = [remarkGfm]

/* ── Types ───────────────────────────────────── */

type PageState =
  | { kind: 'loading' }
  | { kind: 'ready'; markdown: string }
  | { kind: 'error'; message: string }

interface TocEntry {
  id: string
  text: string
  level: number // 2 = h2, 3 = h3
}

/* ── Helpers ─────────────────────────────────── */

/** 从 markdown 原文提取 h2/h3 标题生成 TOC */
function extractToc(md: string): TocEntry[] {
  const entries: TocEntry[] = []
  const lines = md.split('\n')
  for (const line of lines) {
    const m = line.match(/^(#{2,3})\s+(.+)$/)
    if (m) {
      const level = m[1].length
      const text = m[2].trim()
      const id = `av-heading-${entries.length}`
      entries.push({ id, text, level })
    }
  }
  return entries
}

/** 给 ReactMarkdown 的 heading 注入 id（用于 TOC 锚点跳转） */
function headingId(text: string, toc: TocEntry[]): string | undefined {
  const entry = toc.find((e) => e.text === text)
  return entry?.id
}

/* ── Component ───────────────────────────────── */

export default function AVSynthesisResultPage() {
  const { workspaceId = '' } = useParams<{ workspaceId: string }>()
  const navigate = useNavigate()

  const [pageState, setPageState] = useState<PageState>({ kind: 'loading' })
  const [activeToc, setActiveToc] = useState<string | undefined>()

  // Fetch markdown
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const md = await getAVSynthesisMarkdown(workspaceId)
        if (!cancelled) setPageState({ kind: 'ready', markdown: md })
      } catch (err: unknown) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : '加载综合笔记失败'
        setPageState({ kind: 'error', message })
      }
    }
    load()
    return () => { cancelled = true }
  }, [workspaceId])

  // Extract TOC from markdown
  const toc = useMemo(
    () => (pageState.kind === 'ready' ? extractToc(pageState.markdown) : []),
    [pageState],
  )

  // Scroll to heading
  const scrollToHeading = useCallback((id: string) => {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setActiveToc(id)
    }
  }, [])

  // Download handler
  const handleDownload = useCallback(async () => {
    try {
      await downloadAVSynthesisMd(workspaceId)
    } catch {
      // downloadExport already handles errors via blob
    }
  }, [workspaceId])

  // ── Render ──────────────────────────────────
  return (
    <div className="vm-av-synth-scope">
      {/* Nav bar */}
      <div className="av-nav">
        <button className="av-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={14} /> 返回
        </button>
        <span className="av-title">综合笔记</span>
        <span className="av-badge">
          <Star size={10} /> AV Synthesis
        </span>
      </div>

      {/* Loading / Error */}
      {pageState.kind === 'loading' && (
        <div className="av-status">加载中…</div>
      )}
      {pageState.kind === 'error' && (
        <div className="av-status av-error">{pageState.message}</div>
      )}

      {/* Main body */}
      {pageState.kind === 'ready' && (
        <div className="av-body">
          {/* Left: content */}
          <div className="av-main">
            {/* Cover bar: title + meta */}
            <div className="av-cover-bar">
              <div className="av-cover-info">
                <div className="av-page-title">综合笔记</div>
                <div className="av-meta">
                  {toc.length} 个章节
                </div>
              </div>
            </div>

            {/* Markdown body */}
            <div className="av-markdown">
              <ReactMarkdown
                remarkPlugins={remarkPlugins}
                components={{
                  h2: ({ children, ...props }) => {
                    const text = String(children)
                    const id = headingId(text, toc)
                    return <h2 id={id} {...props}>{children}</h2>
                  },
                  h3: ({ children, ...props }) => {
                    const text = String(children)
                    const id = headingId(text, toc)
                    return <h3 id={id} {...props}>{children}</h3>
                  },
                }}
              >
                {pageState.markdown}
              </ReactMarkdown>
            </div>
          </div>

          {/* Right: sidebar */}
          <div className="av-sidebar">
            {/* TOC */}
            {toc.length > 0 && (
              <div>
                <div className="av-toc-title">章节目录</div>
                <ul className="av-toc-list">
                  {toc.map((entry) => (
                    <li
                      key={entry.id}
                      className={`av-toc-item${entry.level === 3 ? ' av-toc-h3' : ''}${activeToc === entry.id ? ' av-toc-active' : ''}`}
                      onClick={() => scrollToHeading(entry.id)}
                    >
                      {entry.text}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Export buttons */}
            <div>
              <div className="av-export-title">导出</div>
              <div className="av-export-group">
                {/* Markdown — 可用 */}
                <button className="av-export-btn" onClick={handleDownload}>
                  <FileText size={14} />
                  <span className="av-export-label">Markdown</span>
                </button>

                {/* PDF — 灰态 */}
                <button className="av-export-btn" disabled>
                  <FileDown size={14} />
                  <span className="av-export-label">PDF</span>
                  <span className="av-export-tag">R20</span>
                </button>

                {/* Word — 灰态 */}
                <button className="av-export-btn" disabled>
                  <FileSpreadsheet size={14} />
                  <span className="av-export-label">Word</span>
                  <span className="av-export-tag">R20</span>
                </button>

                {/* Obsidian Vault — 灰态 */}
                <button className="av-export-btn" disabled>
                  <BookOpenCheck size={14} />
                  <span className="av-export-label">Obsidian Vault</span>
                  <span className="av-export-tag">R20</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
