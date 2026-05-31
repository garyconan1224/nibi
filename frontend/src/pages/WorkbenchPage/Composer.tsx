import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Link2, Upload, Search, X, Check, Plus, ArrowRight, Layers,
} from 'lucide-react'
import { toast } from 'sonner'
import type { WorkspaceRecord } from '@/types/workspace'
import { detectPlatform } from './platforms'
import { normalizeMediaUrl } from '@/lib/url'
import {
  listWorkspaces,
  createWorkspace,
  sniffUrl,
  autoCreateWorkspace,
  uploadWorkspaceItem,
  savePreflight,
  startItemPipeline,
} from '@/services/workspaces'
import type { SniffResult } from '@/services/workspaces'
import { AddMaterialModal, type StagedConfig } from '@/components/workspace/AddMaterialModal'
import { LinkPreviewModal } from '@/components/workspace/LinkPreviewModal'
import { PreflightDrawer } from '@/pages/WorkbenchPage/PreflightDrawer'

const WS_COLORS = [
  '#22c55e', '#f59e0b', '#a855f7', '#0ea5e9',
  '#ef4444', '#ec4899', '#14b8a6', '#eab308',
]

interface ComposerProps {
  onTaskCreated?: () => void
}

export function Composer({ onTaskCreated }: ComposerProps) {
  const navigate = useNavigate()
  const [url, setUrl] = useState('')
  const [uploadOpen, setUploadOpen] = useState(false)

  const [workspaces, setWorkspaces] = useState<WorkspaceRecord[]>([])
  const [workspaceSel, setWorkspaceSel] = useState<string[]>([])
  const [wsOpen, setWsOpen] = useState(false)
  const [wsQuery, setWsQuery] = useState('')
  const [sniffResult, setSniffResult] = useState<SniffResult | null>(null)
  const [preflightOpen, setPreflightOpen] = useState(false)
  const [preflightStaged, setPreflightStaged] = useState<StagedConfig | undefined>(undefined)
  const [uploading, setUploading] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)

  const popRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const sniffTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

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

  const wsBackgrounds = useMemo(
    () => Object.fromEntries(workspaces.map((w) => [w.workspace_id, w.background])),
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

  const handleUrlChange = useCallback((value: string) => {
    setUrl(value)
    setSniffResult(null)
  }, [])

  // Debounced URL sniff
  useEffect(() => {
    if (!normalizedUrl) return
    clearTimeout(sniffTimer.current)
    sniffTimer.current = setTimeout(async () => {
      try {
        const result = await sniffUrl(normalizedUrl)
        setSniffResult(result)
      } catch {
        setSniffResult(null)
      }
    }, 500)
    return () => clearTimeout(sniffTimer.current)
  }, [normalizedUrl])

  const handleAdd = () => {
    if (!url.trim()) return
    // text 类型 URL → 先预览确认
    if (sniffResult?.primary_type === 'text') {
      setPreviewOpen(true)
    } else {
      setUploadOpen(true)
    }
  }

  const handlePreviewConfirm = () => {
    setPreviewOpen(false)
    setUploadOpen(true)
  }

  const handlePreviewFallback = () => {
    setPreviewOpen(false)
    setUploadOpen(true)
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  // 单文件上传流程：选择文件 → autoCreateWorkspace → upload → savePreflight → start → navigate
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const ws = await autoCreateWorkspace({ hint_text: file.name })
      toast.info(`已自动创建工作空间「${ws.name}」`)
      const updated = await uploadWorkspaceItem(ws.workspace_id, file, {
        name: file.name,
      })
      const item = updated.items[updated.items.length - 1]
      const itemId = item.item_id
      await savePreflight(ws.workspace_id, itemId, {
        background_overrides: {},
        models: {},
        tasks: {},
      })
      const { task_id } = await startItemPipeline(ws.workspace_id, itemId)
      toast.success(`文件「${file.name}」已上传并开始分析`)
      navigate(`/processing/${task_id}`, {
        state: { url: file.name, workspaceId: ws.workspace_id, itemId },
      })
      handleAdded()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '上传失败'
      toast.error(`文件上传失败: ${msg}`)
    } finally {
      setUploading(false)
      // 重置 file input，允许再次选同一个文件
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
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
          onChange={(e) => handleUrlChange(e.target.value)}
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

        <button
          className="btn btn-ghost"
          title="上传本地文件"
          style={{ gap: 6 }}
          onClick={handleUploadClick}
          disabled={uploading}
        >
          <Upload size={15} />
          {uploading ? '上传中…' : '上传'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
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

      {/* Link preview modal */}
      <LinkPreviewModal
        open={previewOpen}
        url={normalizedUrl || url}
        onConfirm={handlePreviewConfirm}
        onFallback={handlePreviewFallback}
        onCancel={() => setPreviewOpen(false)}
      />

      {/* Upload modal */}
      <AddMaterialModal
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        workspaceIds={workspaceSel}
        workspaceBackgrounds={wsBackgrounds}
        sniffResult={sniffResult}
        urlValue={normalizedUrl || undefined}
        initialStaged={preflightStaged}
        onAdded={handleAdded}
        onFineTune={(staged) => {
          setUploadOpen(false)
          setPreflightStaged(staged)
          setPreflightOpen(true)
        }}
      />

      {/* R7.4: PreflightDrawer stage 模式 — 回写配置后重开 modal */}
      <PreflightDrawer
        open={preflightOpen}
        url={normalizedUrl || url}
        platformName={platform?.name ?? null}
        sniffResult={sniffResult}
        workspaceId={workspaceSel[0]}
        stagedConfig={preflightStaged}
        mode="stage"
        onSaveStaged={(staged) => {
          setPreflightStaged(staged)
          setPreflightOpen(false)
          setUploadOpen(true)
        }}
        onClose={() => setPreflightOpen(false)}
        onCreated={() => {
          setPreflightOpen(false)
          handleAdded()
        }}
      />
    </div>
  )
}
