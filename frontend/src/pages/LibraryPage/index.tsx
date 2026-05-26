import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trash2, Plus } from 'lucide-react'
import { fetchLibrary, deleteItem, batchDeleteItems, type LibraryItem, type LibraryResponse } from '@/services/library'
import { useLibraryStore, type SortBy } from '@/store/libraryStore'
import { FilterChips } from './FilterChips'
import { SortMenu } from './SortMenu'
import { ViewToggle } from './ViewToggle'
import { ItemCard } from './ItemCard'
import { ListView } from './ListView'
import { WorkspaceCard } from './WorkspaceCard'
import {
  STATE_ORDER,
  primaryStatusToState,
} from './libraryHelpers'
import './library.css'

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

  const handleOpenItem = useCallback((item: LibraryItem) => {
    navigate(`/workspaces/${item.workspace_id}/items/${item.item_id}/overview`)
  }, [navigate])

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
                className="ex-grid"
                style={{ marginBottom: typeFilters.length > 0 ? 28 : 0 }}
              >
                {filteredWorkspaces.map((ws) => {
                  const wsItems = data.items.filter(
                    (it) => it.workspace_id === ws.workspace_id,
                  )
                  return (
                    <WorkspaceCard
                      key={ws.workspace_id}
                      workspace={ws}
                      items={wsItems}
                    />
                  )
                })}
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
                <ListView
                  items={filteredItems}
                  selectMode={selectMode}
                  selectedSet={selectedSet}
                  selectionKey={selectionKey}
                  onToggle={toggleSelect}
                  onOpen={handleOpenItem}
                  onDelete={handleDeleteOne}
                />
              ) : (
                <div className="ex-grid">
                  {filteredItems.map((item) => (
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
