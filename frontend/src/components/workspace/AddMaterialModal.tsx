import { useCallback, useEffect, useRef, useState } from 'react'
import axios from 'axios'
import {
  ChevronRight,
  ChevronLeft,
  FileAudio,
  FileImage,
  FileText,
  FileVideo,
  Upload,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  addWorkspaceItem,
  savePreflight,
  startItemPipeline,
  uploadWorkspaceItem,
} from '@/services/workspaces'
import type {
  ItemType,
  ItemSource,
  PreflightSaveRequest,
  WorkspaceBackground,
  WorkspaceRecord,
} from '@/types/workspace'

// ── 分析任务定义（按 SPEC §2.6）─────────────────────────

interface TaskDef {
  id: string
  label: string
  defaultChecked: boolean
}

const TASKS_BY_TYPE: Record<ItemType, TaskDef[]> = {
  video: [
    { id: 'frame_prompts', label: '画面提示词生成', defaultChecked: true },
    { id: 'video_summary', label: '视频文案总结', defaultChecked: true },
    { id: 'subtitle_export', label: '字幕导出', defaultChecked: true },
    { id: 'music_analysis', label: '音乐分析', defaultChecked: false },
  ],
  audio: [
    { id: 'asr', label: '人声转写 + 内容总结', defaultChecked: true },
    { id: 'subtitle_file', label: '生成字幕文件', defaultChecked: true },
    { id: 'speaker_diarization', label: '说话人音色区分', defaultChecked: false },
    { id: 'music_analysis', label: '音乐分析', defaultChecked: false },
  ],
  image: [
    { id: 'content_describe', label: '内容识别描述', defaultChecked: true },
    { id: 'ocr', label: 'OCR 文字提取', defaultChecked: true },
    { id: 'frame_prompts', label: '画面提示词生成', defaultChecked: true },
    { id: 'association', label: '内容联想总结', defaultChecked: false },
  ],
  text: [
    { id: 'summary', label: '摘要 / 要点 / 金句', defaultChecked: true },
    { id: 'association', label: '联想归纳', defaultChecked: false },
    { id: 'rewrite', label: '改写 / 润色', defaultChecked: false },
    { id: 'translate', label: '翻译', defaultChecked: false },
  ],
}

// ── URL 平台 → 类型映射 ─────────────────────────────────

const VIDEO_DOMAINS = [
  'bilibili.com', 'b23.tv', 'youtube.com', 'youtu.be',
  'douyin.com', 'kuaishou.com', 'ixigua.com',
]

const ARTICLE_DOMAINS = [
  'mp.weixin.qq.com', 'xiaohongshu.com', 'zhuanlan.zhihu.com',
  'toutiao.com', 'sspai.com',
]

function inferTypeFromUrl(url: string): ItemType | null {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    if (VIDEO_DOMAINS.some((d) => host.includes(d))) return 'video'
    if (ARTICLE_DOMAINS.some((d) => host.includes(d))) return 'text'
    // 通用链接默认当网页文章
    return 'text'
  } catch {
    return null
  }
}

function inferTypeFromFile(file: File): ItemType | null {
  const mime = file.type.toLowerCase()
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('text/')) return 'text'

  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!ext) return null
  if (['mp4', 'mov', 'avi', 'mkv', 'flv', 'wmv', 'webm'].includes(ext)) return 'video'
  if (['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg'].includes(ext)) return 'audio'
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image'
  if (['txt', 'md', 'srt', 'vtt', 'json', 'pdf', 'docx'].includes(ext)) return 'text'
  return null
}

// ── 组件 ────────────────────────────────────────────────

interface AddMaterialModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
  workspaceBackground?: WorkspaceBackground
  onAdded: (updated: WorkspaceRecord) => void
}

