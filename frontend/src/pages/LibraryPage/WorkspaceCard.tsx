import { useNavigate } from 'react-router-dom'
import type { LibraryWorkspace, LibraryItem } from '@/services/library'

const TYPE_TONE: Record<string, { c: string; l: string }> = {
  video: { c: 'var(--accent-2)', l: '视频' },
  audio: { c: 'var(--accent-green)', l: '音频' },
  image: { c: 'var(--accent-3)', l: '图片' },
  text: { c: 'var(--ink-3)', l: '文字' },
}

const WS_STATE: Record<string, { l: string; c: string }> = {
  done: { l: '已完成', c: 'var(--accent-green)' },
  running: { l: '处理中', c: 'var(--accent-pink)' },
  queued: { l: '等待中', c: 'var(--ink-4)' },
  error: { l: '有错误', c: 'var(--accent-pink)' },
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
    const now = Date.now()
    const diff = now - d.getTime()
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
  const stripeColor = TYPE_TONE[dom]?.c ?? 'var(--ink-3)'
  const st = WS_STATE[workspace.status] ?? WS_STATE.queued

  const thumbs = items
    .filter((it) => it.thumbnail)
    .slice(0, 4)
    const more = Math.max(0, total - thumbs.length)

  return (
    <div
      className="ws-card"
      onClick={() => {
        if (selectMode) {
          onToggleSelect?.(workspace.workspace_id)
        } else {
          navigate(`/workspaces/${workspace.workspace_id}`)
        }
      }}
      style={{
        position: 'relative',
        borderColor: selected ? 'var(--ink)' : 'var(--line)',
      }}
    >
      {/* ── 顶部操作栏（选择或删除） ── */}
      <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 10 }}>
        {selectMode ? (
          <span
            onClick={(e) => {
              e.stopPropagation()
              onToggleSelect?.(workspace.workspace_id)
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
          onDelete && (
            <button
              className="ws-delete-btn"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(workspace.workspace_id)
              }}
              title="删除"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" />
              </svg>
            </button>
          )
        )}
      </div>

      {/* 主色顶条 */}
      <div
        style={{ height: 4, background: stripeColor, flexShrink: 0 }}
      />

      <div className="ws-card-body">
        {/* ── Title row ── */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="ws-title">{workspace.name}</div>
            <div style={{
              fontFamily: 'var(--mono)',
              fontSize: 10.5,
              color: 'var(--ink-3)',
              letterSpacing: '0.04em',
              marginTop: 6,
              display: 'flex', gap: 8, flexWrap: 'wrap',
            }}>
              <span>{total} 个素材</span>
              {workspace.updated_at && (
                <>
                  <span style={{ opacity: 0.4 }}>·</span>
                  <span>{formatRelative(workspace.updated_at)}活跃</span>
                </>
              )}
            </div>
          </div>
          {/* 状态圆点 */}
          <span style={{
            width: 8, height: 8, borderRadius: 99, background: st.c,
            flexShrink: 0, marginTop: 6,
          }} title={st.l} />
        </div>

        {/* ── Thumb row ── */}
        <div style={{ display: 'flex', gap: 6 }}>
          {thumbs.map((it, i) => (
            <div key={i} className="ws-thumb-cell">
              <img
                src={it.thumbnail!}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            </div>
          ))}
          {more > 0 && (
            <div className="ws-thumb-more">+{more}</div>
          )}
          {/* 不足 4 个时补空白格 */}
          {Array.from({ length: Math.max(0, 4 - thumbs.length - (more > 0 ? 1 : 0)) }).map((_, i) => (
            <div key={`sp-${i}`} className="ws-thumb-cell" style={{ background: 'transparent' }} />
          ))}
        </div>

        {/* ── Footer ── */}
        <div className="ws-card-footer">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {Object.entries(comp).map(([t, n]) => (
              <span key={t} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 11.5, color: 'var(--ink-2)',
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: 99,
                  background: TYPE_TONE[t]?.c ?? 'var(--ink-4)',
                }} />
                <b style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{n}</b>
                <span style={{ color: 'var(--ink-3)' }}>{TYPE_TONE[t]?.l ?? t}</span>
              </span>
            ))}
          </div>
          {/* Status pill */}
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '3px 9px', borderRadius: 99,
            background:
              workspace.status === 'running' ? 'rgba(255,77,126,0.10)' :
              workspace.status === 'done' ? 'rgba(34,211,154,0.12)' :
              workspace.status === 'error' ? 'rgba(255,77,126,0.12)' :
              'var(--bg-sunken)',
            border: '1px solid var(--line)',
            color: st.c, fontSize: 10.5, fontWeight: 600,
            whiteSpace: 'nowrap',
          }}>
            <span style={{ width: 5, height: 5, borderRadius: 99, background: st.c }} />
            {st.l}
          </span>
        </div>
      </div>
    </div>
  )
}
