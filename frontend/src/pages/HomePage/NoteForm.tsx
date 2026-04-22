import { useCallback, useEffect, useRef, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import {
  AlertTriangle,
  FileVideo,
  Link2,
  Loader2,
  Send,
  Upload,
  X,
} from 'lucide-react'

import { getPlatformBadge } from '@/constant/platforms'

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

import { createPipelineTask } from '@/services/pipeline'
import { uploadLocalFile } from '@/services/upload'
import { useTaskStore } from '@/store/taskStore'
// @deprecated: useModelStore 已被 providerStore.providerModels 取代，保留文件备用，后续清理
import { useModelStore } from '@/store/modelStore'
import { useProviderStore } from '@/store/providerStore'
import { useConfigStore } from '@/store/configStore'
import {
  QUALITY_OPTIONS,
  FORMAT_OPTIONS,
  STYLE_OPTIONS,
  PIPELINE_STEPS,
  DEFAULT_STEPS,
  DOWNLOAD_MODE_OPTIONS,
  resolveFormatSelector,
} from '@/constant/note'
import type { NoteFormat, DownloadMode } from '@/store/configStore'

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

// schema 中的 message 保留为 i18n key，UI 层展示错误时再通过 t() 翻译
const formSchema = z.object({
  task_type:           z.enum(TASK_TYPES),
  // 允许空字符串（本地上传模式下 URL 为空）
  url:                 z.string(),
  // 双模型：文本 + 视觉，各自独立选择 provider 和 model
  // 注：音频模型已弃用，改用本地 faster-whisper 转录
  text_provider_id:    z.string().min(1, { message: 'form.errors.selectTextProvider' }),
  text_model:          z.string().min(1, { message: 'form.errors.selectTextModel' }),
  video_provider_id:   z.string().min(1, { message: 'form.errors.selectVideoProvider' }),
  video_model:         z.string().min(1, { message: 'form.errors.selectVideoModel' }),
  // 笔记生成偏好
  quality:             z.enum(['fast', 'medium', 'slow']),
  formats:             z.array(z.string()).min(1, { message: 'form.errors.selectFormat' }),
  style:               z.enum(['academic', 'minimalist', 'creative']),
  // 视觉理解与网格参数
  video_understanding: z.boolean(),
  video_interval:      z.number().int().min(1).max(300),
  grid_cols:           z.number().int().min(1).max(6),
  grid_rows:           z.number().int().min(1).max(6),
  // 其他选项
  screenshot:          z.boolean(),
  link:                z.boolean(),
  extras:              z.string(),
  steps:               z.array(z.string()).min(1, { message: 'form.errors.selectStep' }),
  // 下载策略（默认从 configStore 读取；单次任务可临时覆盖）
  download_mode:       z.enum(['balanced', 'speed', 'quality', 'audio']),
})

type FormValues = z.infer<typeof formSchema>

/**
 * 翻译表单验证错误消息：
 * 如果 message 以 'form.errors.' 开头则视为 i18n 键，否则原样返回。
 */
function translateFormError(msg: string | undefined, t: (key: string) => string): string {
  if (!msg) return ''
  if (msg.startsWith('form.errors.')) {
    return t(`homePage:${msg}`)
  }
  return msg
}

/* ─── 组件 ─── */
const NoteForm = () => {
  const { t } = useTranslation(['homePage', 'common'])
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
  // provider 默认值优先级：第一个 enabled provider > 历史 currentModel > providers 首项
  const defaultProviderId = providers.find(p => p.enabled)?.id
    || currentModel?.provider_id
    || providers[0]?.id
    || ''

  /* react-hook-form 初始值从 configStore 读（含三位模型 provider/model） */
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
      // 三位一体：优先复用上次持久化的 provider + model，否则用默认 provider + 空 model
      text_provider_id:    config.textProviderId || defaultProviderId,
      text_model:          config.textModelId,
      video_provider_id:   config.visionProviderId || defaultProviderId,
      video_model:         config.videoModelId,
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
      download_mode:       config.downloadMode,
    },
  })

  /* 监听 steps，用于控制上传区域与 task_type 推导 */
  const watchedSteps = watch('steps')
  const hasDownloadStep = watchedSteps.includes('download')

  /* 监听 URL 输入，按平台域名渲染前缀徽章/图标 */
  const watchedUrl = watch('url')
  const platformIcon = (() => {
    const u = (watchedUrl || '').trim()
    if (!u) return null
    // 使用新的平台检测模块
    return getPlatformBadge(u)
  })()

  /**
   * 是否需要显示本地文件上传区：
   * 勾选了 analyze 或 transcribe，但未勾选 download
   */
  const showLocalUpload =
    watchedSteps.some(s => ['analyze', 'transcribe'].includes(s)) &&
    !hasDownloadStep

  /* 监听两个 provider 变化 → 为对应模型字段自动填入首个模型 */
  const watchedTextProviderId = watch('text_provider_id')
  const watchedVideoProviderId = watch('video_provider_id')
  const watchedTextModel = watch('text_model')
  const watchedVideoModel = watch('video_model')

  // 为文本模型的 provider 变化处理
  useEffect(() => {
    if (!watchedTextProviderId) return
    if (!providerModels[watchedTextProviderId] && !modelsLoading[watchedTextProviderId]) {
      fetchProviderModels(watchedTextProviderId)
    }
    const cached = providerModels[watchedTextProviderId]
    if (cached && cached.length > 0) {
      const ids = cached.map(m => m.id)
      if (!watchedTextModel || !ids.includes(watchedTextModel)) {
        setValue('text_model', cached[0].id)
      }
    }
  }, [watchedTextProviderId, providerModels, modelsLoading, fetchProviderModels, setValue, watchedTextModel])

  // 为视频模型的 provider 变化处理
  useEffect(() => {
    if (!watchedVideoProviderId) return
    if (!providerModels[watchedVideoProviderId] && !modelsLoading[watchedVideoProviderId]) {
      fetchProviderModels(watchedVideoProviderId)
    }
    const cached = providerModels[watchedVideoProviderId]
    if (cached && cached.length > 0) {
      const ids = cached.map(m => m.id)
      if (!watchedVideoModel || !ids.includes(watchedVideoModel)) {
        setValue('video_model', cached[0].id)
      }
    }
  }, [watchedVideoProviderId, providerModels, modelsLoading, fetchProviderModels, setValue, watchedVideoModel])

  /* ─── 提交 ─── */
  const onSubmit = async (values: FormValues) => {
    setSubmitError(null)

    // 提交后将选项写回 configStore（持久化偏好：笔记格式、双模型 provider/model、下载模式）
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
      textProviderId:      values.text_provider_id,
      textModelId:         values.text_model,
      visionProviderId:    values.video_provider_id,
      videoModelId:        values.video_model,
      downloadMode:        values.download_mode as DownloadMode,
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

      // 本地文件存在时，强制从 steps 中剔除 download，让 UI 与 pipeline 从"转录/分析"直接开始
      const effectiveSteps = (showLocalUpload && localFile)
        ? values.steps.filter(s => s !== 'download')
        : values.steps

      // 从有效 steps 推导 task_type，不依赖 form field
      const taskType = deriveTaskType(effectiveSteps)

      const body = {
        project_id: projectId,
        task_type:  taskType,
        payload: {
          // 本地上传时用 video_path，否则用 URL 输入框的值
          url:                 videoPath ?? values.url,
          video_path:          videoPath,
          // 兼容旧后端字段：model_name 使用文本模型作为主模型
          model_name:          values.text_model,
          // 三位一体：各自独立的 provider + model
          text_provider_id:    values.text_provider_id,
          text_model:          values.text_model,
          vision_provider_id:  values.video_provider_id,
          vision_model:        values.video_model,
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
          // 全局网络设置：代理 / PO Token / Visitor Data / Cookie 目录统一从 configStore 读取
          proxy:               (config.httpProxy || '').trim(),
          po_token:            (config.poToken || '').trim(),
          visitor_data:        (config.visitorData || '').trim(),
          format_selector:     resolveFormatSelector(values.download_mode as DownloadMode),
          cookie_base_dirs:    (config.cookieBaseDirs || '')
            .split('\n')
            .map(s => s.trim())
            .filter(Boolean),
        },
        // 始终传递 steps，让后端按照用户勾选的流程执行
        steps: effectiveSteps,
      }

      const { task_id } = await createPipelineTask(body)

      addTask({
        task_id,
        project_id:       projectId,
        task_type:        taskType,
        // 与后端 payload 保持一致，并把 steps 塞入 payload，便于前端步骤条按 steps 过滤阶段
        payload:          { ...body.payload, steps: effectiveSteps },
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
        setSubmitError(t('homePage:form.errors.modelUnavailable'))
      } else {
        setSubmitError(msg || t('homePage:form.errors.submitFailed'))
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
        <span>{t('form.title')}</span>
      </div>

      {/* ── URL 输入（仅在不显示本地上传时展示）── */}
      {!showLocalUpload && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="url" className="text-xs text-muted-foreground">{t('homePage:form.labels.videoUrl')}</Label>
          <div className="relative">
            {/* 平台前缀：按 URL 域名展示 B/YT 徽章或链接图标 */}
            {platformIcon && (
              <span
                aria-hidden
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
              >
                {platformIcon}
              </span>
            )}
            <input
              id="url"
              type="url"
              placeholder={t('homePage:form.placeholders.pasteLink')}
              disabled={isSubmitting}
              className={[
                'w-full rounded-md border border-neutral-200 bg-white py-2 text-sm text-gray-800 placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50',
                platformIcon ? 'pl-10 pr-3' : 'px-3',
              ].join(' ')}
              {...register('url')}
            />
          </div>
          {errors.url && (
            <p className="text-xs text-red-500">{translateFormError(errors.url.message, t)}</p>
          )}
        </div>
      )}

      {/* ── 本地文件上传区（勾选 analyze/transcribe 且未勾选 download 时显示）── */}
      {showLocalUpload && (
        <div className="flex flex-col gap-2">
          <Label className="text-xs text-muted-foreground">{t('homePage:form.labels.localAudioVideo')}</Label>

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
            aria-label={t('homePage:form.upload.aria')}
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
              {t('homePage:form.upload.drag')} <span className="text-primary font-medium">{t('homePage:form.upload.clickSelect')}</span>
            </p>
            <p className="text-[10px] text-muted-foreground">
              {t('homePage:form.hints.supportedFormats', { formats: ACCEPTED_EXTENSIONS.join(' ') })}
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
                  aria-label={t('homePage:form.upload.removeFile')}
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

      {/* ── 双模型选择器：文本 + 视觉（纵向堆叠） ── */}
      {/* 注：音频模型已弃用，改用本地 faster-whisper 转录 */}
      <div className="grid grid-cols-1 gap-4">
        {([
          {
            providerField: 'text_provider_id' as const,
            modelField: 'text_model' as const,
            label: 'homePage:form.labels.textModel',
            hint: 'homePage:form.labels.textModelHint',
          },
          {
            providerField: 'video_provider_id' as const,
            modelField: 'video_model' as const,
            label: 'homePage:form.labels.videoModel',
            hint: 'homePage:form.labels.videoModelHint',
          },
        ] as const).map(item => {
          const watchedProviderId = watch(item.providerField)
          const isLoading = !!modelsLoading[watchedProviderId]
          const dynamicModels = providerModels[watchedProviderId] ?? []
          const fallbackModels = models
            .filter(m => m.provider_id === watchedProviderId)
            .map(m => ({ id: m.model_id, name: m.name }))

          return (
            <div key={item.label} className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">
                {t(item.label as any)}
                <span className="ml-1 text-[10px] text-muted-foreground/70">{t(item.hint as any)}</span>
              </Label>
              {/* Provider 选择器 */}
              <Controller
                name={item.providerField}
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="h-8 text-xs truncate">
                      <SelectValue placeholder={t('homePage:form.placeholders.selectProvider')} />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px] overflow-y-auto">
                      {providers.length === 0 && (
                        <SelectItem value="_none" disabled>{t('homePage:form.empty.noProviders')}</SelectItem>
                      )}
                      {providers
                        .filter(p => p.enabled)
                        .map(p => (
                          <SelectItem key={p.id} value={p.id} className="truncate">
                            {p.name}
                          </SelectItem>
                        ))}
                      {models
                        .filter(m => !providers.find(p => p.id === m.provider_id))
                        .map(m => m.provider_id)
                        .filter((v, i, a) => a.indexOf(v) === i)
                        .map(pid => (
                          <SelectItem key={pid} value={pid} className="truncate">{pid}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors[item.providerField] && (
                <p className="text-xs text-red-500">{translateFormError(errors[item.providerField]?.message as string, t)}</p>
              )}

              {/* Model 选择器 */}
              <Controller
                name={item.modelField}
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="h-8 text-xs truncate">
                      <SelectValue placeholder={isLoading ? t('homePage:form.placeholders.selectModel') : t('homePage:form.placeholders.selectModel')} />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px] overflow-y-auto">
                      {isLoading && (
                        <SelectItem value="_loading" disabled>{t('homePage:form.placeholders.selectModel')}</SelectItem>
                      )}
                      {!isLoading && dynamicModels.length === 0 && fallbackModels.length === 0 && (
                        <SelectItem value="_none" disabled>{t('homePage:form.empty.noModels')}</SelectItem>
                      )}
                      {dynamicModels.length > 0
                        ? dynamicModels.map(m => (
                            <SelectItem key={m.id} value={m.id} className="truncate">
                              {m.name}
                            </SelectItem>
                          ))
                        : fallbackModels.map(m => (
                            <SelectItem key={m.id} value={m.id} className="truncate">
                              {m.name}
                            </SelectItem>
                          ))
                      }
                    </SelectContent>
                  </Select>
                )}
              />
              {errors[item.modelField] && (
                <p className="text-xs text-red-500">{translateFormError(errors[item.modelField]?.message as string, t)}</p>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Quality 单选 ── */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">{t('homePage:form.labels.processingQuality')}</Label>
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
        <Label className="text-xs text-muted-foreground">{t('homePage:form.labels.formats')}</Label>
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
          <p className="text-xs text-red-500">{translateFormError(errors.formats.message, t)}</p>
        )}
      </div>

      {/* ── Style 单选 ── */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">{t('homePage:form.labels.style')}</Label>
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

      {/* ── 视觉理解（多模态抽帧）── */}
      <div className="flex items-center justify-between">
        <Label className="text-xs">{t('homePage:form.labels.visualUnderstanding')}</Label>
        <Controller
          name="video_understanding"
          control={control}
          render={({ field }) => (
            <Switch checked={field.value} onCheckedChange={field.onChange} />
          )}
        />
      </div>

      {/* ── 抽帧间隔（秒）── */}
      <div className="flex items-center justify-between gap-3">
        <Label className="text-xs shrink-0">{t('homePage:form.labels.frameInterval')}</Label>
        <input
          type="number"
          min={1}
          max={300}
          className="w-20 rounded-md border border-neutral-200 px-2 py-1 text-xs text-right"
          {...register('video_interval', { valueAsNumber: true })}
        />
      </div>

      {/* ── 网格拼图（列 × 行）── */}
      <div className="flex items-center justify-between gap-3">
        <Label className="text-xs shrink-0">{t('homePage:form.labels.gridSize')}</Label>
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

      {/* ── 下载策略（平铺） ── */}
      {!showLocalUpload && (
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">{t('homePage:form.labels.downloadStrategy')}</Label>
          <Controller
            name="download_mode"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder={t('homePage:form.placeholders.selectDownloadMode')} />
                </SelectTrigger>
                <SelectContent>
                  {DOWNLOAD_MODE_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span className="flex flex-col items-start">
                        <span className="font-medium">{opt.label}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {opt.description}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <p className="text-[10px] text-muted-foreground">
            {t('homePage:form.hints.advancedNetworkSettings')}
          </p>
        </div>
      )}

      {/* ── 执行步骤（可自由组合）── */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">{t('homePage:form.labels.steps')}</Label>
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
                        {t('homePage:form.hints.localFileHint')}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        />
        {errors.steps && (
          <p className="text-xs text-red-500">{translateFormError(errors.steps.message, t)}</p>
        )}
      </div>

      {/* ── 辅助选项（完全平铺：截图 / 链接 / 额外说明）── */}
      <div className="flex items-center justify-between">
        <Label className="text-xs">{t('homePage:form.labels.insertScreenshot')}</Label>
        <Controller
          name="screenshot"
          control={control}
          render={({ field }) => (
            <Switch checked={field.value} onCheckedChange={field.onChange} />
          )}
        />
      </div>

      <div className="flex items-center justify-between">
        <Label className="text-xs">{t('homePage:form.labels.preserveLink')}</Label>
        <Controller
          name="link"
          control={control}
          render={({ field }) => (
            <Switch checked={field.value} onCheckedChange={field.onChange} />
          )}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">{t('homePage:form.labels.extras')}</Label>
        <Textarea
          placeholder={t('homePage:form.placeholders.extrasHint')}
          className="min-h-[60px] text-xs"
          {...register('extras')}
        />
      </div>

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
            <span>{t('homePage:form.hints.submitting')}</span>
          </>
        ) : (
          <>
            <Send className="h-4 w-4" />
            <span>{t('form.submit')}</span>
          </>
        )}
      </Button>

      {/* ── 提示文案 ── */}
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {t('homePage:form.hints.supportedPlatforms')}
      </p>
    </form>
  )
}

export default NoteForm

