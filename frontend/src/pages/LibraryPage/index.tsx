import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Trash2, Plus, Inbox, Filter, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { fetchLibrary, deleteItem, batchDeleteItems, type LibraryItem, type LibraryResponse } from '@/services/library'
import { deleteWorkspace, startItemPipeline } from '@/services/workspaces'
import { useLibraryStore, type SortBy } from '@/store/libraryStore'
import { FilterChips } from './FilterChips'
import { SortMenu } from './SortMenu'
import { ViewToggle } from './ViewToggle'
import { ItemCard } from './ItemCard'
import { WorkspaceCard } from './WorkspaceCard'
import {
  STATE_ORDER,
  primaryStatusToState,
} from './libraryHelpers'
import './library.css'

function matchesQuery(query: string, values: Array<string | null | undefined>): boolean {
  if (!query) return true
  return values.some((value) => value?.toLowerCase().includes(query))
}

function isItemGenerating(item: LibraryItem): boolean {
  const taskState = primaryStatusToState(item.primary_task_status)
  return taskState === 'queued' || taskState === 'running' || item.status === 'pending' || item.status === 'processing'
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

export default function LibraryPage({ kind }: { kind?: 'note' | 'replica' } = {}) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const intentFilter = searchParams.get('intent') || ''
  const [data, setData] = useState<LibraryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selecting, setSelecting] = useState(false)
  const [selectedSet, setSelectedSet] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [query, setQuery] = useState('')

  const selectedFilters = useLibraryStore((s) => s.selectedFilters)
  const setSelectedFilters = useLibraryStore((s) => s.setSelectedFilters)
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

  const typeFilters = selectedFilters.filter(
    (k): k is LibraryItem['type'] => k === 'video' || k === 'audio' || k === 'image' || k === 'text',
  )
  const showCollections = selectedFilters.includes('collection')
  const showRunning = selectedFilters.includes('running')
  const showAll = selectedFilters.includes('all')
  const normalizedQuery = query.trim().toLowerCase()

  const scopedItems = useMemo(() => {
    if (!data) return []
    let items = kind ? data.items.filter((it) => it.workspace_kind === kind) : data.items
    if (intentFilter) items = items.filter((it) => it.preflight?.intent === intentFilter)
    return items
  }, [data, kind, intentFilter])

  const scopedWorkspaces = useMemo(() => {
    if (!data) return []
    return kind ? data.workspaces.filter((ws) => ws.kind === kind) : data.workspaces
  }, [data, kind])

  const itemsByWorkspace = useMemo(() => {
    const map = new Map<string, LibraryItem[]>()
    scopedItems.forEach((item) => {
      const current = map.get(item.workspace_id)
      if (current) current.push(item)
      else map.set(item.workspace_id, [item])
    })
    return map
  }, [scopedItems])

  const collectionWorkspaces = useMemo(
    () => scopedWorkspaces.filter((ws) => (itemsByWorkspace.get(ws.workspace_id)?.length ?? ws.items_count) > 1),
    [scopedWorkspaces, itemsByWorkspace],
  )

  const collectionWorkspaceIds = useMemo(
    () => new Set(collectionWorkspaces.map((ws) => ws.workspace_id)),
    [collectionWorkspaces],
  )

  const visibleWorkspaces = useMemo(() => {
    if (!data) return []
    if (!(showAll || showCollections || showRunning)) return []
    return collectionWorkspaces.filter((ws) => {
      const wsItems = itemsByWorkspace.get(ws.workspace_id) ?? []
      if (wsItems.length === 0) return false
      if (typeFilters.length > 0 && !wsItems.some((item) => typeFilters.includes(item.type))) return false
      if (showRunning && !(ws.status === 'running' || wsItems.some(isItemGenerating))) return false
      if (!matchesQuery(normalizedQuery, [ws.name, ...wsItems.flatMap((item) => [item.name, item.source_value, item.workspace_name])])) return false
      return true
    })
  }, [data, showAll, showCollections, showRunning, collectionWorkspaces, itemsByWorkspace, typeFilters, normalizedQuery])

  const visibleWorkspaceIds = useMemo(
    () => new Set(visibleWorkspaces.map((ws) => ws.workspace_id)),
    [visibleWorkspaces],
  )

  const visibleItems = useMemo(() => {
    let items = scopedItems
    if (!showAll) {
      if (typeFilters.length > 0) {
        items = items.filter((item) => typeFilters.includes(item.type))
      }
      if (showRunning) {
        items = items.filter(isItemGenerating)
      }
      if (showCollections && typeFilters.length === 0 && !showRunning) {
        return []
      }
      if (typeFilters.length === 0 && !showRunning && !showCollections) {
        return []
      }
    }
    if (visibleWorkspaceIds.size > 0) {
      items = items.filter((item) => !visibleWorkspaceIds.has(item.workspace_id))
    }
    if (normalizedQuery) {
      items = items.filter((item) => matchesQuery(normalizedQuery, [item.name, item.source_value, item.workspace_name]))
    }
    return sortItems(items, sortBy)
  }, [scopedItems, showAll, showRunning, showCollections, typeFilters, visibleWorkspaceIds, normalizedQuery, sortBy])

  const hasVisibleEntries = visibleWorkspaces.length > 0 || visibleItems.length > 0

  const selectAll = useCallback(() => {
    const next = new Set<string>()
    visibleItems.forEach((it) => next.add(selectionKey(it.workspace_id, it.item_id)))
    visibleWorkspaces.forEach((ws) => next.add(`ws:${ws.workspace_id}`))
    setSelectedSet(next)
  }, [visibleItems, visibleWorkspaces])

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
    const imageItems = visibleItems.filter(
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
  }, [selectedSet, visibleItems, load])

  const chipCounts = useMemo(() => {
    if (!data) return undefined
    const standaloneItems = scopedItems.filter((item) => !collectionWorkspaceIds.has(item.workspace_id))
    return {
      all: standaloneItems.length + collectionWorkspaces.length,
      video: scopedItems.filter((i) => i.type === 'video').length,
      audio: scopedItems.filter((i) => i.type === 'audio').length,
      image: scopedItems.filter((i) => i.type === 'image').length,
      text: scopedItems.filter((i) => i.type === 'text').length,
      collection: collectionWorkspaces.length,
      running:
        standaloneItems.filter(isItemGenerating).length +
        collectionWorkspaces.filter((ws) => ws.status === 'running' || (itemsByWorkspace.get(ws.workspace_id) ?? []).some(isItemGenerating)).length,
    }
  }, [data, scopedItems, collectionWorkspaces, collectionWorkspaceIds, itemsByWorkspace])

  const emptyTitle = kind === 'note' ? '暂无笔记' : kind === 'replica' ? '暂无复刻' : '暂无笔记'
  const emptyDesc = kind === 'note'
    ? '去工作台添加学习素材，或粘贴一个链接开始吧'
    : kind === 'replica'
      ? '去工作台添加复刻素材，开始创作吧'
      : '去工作台添加笔记，或粘贴一个链接开始吧'

  const pageTone = kind === 'replica' ? 'replica' : kind === 'note' ? 'note' : 'library'
  const pageKicker = kind === 'replica'
    ? 'REPLICA LIBRARY'
    : kind === 'note'
      ? 'NOTE LIBRARY'
      : 'MATERIAL LIBRARY'

  return (
    <div className={`lib-page lib-page--${pageTone}`}>
      {/* ── Hero ── */}
      <div className="lib-page-header">
        <div>
          <div className="lib-kicker">{pageKicker} · LOCAL</div>
          <h2>
            {kind === 'note'
              ? '所有做过的笔记，都在这里汇总。'
              : kind === 'replica'
                ? '逐帧复刻，画面里的每个细节。'
                : '所有参考资料，一键检索引用。'}
          </h2>
          <p>
            {kind === 'note'
              ? '视频、音频、图片和文本都保留各自入口，只把最需要的操作放在第一层。'
              : kind === 'replica'
                ? '对视频和图片进行逐帧拆解与结构分析，沉淀可复用的视觉参考和分镜脚本。'
                : '导入 PDF、论文、网页和文档，AI 自动建立知识图谱并在笔记和分镜中关联引用。'}
          </p>
          <div className="lib-hero-actions">
            <button className="lib-cta lib-cta-primary" onClick={() => navigate('/')}>
              <Plus size={15} />
              {kind === 'replica' ? '新建复刻' : kind === 'note' ? '导入内容' : '上传资料'}
            </button>
            <button className="lib-cta lib-cta-secondary" onClick={() => setSelectedFilters(['collection'])}>
              <Plus size={15} />
              查看合集
            </button>
          </div>
          <div className="lib-mini-stats" aria-label="library-stats">
            <span>全部 {chipCounts?.all ?? 0}</span>
            <span>视频 {chipCounts?.video ?? 0}</span>
            <span>音频 {chipCounts?.audio ?? 0}</span>
            <span>图片 {chipCounts?.image ?? 0}</span>
            <span>文字 {chipCounts?.text ?? 0}</span>
          </div>
        </div>
        <div className="lib-actions">
          {hasVisibleEntries && (
            <>
              {selectMode ? (
                <>
                  <button className="btn btn-sm" onClick={selectAll}>全选</button>
                  <button className="btn btn-sm" onClick={clearSelection}>取消</button>
                  <button
                    className={`btn btn-sm${selectedSet.size > 0 ? ' btn-danger' : ''}`}
                    disabled={deleting || selectedSet.size === 0}
                    onClick={handleBatchDelete}
                  >
                    <Trash2 size={13} />
                    删除 {selectedSet.size > 0 ? `(${selectedSet.size})` : ''}
                  </button>
                  <button
                    className={`btn btn-sm${selectedSet.size > 0 ? ' btn-secondary' : ''}`}
                    disabled={analyzing || selectedSet.size === 0}
                    onClick={handleBatchAnalyze}
                    title="仅对选中的图片笔记触发分析（按已存配置），进度见右上角任务队列"
                  >
                    <Sparkles size={13} />
                    {analyzing ? '分析中…' : '批量分析'}
                  </button>
                </>
              ) : (
                <button className="btn btn-sm" onClick={enterSelectMode}>选择</button>
              )}
            </>
          )}
          <SortMenu />
          <ViewToggle />
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="lib-toolbar">
        <FilterChips counts={chipCounts} />
        <div className="lib-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="搜索标题、来源、摘要..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <ViewToggle />
      </div>

      {/* ── 内容区 ── */}
      {loading && (
        <div className="empty-state">
          <div className="spinner" />
          <div className="empty-state-desc">加载资料库…</div>
        </div>
      )}

      {error && (
        <div className="empty-state lib-error">
          <div className="empty-state-title">{error}</div>
          <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={load}>
            重试
          </button>
        </div>
      )}

      {!loading && !error && data && (
        <>
          {!hasVisibleEntries ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                {(showCollections || showRunning || typeFilters.length > 0 || query.trim()) ? (
                  <Filter size={24} strokeWidth={1.5} />
                ) : (
                  <Inbox size={24} strokeWidth={1.5} />
                )}
              </div>
              <div className="empty-state-title">
                {showAll && chipCounts?.all === 0 ? emptyTitle : '没有匹配的笔记'}
              </div>
              <div className="empty-state-desc">
                {showAll && chipCounts?.all === 0 ? emptyDesc : '试试切换筛选条件或清除 chip'}
              </div>
            </div>
          ) : (
            <div className={`note-grid${viewMode === 'list' ? ' is-list' : ''}`}>
              {visibleWorkspaces.map((ws) => (
                <WorkspaceCard
                  key={ws.workspace_id}
                  workspace={ws}
                  items={itemsByWorkspace.get(ws.workspace_id) ?? []}
                  selectMode={selectMode}
                  selected={selectedSet.has(`ws:${ws.workspace_id}`)}
                  onToggleSelect={toggleWorkspaceSelect}
                  onDelete={handleDeleteWorkspace}
                />
              ))}
              {visibleItems.map((item) => (
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
    </div>
  )
}
