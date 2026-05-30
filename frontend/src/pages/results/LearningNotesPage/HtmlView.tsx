import { useRef, useMemo } from 'react'
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

interface Props {
  markdown: string
  onMarkdownChange: (md: string) => void
}

export default function HtmlView({ markdown, onMarkdownChange }: Props) {
  const editableRef = useRef<HTMLDivElement>(null)

  // 解析 h2/h3 生成 TOC（从旧 LNNotesPanel 迁移，B-6 复用）
  const toc = useMemo(() => {
    const entries: { id: string; text: string; level: number }[] = []
    const lines = markdown.split('\n')
    for (const line of lines) {
      const match = line.match(/^(#{2,3})\s+(.+)/)
      if (match) {
        const level = match[1].length
        const text = match[2].trim()
        const id = text.toLowerCase().replace(/[^\w一-鿿]+/g, '-').replace(/^-|-$/g, '')
        entries.push({ id, text, level })
      }
    }
    return entries
  }, [markdown])

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
              >
                <a href={`#${entry.id}`}>{entry.text}</a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Editable HTML content */}
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
              const text = String(children)
              const id = text.toLowerCase().replace(/[^\w一-鿿]+/g, '-').replace(/^-|-$/g, '')
              return <h2 id={id} {...props}>{children}</h2>
            },
            h3: ({ children, ...props }) => {
              const text = String(children)
              const id = text.toLowerCase().replace(/[^\w一-鿿]+/g, '-').replace(/^-|-$/g, '')
              return <h3 id={id} {...props}>{children}</h3>
            },
          }}
        >
          {markdown}
        </ReactMarkdown>
      </div>
    </>
  )
}
