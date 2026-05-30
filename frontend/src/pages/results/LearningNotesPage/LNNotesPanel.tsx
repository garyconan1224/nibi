import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// remarkGfm 类型与 react-markdown 不完全兼容
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const remarkPlugins: any[] = [remarkGfm]

interface LNNotesPanelProps {
  markdown: string
  /** 当前播放时间（秒），B-2 字幕跟随会用到 */
  currentTime?: number
}

export default function LNNotesPanel({ markdown, currentTime: _currentTime }: LNNotesPanelProps) {
  // 解析 h2/h3 生成 TOC
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

  if (!markdown) {
    return (
      <div className="ln-notes-panel">
        <div className="ln-notes-empty">
          <p>暂无笔记内容</p>
          <p className="ln-notes-hint">综合笔记尚未生成</p>
        </div>
      </div>
    )
  }

  return (
    <div className="ln-notes-panel">
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

      {/* Markdown content */}
      <div className="ln-notes-content">
        <ReactMarkdown
          remarkPlugins={remarkPlugins}
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
    </div>
  )
}
