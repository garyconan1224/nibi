import { useCallback, useEffect, useRef, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FileVideo,
  Link2,
  Loader2,
  Send,
  Settings2,
  Upload,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'

import { createPipelineTask } from '@/services/pipeline'
import { uploadLocalFile } from '@/services/upload'
import { useTaskStore } from '@/store/taskStore'
// @deprecated: useModelStore 已被 providerStore.providerModels 取代，保留文件备用，后续清理
import { useModelStore } from '@/store/modelStore'
import { useProviderStore } from '@/store/providerStore'
import { useConfigStore } from '@/store/configStore'
import { QUALITY_OPTIONS, FORMAT_OPTIONS, STYLE_OPTIONS, PIPELINE_STEPS, DEFAULT_STEPS } from '@/constant/note'
import type { NoteFormat } from '@/store/configStore'

/* ─── 本地上传允许的文件类型 ─── */
const ACCEPTED_EXTENSIONS = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.mp3', '.wav', '.m4a']
const ACCEPTED_MIME = 'video/*,audio/*'

/** 字节数格式化为人类可读字符串 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/* ─── Zod Schema ─── */
const TASK_TYPES = ['note', 'download', 'analyze'] as const
type PipelineTaskType = typeof TASK_TYPES[number]

/** 从勾选的 steps 动态推导 task_type */
function deriveTaskType(steps: string[]): PipelineTaskType {
  if (steps.includes('note')) return 'note'
  if (steps.length === 1 && steps[0] === 'download') return 'download'
  return 'analyze'
}

const formSchema = z.object({
  task_type:           z.enum(TASK_TYPES),
  // 允许空字符串（本地上传模式下 URL 为空）
  url:                 z.string(),
  provider_id:         z.string().min(1, { message: '请选择提供商' }),
  model_id:            z.string().min(1, { message: '请选择模型' }),
  quality:             z.enum(['fast', 'medium', 'slow']),
  formats:             z.array(z.string()).min(1, { message: '至少选择一种格式' }),
  style:               z.enum(['academic', 'minimalist', 'creative']),
  screenshot:          z.boolean(),
  link:                z.boolean(),
  video_understanding: z.boolean(),
  video_interval:      z.number().int().min(1).max(300),
  grid_cols:           z.number().int().min(1).max(6),
  grid_rows:           z.number().int().min(1).max(6),
  extras:              z.string(),
  steps:               z.array(z.string()).min(1, { message: '至少选择一个执行步骤' }),
})

type FormValues = z.infer<typeof formSchema>

/* ─── 组件 ─── */
const NoteForm = () => {
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [submitError, setSubmitError]   = useState<string | null>(null)

  /* ── 本地文件上传相关 state ── */
  const [localFile, setLocalFile]         = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState<number>(0)
  const [isDragOver, setIsDragOver]       = useState(false)
  const fileInputRef                       = useRef<HTMLInputElement>(null)

  /** 验证并选定文件（拖拽 / 点击共用） */
  const handleFileSelect = useCallback((file: File) => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    const isMimeOk = file.type.startsWith('video/') || file.type.startsWith('audio/')
    const isExtOk  = ACCEPTED_EXTENSIONS.includes(ext)
    if (!isMimeOk && !isExtOk) return // 忽略不支持的文件类型
    setLocalFile(file)
    setUploadProgress(0)
  }, [])

  /* 拖拽事件处理 */
  const onDragOver  = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true) }, [])
  const onDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false) }, [])
  const onDrop      = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }, [handleFileSelect])

  /* stores */
  const { addTask, setCurrentTask }                             = useTaskStore()
  const { models, currentModelId }                              = useModelStore() // @deprecated
  const { providers, fetchProviders, providerModels,
          modelsLoading, fetchProviderModels }                  = useProviderStore()
  const config                                                   = useConfigStore()

  /* 首次挂载拉取 providers（内部会自动拉各 enabled provider 的模型） */
  useEffect(() => { fetchProviders() }, [fetchProviders])

  /* 当前选中模型归属的 provider（优先用 providerStore 数据，fallback 到 modelStore） */
  const currentModel     = models.find(m => m.model_id === currentModelId) ?? models[0]
  const defaultProviderId = providers.find(p => p.enabled)?.id
    ?? currentModel?.provider_id
    ?? providers[0]?.id
    ?? ''

  /* react-hook-form 初始值从 configStore 读 */
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      task_type:           'note' as PipelineTaskType,
      url:                 '',
      provider_id:         defaultProviderId,
      model_id:            currentModelId ?? models[0]?.model_id ?? '',
      quality:             config.defaultQuality,
      formats:             config.defaultFormats,
      style:               config.defaultStyle,
      screenshot:          config.screenshot,
      link:                config.link,
      video_understanding: config.video_understanding,
      video_interval:      config.video_interval,
      grid_cols:           config.grid_size[0],
      grid_rows:           config.grid_size[1],
      extras:              config.extras,
      steps:               [...DEFAULT_STEPS],
    },
  })

  /* 监听 steps，用于控制上传区域与 task_type 推导 */
  const watchedSteps = watch('steps')
  const hasDownloadStep = watchedSteps.includes('download')

  /**
   * 是否需要显示本地文件上传区：
   * 勾选了 analyze 或 transcribe，但未勾选 download
   */
  const showLocalUpload =
    watchedSteps.some(s => ['analyze', 'transcribe'].includes(s)) &&
    !hasDownloadStep

  /* 监听 provider 变化 → 触发拉取模型 & 自动切换到第一个模型 */
  const watchedProviderId = watch('provider_id')
  useEffect(() => {
    if (!watchedProviderId) return
    // 若该 provider 尚未缓存模型，触发拉取
    if (!providerModels[watchedProviderId] && !modelsLoading[watchedProviderId]) {
      fetchProviderModels(watchedProviderId)
    }
    // 切换 provider 时，自动选中第一个可用模型
    const cached = providerModels[watchedProviderId]
    if (cached && cached.length > 0) {
      setValue('model_id', cached[0].id)
    }
  }, [watchedProviderId, providerModels, modelsLoading, fetchProviderModels, setValue])

  /* 当前 provider 的动态模型列表（优先用 providerStore 缓存，fallback 到 modelStore） */
  const dynamicModels = providerModels[watchedProviderId] ?? []
  const isModelsLoading = !!modelsLoading[watchedProviderId]
  // fallback：若动态模型为空，使用 modelStore 中属于该 provider 的静态模型
  const fallbackModels = models
    .filter(m => m.provider_id === watchedProviderId)
    .map(m => ({ id: m.model_id, name: m.name }))

  /* ─── 提交 ─── */
  const onSubmit = async (values: FormValues) => {
    setSubmitError(null)

    // 提交后将选项写回 configStore（持久化偏好）
    config.setConfig({
      defaultQuality:      values.quality,
      defaultFormats:      values.formats as NoteFormat[],
      defaultStyle:        values.style,
      screenshot:          values.screenshot,
      link:                values.link,
      video_understanding: values.video_understanding,
      video_interval:      values.video_interval,
      grid_size:           [values.grid_cols, values.grid_rows],
      extras:              values.extras,
    })

    try {
      // ── 若存在本地文件，先上传，获取 project_id ──
      let projectId: string = crypto.randomUUID()
      let videoPath: string | undefined

      if (showLocalUpload && localFile) {
        const uploaded = await uploadLocalFile(localFile, projectId, setUploadProgress)
        projectId = uploaded.project_id
        videoPath = uploaded.video_path
      }

      // 从勾选的 steps 推导 task_type，不依赖 form field
      const taskType = deriveTaskType(values.steps)

      const body = {
        project_id: projectId,
        task_type:  taskType,
        payload: {
          // 本地上传时用 video_path，否则用 URL 输入框的值
          url:                 videoPath ?? values.url,
          video_path:          videoPath,
          model_name:          values.model_id,
          provider_id:         values.provider_id,
          quality:             values.quality,
          format:              values.formats,
          style:               values.style,
          screenshot:          values.screenshot,
          link:                values.link,
          video_understanding: values.video_understanding,
          video_interval:      values.video_interval,
          grid_size:           [values.grid_cols, values.grid_rows],
          extras:              values.extras || undefined,
          browser:             'chrome',
          proxy:               '',
          format_selector:     'best',
          cookie_base_dirs:    [],
        },
        // 始终传递 steps，让后端按照用户勾选的流程执行
        steps: values.steps,
      }

      const { task_id } = await createPipelineTask(body)

      addTask({
        task_id,
        project_id:       projectId,
        task_type:        taskType,
        payload:          body.payload,
        status:           'PENDING',
        progress:         0,
        log:              [],
        result:           {},
        error:            '',
        retry_of:         '',
        cancel_requested: false,
        created_at:       new Date().toISOString(),
        updated_at:       new Date().toISOString(),
      })

      setCurrentTask(task_id)
    } catch (err: unknown) {
      // 对 400 错误（如模型不可用）给出友好提示
      const msg = err instanceof Error ? err.message : String(err)
      const lower = msg.toLowerCase()
      if (
        (lower.includes('400') || lower.includes('bad request')) &&
        (lower.includes('model') || lower.includes('模型'))
      ) {
        setSubmitError('当前模型不可用，请在「设置 → 提供商管理」中检查模型配置后重试')
      } else {
        setSubmitError(msg || '提交失败，请重试')
      }
    }
  }

  /* ─── 渲染 ─── */
  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-5 px-1"
    >
      {/* ── 标题 ── */}
      <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
        <Link2 className="h-4 w-4 text-primary" />
        <span>新建笔记</span>
      </div>

      {/* ── URL 输入（仅在不显示本地上传时展示）── */}
      {!showLocalUpload && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="url" className="text-xs text-muted-foreground">视频 URL</Label>
          <input
            id="url"
            type="url"
            placeholder="粘贴 YouTube / Bilibili 链接..."
            disabled={isSubmitting}
            className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
            {...register('url')}
          />
          {errors.url && (
            <p className="text-xs text-red-500">{errors.url.message}</p>
          )}
        </div>
      )}

      {/* ── 本地文件上传区（勾选 analyze/transcribe 且未勾选 download 时显示）── */}
      {showLocalUpload && (
        <div className="flex flex-col gap-2">
          <Label className="text-xs text-muted-foreground">本地音视频文件</Label>

          {/* 隐藏的 file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_MIME}
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) handleFileSelect(file)
              e.target.value = '' // 允许重复选同一文件
            }}
          />

          {/* 拖拽 / 点击触发区域 */}
          <div
            role="button"
            tabIndex={0}
            aria-label="上传本地视频或音频文件"
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={[
              'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 cursor-pointer transition-colors',
              isDragOver
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-neutral-300 bg-neutral-50 text-muted-foreground hover:border-primary/60 hover:bg-primary/5',
              isSubmitting ? 'pointer-events-none opacity-50' : '',
            ].join(' ')}
          >
            <Upload className="h-6 w-6 shrink-0" />
            <p className="text-xs text-center leading-relaxed">
              拖拽视频 / 音频到此处，或 <span className="text-primary font-medium">点击选择</span>
            </p>
            <p className="text-[10px] text-muted-foreground">
              支持 {ACCEPTED_EXTENSIONS.join(' ')}
            </p>
          </div>

          {/* 已选文件信息 + 上传进度 */}
          {localFile && (
            <div className="rounded-md border border-neutral-200 bg-white px-3 py-2.5 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <FileVideo className="h-4 w-4 shrink-0 text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{localFile.name}</p>
                  <p className="text-[10px] text-muted-foreground">{formatFileSize(localFile.size)}</p>
                </div>
                <button
                  type="button"
                  aria-label="移除文件"
                  disabled={isSubmitting}
                  onClick={e => { e.stopPropagation(); setLocalFile(null); setUploadProgress(0) }}
                  className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-red-500 disabled:opacity-40"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              {uploadProgress > 0 && (
                <div className="flex flex-col gap-1">
                  <Progress value={uploadProgress} className="h-1.5" />
                  <p className="text-[10px] text-muted-foreground text-right">{uploadProgress}%</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Provider → Model 二级下拉 ── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">提供商</Label>
          <Controller
            name="provider_id"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="选择提供商" />
                </SelectTrigger>
                <SelectContent>
                  {providers.length === 0 && (
                    <SelectItem value="_none" disabled>暂无提供商</SelectItem>
                  )}
                  {providers
                    .filter(p => p.enabled)
                    .map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  {/* 硬编码备用（当 providers 未拉取时也能选） */}
                  {models
                    .filter(m => !providers.find(p => p.id === m.provider_id))
                    .map(m => m.provider_id)
                    .filter((v, i, a) => a.indexOf(v) === i)
                    .map(pid => (
                      <SelectItem key={pid} value={pid}>{pid}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">模型</Label>
          <Controller
            name="model_id"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder={isModelsLoading ? '加载中...' : '选择模型'} />
                </SelectTrigger>
                <SelectContent>
                  {isModelsLoading && (
                    <SelectItem value="_loading" disabled>加载中...</SelectItem>
                  )}
                  {!isModelsLoading && dynamicModels.length === 0 && fallbackModels.length === 0 && (
                    <SelectItem value="_none" disabled>暂无模型</SelectItem>
                  )}
                  {/* 优先展示动态拉取的真实模型列表 */}
                  {dynamicModels.length > 0
                    ? dynamicModels.map(m => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))
                    : fallbackModels.map(m => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))
                  }
                </SelectContent>
              </Select>
            )}
          />
          {errors.model_id && (
            <p className="text-xs text-red-500">{errors.model_id.message}</p>
          )}
        </div>
      </div>

      {/* ── Quality 单选 ── */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">处理质量</Label>
        <Controller
          name="quality"
          control={control}
          render={({ field }) => (
            <RadioGroup
              value={field.value}
              onValueChange={field.onChange}
              className="flex gap-4"
            >
              {QUALITY_OPTIONS.map(opt => (
                <div key={opt.value} className="flex items-center gap-1.5">
                  <RadioGroupItem value={opt.value} id={`quality-${opt.value}`} />
                  <Label htmlFor={`quality-${opt.value}`} className="text-xs cursor-pointer">
                    {opt.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          )}
        />
      </div>

      {/* ── Format 多选 ── */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">笔记格式（可多选）</Label>
        <Controller
          name="formats"
          control={control}
          render={({ field }) => (
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {FORMAT_OPTIONS.map(opt => (
                <div key={opt.value} className="flex items-center gap-1.5">
                  <Checkbox
                    id={`fmt-${opt.value}`}
                    checked={field.value.includes(opt.value)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        field.onChange([...field.value, opt.value])
                      } else {
                        field.onChange(field.value.filter((v: string) => v !== opt.value))
                      }
                    }}
                  />
                  <Label htmlFor={`fmt-${opt.value}`} className="text-xs cursor-pointer">
                    {opt.label}
                  </Label>
                </div>
              ))}
            </div>
          )}
        />
        {errors.formats && (
          <p className="text-xs text-red-500">{errors.formats.message}</p>
        )}
      </div>

      {/* ── Style 单选 ── */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">笔记风格</Label>
        <Controller
          name="style"
          control={control}
          render={({ field }) => (
            <RadioGroup
              value={field.value}
              onValueChange={field.onChange}
              className="flex gap-4"
            >
              {STYLE_OPTIONS.map(opt => (
                <div key={opt.value} className="flex items-center gap-1.5">
                  <RadioGroupItem value={opt.value} id={`style-${opt.value}`} />
                  <Label htmlFor={`style-${opt.value}`} className="text-xs cursor-pointer">
                    {opt.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          )}
        />
      </div>

      {/* ── 高级选项 Collapsible ── */}
      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-md border border-dashed border-neutral-300 px-3 py-2 text-xs text-muted-foreground hover:bg-neutral-50"
          >
            <span className="flex items-center gap-1.5">
              <Settings2 className="h-3.5 w-3.5" />
              高级选项
            </span>
            {advancedOpen
              ? <ChevronUp className="h-3.5 w-3.5" />
              : <ChevronDown className="h-3.5 w-3.5" />
            }
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-3 flex flex-col gap-3">
          {/* ── 步骤选择器（始终显示，通过 steps 推导 task_type）── */}
          <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">执行步骤（可自由组合）</Label>
              <Controller
                name="steps"
                control={control}
                render={({ field }) => (
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                    {PIPELINE_STEPS.map(opt => {
                      const checked = field.value.includes(opt.value)
                      const needsLocalHint =
                        !hasDownloadStep &&
                        (opt.value === 'transcribe' || opt.value === 'analyze')
                      return (
                        <div key={opt.value} className="flex items-center gap-1.5">
                          <Checkbox
                            id={`step-${opt.value}`}
                            checked={checked}
                            onCheckedChange={(isChecked) => {
                              if (isChecked) {
                                field.onChange([...field.value, opt.value])
                              } else {
                                // 至少保留一个选中项
                                const next = field.value.filter((v: string) => v !== opt.value)
                                if (next.length > 0) field.onChange(next)
                              }
                            }}
                          />
                          <Label
                            htmlFor={`step-${opt.value}`}
                            className="text-xs cursor-pointer"
                          >
                            {opt.label}
                          </Label>
                          {needsLocalHint && checked && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-600">
                              <AlertTriangle className="h-3 w-3" />
                              将尝试使用本地已有文件
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              />
              {errors.steps && (
                <p className="text-xs text-red-500">{errors.steps.message}</p>
              )}
          </div>

          {/* screenshot */}
          <div className="flex items-center justify-between">
            <Label className="text-xs">插入截图</Label>
            <Controller
              name="screenshot"
              control={control}
              render={({ field }) => (
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
          </div>

          {/* link */}
          <div className="flex items-center justify-between">
            <Label className="text-xs">保留原始链接</Label>
            <Controller
              name="link"
              control={control}
              render={({ field }) => (
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
          </div>

          {/* video_understanding */}
          <div className="flex items-center justify-between">
            <Label className="text-xs">视觉理解（多模态抽帧）</Label>
            <Controller
              name="video_understanding"
              control={control}
              render={({ field }) => (
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
          </div>

          {/* video_interval */}
          <div className="flex items-center justify-between gap-3">
            <Label className="text-xs shrink-0">抽帧间隔（秒）</Label>
            <input
              type="number"
              min={1}
              max={300}
              className="w-20 rounded-md border border-neutral-200 px-2 py-1 text-xs text-right"
              {...register('video_interval', { valueAsNumber: true })}
            />
          </div>

          {/* grid_size */}
          <div className="flex items-center justify-between gap-3">
            <Label className="text-xs shrink-0">网格拼图（列 × 行）</Label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={1}
                max={6}
                className="w-14 rounded-md border border-neutral-200 px-2 py-1 text-xs text-right"
                {...register('grid_cols', { valueAsNumber: true })}
              />
              <span className="text-xs text-muted-foreground">×</span>
              <input
                type="number"
                min={1}
                max={6}
                className="w-14 rounded-md border border-neutral-200 px-2 py-1 text-xs text-right"
                {...register('grid_rows', { valueAsNumber: true })}
              />
            </div>
          </div>

          {/* extras */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">额外说明（补充 Prompt）</Label>
            <Textarea
              placeholder="可填写额外的分析要求..."
              className="min-h-[60px] text-xs"
              {...register('extras')}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* ── 错误提示 ── */}
      {submitError && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">
          {submitError}
        </p>
      )}

      {/* ── 提交按钮 ── */}
      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full"
        size="sm"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>提交中...</span>
          </>
        ) : (
          <>
            <Send className="h-4 w-4" />
            <span>开始处理</span>
          </>
        )}
      </Button>

      {/* ── 提示文案 ── */}
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        支持 YouTube、Bilibili 等平台链接。提交后将自动下载并生成笔记。
      </p>
    </form>
  )
}

export default NoteForm

