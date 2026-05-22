import { useNavigate } from 'react-router-dom'
import { Film, Music, ImageIcon, FileText, Trash2, CheckCircle, Circle } from 'lucide-react'
import type { LibraryItem } from '@/services/library'

const TYPE_ICON: Record<string, typeof Film> = {
  video: Film,
  audio: Music,
  image: ImageIcon,
  text: FileText,
}

const STATE_LABEL: Record<string, string> = {
  done: 'done',
  processing: 'running',
  pending: 'queued',
  failed: 'error',
}

const STATE_COLOR: Record<string, string> = {
  done: 'var(--accent-green)',
  running: 'var(--ink)',
  error: 'var(--accent)',
  queued: 'var(--ink-4)',
}

function primaryStatusToState(raw: string | null): string {
  if (!raw) return 'queued'
  const s = raw.toUpperCase()
  if (s === 'SUCCESS') return 'done'
  if (s === 'FAILED' || s === 'CANCELLED') return 'error'
  if (s === 'QUEUED') return 'queued'
  return 'running'
}

function extractDomain(src: string): string {
  if (!src) return ''
  try {
    const u = new URL(src)
    const host = u.hostname.replace(/^www\./, '')
    const path = u.pathname.replace(/\/$/, '')
    const seg = path.split('/').pop() || ''
    if (seg && seg.length < 24) return `${host}${path}`
    return `${host}${path.slice(0, 24)}…`
  } catch {
    // local file
    const parts = src.replace(/\\/g, '/').split('/')
    return parts[parts.length - 1] || src.slice(0, 40)
  }
}

function formatDuration(sec: number | null): string | null {
  if (sec == null || sec <= 0) return null
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

interface ItemCardProps {
  item: LibraryItem
  selected?: boolean
  selectMode?: boolean
  onToggleSelect?: (itemId: string, workspaceId: string) => void
  onDelete?: (item: LibraryItem) => void
}

export function ItemCard({ item, selected, selectMode, onToggleSelect, onDelete }: ItemCardProps) {
  const navigate = useNavigate()
  const state = primaryStatusToState(item.primary_task_status)
  const stateColor = STATE_COLOR[state] || STATE_COLOR.queued
  const stateLabel = STATE_LABEL[state] || 'queued'
  const Icon = TYPE_ICON[item.type] || FileText
  const dur = formatDuration(item.duration_seconds)
  const srcLabel = extractDomain(item.source_value)
  const showOverlay = selectMode

  const handleCardClick = () => {
    if (selectMode && onToggleSelect) {
      onToggleSelect(item.item_id, item.workspace_id)
    } else {
      navigate(`/workspaces/${item.workspace_id}/items/${item.item_id}/overview`)
    }
  }

  return (
    <div
      className="ex-card"
      style={{ position: 'relative' }}
      onClick={handleCardClick}
    >
      <div className="ex-thumb">
        {item.thumbnail ? (
          <img src={item.thumbnail} alt={item.name} />
        ) : (
          <Icon size={28} strokeWidth={1.2} />
        )}
        {/* 状态徽标 */}
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '3px 8px',
            borderRadius: 99,
            background: 'rgba(0,0,0,0.6)',
            fontSize: 10,
            color: '#fff',
            fontFamily: 'var(--mono)',
          }}
        >
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: 99,
              background: stateColor,
            }}
          />
          {stateLabel}
        </div>
        {/* 右上角操作区 */}
        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            display: 'flex',
            gap: 6,
            alignItems: 'center',
          }}
        >
          {/* 勾选框 */}
          {showOverlay && (
            <span
              onClick={(e) => {
                e.stopPropagation()
                onToggleSelect?.(item.item_id, item.workspace_id)
              }}
              style={{ cursor: 'pointer', display: 'flex', color: '#fff' }}
            >
              {selected ? <CheckCircle size={18} /> : <Circle size={18} style={{ opacity: 0.5 }} />}
            </span>
          )}
          {/* 删除按钮 */}
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete(item)
              }}
              style={{
                background: 'rgba(0,0,0,0.45)',
                border: 'none',
                borderRadius: 6,
                padding: '4px 6px',
                cursor: 'pointer',
                color: 'rgba(255,255,255,0.7)',
                display: 'flex',
                opacity: 0,
                transition: 'opacity 120ms',
              }}
              className="ex-delete-btn"
              title="删除"
            >
              <Trash2 size={14} />
            </button>
          )}
          {/* 时长角标 */}
          {dur && !showOverlay && (
            <span
              style={{
                padding: '2px 6px',
                borderRadius: 6,
                background: 'rgba(0,0,0,0.55)',
                fontSize: 10,
                color: 'rgba(255,255,255,0.8)',
                fontFamily: 'var(--mono)',
              }}
            >
              {dur}
            </span>
          )}
        </div>
      </div>
      <div className="ex-meta">
        <div className="ex-title" title={item.name}>
          {item.name || '未命名'}
        </div>
        <div className="ex-sub">
          {srcLabel} · {item.type}
        </div>
      </div>
    </div>
  )
}
