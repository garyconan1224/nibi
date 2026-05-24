import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'

import { getWorkspace } from '@/services/workspaces'
import { AddMaterialModal } from '@/components/workspace/AddMaterialModal'
import { useTaskStore } from '@/store/taskStore'
import { isTaskTerminal } from '@/types/task'
import type { WorkspaceRecord } from '@/types/workspace'

import { ChatTab } from './ChatTab'
import { CompareTab } from './CompareTab'
import { ExportTab } from './ExportTab'
import { FavoritesTab } from './FavoritesTab'
import { MaterialsTab } from './MaterialsTab'
import { QueueTab } from './QueueTab'
import { TagsTab } from './TagsTab'
import { BackgroundEditor } from './BackgroundEditor'
import { TaskboardHead } from './TaskboardHead'
import { TabsNav } from './TabsNav'
import type { TabId } from './types'
import { VersionsTab } from './VersionsTab'
import './taskboard.css'

/**
 * Taskboard 主入口 — 替代旧 WorkspaceDetail。
 *
 * H2.4: 骨架 + 头部 + 9 Tab（7 可用 + 2 禁用）。
 */
export default function TaskboardPage() {
  const { id } = useParams<{ id: string }>()
  const [workspace, setWorkspace] = useState<WorkspaceRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<TabId>('materials')
  const [addOpen, setAddOpen] = useState(false)
  const [bgOpen, setBgOpen] = useState(false)
  const tasks = useTaskStore((s) => s.tasks)
  const abortRef = useRef<AbortController | null>(null)

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
        {error ?? '工作空间不存在'}
      </div>
    )
  }

  const counts: Partial<Record<TabId, number>> = {
    materials: workspace.items.length,
    queue: tasks.filter((t) => !isTaskTerminal(t.status)).length,
    favs: workspace.favorites.length,
  }

  return (
    <div className="tb-wrap">
      <TaskboardHead
        name={workspace.name}
        background={workspace.background}
        onEditBackground={() => setBgOpen(true)}
        onAddMaterial={() => setAddOpen(true)}
      />

      <TabsNav active={tab} onChange={setTab} counts={counts} />

      <div className="tb-body">
        {tab === 'materials' && (
          <MaterialsTab
            items={workspace.items}
            workspaceId={workspace.workspace_id}
            onAddMaterial={() => setAddOpen(true)}
          />
        )}
        {tab === 'queue' && <QueueTab />}
        {tab === 'favs' && (
          <FavoritesTab
            favoriteIds={workspace.favorites}
            items={workspace.items}
            workspaceId={workspace.workspace_id}
          />
        )}
        {tab === 'history' && <VersionsTab />}
        {tab === 'tags' && (
          <TagsTab
            items={workspace.items}
            workspaceId={workspace.workspace_id}
            onTagsChanged={() => getWorkspace(workspace.workspace_id).then(setWorkspace).catch(() => {})}
          />
        )}
        {tab === 'chat' && <ChatTab workspace={workspace} />}
        {tab === 'export' && (
          <ExportTab items={workspace.items} workspaceId={workspace.workspace_id} />
        )}
        {tab === 'compare' && (
          <CompareTab workspace={workspace} />
        )}
        {tab === 'style' && (
          <div className="tb-placeholder">Phase [C] 开放</div>
        )}
      </div>

      <AddMaterialModal
        open={addOpen}
        onOpenChange={setAddOpen}
        workspaceIds={[workspace.workspace_id]}
        onAdded={(updated) => setWorkspace(updated)}
      />

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
