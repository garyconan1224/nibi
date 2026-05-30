import React, { useRef, useMemo, useEffect, useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import DOMPurify from 'dompurify'
import TurndownService from 'turndown'
// @ts-expect-error turndown-plugin-gfm 没有类型声明
import { gfm as turndownGfm } from 'turndown-plugin-gfm'

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '_',
})
turndown.use(turndownGfm)

const SAFE_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'br', 'strong', 'em', 'del', 'code', 'pre', 'blockquote',
  'ul', 'ol', 'li',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'a', 'img',
  'input',
]
const SAFE_ATTRS = ['href', 'src', 'alt', 'title', 'type', 'checked', 'disabled']

function sanitize(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: SAFE_TAGS,
    ALLOWED_ATTR: SAFE_ATTRS,
    KEEP_CONTENT: true,
  })
}

// remarkGfm 类型与 react-markdown 不完全兼容
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const remarkPlugins: any[] = [remarkGfm]

/** 时间戳正则：匹配 [mm:ss]、[mm:ss~mm:ss]、[hh:mm:ss]、[hh:mm:ss~hh:mm:ss] */
export const TS_RE = /\[(\d{1,2}:\d{2}(?::\d{2})?)(?:~(\d{1,2}:\d{2}(?::\d{2})?))?\]/g

/** 把 mm:ss 或 hh:mm:ss 解析成秒数 */
export function parseTs(ts: string): number {
  const parts = ts.split(':').map(Number)
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  return 0
}

/** 生成 slug id（与 TOC 提取一致） */
function slugify(text: string): string {
  return text.toLowerCase().replace(/[^\w一-鿿]+/g, '-').replace(/^-|-$/g, '')
}

interface Props {
  markdown: string
  onMarkdownChange: (md: string) => void
  onSeek?: (sec: number) => void
}

