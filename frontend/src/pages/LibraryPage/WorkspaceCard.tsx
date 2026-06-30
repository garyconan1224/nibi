import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { LibraryWorkspace, LibraryItem } from '@/services/library'

const TYPE_TONE: Record<string, { badge: string; label: string }> = {
  video: { badge: 'collection-mini--video', label: 'VIDEO' },
  audio: { badge: 'collection-mini--audio', label: 'AUDIO' },
  image: { badge: 'collection-mini--image', label: 'IMAGE' },
  text: { badge: 'collection-mini--text', label: 'TEXT' },
}

function formatRelative(iso: string): string {
  if (!iso) return ''
  try {
    const deltaDays = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
    if (deltaDays <= 0) return '今天'
    if (deltaDays === 1) return '昨天'
    if (deltaDays < 7) return `${deltaDays} 天前`
    return `${Math.floor(deltaDays / 7)} 周前`
  } catch {
    return iso.slice(0, 10)
  }
}

function buildSourceSummary(items: LibraryItem[]): string {
  const labels = Array.from(new Set(items.map((item) => TYPE_TONE[item.type]?.label ?? item.type)))
  if (labels.length === 0) return '空合集'
  if (labels.length === 1) return `来自${labels[0]}`
  return `来自${labels.slice(0, 2).join(' / ')}`
}

interface WorkspaceCardProps {
  workspace: LibraryWorkspace
  items: LibraryItem[]
  selectMode?: boolean
  selected?: boolean
  onToggleSelect?: (workspaceId: string) => void
  onDelete?: (workspaceId: string) => void
  onRename?: (workspaceId: string, name: string) => Promise<void>
}

export function WorkspaceCard({
  workspace,
  items,
  selectMode,
  selected,
  onToggleSelect,
  onDelete,
  onRename,
}: WorkspaceCardProps) {
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(workspace.name)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setDraftName(workspace.name)
  }, [workspace.name])

  const previewItems = useMemo(
    () => [...items].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, 2),
    [items],
  )

  const progressPct = workspace.items_count === 0 ? 12 : Math.min(100, 28 + workspace.items_count * 24)
  const summaryText = workspace.kind === 'replica'
    ? '把拆帧、提示词和镜头观察放进同一个夹层，复盘时能顺着继续。'
    : '把同一个主题下的视频、音频、图片和文本放在一起，随时回到这条路径。'

  const handleSave = async () => {
    const nextName = draftName.trim()
    if (!nextName || nextName === workspace.name || saving || !onRename) {
      setEditing(false)
      setDraftName(workspace.name)
      return
    }
    setSaving(true)
    try {
      await onRename(workspace.workspace_id, nextName)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <article
      className={`note-card collection-card${selected ? ' note-card--selected' : ''}`}
      data-kind="collection"
      onClick={() => {
        if (selectMode) onToggleSelect?.(workspace.workspace_id)
        else navigate(`/workspaces/${workspace.workspace_id}`)
      }}
    >
      <div className="note-cover collection-cover">
        <span className="media-chip">COLLECTION</span>
        <span className="status-pill status-done">文件夹</span>
        {selectMode ? (
          <span
            onClick={(event) => {
              event.stopPropagation()
              onToggleSelect?.(workspace.workspace_id)
            }}
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
              onClick={(event) => {
                event.stopPropagation()
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

        <div className="collection-folder">
          <div className="collection-tab" />
          <div className="collection-stack">
            {previewItems.length > 0 ? (
              previewItems.map((item) => (
                <div key={item.item_id} className={`collection-mini ${TYPE_TONE[item.type]?.badge ?? 'collection-mini--video'}`}>
                  <span>{TYPE_TONE[item.type]?.label ?? item.type.toUpperCase()}</span>
                  <strong>{item.name || '未命名内容'}</strong>
                </div>
              ))
            ) : (
              <div className="collection-mini collection-mini--empty">
                <span>{workspace.kind === 'replica' ? 'REPLICA' : 'NOTE'}</span>
                <strong>先往这个合集里放一条内容</strong>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="note-card-body">
        <div className="note-title-row">
          <span className="note-type-dot" />
          <div className="collection-title-wrap">
            {editing ? (
              <input
                autoFocus
                className="collection-title-input"
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                onClick={(event) => event.stopPropagation()}
                onBlur={() => void handleSave()}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void handleSave()
                  }
                  if (event.key === 'Escape') {
                    setEditing(false)
                    setDraftName(workspace.name)
                  }
                }}
              />
            ) : (
              <h3 onDoubleClick={(event) => {
                event.stopPropagation()
                setEditing(true)
              }}
              >
                {workspace.name}
              </h3>
            )}
          </div>
        </div>

        <p className="note-summary">{summaryText}</p>

        <div className="note-meta-row">
          <span>合集</span>
          <span>{workspace.items_count} 项内容</span>
          <span>更新 {formatRelative(workspace.updated_at)}</span>
        </div>

        <div className="note-progress-mini">
          <span style={{ width: `${progressPct}%` }} />
        </div>

        <div className="note-card-actions">
          <span>{buildSourceSummary(previewItems)}</span>
          <button className="note-open" onClick={(event) => {
            event.stopPropagation()
            navigate(`/workspaces/${workspace.workspace_id}`)
          }}
          >
            打开
          </button>
        </div>
      </div>
    </article>
  )
}
