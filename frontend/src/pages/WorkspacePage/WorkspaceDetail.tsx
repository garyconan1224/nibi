import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { subscribeSse } from '@/services/events'
import { ChatSidebar } from '@/components/workspace/ChatSidebar'
import { AddMaterialModal } from '@/components/workspace/AddMaterialModal'
import {
  ArrowLeft,
  Plus,
  Trash2,
  Pencil,
  FileImage,
  FileVideo,
  FileAudio,
  FileText,
  PlayCircle,
  Eye,
  Settings2,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

import PreflightConfigPanel from '@/components/workspace/PreflightConfigPanel'
import { WorkspaceSearchBar } from './WorkspaceSearchBar'
import {
  deleteWorkspace,
  getWorkspace,
  removeWorkspaceItem,
  savePreflight,
  startItemPipeline,
  updateWorkspace,
} from '@/services/workspaces'
import {
  ITEM_TYPE_COLOR,
  ITEM_TYPE_TEXT,
  WORKSPACE_STATUS_TEXT,
  type ItemType,
  type PreflightSaveRequest,
  type WorkspaceItem,
  type WorkspaceRecord,
} from '@/types/workspace'

/**
 * 工作空间详情页（设计文档 2.4「任务详情页」最小版）。
 *
 * 路由：/workspaces/:id
 *
 * 当前实现：
 *   - 顶部：返回 + 名称 + 状态徽章
 *   - 左侧主区：素材列表 + 「添加内容」按钮
 *   - 右侧侧栏：占位（后续接入 LLM 对话 + 复刻清单 + 导出按钮）
 *
 * 后续扩展：
 *   - 添加素材后弹出「前置配置面板」（背景信息 + 模型选择 + 任务勾选）
 *   - 点击素材跳转到对应的视频/音频/图片/文字结果详情页
 */
export default function WorkspaceDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [workspace, setWorkspace] = useState<WorkspaceRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 工作空间级操作
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameName, setRenameName] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // 添加素材模态状态
  const [addOpen, setAddOpen] = useState(false)

  // 前置配置面板状态——保存当前正在配置的 item 引用
  const [preflightItem, setPreflightItem] = useState<WorkspaceItem | null>(null)
  const [preflightSubmitting, setPreflightSubmitting] = useState(false)

  const refresh = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const data = await getWorkspace(id)
      setWorkspace(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const openRenameDialog = () => {
    if (!workspace) return
    setRenameName(workspace.name)
    setRenameOpen(true)
  }

  const handleRename = async () => {
    if (!id || !workspace) return
    const name = renameName.trim()
    if (!name || name === workspace.name) {
      setRenameOpen(false)
      return
    }
    setRenaming(true)
    setError(null)
    try {
      const updated = await updateWorkspace(id, { name })
      setWorkspace(updated)
      setRenameOpen(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '重命名失败')
    } finally {
      setRenaming(false)
    }
  }

  const handleDeleteWorkspace = async () => {
    if (!id) return
    setDeleting(true)
    setError(null)
    try {
      await deleteWorkspace(id)
      setDeleteOpen(false)
      navigate('/workspaces')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '删除失败')
    } finally {
      setDeleting(false)
    }
  }

  const handleRemoveItem = async (itemId: string) => {
    if (!id) return
    try {
      const updated = await removeWorkspaceItem(id, itemId)
      setWorkspace(updated)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '移除失败')
    }
  }

  const handleConfigureItem = (item: WorkspaceItem) => {
    setPreflightItem(item)
  }

  const handlePreflightSave = async (config: PreflightSaveRequest) => {
    if (!id || !preflightItem) return
    setPreflightSubmitting(true)
    try {
      // 先保存配置
      const afterSave = await savePreflight(id, preflightItem.item_id, config)
      setWorkspace(afterSave)
      // 再触发 pipeline 任务
      try {
        const started = await startItemPipeline(id, preflightItem.item_id)
        setWorkspace(started.workspace)
      } catch (startErr: unknown) {
        // 配置已存上但触发失败——给出明确提示，配置不丢
        setError(
          startErr instanceof Error
            ? `配置已保存，但触发分析失败：${startErr.message}`
            : '配置已保存，但触发分析失败',
        )
      }
      setPreflightItem(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setPreflightSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!workspace) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-4 p-6">
        <Button variant="ghost" onClick={() => navigate('/workspaces')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回工作空间列表
        </Button>
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error ?? '工作空间不存在或已被删除。'}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
      {/* 顶部：面包屑式导航 */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/workspaces')}
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          工作空间
        </Button>
        <span className="text-muted-foreground">/</span>
        <span className="font-medium">{workspace.name}</span>
        <Badge variant="outline" className="ml-2">
          {WORKSPACE_STATUS_TEXT[workspace.status]}
        </Badge>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={openRenameDialog}>
            <Pencil className="mr-1 h-4 w-4" />
            改名
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="mr-1 h-4 w-4" />
            删除
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* 主体：Taskboard 子标签 */}
      <Tabs defaultValue="materials">
        <TabsList>
          <TabsTrigger value="materials">素材</TabsTrigger>
          <TabsTrigger value="queue">队列</TabsTrigger>
          <TabsTrigger value="tags">标签库</TabsTrigger>
          <TabsTrigger value="chat">AI 对话</TabsTrigger>
        </TabsList>

        <TabsContent value="materials" className="space-y-4">
          <WorkspaceSearchBar workspaceId={workspace.workspace_id} />
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-lg">素材列表</CardTitle>
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <Plus className="mr-1 h-4 w-4" />
                添加内容
              </Button>
            </CardHeader>
            <CardContent>
              {workspace.items.length === 0 ? (
                <EmptyState
                  title="还没有素材"
                  description="点击右上角「添加内容」放入第一个视频/音频/图片/文字。"
                />
              ) : (
                <div className="space-y-2">
                  {workspace.items.map((it) => (
                    <ItemRow
                      key={it.item_id}
                      item={it}
                      onTaskDone={refresh}
                      onConfigure={() => handleConfigureItem(it)}
                      onRemove={() => handleRemoveItem(it.item_id)}
                      onViewResult={() => {
                        const map: Record<string, string> = {
                          video: 'result',
                          audio: 'audio_result',
                          image: 'image_result',
                          text: 'text_result',
                        }
                        const suffix = map[it.type] ?? 'result'
                        navigate(`/workspaces/${workspace.workspace_id}/items/${it.item_id}/${suffix}`)
                      }}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="queue">
          <Card>
            <CardContent className="pt-6">
              <EmptyState
                title="队列为空"
                description="添加素材并触发分析后，进行中的任务会出现在这里。"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tags">
          <Card>
            <CardContent className="pt-6">
              <EmptyState
                title="暂无标签"
                description="素材分析完成后，7 维度标签会自动归类到这里。"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chat">
          <Card>
            <CardContent className="pt-6">
              <EmptyState
                title="AI 对话即将上线"
                description="任务级 LLM 对话功能开发中，敬请期待。"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* N4: 添加素材模态（4 步合一） */}
      {workspace && (
        <AddMaterialModal
          open={addOpen}
          onOpenChange={setAddOpen}
          workspaceId={workspace.workspace_id}
          workspaceBackground={workspace.background}
          onAdded={(updated) => setWorkspace(updated)}
        />
      )}

      {/* 改名模态 */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重命名工作空间</DialogTitle>
            <DialogDescription>
              修改后会立即同步到工作空间列表和详情页。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="rename-workspace-name">工作空间名称</Label>
            <Input
              id="rename-workspace-name"
              autoFocus
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && renameName.trim() && !renaming) {
                  handleRename()
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRenameOpen(false)}
              disabled={renaming}
            >
              取消
            </Button>
            <Button
              onClick={handleRename}
              disabled={!renameName.trim() || renaming}
            >
              {renaming ? '保存中…' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除工作空间确认 */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除？</AlertDialogTitle>
            <AlertDialogDescription>
              将永久删除工作空间「{workspace.name}」及其内所有素材的引用。此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteWorkspace}
              disabled={deleting}
            >
              {deleting ? '删除中…' : '删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 前置配置面板：从素材行的「配置并开始」/「重新配置」唤出 */}
      {preflightItem && (
        <PreflightConfigPanel
          open={!!preflightItem}
          onOpenChange={(open) => !open && setPreflightItem(null)}
          item={preflightItem}
          onSave={handlePreflightSave}
          submitting={preflightSubmitting}
        />
      )}
      <ChatSidebar workspaceId={workspace.workspace_id} />
    </div>
  )
}

// ── 子组件：单条素材行 ────────────────────────────────────

const TYPE_ICON_MAP: Record<ItemType, typeof FileVideo> = {
  video: FileVideo,
  audio: FileAudio,
  image: FileImage,
  text: FileText,
}

const TERMINAL = new Set(['SUCCESS', 'FAILED', 'CANCELLED'])

function ItemRow({
  item,
  onTaskDone,
  onConfigure,
  onRemove,
  onViewResult,
}: {
  item: WorkspaceItem
  onTaskDone: () => void
  onConfigure: () => void
  onRemove: () => void
  onViewResult: () => void
}) {
  const Icon = TYPE_ICON_MAP[item.type]
  const taskCount = item.related_task_ids.length
  // pending = 还没配过/没起任务；processing = 已经触发；done/failed = 终态
  const canStart = item.status === 'pending'

  // ── SSE 进度订阅（X.3）──────────────────────────────────
  const [progressMsg, setProgressMsg] = useState<string | null>(null)
  const [progressPct, setProgressPct] = useState<number | null>(null)
  const onTaskDoneRef = useRef(onTaskDone)
  useEffect(() => { onTaskDoneRef.current = onTaskDone }, [onTaskDone])

  useEffect(() => {
    if (item.status !== 'processing' || item.related_task_ids.length === 0) {
      setProgressMsg(null)
      setProgressPct(null)
      return
    }
    const taskId = item.related_task_ids[item.related_task_ids.length - 1]
    const sub = subscribeSse<{ type: string; entry?: { message: string }; task?: { status: string; progress: number } }>(
      `/pipeline/tasks/${taskId}/events`,
      {
        onMessage: (data) => {
          if (data.type === 'log' && data.entry?.message) {
            setProgressMsg(data.entry.message)
          } else if (data.type === 'task' && data.task) {
            if (data.task.progress != null) setProgressPct(data.task.progress)
            if (TERMINAL.has(data.task.status)) {
              sub.close()
              setProgressMsg(null)
              setProgressPct(null)
              onTaskDoneRef.current()
            }
          }
        },
      },
    )
    return () => sub.close()
  // item.status / related_task_ids 变化时重新订阅（item_id 唯一确定稳定 ref）
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.item_id, item.status, item.related_task_ids.length])

  return (
    <div className="group flex items-center gap-3 rounded-md border p-3 transition-colors hover:bg-muted/50">
      <div
        className={`flex h-9 w-9 items-center justify-center rounded ${ITEM_TYPE_COLOR[item.type]}`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{item.name}</div>
        <div className="truncate text-xs text-muted-foreground">
          {ITEM_TYPE_TEXT[item.type]} · {item.source === 'url' ? '链接' : '本地'} ·{' '}
          {item.source_value}
          {taskCount > 0 && (
            <span className="ml-2">· 已触发 {taskCount} 个任务</span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <Badge variant="secondary">
          {item.status === 'pending'
            ? '待处理'
            : item.status === 'processing'
              ? '处理中'
              : item.status === 'done'
                ? '完成'
                : '失败'}
        </Badge>
        {item.status === 'processing' && progressMsg && (
          <span className="max-w-[14rem] truncate text-right text-[10px] text-muted-foreground">
            {progressPct != null ? `${Math.round(progressPct * 100)}% · ` : ''}{progressMsg}
          </span>
        )}
      </div>
      {item.status === 'done' && (
        <Button
          size="sm"
          variant="outline"
          onClick={onViewResult}
          className="shrink-0"
        >
          <Eye className="mr-1 h-3.5 w-3.5" />
          查看结果
        </Button>
      )}
      <Button
        size="sm"
        variant={canStart ? 'default' : 'outline'}
        onClick={onConfigure}
        className="shrink-0"
      >
        {canStart ? (
          <>
            <PlayCircle className="mr-1 h-3.5 w-3.5" />
            配置并开始
          </>
        ) : (
          <>
            <Settings2 className="mr-1 h-3.5 w-3.5" />
            重新配置
          </>
        )}
      </Button>
      <button
        type="button"
        className="rounded p-1 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
        aria-label="移除素材"
        onClick={onRemove}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}