export default function HtmlView({ markdown, onMarkdownChange, onSeek }: Props) {
  const editableRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [activeId, setActiveId] = useState('')

  // 解析 h2/h3 生成 TOC
  const toc = useMemo(() => {
    const entries: { id: string; text: string; level: number }[] = []
    const lines = markdown.split('\n')
    for (const line of lines) {
      const match = line.match(/^(#{2,3})\s+(.+)/)
      if (match) {
        const level = match[1].length
        const text = match[2].trim()
        const id = slugify(text)
        entries.push({ id, text, level })
      }
    }
    return entries
  }, [markdown])

  // 滚动时高亮当前章节
  useEffect(() => {
    const container = scrollRef.current
    if (!container || toc.length === 0) return

    function updateActive() {
      const headings = container!.querySelectorAll('h2[id], h3[id]')
      if (headings.length === 0) return

      const containerTop = container!.getBoundingClientRect().top
      const threshold = container!.clientHeight * 0.3 // 靠上 30% 为激活区
      let current = ''

      for (const h of headings) {
        const rect = h.getBoundingClientRect()
        if (rect.top - containerTop <= threshold) {
          current = h.id
        }
      }

      setActiveId(current)
    }

    // 初始计算 + 监听滚动
    updateActive()
    container.addEventListener('scroll', updateActive, { passive: true })
    return () => container.removeEventListener('scroll', updateActive)
  }, [toc, markdown])

  // 把 ReactNode children 中的文本节点做时间戳替换
  const renderWithTsChips = useCallback(
    (children: React.ReactNode): React.ReactNode => {
      if (!onSeek) return children
      return processChildren(children, onSeek)
    },
    [onSeek],
  )

  function onPaste(e: React.ClipboardEvent) {
    e.preventDefault()
    const html = e.clipboardData.getData('text/html')
    const text = e.clipboardData.getData('text/plain')
    const insert = html ? sanitize(html) : text.replace(/</g, '&lt;')
    document.execCommand('insertHTML', false, insert)
  }

  function onBlur() {
    if (!editableRef.current) return
    const html = sanitize(editableRef.current.innerHTML)
    const md = turndown.turndown(html)
    onMarkdownChange(md)
  }

  if (!markdown) {
    return (
      <div className="ln-html-view">
        <div className="ln-notes-empty">
          <p>暂无笔记内容</p>
          <p className="ln-notes-hint">综合笔记尚未生成</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* TOC */}
      {toc.length > 0 && (
        <div className="ln-toc">
          <div className="ln-toc-title">目录</div>
          <ul className="ln-toc-list">
            {toc.map((entry) => (
              <li
                key={entry.id}
                className={`ln-toc-item${entry.level === 3 ? ' ln-toc-h3' : ''}`}
                data-active={entry.id === activeId || undefined}
              >
                <a href={`#${entry.id}`}>{entry.text}</a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Editable HTML content */}
      <div ref={scrollRef} className="ln-html-scroll">
        <div
          ref={editableRef}
          contentEditable
          suppressContentEditableWarning
          onPaste={onPaste}
          onBlur={onBlur}
          className="ln-html-view"
        >
          <ReactMarkdown
            remarkPlugins={remarkPlugins}
            rehypePlugins={[rehypeRaw]}
            components={{
              h2: ({ children, ...props }) => {
                const text = flattenText(children)
                const id = slugify(text)
                return <h2 id={id} {...props}>{children}</h2>
              },
              h3: ({ children, ...props }) => {
                const text = flattenText(children)
                const id = slugify(text)
                return <h3 id={id} {...props}>{children}</h3>
              },
              p: ({ children, ...props }) => (
                <p {...props}>{renderWithTsChips(children)}</p>
              ),
            }}
          >
            {markdown}
          </ReactMarkdown>
        </div>
      </div>
    </>
  )
}

// ── helpers ──

/** 递归提取 ReactNode 中的纯文本（用于 slugify） */
function flattenText(node: React.ReactNode): string {
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (!node || typeof node !== 'object') return ''
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ('props' in node) return flattenText((node as React.ReactElement<any>).props.children)
  if (Array.isArray(node)) return node.map(flattenText).join('')
  return ''
}

/** 递归处理 children，把文本中的时间戳替换成 chip 按钮 */
function processChildren(
  children: React.ReactNode,
  onSeek: (sec: number) => void,
): React.ReactNode {
  if (typeof children === 'string') {
    return replaceTsInString(children, onSeek)
  }
  if (typeof children === 'number' || !children) return children
  if (Array.isArray(children)) {
    return children.map((child, i) => {
      const processed = processChildren(child, onSeek)
      return typeof processed === 'string' || typeof processed === 'number' || !processed
        ? processed
        : React.cloneElement(processed as React.ReactElement, { key: i })
    })
  }
  if (typeof children === 'object' && 'props' in (children as React.ReactElement)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const el = children as React.ReactElement<any>
    // 代码块不处理时间戳
    if (el.type === 'code' || el.type === 'pre') return children
    const newChildren = processChildren(el.props.children, onSeek)
    if (newChildren === el.props.children) return children
    return React.cloneElement(el, { ...el.props, children: newChildren })
  }
  return children
}

/** 把一段字符串里的 [mm:ss] 替换成 <button> chip */
function replaceTsInString(
  text: string,
  onSeek: (sec: number) => void,
): React.ReactNode {
  const parts: React.ReactNode[] = []
  let lastIdx = 0
  let match: RegExpExecArray | null

  TS_RE.lastIndex = 0
  while ((match = TS_RE.exec(text)) !== null) {
    // 匹配前的纯文本
    if (match.index > lastIdx) {
      parts.push(text.slice(lastIdx, match.index))
    }

    const ts = match[1]
    const sec = parseTs(ts)
    const display = match[0] // 完整 [mm:ss] 或 [mm:ss~mm:ss]

    parts.push(
      <button
        key={`ts-${match.index}`}
        className="ln-ts-chip"
        onClick={(e) => {
          e.preventDefault()
          onSeek(sec)
        }}
        title={match[2] ? `跳转到 ${ts}（区间 ${ts} ~ ${match[2]}）` : `跳转到 ${ts}`}
      >
        {display}
      </button>,
    )
    lastIdx = match.index + match[0].length
  }

  // 尾部文本
  if (lastIdx < text.length) {
    parts.push(text.slice(lastIdx))
  }

  return parts.length === 1 ? parts[0] : parts
}
