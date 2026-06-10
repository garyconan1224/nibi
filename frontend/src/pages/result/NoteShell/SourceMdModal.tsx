import { X, FileCode } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface SourceMdModalProps {
  open: boolean
  sourceMd: string
  onClose: () => void
}

/**
 * 源 md 悬浮框 — 仿 TranscriptPreviewModal 结构。
 * position:fixed 遮罩 + 居中卡片 + 可滚动源码。
 */
export function SourceMdModal({ open, sourceMd, onClose }: SourceMdModalProps) {
  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'grid',
        placeItems: 'center',
        background: 'rgba(0,0,0,0.4)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '90vw',
          maxWidth: 640,
          maxHeight: '80vh',
          background: 'var(--bg)',
          borderRadius: 'var(--radius-lg, 16px)',
          border: '1px solid var(--line)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            borderBottom: '1px solid var(--line)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileCode size={16} style={{ color: 'var(--accent-2)' }} />
            <span style={{ fontWeight: 600, fontSize: 14 }}>源 Markdown</span>
          </div>
          <button
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 8,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: 'var(--ink-3)',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body：渲染 markdown，让 ![]() 显示成图（不再是 raw 源码）*/}
        <div
          className="source-md-body"
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '14px 18px',
            fontSize: 13,
            lineHeight: 1.7,
            color: 'var(--ink-2)',
          }}
        >
          <style>{`.source-md-body img { max-width: 100%; height: auto; border-radius: 8px; display: block; margin: 8px 0; }`}</style>
          <ReactMarkdown remarkPlugins={[remarkGfm as any]}>{sourceMd}</ReactMarkdown>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            padding: '12px 18px',
            borderTop: '1px solid var(--line)',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid var(--line)',
              background: 'var(--bg)',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}
