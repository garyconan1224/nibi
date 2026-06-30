import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useAddMaterialStore } from '@/store/addMaterialStore'
import type { WorkspaceRecord } from '@/types/workspace'
import {
  createWorkspace,
  listWorkspaces,
  removeWorkspaceItem,
} from '@/services/workspaces'
import { AddMaterialModal } from './AddMaterialModal'

export function GlobalAddMaterialModal() {
  const {
    open,
    urlValue,
    sniffResult,
    localFile,
    localFileName,
    localWsId,
    onAdded,
    closeAddMaterial,
  } = useAddMaterialStore()
  const [workspaces, setWorkspaces] = useState<WorkspaceRecord[]>([])
  const [workspaceIds, setWorkspaceIds] = useState<string[]>([])
  const submittedRef = useRef(false)

  const workspaceBackgrounds = useMemo(
    () => Object.fromEntries(workspaces.map((workspace) => [workspace.workspace_id, workspace.background])),
    [workspaces],
  )

  const refreshWorkspaces = useCallback(() => {
    listWorkspaces().then(setWorkspaces).catch(() => {
      toast.error('加载合集列表失败，请检查后端是否已启动')
    })
  }, [])

  useEffect(() => {
    if (!open) return
    submittedRef.current = false
    setWorkspaceIds([])
    refreshWorkspaces()
  }, [open, refreshWorkspaces])

  const handleCreateWorkspace = useCallback(async (rawName: string, kind?: 'note' | 'replica') => {
    const name = rawName.trim() || (kind === 'replica' ? '新复刻合集' : '新笔记合集')
    const created = await createWorkspace({ name, kind })
    setWorkspaces((prev) => [...prev, created])
    toast.success(`合集「${name}」已创建`)
    return created
  }, [])

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (nextOpen) return
    if (!submittedRef.current && localFile && localWsId) {
      removeWorkspaceItem(localWsId, localFile).catch(() => {})
    }
    closeAddMaterial()
  }, [closeAddMaterial, localFile, localWsId])

  const handleAdded = useCallback(() => {
    submittedRef.current = true
    onAdded?.()
    refreshWorkspaces()
    closeAddMaterial()
  }, [closeAddMaterial, onAdded, refreshWorkspaces])

  return (
    <AddMaterialModal
      open={open}
      onOpenChange={handleOpenChange}
      workspaceIds={workspaceIds}
      workspaceBackgrounds={workspaceBackgrounds}
      availableWorkspaces={workspaces}
      onWorkspaceIdsChange={setWorkspaceIds}
      onCreateWorkspace={handleCreateWorkspace}
      onWorkspaceUpdated={(updated) => {
        setWorkspaces((prev) => prev.map((workspace) => (
          workspace.workspace_id === updated.workspace_id ? updated : workspace
        )))
      }}
      sniffResult={sniffResult}
      urlValue={urlValue}
      onAdded={handleAdded}
      localFile={localFile}
      localFileName={localFileName}
      localWsId={localWsId}
    />
  )
}
