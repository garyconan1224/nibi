import { useNavigate } from 'react-router-dom'
import type { LibraryWorkspace, LibraryItem } from '@/services/library'

const TYPE_TONE: Record<string, { c: string; l: string }> = {
  video: { c: 'var(--acc)', l: '视频' },
  audio: { c: 'var(--ok)', l: '音频' },
  image: { c: 'var(--acc)', l: '图片' },
  text: { c: 'var(--mut)', l: '文字' },
}

function dominantType(cnt: Record<string, number>): string {
  let max = 0
  let dom = 'video'
  for (const [t, n] of Object.entries(cnt)) {
    if (n > max) { max = n; dom = t }
  }
  return dom
}

function formatRelative(iso: string): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    const diff = Date.now() - d.getTime()
    const days = Math.floor(diff / 86400000)
    if (days === 0) return '今天'
    if (days === 1) return '昨天'
    if (days < 7) return `${days} 天前`
    if (days < 14) return '上周'
    return `${Math.floor(days / 7)} 周前`
  } catch {
    return iso.slice(0, 10)
  }
}

interface WorkspaceCardProps {
  workspace: LibraryWorkspace
  items: LibraryItem[]
  selectMode?: boolean
  selected?: boolean
  onToggleSelect?: (workspaceId: string) => void
  onDelete?: (workspaceId: string) => void
}

export function WorkspaceCard({ workspace, items, selectMode, selected, onToggleSelect, onDelete }: WorkspaceCardProps) {
  const navigate = useNavigate()
  const comp = workspace.items_count_by_type || {}
  const total = workspace.items_count
  const dom = dominantType(comp)
  const stripeColor = TYPE_TONE[dom]?.c ?? 'var(--mut)'

  const thumbs = items.filter((it) => it.thumbnail).slice(0, 4)
  const more = Math.max(0, total - thumbs.length)

  const stLabel = workspace.status === 'done' ? '已完成'
    : workspace.status === 'running' ? '处理中'
    : workspace.status === 'error' ? '有错误'
    : '等待中'
  const stPill = workspace.status === 'done' ? 'ws-status-pill--done'
    : workspace.status === 'running' ? 'ws-status-pill--running'
    : workspace.status === 'error' ? 'ws-status-pill--error'
    : ''

  return (
    <div
      className={`ws-card${selected ? ' ws-card--selected' : ''}`}
      onClick={() => {
        if (selectMode) {
          onToggleSelect?.(workspace.workspace_id)
        } else {
          navigate(`/workspaces/${workspace.workspace_id}`)
        }
      }}
    >
      <div className="ws-card-stripe" style={{ background: stripeColor }} />
      <div className="ws-card-body">
        {/* Top actions */}
        <div className="ws-card-top-actions">
          {selectMode ? (
            <span
              onClick={(e) => { e.stopPropagation(); onToggleSelect?.(workspace.workspace_id) }}
              className={`ws-select-dot${selected ? ' ws-select-dot--on' : ''}`}
            >
              {selected && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              )}
            </span>
          ) : (
            onDelete && (
              <button
                className="ws-delete-btn"
                onClick={(e) => { e.stopPropagation(); onDelete(workspace.workspace_id) }}
                title="删除"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" />
                </svg>
              </button>
            )
          )}
        </div>

        {/* Title row */}
        <div className="ws-title-row">
          <div className="ws-title-col">
            <div className="ws-title">{workspace.name}</div>
            <div className="ws-meta-line">
              <span>{total} 个笔记</span>
              {workspace.updated_at && (
                <>
                  <span className="ws-meta-sep">·</span>
                  <span>{formatRelative(workspace.updated_at)}活跃</span>
                </>
              )}
            </div>
          </div>
          <span className="ws-status-dot" style={{ background: workspace.status === 'done' ? 'var(--ok)' : workspace.status === 'error' ? 'var(--err)' : 'var(--mut)' }} title={stLabel} />
        </div>

        {/* Thumb row */}
        <div className="ws-thumb-row">
          {thumbs.map((it, i) => (
            <div key={i} className="ws-thumb-cell">
              <img src={it.thumbnail!} alt="" />
            </div>
          ))}
          {more > 0 && (
            <div className="ws-thumb-more">+{more}</div>
          )}
          {Array.from({ length: Math.max(0, 4 - thumbs.length - (more > 0 ? 1 : 0)) }).map((_, i) => (
            <div key={`sp-${i}`} className="ws-thumb-spacer" />
          ))}
        </div>

        {/* Footer */}
        <div className="ws-card-footer">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {Object.entries(comp).map(([t, n]) => (
              <span key={t} className="ws-comp-item">
                <span className="ws-comp-dot" style={{ background: TYPE_TONE[t]?.c ?? 'var(--mut)' }} />
                <b className="ws-comp-count">{n}</b>
                <span className="ws-comp-label">{TYPE_TONE[t]?.l ?? t}</span>
              </span>
            ))}
          </div>
          <span className={`ws-status-pill ${stPill}`}>
            <span style={{ width: 5, height: 5, borderRadius: 99, background: workspace.status === 'done' ? 'var(--ok)' : workspace.status === 'error' ? 'var(--err)' : 'var(--mut)' }} />
            {stLabel}
          </span>
        </div>
      </div>
    </div>
  )
}
