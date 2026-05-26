import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Film, Music, ImageIcon, FileText, Trash2, CheckCircle, Circle, Plus } from 'lucide-react'
import { fetchLibrary, deleteItem, batchDeleteItems, type LibraryItem, type LibraryResponse } from '@/services/library'
import { useLibraryStore, type SortBy } from '@/store/libraryStore'
import { FilterChips } from './FilterChips'
import { SortMenu } from './SortMenu'
import { ViewToggle } from './ViewToggle'
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
  running: 'running',
  queued: 'queued',
  error: 'error',
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
  const [selecting, setSelecting] = useState(false)
  const [selectedSet, setSelectedSet] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)

  const selectedFilters = useLibraryStore((s) => s.selectedFilters)
  const sortBy = useLibraryStore((s) => s.sortBy)
  const viewMode = useLibraryStore((s) => s.viewMode)

  const selectionKey = (wsId: string, itemId: string) => `${wsId}:${itemId}`

  const toggleSelect = useCallback((itemId: string, wsId: string) => {
    setSelectedSet((prev) => {
      const next = new Set(prev)
      const key = `${wsId}:${itemId}`
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedSet(new Set())
    setSelecting(false)
  }, [])

  const enterSelectMode = useCallback(() => {
    setSelectedSet(new Set())
    setSelecting(true)
  }, [])

  const selectMode = selecting

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const selectAll = useCallback(() => {
    setSelectedSet(new Set(filteredItems.map((it) => selectionKey(it.workspace_id, it.item_id))))
  }, [filteredItems])

  const handleDeleteOne = useCallback(async (item: LibraryItem) => {
    const ok = window.confirm(`确定删除「${item.name || '未命名'}」？`)
    if (!ok) return
    try {
      await deleteItem(item.workspace_id, item.item_id)
      load()
    } catch {
      alert('删除失败，请重试')
    }
  }, [load])

  const handleBatchDelete = useCallback(async () => {
    if (selectedSet.size === 0) return
    const ok = window.confirm(`确定删除选中的 ${selectedSet.size} 个素材？此操作不可撤销。`)
    if (!ok) return
    setDeleting(true)
    try {
      const items = Array.from(selectedSet).map((key) => {
        const [ws, ...rest] = key.split(':')
        return { workspace_id: ws, item_id: rest.join(':') }
      })
      await batchDeleteItems(items)
      setSelectedSet(new Set())
      load()
    } catch {
      alert('批量删除失败，请重试')
    } finally {
      setDeleting(false)
    }
  }, [selectedSet, load])

  const filteredWorkspaces = useMemo(() => {
    if (!data || !showWorkspace) return null
    return data.workspaces
  }, [data, showWorkspace])

  const chipCounts = useMemo(() => {
    if (!data) return undefined
    return {
      all: data.items.length,
      video: data.items.filter((i) => i.type === 'video').length,
      audio: data.items.filter((i) => i.type === 'audio').length,
      image: data.items.filter((i) => i.type === 'image').length,
      text: data.items.filter((i) => i.type === 'text').length,
      workspace: data.workspaces.length,
    }
  }, [data])

  const statLabel =
    showWorkspace && typeFilters.length === 0
      ? `${filteredWorkspaces?.length ?? 0} WORKSPACES`
      : `${filteredItems.length} ITEMS`

  const renderGridView = (items: LibraryItem[]) => (
    <div className="ex-grid">
      {items.map((item) => (
        <ItemCard
          key={item.item_id}
          item={item}
          selected={selectedSet.has(selectionKey(item.workspace_id, item.item_id))}
          selectMode={selectMode}
          onToggleSelect={toggleSelect}
          onDelete={handleDeleteOne}
        />
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
            {selectMode && (
              <th style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 500, width: 36 }}></th>
            )}
            <th style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 500 }}>名称</th>
            <th style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 500 }}>类型</th>
            <th style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 500 }}>状态</th>
            <th style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 500 }}>时长</th>
            <th style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 500 }}>创建时间</th>
            <th style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 500, width: 36 }}></th>
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
                onClick={() => {
                  if (selectMode) {
                    toggleSelect(item.item_id, item.workspace_id)
                  } else {
                    navigate(`/workspaces/${item.workspace_id}/items/${item.item_id}/overview`)
                  }
                }}
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
                {selectMode && (
                  <td style={{ padding: '10px 14px' }} onClick={(e) => e.stopPropagation()}>
                    <span
                      onClick={() => toggleSelect(item.item_id, item.workspace_id)}
                      style={{ cursor: 'pointer', display: 'flex', color: 'var(--ink-3)' }}
                    >
                      {selectedSet.has(selectionKey(item.workspace_id, item.item_id))
                        ? <CheckCircle size={16} style={{ color: 'var(--ink)' }} />
                        : <Circle size={16} />}
                    </span>
                  </td>
                )}
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
                <td style={{ padding: '10px 14px' }} onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handleDeleteOne(item)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--ink-4)',
                      display: 'flex',
                      padding: 2,
                    }}
                    title="删除"
                  >
                    <Trash2 size={14} />
                  </button>
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
          <div className="eyebrow">LIBRARY · {statLabel} · LOCAL</div>
          <h1
            className="display"
            style={{
              fontSize: 'clamp(56px, 7vw, 92px)',
              lineHeight: 0.98,
              margin: '10px 0 4px',
              letterSpacing: '-0.02em',
            }}
          >
            资料库
          </h1>
          <p
            style={{
              fontSize: 16,
              color: 'var(--ink-3)',
              maxWidth: 560,
              margin: '12px 0 0',
              lineHeight: 1.55,
            }}
          >
            横切所有工作空间的素材池。按类型筛、按时长/状态排，找到该用的那一个。
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* 选择控制 */}
          {filteredItems.length > 0 && (
            <>
              {selectMode ? (
                <>
                  <button className="btn" style={{ fontSize: 12, height: 32 }} onClick={selectAll}>
                    全选
                  </button>
                  <button className="btn" style={{ fontSize: 12, height: 32 }} onClick={clearSelection}>
                    取消
                  </button>
                  {selectedSet.size > 0 && (
                    <button
                      className="btn"
                      style={{
                        fontSize: 12,
                        height: 32,
                        color: 'var(--accent)',
                        borderColor: 'var(--accent)',
                        opacity: deleting ? 0.5 : 1,
                      }}
                      onClick={handleBatchDelete}
                      disabled={deleting}
                    >
                      <Trash2 size={13} />
                      删除 ({selectedSet.size})
                    </button>
                  )}
                </>
              ) : (
                <button className="btn" style={{ fontSize: 12, height: 32 }} onClick={enterSelectMode}>
                  选择
                </button>
              )}
            </>
          )}

          {/* 排序下拉 */}
          <SortMenu />

          {/* grid/list 切换 */}
          <ViewToggle />

          {/* 导入按钮 — 跳转工作台 */}
          <button
            className="btn btn-primary"
            style={{ height: 32, fontSize: 12 }}
            onClick={() => navigate('/')}
            title="去工作台新建工作空间"
          >
            <Plus size={14} />
            导入
          </button>
        </div>
      </div>

      {/* ── Chip 筛选 ── */}
      <FilterChips counts={chipCounts} />

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
