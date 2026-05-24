import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import {
  Link2, Upload, Search, X, Check, Plus, ArrowRight, Layers,
} from 'lucide-react'
import { toast } from 'sonner'
import type { WorkspaceRecord } from '@/types/workspace'
import { detectPlatform } from './platforms'
import { normalizeMediaUrl } from '@/lib/url'
import { listWorkspaces, createWorkspace } from '@/services/workspaces'
import { AddMaterialModal } from '@/components/workspace/AddMaterialModal'

const WS_COLORS = [
  '#22c55e', '#f59e0b', '#a855f7', '#0ea5e9',
  '#ef4444', '#ec4899', '#14b8a6', '#eab308',
]

interface ComposerProps {
  onTaskCreated?: () => void
}

export function Composer({ onTaskCreated }: ComposerProps) {
  const [url, setUrl] = useState('')
  const [uploadOpen, setUploadOpen] = useState(false)

  const [workspaces, setWorkspaces] = useState<WorkspaceRecord[]>([])
  const [workspaceSel, setWorkspaceSel] = useState<string[]>([])
  const [wsOpen, setWsOpen] = useState(false)
  const [wsQuery, setWsQuery] = useState('')

  const popRef = useRef<HTMLDivElement>(null)

  // Fetch workspaces on mount
  useEffect(() => {
    listWorkspaces().then(setWorkspaces).catch(() => {
      toast.error('加载工作空间列表失败，请检查后端是否已启动')
    })
  }, [])

  useEffect(() => {
    if (!wsOpen) return
    const handler = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setWsOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [wsOpen])

  const wsById = useMemo(
    () => Object.fromEntries(workspaces.map((w) => [w.workspace_id, w])),
    [workspaces],
  )

  const filteredWs = wsQuery
    ? workspaces.filter((w) => w.name.toLowerCase().includes(wsQuery.toLowerCase()))
    : workspaces

  const toggleWs = useCallback((id: string) =>
    setWorkspaceSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id])), [])

  const removeWs = useCallback((id: string) =>
    setWorkspaceSel((s) => s.filter((x) => x !== id)), [])

  const handleNewWorkspace = useCallback(async () => {
    const name = wsQuery.trim() || '新工作空间'
    try {
      const created = await createWorkspace({ name })
      setWorkspaces((prev) => [...prev, created])
      setWorkspaceSel((s) => [...s, created.workspace_id])
      setWsQuery('')
      toast.success(`工作空间「${name}」已创建`)
    } catch {
      toast.error('创建工作空间失败')
    }
  }, [wsQuery])

  const normalizedUrl = useMemo(() => normalizeMediaUrl(url), [url])
  const platform = detectPlatform(normalizedUrl || url)

  const handleAdd = () => {
    if (!url.trim()) return
    if (workspaceSel.length === 0) {
      toast.error('请先选择工作空间')
      setWsOpen(true)
      return
    }
    setUploadOpen(true)
  }

  const handleUploadClick = () => {
    if (workspaceSel.length === 0) {
      toast.error('请先选择工作空间')
      setWsOpen(true)
      return
    }
    setUploadOpen(true)
  }

  const handleAdded = () => {
    setUploadOpen(false)
    setUrl('')
    listWorkspaces().then(setWorkspaces).catch(() => {
      toast.error('刷新工作空间列表失败')
    })
    onTaskCreated?.()
  }

  return (
    <div className="composer">
      {/* URL row */}
      <div className="composer-url">
        {platform ? (
          <div
            className="platform"
            style={{ background: platform.color, color: '#fff', width: 'auto', padding: '0 10px' }}
          >
            {platform.name}
          </div>
        ) : (
          <div className="platform">
            <Link2 size={18} />
          </div>
        )}

        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="粘贴 B站 / YouTube / 小红书 / 抖音 / 本地文件路径..."
        />

        {platform && (
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            {platform.types.map((t) => (
              <span key={t} className="kw" style={{ background: 'var(--bg-sunken)', fontSize: 11 }}>
                {t}
              </span>
            ))}
          </div>
        )}

        <button className="btn btn-ghost" title="上传本地文件" style={{ gap: 6 }} onClick={handleUploadClick}>
          <Upload size={15} />
          上传
        </button>
      </div>

      {/* Workspace assignment row */}
      <div className="composer-projects">
        <span className="pp-label">归入工作空间</span>

        {workspaceSel.length === 0 && <span className="pp-none">未选空间 · 提交时自动创建</span>}

        {workspaceSel.map((id) => {
          const ws = wsById[id]
          if (!ws) return null
          const color = WS_COLORS[Math.abs(id.charCodeAt(0)) % WS_COLORS.length]
          return (
            <span key={id} className="pp-chip">
              <span className="pp-dot" style={{ background: color }} />
              {ws.name}
              <button className="pp-x" onClick={() => removeWs(id)} title="移除">
                <X size={11} />
              </button>
            </span>
          )
        })}

        <button className="pp-add" onClick={() => setWsOpen((o) => !o)}>
          <Layers size={11} />
          {workspaceSel.length ? '继续添加' : '选择工作空间'}
        </button>

        <span
          style={{
            marginLeft: 'auto',
            fontSize: 10,
            color: 'var(--ink-4)',
            fontFamily: 'var(--mono)',
          }}
          title="一个内容可同时归入多个工作空间"
        >
          可多选 · 一个内容可归入多个空间
        </span>

        {wsOpen && (
          <div className="pp-popover" ref={popRef}>
            <div className="pp-search">
              <Search size={14} />
              <input
                autoFocus
                placeholder="搜索工作空间..."
                value={wsQuery}
                onChange={(e) => setWsQuery(e.target.value)}
              />
              {workspaceSel.length > 0 && (
                <button
                  className="btn btn-ghost"
                  onClick={() => setWorkspaceSel([])}
                  style={{ height: 24, padding: '0 8px', fontSize: 11 }}
                >
                  清空
                </button>
              )}
            </div>

            <div className="pp-list">
              {filteredWs.length === 0 && (
                <div
                  style={{
                    padding: '18px 12px',
                    textAlign: 'center',
                    fontSize: 12,
                    color: 'var(--ink-4)',
                    fontFamily: 'var(--mono)',
                  }}
                >
                  无匹配工作空间
                </div>
              )}
              {filteredWs.map((ws) => {
                const on = workspaceSel.includes(ws.workspace_id)
                const color = WS_COLORS[Math.abs(ws.workspace_id.charCodeAt(0)) % WS_COLORS.length]
                return (
                  <div
                    key={ws.workspace_id}
                    className="pp-row"
                    data-on={on}
                    onClick={() => toggleWs(ws.workspace_id)}
                  >
                    <span className="pp-check">
                      <Check size={11} strokeWidth={3} />
                    </span>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 99,
                        background: color,
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div className="pp-name">{ws.name}</div>
                    </div>
                    <span className="pp-count">{ws.items.length} 项</span>
                  </div>
                )
              })}
            </div>

            <div className="pp-foot">
              <button
                className="pp-new"
                onClick={handleNewWorkspace}
              >
                <Plus size={11} />
                新建工作空间{wsQuery ? ` "${wsQuery}"` : ''}
              </button>
              <button className="pp-done" onClick={() => setWsOpen(false)}>
                完成
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Run row */}
      <div className="composer-run">
        <button className="wb-btn-run" onClick={handleAdd} disabled={!url.trim()}>
          添加素材
          <span className="iconwrap">
            <ArrowRight size={14} />
          </span>
        </button>
      </div>

      {/* Upload modal */}
      <AddMaterialModal
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        workspaceId={workspaceSel[0] ?? ''}
        onAdded={handleAdded}
      />
    </div>
  )
}
