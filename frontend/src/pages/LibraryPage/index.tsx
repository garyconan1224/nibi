import { useEffect, useState, useCallback } from 'react'
import { Upload } from 'lucide-react'
import { fetchLibrary, type LibraryResponse } from '@/services/library'
import { ItemCard } from './ItemCard'
import './library.css'

export default function LibraryPage() {
  const [data, setData] = useState<LibraryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  const itemCount = data?.items.length ?? 0

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
          <div className="eyebrow">LIBRARY · {itemCount} ITEMS</div>
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
          {itemCount === 0 ? (
            <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
              暂无内容，去工作台添加素材吧
            </div>
          ) : (
            <div className="ex-grid">
              {data.items.map((item) => (
                <ItemCard key={item.item_id} item={item} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
