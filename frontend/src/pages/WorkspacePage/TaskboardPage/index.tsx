import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { X } from 'lucide-react'
import { toast } from 'sonner'

import { getWorkspace, getItemNote, downloadCollectionHtml, mergeNotes } from '@/services/workspaces'
import type { MergedNote } from '@/services/workspaces'
import { AddMaterialModal } from '@/components/workspace/AddMaterialModal'
import { usePipelineTasks } from '@/hooks/usePipelineTasks'
import { withStatusToast } from '@/lib/statusToast'

import type { WorkspaceRecord } from '@/types/workspace'

import { ChatTab } from './ChatTab'
import { KnowledgeQATab } from './KnowledgeQATab'
import { CompareTab } from './CompareTab'
import { ExportTab } from './ExportTab'
import { FavoritesTab } from './FavoritesTab'
import { MaterialsTab } from './MaterialsTab'
import { QueueTab } from './QueueTab'
import { TagsTab } from './TagsTab'
import { BackgroundEditor } from './BackgroundEditor'
import { TaskboardHead } from './TaskboardHead'
import type { TabId } from './types'
import { VersionsTab } from './VersionsTab'
import './taskboard.css'

/**
 * Taskboard 主入口 — BiliNote 式布局：
 * 头部（名称 + 计数 + 操作按钮） + 素材网格主体 + Modal 弹层（导出/对比/更多功能）。
 */
