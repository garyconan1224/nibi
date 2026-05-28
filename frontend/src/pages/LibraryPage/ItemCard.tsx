import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import type { LibraryItem } from '@/services/library'
import { Mic, Music } from 'lucide-react'
import {
  TYPE_ICON,
  STATE_COLOR,
  STATE_LABEL,
  primaryStatusToState,
  formatDuration,
  extractDomain,
} from './libraryHelpers'

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
  const Icon = TYPE_ICON[item.type] || TYPE_ICON.text
  const dur = formatDuration(item.duration_seconds)
  const hasDur = item.duration_seconds != null && item.duration_seconds > 0
  const srcLabel = extractDomain(item.source_value)

  const isDone = state === 'done'

  const handleCardClick = () => {
    if (selectMode && onToggleSelect) {
      onToggleSelect(item.item_id, item.workspace_id)
    } else if (isDone) {
      navigate(`/workspaces/${item.workspace_id}/items/${item.item_id}/overview`)
    } else {
      // 未完成 → 进 ProcessingPage；用首个关联 task 兜底
      const tid = item.related_task_ids?.[0] ?? ''
      if (tid) {
        navigate(`/processing/${tid}`)
      } else {
        toast.info('该素材尚在分析中，请从任务面板查看进度')
      }
    }
  }

  return (
    <div
      className="ex-card"
      style={{
        borderColor: selected ? 'var(--ink)' : 'var(--line)',
      }}
      onClick={handleCardClick}
    >
      {/* ── Thumbnail 16/9 ── */}
      <div className="ex-thumb">
        {item.thumbnail ? (
          <img src={item.thumbnail} alt={item.name} referrerPolicy="no-referrer" />
        ) : (
          <Icon size={32} strokeWidth={1.2} style={{ color: 'rgba(255,255,255,0.45)' }} />
        )}

        {/* type badge — top-left */}
        <span className={`ex-type-badge ex-type-badge--${item.type}`}>
          {item.type.toUpperCase()}
        </span>

        {/* audio nature badge — bottom-left */}
        {item.type === 'audio' && item.audio_nature && (
          <span className="ex-nature-badge">
            {item.audio_nature === 'speech' ? <Mic size={12} /> : <Music size={12} />}
            {item.audio_nature === 'speech' ? '人声' : '音乐'}
          </span>
        )}

        {/* running progress bar */}
        {state === 'running' && (
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 3,
              background: 'rgba(255,255,255,0.18)',
            }}
          >
            <div
              style={{
                height: '100%',
                width: '40%',
                background: 'var(--accent-3)',
                transition: 'width 400ms',
              }}
            />
          </div>
        )}

        {/* state badge — top-left */}
        <div className="ex-badge">
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

        {/* top-right */}
        <div className="ex-top-right">
          {selectMode ? (
            <span
              onClick={(e) => {
                e.stopPropagation()
                onToggleSelect?.(item.item_id, item.workspace_id)
              }}
              className="ex-select-dot"
              style={{
                background: selected ? '#fff' : 'rgba(0,0,0,0.5)',
                color: selected ? 'var(--ink)' : '#fff',
                borderColor: selected ? '#fff' : 'rgba(255,255,255,0.6)',
              }}
            >
              {selected && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              )}
            </span>
          ) : (
            <>
              <button
                className="ex-delete-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete?.(item)
                }}
                title="删除"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" />
                </svg>
              </button>
              {hasDur && (
                <span className="ex-dur-badge">{dur}</span>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Meta ── */}
      <div className="ex-meta">
        <div className="ex-title-row">
          <Icon size={14} strokeWidth={1.5} style={{ color: 'var(--ink-3)', flexShrink: 0, marginTop: 2 }} />
          <span className="ex-title" title={item.name}>
            {item.name || '未命名'}
          </span>
        </div>
        <div className="ex-sub-row">
          <span className="ex-src-label">{srcLabel}</span>
          <span className="ex-ws-name">{item.workspace_name}</span>
        </div>
        {(() => {
          const chips: string[] = []
          if (item.results_summary.has_transcript) chips.push('转写')
          if (item.has_chapters) chips.push('章节')
          if (item.type === 'video' && (item.frames_count ?? 0) > 0) chips.push(`${item.frames_count} 帧`)
          if (item.has_subtitle) chips.push('字幕')
          if (item.results_summary.has_summary) chips.push('摘要')
          if (item.type === 'image' && item.results_summary.has_summary) chips.push('提示词')
          const visible = chips.slice(0, 3)
          if (visible.length === 0) return null
          return (
            <div className="ex-chip-row">
              {visible.map((c) => (
                <span key={c} className="ex-chip">{c}</span>
              ))}
            </div>
          )
        })()}
      </div>
    </div>
  )
}
