import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderOpen, Inbox, AlertCircle } from 'lucide-react'
import { fetchLibrary, type LibraryResponse } from '@/services/library'
import '@/pages/LibraryPage/library.css'

const TYPE_TONE: Record<string, { c: string; l: string }> = {
  video: { c: 'var(--accent-2)', l: '视频' },
  audio: { c: 'var(--accent-green)', l: '音频' },
  image: { c: 'var(--accent-3)', l: '图片' },
  text:  { c: 'var(--ink-3)', l: '文字' },
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

function CollectionsPage() {
  const navigate = useNavigate()
  const [data, setData] = useState<LibraryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    fetchLibrary()
      .then(setData)
      .catch(() => setError('加载合集失败，请确认后端已启动后重试。'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const workspaces = data?.workspaces ?? []
  const items = data?.items ?? []

  // "未归类笔记"：不属于任何已有合集的笔记（当前后端每个 item 都有 workspace，
  // 所以这里取 items_count === 0 的 workspace 作为兜底提示）
  const ungroupedCount = items.filter(
    (it) => !workspaces.some((ws) => ws.workspace_id === it.workspace_id),
  ).length

  return (
    <div style={{ padding: '28px 32px', overflow: 'auto', height: '100%' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>合集</h1>
        <p style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 6 }}>
          按主题整理笔记，点击卡片进入详情。
        </p>
      </div>

      {loading ? (
        <div className="empty-state">
          <div className="spinner" />
        </div>
      ) : error ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <AlertCircle size={28} strokeWidth={1.5} style={{ color: 'var(--accent-pink)' }} />
          </div>
          <div className="empty-state-title">加载失败</div>
          <div className="empty-state-desc">{error}</div>
          <button
            className="btn btn-primary"
            style={{ marginTop: 16, fontSize: 13, height: 34 }}
            onClick={load}
          >
            重试
          </button>
        </div>
      ) : workspaces.length === 0 && ungroupedCount === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Inbox size={28} strokeWidth={1.5} />
          </div>
          <div className="empty-state-title">还没有合集</div>
          <div className="empty-state-desc">去工作台添加笔记后，会自动归入合集。</div>
        </div>
      ) : (
        <div className="ex-grid">
          {workspaces.map((ws) => {
            const comp = ws.items_count_by_type || {}
            const total = ws.items_count

            return (
              <div
                key={ws.workspace_id}
                className="ws-card"
                onClick={() => navigate(`/workspaces/${ws.workspace_id}`)}
              >
                <div
                  style={{
                    height: 4,
                    background: 'var(--accent-2)',
                    flexShrink: 0,
                  }}
                />
                <div className="ws-card-body">
                  <div>
                    <div className="ws-title">{ws.name}</div>
                    <div
                      style={{
                        fontFamily: 'var(--mono)',
                        fontSize: 10.5,
                        color: 'var(--ink-3)',
                        letterSpacing: '0.04em',
                        marginTop: 6,
                        display: 'flex',
                        gap: 8,
                      }}
                    >
                      <span>{total} 个笔记</span>
                      {ws.updated_at && (
                        <>
                          <span style={{ opacity: 0.4 }}>·</span>
                          <span>{formatRelative(ws.updated_at)}活跃</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {Array.from(Object.entries(comp)).map(([t, n]) => (
                      <span
                        key={t}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 11.5,
                          color: 'var(--ink-2)',
                        }}
                      >
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: 99,
                            background: TYPE_TONE[t]?.c ?? 'var(--ink-4)',
                          }}
                        />
                        <b style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{n}</b>
                        <span style={{ color: 'var(--ink-3)' }}>
                          {TYPE_TONE[t]?.l ?? t}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}

          {/* ── 未归类笔记 ── */}
          <div
            className="ws-card"
            style={{
              borderColor: 'var(--line)',
              opacity: ungroupedCount > 0 ? 1 : 0.45,
              cursor: ungroupedCount > 0 ? 'pointer' : 'default',
            }}
            onClick={() => {
              if (ungroupedCount > 0) navigate('/library')
            }}
          >
            <div
              style={{
                height: 4,
                background: 'var(--ink-4)',
                flexShrink: 0,
              }}
            />
            <div className="ws-card-body" style={{ alignItems: 'center', textAlign: 'center' }}>
              <FolderOpen size={28} strokeWidth={1.5} style={{ color: 'var(--ink-4)' }} />
              <div style={{ fontWeight: 600, fontSize: 14 }}>未归类笔记</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                {ungroupedCount > 0
                  ? `${ungroupedCount} 篇笔记尚未归入特定合集`
                  : '暂无未归类笔记'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CollectionsPage