export function AddMaterialModal({
  open,
  onOpenChange,
  workspaceId,
  onAdded,
}: AddMaterialModalProps) {
  // ── Step 管理 ──
  const [step, setStep] = useState(0) // 0=类型, 1=输入源, 2=分析任务, 3=背景信息

  // ── 表单状态 ──
  const [itemType, setItemType] = useState<ItemType>('video')
  const [itemSource, setItemSource] = useState<ItemSource>('url')
  const [itemValue, setItemValue] = useState('')
  const [itemName, setItemName] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadDragOver, setUploadDragOver] = useState(false)
  const uploadInputRef = useRef<HTMLInputElement>(null)

  // ── 分析任务勾选 ──
  const [selectedTasks, setSelectedTasks] = useState<Record<string, boolean>>({})

  // ── 背景信息覆盖 ──
  const [bgOpen, setBgOpen] = useState(false)
  const [bgOverrides, setBgOverrides] = useState<Partial<WorkspaceBackground>>({})

  // ── 提交状态 ──
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── 类型变化时重置任务勾选为默认值 ──
  useEffect(() => {
    const defaults: Record<string, boolean> = {}
    for (const t of TASKS_BY_TYPE[itemType]) {
      defaults[t.id] = t.defaultChecked
    }
    setSelectedTasks(defaults) // eslint-disable-line react-hooks/set-state-in-effect
  }, [itemType])

  // ── 打开时重置 ──
  useEffect(() => {
    if (open) {
      setStep(0) // eslint-disable-line react-hooks/set-state-in-effect
      setItemType('video')
      setItemSource('url')
      setItemValue('')
      setItemName('')
      setUploadFile(null)
      setUploadProgress(0)
      setBgOpen(false)
      setBgOverrides({})
      setError(null)
      setSubmitting(false)
    }
  }, [open]) // eslint-disable-line react-hooks/set-state-in-effect

  // ── 自动识别类型 ──
  const handleValueChange = useCallback((val: string) => {
    setItemValue(val)
    if (itemSource === 'url' && val.trim()) {
      const detected = inferTypeFromUrl(val.trim())
      if (detected) setItemType(detected)
    }
  }, [itemSource])

  const handleFileSelect = useCallback((file: File) => {
    setUploadFile(file)
    setUploadProgress(0)
    const detected = inferTypeFromFile(file)
    if (detected) setItemType(detected)
    if (!itemName.trim()) setItemName(file.name)
  }, [itemName])

  // ── 步骤导航 ──
  const canNext = (): boolean => {
    if (step === 0) return true // 类型总有默认
    if (step === 1) {
      if (itemSource === 'local') return !!uploadFile || !!itemValue.trim()
      return !!itemValue.trim()
    }
    return true
  }

  const handleNext = () => {
    if (step === 1 && itemSource === 'url' && itemValue.trim()) {
      // URL 校验
      try {
        const u = new URL(itemValue.trim())
        if (u.protocol !== 'http:' && u.protocol !== 'https:') {
          setError('链接必须以 http:// 或 https:// 开头')
          return
        }
      } catch {
        setError('请输入有效的网络链接')
        return
      }
    }
    setError(null)
    setStep((s) => Math.min(s + 1, 3))
  }

  // ── 提交 ──
  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      // 1. 创建素材
      const updated =
        itemSource === 'local' && uploadFile
          ? await uploadWorkspaceItem(workspaceId, uploadFile, {
              name: itemName.trim() || undefined,
              onProgress: setUploadProgress,
            })
          : await addWorkspaceItem(workspaceId, {
              type: itemType,
              source: itemSource,
              source_value: itemValue.trim(),
              name: itemName.trim() || undefined,
            })

      // 2. 保存 preflight（分析任务勾选 + 背景覆盖）
      const newItem = updated.items[updated.items.length - 1]
      if (newItem) {
        const preflightReq: PreflightSaveRequest = {
          tasks: selectedTasks,
        }
        if (Object.keys(bgOverrides).length > 0) {
          preflightReq.background_overrides = bgOverrides
        }
        try {
          const afterSave = await savePreflight(workspaceId, newItem.item_id, preflightReq)
          // 3. 自动触发分析
          try {
            const started = await startItemPipeline(workspaceId, newItem.item_id)
            onAdded(started.workspace)
          } catch {
            onAdded(afterSave)
          }
        } catch {
          onAdded(updated)
        }
      } else {
        onAdded(updated)
      }

      onOpenChange(false)
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const detail = (err.response?.data as { detail?: unknown } | undefined)?.detail
        setError(typeof detail === 'string' ? detail : '添加失败')
      } else {
        setError(err instanceof Error ? err.message : '添加失败')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const typeOptions: { value: ItemType; icon: typeof FileVideo; label: string }[] = [
    { value: 'video', icon: FileVideo, label: '视频' },
    { value: 'audio', icon: FileAudio, label: '音频' },
    { value: 'image', icon: FileImage, label: '图片' },
    { value: 'text', icon: FileText, label: '文字' },
  ]

  const stepTitles = ['选择素材类型', '输入素材来源', '勾选分析任务', '背景信息（可选）']

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>添加素材</DialogTitle>
          <DialogDescription>{stepTitles[step]}</DialogDescription>
        </DialogHeader>

        {/* 步骤指示器 */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {stepTitles.map((t, i) => (
            <span
              key={t}
              className={[
                'flex items-center gap-1',
                i === step ? 'font-medium text-foreground' : i < step ? 'text-primary' : '',
              ].join(' ')}
            >
              <span
                className={[
                  'flex size-5 items-center justify-center rounded-full text-[10px]',
                  i === step
                    ? 'bg-primary text-primary-foreground'
                    : i < step
                      ? 'bg-primary/20 text-primary'
                      : 'bg-muted',
                ].join(' ')}
              >
                {i < step ? '✓' : i + 1}
              </span>
              <span className="hidden sm:inline">{t}</span>
              {i < 3 && <ChevronRight className="size-3" />}
            </span>
          ))}
        </div>

        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* ── Step 0: 素材类型 ── */}
        {step === 0 && (
          <div className="grid grid-cols-4 gap-3 py-2">
            {typeOptions.map((opt) => {
              const Icon = opt.icon
              const selected = itemType === opt.value
              return (
                <button
                  key={opt.value}
                  onClick={() => setItemType(opt.value)}
                  className={[
                    'flex flex-col items-center gap-2 rounded-lg border-2 p-4 text-sm transition-colors',
                    selected
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border hover:border-primary/40',
                  ].join(' ')}
                >
                  <Icon className="size-6" />
                  <span>{opt.label}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* ── Step 1: 输入源 ── */}
        {step === 1 && (
          <div className="space-y-4 py-2">
            {/* 来源切换 */}
            <div className="flex gap-2">
              <Button
                variant={itemSource === 'url' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setItemSource('url')
                  setUploadFile(null)
                  setUploadProgress(0)
                }}
              >
                网络链接
              </Button>
              <Button
                variant={itemSource === 'local' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setItemSource('local')
                  setItemValue('')
                }}
              >
                本地文件
              </Button>
            </div>

            {/* URL 输入 */}
            {itemSource === 'url' && (
              <div className="space-y-2">
                <Label>链接 URL</Label>
                <Input
                  autoFocus
                  placeholder="https://www.bilibili.com/video/BV1..."
                  value={itemValue}
                  onChange={(e) => handleValueChange(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  粘贴链接后会自动识别素材类型
                </p>
              </div>
            )}

            {/* 本地文件上传 */}
            {itemSource === 'local' && (
              <div className="space-y-2">
                <Label>上传文件</Label>
                <input
                  ref={uploadInputRef}
                  type="file"
                  className="hidden"
                  accept="video/*,audio/*,image/*,.txt,.md,.srt,.vtt,.json,.pdf,.docx"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleFileSelect(file)
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
                    if (file) handleFileSelect(file)
                  }}
                  className={[
                    'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-4 py-6 text-sm transition-colors',
                    uploadDragOver
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/60 hover:bg-primary/5',
                  ].join(' ')}
                >
                  <Upload className="h-5 w-5" />
                  <span>拖入文件或点击选择</span>
                </div>

                {uploadFile && (
                  <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-2">
                    <Upload className="h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{uploadFile.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatFileSize(uploadFile.size)}
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label="移除上传文件"
                      className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => {
                        setUploadFile(null)
                        setUploadProgress(0)
                      }}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}

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

            {/* 显示名 */}
            <div className="space-y-2">
              <Label>显示名（可选）</Label>
              <Input
                placeholder="不填则自动从链接/路径推导"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* ── Step 2: 分析任务勾选 ── */}
        {step === 2 && (
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              已自动勾选常用任务，可按需调整
            </p>
            {TASKS_BY_TYPE[itemType].map((task) => (
              <label
                key={task.id}
                className="flex items-center gap-3 rounded-md border p-3 transition-colors hover:bg-muted/50 cursor-pointer"
              >
                <Checkbox
                  checked={selectedTasks[task.id] ?? false}
                  onCheckedChange={(checked) =>
                    setSelectedTasks((prev) => ({ ...prev, [task.id]: !!checked }))
                  }
                />
                <span className="text-sm">{task.label}</span>
              </label>
            ))}
          </div>
        )}

        {/* ── Step 3: 背景信息（折叠） ── */}
        {step === 3 && (
          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">
              背景信息会注入到所有 AI 调用中，提升分析质量。不填则使用任务级背景。
            </p>

            <Collapsible open={bgOpen} onOpenChange={setBgOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" className="w-full">
                  {bgOpen ? '收起背景信息' : '展开填写背景信息'}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3 space-y-3">
                <BgField
                  label="内容类型"
                  placeholder="课程 / 宣传片 / Vlog / 访谈 / 纯音乐 / 其他"
                  value={bgOverrides.content_type ?? ''}
                  onChange={(v) => setBgOverrides((p) => ({ ...p, content_type: v }))}
                />
                <BgField
                  label="参与人物"
                  placeholder="例：Hugo · 影视飓风"
                  value={bgOverrides.participants?.join(', ') ?? ''}
                  onChange={(v) =>
                    setBgOverrides((p) => ({
                      ...p,
                      participants: v ? v.split(/[,，]/).map((s) => s.trim()) : [],
                    }))
                  }
                />
                <BgField
                  label="主题背景"
                  placeholder="例：Q2 数码产品开箱评测"
                  value={bgOverrides.topic ?? ''}
                  onChange={(v) => setBgOverrides((p) => ({ ...p, topic: v }))}
                />
                <BgField
                  label="专有名词"
                  placeholder="用逗号分隔，提升识别准确率"
                  value={bgOverrides.glossary?.join(', ') ?? ''}
                  onChange={(v) =>
                    setBgOverrides((p) => ({
                      ...p,
                      glossary: v ? v.split(/[,，]/).map((s) => s.trim()) : [],
                    }))
                  }
                />
                <BgField
                  label="分析目的"
                  placeholder="复刻参考 / 竞品分析 / 内容学习"
                  value={bgOverrides.purpose ?? ''}
                  onChange={(v) => setBgOverrides((p) => ({ ...p, purpose: v }))}
                />
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}

        <DialogFooter>
          {step > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setStep((s) => s - 1)}>
              <ChevronLeft className="mr-1 size-4" />
              上一步
            </Button>
          )}
          {step < 3 ? (
            <Button size="sm" onClick={handleNext} disabled={!canNext()}>
              下一步
              <ChevronRight className="ml-1 size-4" />
            </Button>
          ) : (
            <Button size="sm" onClick={handleSubmit} disabled={submitting}>
              {submitting ? '添加中…' : '添加并开始分析'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── 背景信息字段子组件 ──────────────────────────────────

function BgField({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string
  placeholder: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-sm"
      />
    </div>
  )
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
