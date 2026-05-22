import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, Film, Music, ImageIcon, FileText } from 'lucide-react'
import { fetchLibrary, type LibraryItem, type LibraryResponse } from '@/services/library'
import { useLibraryStore, type SortBy } from '@/store/libraryStore'
import { FilterChips } from './FilterChips'
import { SortMenu } from './SortMenu'
import { ItemCard } from './ItemCard'
import { WorkspaceCard } from './WorkspaceCard'
import './library.css'

const TYPE_ICON: Record<string, typeof Film> = {
  video: Film,
  audio: Music,
  image: ImageIcon,
  text: FileText,
}

const STATE_ORDER: Record<string, number> = {
  error: 0,
  running: 1,
  queued: 2,
  done: 3,
}

function primaryStatusToState(raw: string | null): string {
  if (!raw) return 'queued'
  const s = raw.toUpperCase()
  if (s === 'SUCCESS') return 'done'
  if (s === 'FAILED' || s === 'CANCELLED') return 'error'
  if (s === 'QUEUED') return 'queued'
  return 'running'
}

function sortItems(items: LibraryItem[], sortBy: SortBy): LibraryItem[] {
  const arr = [...items]

  switch (sortBy) {
    case 'created_desc':
      return arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    case 'created_asc':
      return arr.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    case 'completed_desc':
      return arr.sort((a, b) => {
        const aDone = a.status === 'done' ? new Date(a.updated_at).getTime() : 0
        const bDone = b.status === 'done' ? new Date(b.updated_at).getTime() : 0
        if (aDone && bDone) return bDone - aDone
        if (aDone) return -1
        if (bDone) return 1
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
    case 'duration_desc':
      return arr.sort((a, b) => {
        const da = a.duration_seconds ?? -1
        const db = b.duration_seconds ?? -1
        if (da >= 0 && db >= 0) return db - da
        if (da >= 0) return -1
        if (db >= 0) return 1
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
    case 'duration_asc':
      return arr.sort((a, b) => {
        const da = a.duration_seconds ?? -1
        const db = b.duration_seconds ?? -1
        if (da >= 0 && db >= 0) return da - db
        if (da >= 0) return -1
        if (db >= 0) return 1
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
    case 'status':
      return arr.sort((a, b) => {
        const sa = STATE_ORDER[primaryStatusToState(a.primary_task_status)] ?? 9
        const sb = STATE_ORDER[primaryStatusToState(b.primary_task_status)] ?? 9
        if (sa !== sb) return sa - sb
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
    default:
      return arr
  }
}

function formatDuration(sec: number | null): string {
  if (sec == null || sec <= 0) return '--'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  } catch {
    return iso.slice(0, 16)
  }
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

export default function LibraryPage() {
  const navigate = useNavigate()
  const [data, setData] = useState<LibraryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const selectedFilters = useLibraryStore((s) => s.selectedFilters)
  const sortBy = useLibraryStore((s) => s.sortBy)
  const viewMode = useLibraryStore((s) => s.viewMode)
  const setViewMode = useLibraryStore((s) => s.setViewMode)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchLibrary()
      setData(res)
    } catch {
      setError('加载资料库失败，请确认后端已启动')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const showWorkspace = selectedFilters.includes('workspace')
  const typeFilters = selectedFilters.filter(
    (k) => k !== 'all' && k !== 'workspace',
  ) as string[]
  const showAll = selectedFilters.includes('all')

  const filteredItems = useMemo(() => {
    if (!data) return []
    let items: LibraryItem[]
    if (showAll) {
      items = data.items
    } else if (typeFilters.length === 0) {
      return []
    } else {
      items = data.items.filter((it) => typeFilters.includes(it.type))
    }
    return sortItems(items, sortBy)
  }, [data, showAll, typeFilters, sortBy])

  const filteredWorkspaces = useMemo(() => {
    if (!data || !showWorkspace) return null
    return data.workspaces
  }, [data, showWorkspace])

  const statLabel =
    showWorkspace && typeFilters.length === 0
      ? `${filteredWorkspaces?.length ?? 0} WORKSPACES`
      : `${filteredItems.length} ITEMS`

  const renderGridView = (items: LibraryItem[]) => (
    <div className="ex-grid">
      {items.map((item) => (
        <ItemCard key={item.item_id} item={item} />
      ))}
    </div>
  )

  const renderListView = (items: LibraryItem[]) => (
    <div
      style={{
        borderRadius: 'var(--radius)',
        border: '1px solid var(--line)',
        overflow: 'hidden',
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr
            style={{
              background: 'var(--bg-sunken)',
              fontFamily: 'var(--mono)',
              fontSize: 10.5,
              letterSpacing: '0.06em',
              color: 'var(--ink-3)',
              textTransform: 'uppercase',
            }}
          >
            <th style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 500 }}>名称</th>
            <th style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 500 }}>类型</th>
            <th style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 500 }}>状态</th>
            <th style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 500 }}>时长</th>
            <th style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 500 }}>创建时间</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const Icon = TYPE_ICON[item.type] || FileText
            const state = primaryStatusToState(item.primary_task_status)
            const stateLabel = STATE_LABEL[state] || 'queued'
            const stateColor = STATE_COLOR[state] || STATE_COLOR.queued
            return (
              <tr
                key={item.item_id}
                onClick={() =>
                  navigate(`/workspaces/${item.workspace_id}/items/${item.item_id}/overview`)
                }
                style={{
                  cursor: 'pointer',
                  borderTop: '1px solid var(--line)',
                  transition: 'background 120ms',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'var(--bg-sunken)'
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = ''
                }}
              >
                <td style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon size={16} strokeWidth={1.3} style={{ color: 'var(--ink-3)', flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.name || '未命名'}
                    </span>
                  </div>
                </td>
                <td style={{ padding: '10px 14px', color: 'var(--ink-3)', fontFamily: 'var(--mono)', fontSize: 11 }}>
                  {item.type}
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      fontSize: 11,
                      fontFamily: 'var(--mono)',
                    }}
                  >
                    <span
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: 99,
                        background: stateColor,
                        flexShrink: 0,
                      }}
                    />
                    {stateLabel}
                  </span>
                </td>
                <td style={{ padding: '10px 14px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}>
                  {formatDuration(item.duration_seconds)}
                </td>
                <td style={{ padding: '10px 14px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}>
                  {formatDate(item.created_at)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )

  return (
    <div style={{ padding: '28px 32px', overflow: 'auto', height: '100%' }}>
      {/* ── 顶部栏 ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 24,
        }}
      >
        <div>
          <div className="eyebrow">LIBRARY · {statLabel}</div>
          <h1 className="display" style={{ fontSize: 48, margin: '8px 0 6px' }}>
            资料库
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* 排序下拉 */}
          <SortMenu />

          {/* grid/list 切换 */}
          <div
            style={{
              display: 'flex',
              gap: 4,
              padding: 3,
              background: 'var(--bg-sunken)',
              borderRadius: 10,
            }}
          >
            <button
              onClick={() => setViewMode('grid')}
              style={{
                padding: '6px 10px',
                borderRadius: 7,
                fontSize: 12,
                background: viewMode === 'grid' ? 'var(--bg-elev)' : 'transparent',
                color: viewMode === 'grid' ? 'var(--ink)' : 'var(--ink-3)',
                boxShadow: viewMode === 'grid' ? 'var(--shadow-sm)' : 'none',
                border: 'none',
                cursor: 'pointer',
              }}
              title="网格视图"
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <rect x="0.5" y="0.5" width="5" height="5" rx="1.5" fill="currentColor" />
                <rect x="7.5" y="0.5" width="5" height="5" rx="1.5" fill="currentColor" />
                <rect x="0.5" y="7.5" width="5" height="5" rx="1.5" fill="currentColor" />
                <rect x="7.5" y="7.5" width="5" height="5" rx="1.5" fill="currentColor" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('list')}
              style={{
                padding: '6px 10px',
                borderRadius: 7,
                fontSize: 12,
                background: viewMode === 'list' ? 'var(--bg-elev)' : 'transparent',
                color: viewMode === 'list' ? 'var(--ink)' : 'var(--ink-3)',
                boxShadow: viewMode === 'list' ? 'var(--shadow-sm)' : 'none',
                border: 'none',
                cursor: 'pointer',
              }}
              title="列表视图"
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <rect x="0.5" y="0.5" width="12" height="2" rx="1" fill="currentColor" />
                <rect x="0.5" y="5.5" width="12" height="2" rx="1" fill="currentColor" />
                <rect x="0.5" y="10.5" width="12" height="2" rx="1" fill="currentColor" />
              </svg>
            </button>
          </div>

          {/* 导入按钮占位 */}
          <button className="btn btn-primary" style={{ opacity: 0.7, cursor: 'default' }}>
            <Upload size={14} />
            导入
          </button>
        </div>
      </div>

      {/* ── Chip 筛选 ── */}
      <FilterChips />

      {/* ── 内容区 ── */}
      {loading && (
        <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
          <div className="spinner" />
          <span className="ml-3">加载资料库…</span>
        </div>
      )}

      {error && (
        <div
          className="flex items-center justify-center py-20 text-sm"
          style={{ color: 'var(--accent)' }}
        >
          {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* Workspace 区 */}
          {filteredWorkspaces && filteredWorkspaces.length > 0 && (
            <>
              {typeFilters.length > 0 && (
                <div className="eyebrow" style={{ marginBottom: 12, marginTop: 4 }}>
                  工作空间 · {filteredWorkspaces.length}
                </div>
              )}
              <div
                className={viewMode === 'grid' ? 'ex-grid' : undefined}
                style={{ marginBottom: typeFilters.length > 0 ? 28 : 0 }}
              >
                {filteredWorkspaces.map((ws) => (
                  <WorkspaceCard key={ws.workspace_id} workspace={ws} />
                ))}
              </div>
            </>
          )}

          {/* Item 区 */}
          {!(showWorkspace && typeFilters.length === 0) && (
            <>
              {showWorkspace && typeFilters.length > 0 && filteredItems.length > 0 && (
                <div className="eyebrow" style={{ marginBottom: 12 }}>
                  素材 · {filteredItems.length}
                </div>
              )}
              {filteredItems.length === 0 ? (
                <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
                  {showAll && data.items.length === 0
                    ? '暂无内容，去工作台添加素材吧'
                    : '没有匹配的素材'}
                </div>
              ) : viewMode === 'list' ? (
                renderListView(filteredItems)
              ) : (
                renderGridView(filteredItems)
              )}
            </>
          )}

          {showWorkspace &&
            typeFilters.length === 0 &&
            filteredWorkspaces &&
            filteredWorkspaces.length === 0 && (
              <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
                没有匹配的工作空间
              </div>
            )}
        </>
      )}
    </div>
  )
}
