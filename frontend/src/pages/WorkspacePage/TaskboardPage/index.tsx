import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { X } from 'lucide-react'

import { getWorkspace } from '@/services/workspaces'
import { AddMaterialModal } from '@/components/workspace/AddMaterialModal'
import { usePipelineTasks } from '@/hooks/usePipelineTasks'

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
        onEditBackground={() => setBgOpen(true)}
        onAddMaterial={() => setAddOpen(true)}
        onExport={() => setExportOpen(true)}
        onCompare={() => setCompareOpen(true)}
        onMerge={() => {
          // TODO: Commit 4 实现融合
        }}
        onShare={() => {
          // TODO: Commit 2 实现复制 Markdown
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

      {/* ── AddMaterialModal ── */}
      <AddMaterialModal
        open={addOpen}
        onOpenChange={setAddOpen}
        workspaceIds={[workspace.workspace_id]}
        workspaceBackgrounds={{ [workspace.workspace_id]: workspace.background }}
        workspaceKind={workspace.kind}
        onAdded={refresh}
      />

      {/* ── BackgroundEditor ── */}
      <BackgroundEditor
        open={bgOpen}
        workspaceId={workspace.workspace_id}
        initial={workspace.background}
        onClose={() => setBgOpen(false)}
        onSaved={(updated) => setWorkspace(updated)}
      />
    </div>
  )
}
