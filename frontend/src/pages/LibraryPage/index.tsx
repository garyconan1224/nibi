import { useEffect, useState, useCallback, useMemo } from 'react'
import { Upload } from 'lucide-react'
import { fetchLibrary, type LibraryResponse } from '@/services/library'
import { useLibraryStore } from '@/store/libraryStore'
import { FilterChips } from './FilterChips'
import { ItemCard } from './ItemCard'
import { WorkspaceCard } from './WorkspaceCard'
import './library.css'

export default function LibraryPage() {
  const [data, setData] = useState<LibraryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const selectedFilters = useLibraryStore((s) => s.selectedFilters)

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
    if (showAll) return data.items
    if (typeFilters.length === 0) return []
    return data.items.filter((it) => typeFilters.includes(it.type))
  }, [data, showAll, typeFilters])

  const filteredWorkspaces = useMemo(() => {
    if (!data || !showWorkspace) return null
    return data.workspaces
  }, [data, showWorkspace])

  // 顶部计数：workspace-only 视图显示 workspace 数，否则显示 item 数
  const statLabel = showWorkspace && typeFilters.length === 0
    ? `${filteredWorkspaces?.length ?? 0} WORKSPACES`
    : `${filteredItems.length} ITEMS`

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
          <h1
            className="display"
            style={{ fontSize: 48, margin: '8px 0 6px' }}
          >
            资料库
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* grid/list 切换占位（L4 实现功能） */}
          <div
            style={{
              display: 'flex',
              gap: 4,
              padding: 3,
              background: 'var(--bg-sunken)',
              borderRadius: 10,
              opacity: 0.5,
            }}
          >
            <button
              style={{
                padding: '6px 10px',
                borderRadius: 7,
                fontSize: 12,
                background: 'var(--bg-elev)',
                color: 'var(--ink)',
                boxShadow: 'var(--shadow-sm)',
                border: 'none',
                cursor: 'default',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <rect x="0.5" y="0.5" width="5" height="5" rx="1.5" fill="currentColor" />
                <rect x="7.5" y="0.5" width="5" height="5" rx="1.5" fill="currentColor" />
                <rect x="0.5" y="7.5" width="5" height="5" rx="1.5" fill="currentColor" />
                <rect x="7.5" y="7.5" width="5" height="5" rx="1.5" fill="currentColor" />
              </svg>
            </button>
            <button
              style={{
                padding: '6px 10px',
                borderRadius: 7,
                fontSize: 12,
                background: 'transparent',
                color: 'var(--ink-3)',
                border: 'none',
                cursor: 'default',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <rect x="0.5" y="0.5" width="12" height="2" rx="1" fill="currentColor" />
                <rect x="0.5" y="5.5" width="12" height="2" rx="1" fill="currentColor" />
                <rect x="0.5" y="10.5" width="12" height="2" rx="1" fill="currentColor" />
              </svg>
            </button>
          </div>
          {/* 导入按钮占位（未来单开 phase） */}
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
        <div className="flex items-center justify-center py-20 text-sm" style={{ color: 'var(--accent)' }}>
          {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* Workspace 区（workspace chip 选中时） */}
          {filteredWorkspaces && filteredWorkspaces.length > 0 && (
            <>
              {/* 同时选中 workspace + 类型时显示 section 标题 */}
              {typeFilters.length > 0 && (
                <div
                  className="eyebrow"
                  style={{ marginBottom: 12, marginTop: 4 }}
                >
                  工作空间 · {filteredWorkspaces.length}
                </div>
              )}
              <div className="ex-grid" style={{ marginBottom: typeFilters.length > 0 ? 28 : 0 }}>
                {filteredWorkspaces.map((ws) => (
                  <WorkspaceCard key={ws.workspace_id} workspace={ws} />
                ))}
              </div>
            </>
          )}

          {/* Item 区（非纯 workspace 视图时） */}
          {!(showWorkspace && typeFilters.length === 0) && (
            <>
              {/* 同时选中 workspace + 类型时显示 section 标题 */}
              {showWorkspace && typeFilters.length > 0 && filteredItems.length > 0 && (
                <div
                  className="eyebrow"
                  style={{ marginBottom: 12 }}
                >
                  素材 · {filteredItems.length}
                </div>
              )}
              {filteredItems.length === 0 ? (
                <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
                  {showAll && data.items.length === 0
                    ? '暂无内容，去工作台添加素材吧'
                    : '没有匹配的素材'}
                </div>
              ) : (
                <div className="ex-grid">
                  {filteredItems.map((item) => (
                    <ItemCard key={item.item_id} item={item} />
                  ))}
                </div>
              )}
            </>
          )}

          {/* 纯 workspace 视图且无 workspace */}
          {showWorkspace && typeFilters.length === 0 && filteredWorkspaces && filteredWorkspaces.length === 0 && (
            <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
              没有匹配的工作空间
            </div>
          )}
        </>
      )}
    </div>
  )
}
