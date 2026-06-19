import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trash2, Plus, Inbox, Filter, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { fetchLibrary, deleteItem, batchDeleteItems, type LibraryItem, type LibraryResponse } from '@/services/library'
import { deleteWorkspace, startItemPipeline } from '@/services/workspaces'
import { useLibraryStore, type SortBy } from '@/store/libraryStore'
import { resolveItemRoute } from '@/lib/resolveItemRoute'
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
  const [analyzing, setAnalyzing] = useState(false)

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

  const toggleWorkspaceSelect = useCallback((wsId: string) => {
    setSelectedSet((prev) => {
      const next = new Set(prev)
      const key = `ws:${wsId}`
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

  const filteredWorkspaces = useMemo(() => {
    if (!data || !showWorkspace) return null
    return data.workspaces
  }, [data, showWorkspace])

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
    const next = new Set<string>()
    filteredItems.forEach((it) => next.add(selectionKey(it.workspace_id, it.item_id)))
    if (filteredWorkspaces) {
      filteredWorkspaces.forEach((ws) => next.add(`ws:${ws.workspace_id}`))
    }
    setSelectedSet(next)
  }, [filteredItems, filteredWorkspaces])

  const handleDeleteOne = useCallback(async (item: LibraryItem) => {
    const label = item.name || '未命名'
    const ok = window.confirm(`确定删除「${label}」？`)
    if (!ok) return
    try {
      await deleteItem(item.workspace_id, item.item_id)
      toast.success(`已删除「${label}」`)
      load()
    } catch {
      toast.error('删除失败，请重试')
    }
  }, [load])

  const handleDeleteWorkspace = useCallback(async (wsId: string) => {
    const ws = data?.workspaces.find((w) => w.workspace_id === wsId)
    const label = ws?.name || '未命名合集'
    const ok = window.confirm(`确定删除合集「${label}」？`)
    if (!ok) return
    try {
      await deleteWorkspace(wsId)
      toast.success(`已删除合集「${label}」`)
      load()
    } catch {
      toast.error('删除合集失败，请重试')
    }
  }, [data, load])

  const handleBatchDelete = useCallback(async () => {
    if (selectedSet.size === 0) return
    const ok = window.confirm(`确定删除选中的 ${selectedSet.size} 项？此操作不可撤销。`)
    if (!ok) return
    setDeleting(true)
    try {
      const items: { workspace_id: string; item_id: string }[] = []
      const wsIds: string[] = []
      Array.from(selectedSet).forEach((key) => {
        if (key.startsWith('ws:')) {
          wsIds.push(key.slice(3))
        } else {
          const [ws, ...rest] = key.split(':')
          items.push({ workspace_id: ws, item_id: rest.join(':') })
        }
      })
      if (items.length > 0) {
        await batchDeleteItems(items)
      }
      if (wsIds.length > 0) {
        await Promise.all(wsIds.map((id) => deleteWorkspace(id)))
      }
      toast.success(`已删除 ${selectedSet.size} 项`)
      setSelectedSet(new Set())
      load()
    } catch {
      toast.error('批量删除失败，请重试')
    } finally {
      setDeleting(false)
    }
  }, [selectedSet, load])

  // I2.1: 批量分析（仅图片）— 对选中 image 素材循环调 start，复用已存 preflight + 浮动队列
  const handleBatchAnalyze = useCallback(async () => {
    if (selectedSet.size === 0) return
    const imageItems = filteredItems.filter(
      (it) => it.type === 'image' && selectedSet.has(selectionKey(it.workspace_id, it.item_id)),
    )
    if (imageItems.length === 0) {
      toast.error('请选择图片笔记（仅图片支持批量分析）')
      return
    }
    setAnalyzing(true)
    try {
      let ok = 0
      for (const it of imageItems) {
        try {
          await startItemPipeline(it.workspace_id, it.item_id)
          ok++
        } catch {
          /* 单个失败不中断其余 */
        }
      }
      toast.success(`已触发 ${ok}/${imageItems.length} 个图片分析，进度见右上角任务队列`)
      setSelectedSet(new Set())
      load()
    } finally {
      setAnalyzing(false)
    }
  }, [selectedSet, filteredItems, load])



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
    if (item.status === 'done') {
      navigate(resolveItemRoute(item.workspace_id, item))
    } else {
      // 未完成 → 不进结果页，提示用户
      toast.info('该笔记尚在分析中，请从任务面板查看进度')
    }
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
            横切所有合集的笔记池。按类型筛、按时长/状态排，找到该用的那一个。
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* 选择控制 */}
          {(filteredItems.length > 0 || (filteredWorkspaces && filteredWorkspaces.length > 0)) && (
            <>
              {selectMode ? (
                <>
                  <button className="btn" style={{ fontSize: 12, height: 32 }} onClick={selectAll}>
                    全选
                  </button>
                  <button className="btn" style={{ fontSize: 12, height: 32 }} onClick={clearSelection}>
                    取消
                  </button>
                  <button
                    className="btn"
                    style={{
                      fontSize: 12,
                      height: 32,
                      color: selectedSet.size > 0 ? 'var(--accent-pink)' : 'var(--ink-4)',
                      borderColor: selectedSet.size > 0 ? 'var(--accent-pink)' : 'var(--line)',
                      opacity: deleting || selectedSet.size === 0 ? 0.5 : 1,
                    }}
                    onClick={handleBatchDelete}
                    disabled={deleting || selectedSet.size === 0}
                  >
                    <Trash2 size={13} />
                    删除 {selectedSet.size > 0 ? `(${selectedSet.size})` : ''}
                  </button>
                  <button
                    className="btn"
                    style={{
                      fontSize: 12,
                      height: 32,
                      color: selectedSet.size > 0 ? 'var(--accent-3)' : 'var(--ink-4)',
                      borderColor: selectedSet.size > 0 ? 'var(--accent-3)' : 'var(--line)',
                      opacity: analyzing || selectedSet.size === 0 ? 0.5 : 1,
                    }}
                    onClick={handleBatchAnalyze}
                    disabled={analyzing || selectedSet.size === 0}
                    title="仅对选中的图片笔记触发分析（按已存配置），进度见右上角任务队列"
                  >
                    <Sparkles size={13} />
                    {analyzing ? '分析中…' : '批量分析'}
                  </button>
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
            title="去工作台新建合集"
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
        <div className="empty-state">
          <div className="spinner" />
          <div className="empty-state-desc">加载资料库…</div>
        </div>
      )}

      {error && (
        <div className="empty-state" style={{ color: 'var(--accent-pink)' }}>
          <div className="empty-state-title">{error}</div>
          <button className="btn" style={{ marginTop: 8, fontSize: 12 }} onClick={load}>
            重试
          </button>
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* Workspace 区 */}
          {filteredWorkspaces && filteredWorkspaces.length > 0 && (
            <>
              {typeFilters.length > 0 && (
                <div className="eyebrow" style={{ marginBottom: 12, marginTop: 4 }}>
                  合集 · {filteredWorkspaces.length}
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
                      selectMode={selectMode}
                      selected={selectedSet.has(`ws:${ws.workspace_id}`)}
                      onToggleSelect={toggleWorkspaceSelect}
                      onDelete={handleDeleteWorkspace}
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
                  笔记 · {filteredItems.length}
                </div>
              )}
              {filteredItems.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <Inbox size={24} strokeWidth={1.5} />
                  </div>
                  <div className="empty-state-title">
                    {showAll && data.items.length === 0
                      ? '暂无笔记'
                      : '没有匹配的笔记'}
                  </div>
                  <div className="empty-state-desc">
                    {showAll && data.items.length === 0
                      ? '去工作台添加笔记，或粘贴一个链接开始吧'
                      : '试试切换筛选条件或清除 chip'}
                  </div>
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
                      key={`${item.workspace_id}:${item.item_id}`}
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
              <div className="empty-state">
                <div className="empty-state-icon">
                  <Filter size={24} strokeWidth={1.5} />
                </div>
                <div className="empty-state-title">没有合集</div>
                <div className="empty-state-desc">
                  还没有创建任何合集，去首页导入笔记开始吧
                </div>
              </div>
            )}
        </>
      )}
    </div>
  )
}