export default function TaskboardPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [workspace, setWorkspace] = useState<WorkspaceRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [bgOpen, setBgOpen] = useState(false)
  const [compareSelectedIds, setCompareSelectedIds] = useState<Set<string>>(new Set())

  // Modal 状态：导出 / 对比 / 更多功能面板
  const [exportOpen, setExportOpen] = useState(false)
  const [compareOpen, setCompareOpen] = useState(false)
  const [morePanelId, setMorePanelId] = useState<TabId | null>(null)

  // 融合状态
  const [mergeLoading, setMergeLoading] = useState(false)
  const [mergeResult, setMergeResult] = useState<MergedNote | null>(null)


  const abortRef = useRef<AbortController | null>(null)

  usePipelineTasks({ projectId: id, pollInterval: 5000, enabled: Boolean(id) })

  useEffect(() => {
    if (!id) return
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac

    getWorkspace(id)
      .then((data) => {
        if (!ac.signal.aborted) {
          setWorkspace(data)
          setLoading(false)
        }
      })
      .catch((err: unknown) => {
        if (!ac.signal.aborted) {
          setError(err instanceof Error ? err.message : '加载失败')
          setLoading(false)
        }
      })

    return () => ac.abort()
  }, [id])

  /** 「更多」菜单点击处理 */
  const handleMenuAction = (menuId: string) => {
    const validIds: TabId[] = ['queue', 'favs', 'history', 'tags', 'chat', 'knowledgeQA', 'style']
    if (validIds.includes(menuId as TabId)) {
      setMorePanelId(menuId as TabId)
    }
  }

  /** 刷新 workspace 数据 */
  const refresh = () => {
    if (!workspace) return
    getWorkspace(workspace.workspace_id).then(setWorkspace).catch(() => {})
  }

  if (loading) {
    return (
      <div className="tb-wrap" style={{ opacity: 0.5, textAlign: 'center', paddingTop: 120 }}>
        加载中…
      </div>
    )
  }

  if (error || !workspace) {
    return (
      <div className="tb-wrap" style={{ textAlign: 'center', paddingTop: 120, color: 'var(--ink-3)' }}>
        {error ?? '合集不存在'}
      </div>
    )
  }

  return (
    <div className="tb-wrap">
      <TaskboardHead
        name={workspace.name}
        materialCount={workspace.items.length}
        background={workspace.background}
        items={workspace.items}
        description={workspace.background.topic || workspace.background.purpose || '合集内的笔记与素材汇总'}
        updatedAt={new Date(workspace.updated_at).toLocaleDateString('zh-CN')}
        onBack={() => navigate(workspace.kind === 'replica' ? '/replicas' : '/notes')}
        onEditBackground={() => setBgOpen(true)}
        onAddMaterial={() => setAddOpen(true)}
        onExport={() => setExportOpen(true)}
        onCompare={() => {
          if (compareSelectedIds.size < 2) {
            toast.info('请先在素材网格中多选至少 2 个素材，再点击对比')
            return
          }
          setCompareOpen(true)
        }}
        onMerge={async () => {
          const ids = [...compareSelectedIds]
          if (ids.length < 2) {
            toast.info('请先在素材网格中多选 ≥2 个素材，再点击融合')
            return
          }
          setMergeLoading(true)
          try {
            const result = await withStatusToast(
              () => mergeNotes(workspace.workspace_id, ids),
              {
                id: `workspace-merge-${workspace.workspace_id}`,
                loading: '正在融合笔记…',
                success: '融合完成',
                error: '融合失败，请重试',
              },
            )
            setMergeResult(result)
          } catch {
            /* withStatusToast 已提示 */
          } finally {
            setMergeLoading(false)
          }
        }}
        onShareMarkdown={async () => {
          if (workspace.items.length === 0) {
            toast.info('合集为空，暂无可复制的笔记')
            return
          }
          const toastId = `workspace-copy-md-${workspace.workspace_id}`
          toast.loading('正在复制合集 Markdown…', { id: toastId })
          try {
            const notes = await Promise.all(
              workspace.items.map((item) =>
                getItemNote(workspace.workspace_id, item.item_id).catch(() => null)
              )
            )
            const mdParts = notes
              .filter((n): n is NonNullable<typeof n> => n != null && n.note_md.trim().length > 0)
              .map((n) => n.note_md.trim())
            if (mdParts.length === 0) {
              toast.info('暂无笔记内容可复制', { id: toastId })
              return
            }
            await navigator.clipboard.writeText(mdParts.join('\n\n---\n\n'))
            toast.success(`已复制 ${mdParts.length} 篇笔记到剪贴板`, { id: toastId })
          } catch {
            toast.error('复制失败，请重试', { id: toastId })
          }
        }}
        onShareHtml={async () => {
          try {
            await withStatusToast(
              () => downloadCollectionHtml(workspace.workspace_id),
              {
                id: `workspace-export-html-${workspace.workspace_id}`,
                loading: '正在导出合集 HTML…',
                success: '合集 HTML 已开始下载',
                error: '合集 HTML 导出失败，请重试',
              },
            )
          } catch {
            /* withStatusToast 已提示 */
          }
        }}
        onMenuAction={handleMenuAction}
      />

      {/* 素材网格 — 默认主体 */}
      <div className="tb-body">
        <MaterialsTab
          items={workspace.items}
          workspaceId={workspace.workspace_id}
          onAddMaterial={() => setAddOpen(true)}
          onNavigateToCompare={() => setCompareOpen(true)}
          onSelectedIdsChange={setCompareSelectedIds}
        />
      </div>

      {/* ── Modal：导出 ── */}
      {exportOpen && (
        <div className="tb-modal-overlay" onClick={() => setExportOpen(false)}>
          <div className="tb-modal" onClick={(e) => e.stopPropagation()}>
            <button className="tb-modal-close" onClick={() => setExportOpen(false)}>
              <X size={18} />
            </button>
            <ExportTab items={workspace.items} workspaceId={workspace.workspace_id} />
          </div>
        </div>
      )}

      {/* ── Modal：对比 ── */}
      {compareOpen && (
        <div className="tb-modal-overlay" onClick={() => setCompareOpen(false)}>
          <div className="tb-modal" onClick={(e) => e.stopPropagation()}>
            <button className="tb-modal-close" onClick={() => setCompareOpen(false)}>
              <X size={18} />
            </button>
            <CompareTab workspace={workspace} selectedIds={compareSelectedIds} />
          </div>
        </div>
      )}

      {/* ── Modal：更多功能面板（队列/收藏/版本/标签/AI对话/知识库/风格报告） ── */}
      {morePanelId && (
        <div className="tb-modal-overlay" onClick={() => setMorePanelId(null)}>
          <div className="tb-modal" onClick={(e) => e.stopPropagation()}>
            <button className="tb-modal-close" onClick={() => setMorePanelId(null)}>
              <X size={18} />
            </button>
            {morePanelId === 'queue' && <QueueTab workspaceId={workspace.workspace_id} />}
            {morePanelId === 'favs' && (
              <FavoritesTab
                favoriteIds={workspace.favorites}
                items={workspace.items}
                workspaceId={workspace.workspace_id}
              />
            )}
            {morePanelId === 'history' && <VersionsTab />}
            {morePanelId === 'tags' && (
              <TagsTab
                items={workspace.items}
                workspaceId={workspace.workspace_id}
                onTagsChanged={refresh}
              />
            )}
            {morePanelId === 'chat' && <ChatTab workspace={workspace} />}
            {morePanelId === 'knowledgeQA' && <KnowledgeQATab workspace={workspace} />}
            {morePanelId === 'style' && (
              <div className="tb-placeholder">Phase [C] 开放</div>
            )}
          </div>
        </div>
      )}

      {/* ── 融合加载中 ── */}
      {mergeLoading && (
        <div className="tb-modal-overlay">
          <div className="tb-modal" style={{ textAlign: 'center', padding: '48px 32px' }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>✨</div>
            <div style={{ fontSize: 16, color: 'var(--ink-2)' }}>正在融合笔记，请稍候…</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 8 }}>
              LLM 合成中，通常需要 10-30 秒
            </div>
          </div>
        </div>
      )}

      {/* ── Modal：融合结果 ── */}
      {mergeResult && (
        <div className="tb-modal-overlay" onClick={() => setMergeResult(null)}>
          <div className="tb-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 700 }}>
            <button className="tb-modal-close" onClick={() => setMergeResult(null)}>
              <X size={18} />
            </button>
            <h2 style={{ fontSize: 20, marginBottom: 8 }}>{mergeResult.title}</h2>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 16 }}>
              融合了 {mergeResult.item_ids.length} 个素材 · {new Date(mergeResult.created_at).toLocaleString('zh-CN')}
            </div>
            <div
              className="tb-merged-content"
              style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, fontSize: 14, color: 'var(--ink-1)' }}
            >
              {mergeResult.content_md}
            </div>
            <div style={{ marginTop: 20, textAlign: 'right' }}>
              <button
                className="btn btn-primary"
                onClick={async () => {
                  await navigator.clipboard.writeText(mergeResult.content_md)
                  toast.success('已复制到剪贴板')
                }}
              >
                复制内容
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── AddMaterialModal ── */}
      <AddMaterialModal
        open={addOpen}
        onOpenChange={setAddOpen}
        workspaceIds={[workspace.workspace_id]}
        workspaceBackgrounds={{ [workspace.workspace_id]: workspace.background }}
        availableWorkspaces={[workspace]}
        workspaceKind={workspace.kind}
        onAdded={refresh}
        onWorkspaceUpdated={setWorkspace}
      />

      {/* ── BackgroundEditor ── */}
      <BackgroundEditor
        open={bgOpen}
        workspaceId={workspace.workspace_id}
        initialName={workspace.name}
        initial={workspace.background}
        items={workspace.items}
        onClose={() => setBgOpen(false)}
        onSaved={(updated) => setWorkspace(updated)}
      />
    </div>
  )
}
