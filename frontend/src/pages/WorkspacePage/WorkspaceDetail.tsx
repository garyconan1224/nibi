import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'
import { subscribeSse } from '@/services/events'
import { ChatSidebar } from '@/components/workspace/ChatSidebar'
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
  Upload,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import {
  addWorkspaceItem,
  deleteWorkspace,
  getWorkspace,
  removeWorkspaceItem,
  savePreflight,
  startItemPipeline,
  updateWorkspace,
  uploadWorkspaceItem,
} from '@/services/workspaces'
import {
  ITEM_TYPE_COLOR,
  ITEM_TYPE_TEXT,
  WORKSPACE_STATUS_TEXT,
  type ItemSource,
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
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [newItemType, setNewItemType] = useState<ItemType>('video')
  const [newItemSource, setNewItemSource] = useState<ItemSource>('url')
  const [newItemValue, setNewItemValue] = useState('')
  const [newItemName, setNewItemName] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadDragOver, setUploadDragOver] = useState(false)
  const uploadInputRef = useRef<HTMLInputElement>(null)

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

  const resetAddForm = () => {
    setNewItemValue('')
    setNewItemName('')
    setUploadFile(null)
    setUploadProgress(0)
    setUploadDragOver(false)
    setAddError(null)
  }

  const isValidNetworkUrl = (raw: string): boolean => {
    const value = raw.trim()
    if (!value) return false
    try {
      const u = new URL(value)
      return (u.protocol === 'http:' || u.protocol === 'https:') && !!u.host
    } catch {
      return false
    }
  }

  const extractErrorMessage = (err: unknown, fallback: string): string => {
    if (axios.isAxiosError(err)) {
      const detail = (err.response?.data as { detail?: unknown } | undefined)
        ?.detail
      if (typeof detail === 'string') return detail
    }
    return err instanceof Error ? err.message : fallback
  }

  const handleUploadFileSelect = (file: File) => {
    setUploadFile(file)
    setUploadProgress(0)
    const inferredType = inferItemTypeFromFile(file)
    if (inferredType) setNewItemType(inferredType)
    if (!newItemName.trim()) {
      setNewItemName(file.name)
    }
  }

  const handleAdd = async () => {
    if (!id) return
    if (newItemSource === 'local' && !uploadFile && !newItemValue.trim()) return
    if (newItemSource !== 'local' && !newItemValue.trim()) return

    if (newItemSource === 'url' && !isValidNetworkUrl(newItemValue)) {
      setAddError('请输入有效的网络链接，必须以 http:// 或 https:// 开头')
      return
    }

    setAdding(true)
    setError(null)
    setAddError(null)
    try {
      const updated =
        newItemSource === 'local' && uploadFile
          ? await uploadWorkspaceItem(id, uploadFile, {
              name: newItemName.trim() || undefined,
              onProgress: setUploadProgress,
            })
          : await addWorkspaceItem(id, {
              type: newItemType,
              source: newItemSource,
              source_value: newItemValue.trim(),
              name: newItemName.trim() || undefined,
            })
      setWorkspace(updated)
      setAddOpen(false)
      resetAddForm()
      // 添加完毕，直接打开前置配置面板，等用户填好就一键开始分析
      const newest = updated.items[updated.items.length - 1]
      if (newest) setPreflightItem(newest)
    } catch (err: unknown) {
      setAddError(extractErrorMessage(err, '添加失败'))
    } finally {
      setAdding(false)
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

  const canAddItem =
    newItemSource === 'local'
      ? !!uploadFile || !!newItemValue.trim()
      : !!newItemValue.trim()

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

      {/* 主体：左主区 + 右侧栏 */}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* 左：素材列表 */}
        <div className="space-y-4">
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
        </div>

        {/* 右：侧栏占位 */}
        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">任务级 LLM 对话</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                跨素材问答（接通后端 RAG 后启用）。
              </p>
              <Button variant="outline" size="sm" disabled className="mt-3 w-full">
                即将上线
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">复刻清单</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                收藏的参考帧 / 图片会出现在这里。当前 {workspace.favorites.length} 项。
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">导出工作包</CardTitle>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm" disabled className="w-full">
                即将上线
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>

      {/* 添加素材模态 */}
      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open)
          if (!open && !adding) resetAddForm()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加内容</DialogTitle>
            <DialogDescription>
              支持网络链接和本地文件路径。后续会自动路由到对应的分析分支。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {addError && (
              <div
                role="alert"
                className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-sm text-destructive"
              >
                {addError}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>素材类型</Label>
                <Select
                  value={newItemType}
                  onValueChange={(v) => setNewItemType(v as ItemType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="video">视频</SelectItem>
                    <SelectItem value="audio">音频</SelectItem>
                    <SelectItem value="image">图片</SelectItem>
                    <SelectItem value="text">文字</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>来源</Label>
                <Select
                  value={newItemSource}
                  onValueChange={(v) => {
                    setNewItemSource(v as ItemSource)
                    setUploadFile(null)
                    setUploadProgress(0)
                    setAddError(null)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="url">网络链接</SelectItem>
                    <SelectItem value="local">本地路径</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {newItemSource === 'local' && (
              <div className="space-y-2">
                <Label>上传文件</Label>
                <input
                  ref={uploadInputRef}
                  type="file"
                  className="hidden"
                  accept="video/*,audio/*,image/*,.txt,.md,.srt,.vtt,.json"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleUploadFileSelect(file)
                    e.target.value = ''
                  }}
                />
                <div
                  role="button"
                  tabIndex={0}
                  aria-label="上传本地文件"
                  onClick={() => uploadInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') uploadInputRef.current?.click()
                  }}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setUploadDragOver(true)
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault()
                    setUploadDragOver(false)
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    setUploadDragOver(false)
                    const file = e.dataTransfer.files[0]
                    if (file) handleUploadFileSelect(file)
                  }}
                  className={[
                    'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-4 py-6 text-sm transition-colors',
                    uploadDragOver
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/60 hover:bg-primary/5',
                    adding ? 'pointer-events-none opacity-50' : '',
                  ].join(' ')}
                >
                  <Upload className="h-5 w-5" />
                  <span>拖入文件或点击选择</span>
                </div>

                {uploadFile && (
                  <div className="space-y-2 rounded-md border bg-background px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Upload className="h-4 w-4 shrink-0 text-primary" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">
                          {uploadFile.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatFileSize(uploadFile.size)}
                        </div>
                      </div>
                      <button
                        type="button"
                        aria-label="移除上传文件"
                        disabled={adding}
                        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                        onClick={() => {
                          setUploadFile(null)
                          setUploadProgress(0)
                        }}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    {uploadProgress > 0 && (
                      <div className="space-y-1">
                        <Progress value={uploadProgress} className="h-1.5" />
                        <div className="text-right text-xs text-muted-foreground">
                          {uploadProgress}%
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="item-value">
                {newItemSource === 'url' ? '链接 URL' : '本地文件路径（可选）'}
              </Label>
              <Input
                id="item-value"
                autoFocus={newItemSource === 'url'}
                placeholder={
                  newItemSource === 'url'
                    ? 'https://www.bilibili.com/video/BV1...'
                    : '/Users/you/Desktop/video.mp4'
                }
                value={newItemValue}
                onChange={(e) => setNewItemValue(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-name">显示名（可选）</Label>
              <Input
                id="item-name"
                placeholder="不填则自动从链接/路径推导"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddOpen(false)}
              disabled={adding}
            >
              取消
            </Button>
            <Button
              onClick={handleAdd}
              disabled={!canAddItem || adding}
            >
              {adding ? '添加中…' : uploadFile ? '上传并添加' : '添加'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function inferItemTypeFromFile(file: File): ItemType | null {
  const mime = file.type.toLowerCase()
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('text/')) return 'text'

  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!ext) return null
  if (['mp4', 'mov', 'avi', 'mkv', 'flv', 'wmv', 'webm'].includes(ext)) {
    return 'video'
  }
  if (['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg'].includes(ext)) {
    return 'audio'
  }
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image'
  if (['txt', 'md', 'srt', 'vtt', 'json'].includes(ext)) return 'text'
  return null
}
