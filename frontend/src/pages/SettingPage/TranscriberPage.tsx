import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, AudioLines, ChevronDown, Cpu, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { useConfigStore } from '@/store/configStore'
import { useSettingsShellStore } from '@/store/settingsShellStore'
import { useDirtyGuard } from '@/hooks/useDirtyGuard'
import {
  updateTranscriberConfig,
  getAvailableTranscriberTypes,
  getWhisperModelSizes,
  getDeviceOptions,
  getLanguageOptions,
  fetchWhisperModelsStatus,
  type TranscriberConfigPayload,
  type WhisperModelStatus,
} from '@/services/transcriber'
import { Section } from '@/components/ui/section'
import { FieldRow } from '@/components/ui/field-row'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Switch } from '@/components/ui/switch'
import type { TranscriberType } from '@/store/configStore'

/**
 * 音频转写设置页（M3 重构版）。
 *
 * - 卡片式引擎选择器（替代 Select）；
 * - 草稿-快照状态管理 + useDirtyGuard；
 * - SaveBar 集成（由 settingsShellStore 桥接）；
 * - 动态表单：条件渲染字段（Whisper/Groq/通用语言和设备）；
 * - i18n 支持：所有文案从 settings.json 中拉取。
 */

/**
 * Whisper 模型缓存状态徽章。
 *
 * 三态展示（按优先级）：
 *   1. `pending_mb > 0`  → 下载中 X%（或 X MB 已就绪），橙色进行中样式；
 *   2. `cached === true` → 已就绪，绿色 outline；
 *   3. 其他              → 待下载 N MB / 大小未知，中性灰色。
 */
const ModelStatusBadge = ({ status }: { status: WhisperModelStatus }) => {
  if (status.pending_mb > 0) {
    const total = status.estimated_size_mb
    const doneTotal = status.done_mb + status.pending_mb
    const pct = total > 0 ? Math.min(99, Math.round((doneTotal / total) * 100)) : null
    return (
      <Badge variant="secondary" className="bg-amber-100 text-amber-800 text-[10px]">
        {pct !== null ? `下载中 ${pct}%` : `下载中 ${doneTotal.toFixed(0)} MB`}
      </Badge>
    )
  }
  if (status.cached) {
    return (
      <Badge variant="outline" className="border-emerald-500 text-emerald-700 text-[10px]">
        已就绪
      </Badge>
    )
  }
  const sizeLabel =
    status.estimated_size_mb > 0
      ? status.estimated_size_mb >= 1024
        ? `${(status.estimated_size_mb / 1024).toFixed(1)} GB`
        : `${status.estimated_size_mb} MB`
      : '大小未知'
  return (
    <Badge variant="outline" className="text-[10px] text-muted-foreground">
      待下载 {sizeLabel}
    </Badge>
  )
}

const TranscriberPage = () => {
  const { t } = useTranslation('settings')

  // 订阅 configStore 的 transcriber 配置
  const transcriber = useConfigStore((s) => s.transcriber)
  const setConfig = useConfigStore((s) => s.setConfig)

  const setSaveBar = useSettingsShellStore((s) => s.setSaveBar)
  const resetSaveBar = useSettingsShellStore((s) => s.resetSaveBar)

  // 基线快照：用于 dirty 检查与重置
  const baseline = useMemo(() => {
    return {
      type: transcriber.type,
      whisper_model_size: transcriber.whisperModelSize,
      language: transcriber.language,
      device: transcriber.device as 'cpu' | 'cuda' | 'mps',
      groq_api_key: transcriber.groqApiKey,
      initial_prompt: transcriber.initialPrompt,
      cpu_threads: transcriber.cpuThreads,
      beam_size: transcriber.beamSize,
      vad_filter: transcriber.vadFilter,
    }
  }, [transcriber])

  // 草稿状态（本地 form state）
  const [draft, setDraft] = useState<TranscriberConfigPayload>(baseline)
  const [isSaving, setIsSaving] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false) // R4.8: 高级设置折叠

  // Whisper 模型缓存状态（从 /transcriber_config/models 拉取）。
  // 任一模型处于 pending_mb > 0 的下载中状态时，自动 3s 轮询刷新。
  const [modelStatuses, setModelStatuses] = useState<WhisperModelStatus[]>([])
  const [cacheDir, setCacheDir] = useState<string>('')

  const refreshModelStatuses = useCallback(async () => {
    try {
      const res = await fetchWhisperModelsStatus()
      setModelStatuses(res.models)
      setCacheDir(res.cache_dir)
    } catch {
      // 静默失败：模型状态仅是增强信息，不阻塞表单
    }
  }, [])

  useEffect(() => {
    if (draft.type !== 'fast-whisper') return
    refreshModelStatuses()
  }, [draft.type, refreshModelStatuses])

  // 任一模型正在下载（pending_mb > 0）时启动 3 秒轮询；全部稳定后停止
  useEffect(() => {
    if (draft.type !== 'fast-whisper') return
    const hasDownloading = modelStatuses.some((m) => m.pending_mb > 0)
    if (!hasDownloading) return
    const timer = setInterval(refreshModelStatuses, 3000)
    return () => clearInterval(timer)
  }, [draft.type, modelStatuses, refreshModelStatuses])

  // 基线刷新：仅在 store 侧值变化时同步
  useEffect(() => {
    setDraft((prev) =>
      JSON.stringify(prev) === JSON.stringify(baseline) ? prev : baseline,
    )
  }, [baseline])

  const guard = useDirtyGuard<TranscriberConfigPayload>({
    initial: baseline,
    current: draft,
    message: t('dirty.leaveConfirm'),
  })

  const dirty = guard.dirtyMap

  const patch = useCallback((p: Partial<TranscriberConfigPayload>) => {
    setDraft((prev) => ({ ...prev, ...p }))
  }, [])

  const handleReset = useCallback(() => {
    setDraft(baseline)
  }, [baseline])

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    try {
      // 调用后端保存
      await updateTranscriberConfig({
        type: draft.type,
        whisper_model_size: draft.whisper_model_size,
        language: draft.language,
        device: draft.device as 'cpu' | 'cuda' | 'mps',
        groq_api_key: draft.groq_api_key,
        initial_prompt: draft.initial_prompt,
        cpu_threads: draft.cpu_threads,
        beam_size: draft.beam_size,
        vad_filter: draft.vad_filter,
      })

      // 更新前端 store（转换回 camelCase）
      setConfig({
        transcriber: {
          type: draft.type,
          whisperModelSize: draft.whisper_model_size,
          language: draft.language,
          device: draft.device,
          groqApiKey: draft.groq_api_key,
          initialPrompt: draft.initial_prompt,
          cpuThreads: draft.cpu_threads,
          beamSize: draft.beam_size,
          vadFilter: draft.vad_filter,
        },
      })

      guard.commit(draft)
      toast.success(t('transcriber.saved'))
    } catch (error) {
      console.error('Failed to save transcriber config:', error)
      toast.error(t('transcriber.saveFailed'))
    } finally {
      setIsSaving(false)
    }
  }, [draft, setConfig, guard, t])

  // SaveBar 桥：推送脏计数 + 保存/重置回调
  useEffect(() => {
    setSaveBar({
      dirtyCount: guard.dirtyCount,
      saving: isSaving,
      onSave: handleSave,
      onReset: handleReset,
    })
    return () => resetSaveBar()
  }, [guard.dirtyCount, isSaving, handleSave, handleReset, setSaveBar, resetSaveBar])

  // 判断当前是否为 macOS
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent)

  // 获取引擎的本地/在线徽章
  const getEngineType = (type: TranscriberType): 'local' | 'online' => {
    return ['fast-whisper', 'mlx-whisper'].includes(type) ? 'local' : 'online'
  }

  // 获取引擎描述文案的 key
  const getEngineDescriptionKey = (type: TranscriberType): string => {
    const keyMap: Record<TranscriberType, string> = {
      'fast-whisper': 'fastWhisper',
      'mlx-whisper': 'mlxWhisper',
      'bcut': 'bcut',
      'kuaishou': 'kuaishou',
      'groq': 'groq',
    }
    return keyMap[type]
  }

  // 防护：非 Mac 平台选了 mlx-whisper，自动改选 fast-whisper 并提示
  useEffect(() => {
    if (draft.type === 'mlx-whisper' && !isMac) {
      toast.warning(t('transcriber.mlxNotAvailable'))
      patch({ type: 'fast-whisper' })
    }
  }, [isMac, draft.type, t, patch])

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight">
          {t('transcriber.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('transcriber.subtitle')}
        </p>
      </div>

      {/* ── Section · 转写引擎卡片选择器 ── */}
      <Section
        icon={<AudioLines className="size-4" />}
        title={t('transcriber.engine.title')}
        description={t('transcriber.engine.description')}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {getAvailableTranscriberTypes().map((opt) => {
            const isSelected = draft.type === opt.value
            const iType = getEngineType(opt.value as TranscriberType)
            const badgeLabel = iType === 'local' ? t('transcriber.engine.badge.local') : t('transcriber.engine.badge.online')
            const descKey = getEngineDescriptionKey(opt.value as TranscriberType)

            return (
              <button
                key={opt.value}
                onClick={() => patch({ type: opt.value as TranscriberType })}
                className={`flex flex-col gap-2 rounded-xl border-2 p-4 text-left transition-all ${
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50 bg-card'
                }`}
              >
                <div className="flex items-start justify-between">
                  <span className="font-semibold text-foreground">{opt.label}</span>
                  <Badge variant={iType === 'local' ? 'default' : 'secondary'} className="shrink-0">
                    {badgeLabel}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t(`transcriber.engine.description.${descKey}`)}
                </p>
              </button>
            )
          })}
        </div>

        {/* 在线引擎 ToS 提示（仅当选中在线引擎时显示） */}
        {draft.type !== 'fast-whisper' && draft.type !== 'mlx-whisper' && (
          <div className="mt-4">
            <Alert variant="default" className="border-amber-200 bg-amber-50">
              <AlertCircle className="size-4 text-amber-700" />
              <AlertDescription className="text-sm text-amber-800">
                {t(`transcriber.engine.tosWarning.${draft.type}`)}
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Whisper 模型大小（仅 fast-whisper） */}
        {draft.type === 'fast-whisper' && (
          <div className="mt-6 border-t pt-6">
            <FieldRow
              htmlFor="whisper-model-size"
              label={t('transcriber.engine.modelSize')}
              hint={t('transcriber.engine.modelSize') + ' — tiny 最快，large-v3 最精准'}
              dirty={dirty.whisper_model_size}
            >
              <Select
                value={draft.whisper_model_size}
                onValueChange={(v) => patch({ whisper_model_size: v as any })}
              >
                <SelectTrigger id="whisper-model-size">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getWhisperModelSizes().map((size) => {
                    const status = modelStatuses.find((m) => m.name === size)
                    return (
                      <SelectItem key={size} value={size}>
                        <span className="flex items-center gap-2">
                          <span>{size}</span>
                          {status && (
                            <ModelStatusBadge status={status} />
                          )}
                        </span>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </FieldRow>

            {/* 缓存位置提示：下载慢时用户可自行排查磁盘空间/网络 */}
            {cacheDir && (
              <p className="mt-2 text-xs text-muted-foreground">
                模型缓存目录：<code className="rounded bg-muted px-1 py-0.5 text-[11px]">{cacheDir}</code>
              </p>
            )}
          </div>
        )}

        {/* Groq API Key（仅 groq） */}
        {draft.type === 'groq' && (
          <div className="mt-6 border-t pt-6">
            <FieldRow
              htmlFor="groq-api-key"
              label={t('transcriber.engine.groqApiKey')}
              required
              hint="Groq API Key（获取：https://console.groq.com/keys）"
              dirty={dirty.groq_api_key}
            >
              <Input
                id="groq-api-key"
                type="password"
                autoComplete="new-password"
                placeholder="gsk_..."
                value={draft.groq_api_key}
                onChange={(e) => patch({ groq_api_key: e.target.value })}
              />
            </FieldRow>
          </div>
        )}

        {/* 初始提示词（所有引擎，但仅 fast-whisper 生效） */}
        <div className="mt-6 border-t pt-6">
          <FieldRow
            htmlFor="initial-prompt"
            label={t('transcriber.initialPrompt.label')}
            hint={t('transcriber.initialPrompt.hint')}
            dirty={dirty.initial_prompt}
          >
            <Textarea
              id="initial-prompt"
              placeholder={t('transcriber.initialPrompt.placeholder')}
              value={draft.initial_prompt}
              onChange={(e) => patch({ initial_prompt: e.target.value })}
              className="min-h-20 text-sm"
            />
          </FieldRow>
        </div>
      </Section>

      {/* ── Section · 识别参数 ── */}
      <Section
        icon={<Cpu className="size-4" />}
        title="识别参数"
        description="配置语言识别和计算设备"
      >
        <div className="space-y-6">
          {/* 语言偏好 */}
          <FieldRow
            htmlFor="language"
            label={t('transcriber.language.label')}
            hint={t('transcriber.language.description')}
            dirty={dirty.language}
          >
            <Select value={draft.language} onValueChange={(v) => patch({ language: v })}>
              <SelectTrigger id="language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getLanguageOptions().map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>

          {/* 设备选择 */}
          <FieldRow
            htmlFor="device"
            label={t('transcriber.device.label')}
            hint={t('transcriber.device.description')}
            dirty={dirty.device}
          >
            <Select value={draft.device} onValueChange={(v) => patch({ device: v as any })}>
              <SelectTrigger id="device">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getDeviceOptions().map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>
        </div>
      </Section>

      {/* ── Section · 转录加速（R4.8）── */}
      {draft.type === 'fast-whisper' && (
        <Section
          icon={<Zap className="size-4" />}
          title="转录加速"
          description="调整转录引擎性能参数，提速 30-50%"
        >
          <div className="space-y-6">
            {/* VAD 静默跳过 */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium">VAD 静默跳过</span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  自动检测并跳过无人声片段，省 10-30% 耗时
                </p>
              </div>
              <Switch
                checked={draft.vad_filter}
                onCheckedChange={(v) => patch({ vad_filter: v })}
              />
            </div>

            {/* CPU 线程数 */}
            <FieldRow
              htmlFor="cpu-threads"
              label="CPU 线程数"
              hint="更多线程 = 更快计算，但会占用更多 CPU 资源"
              dirty={dirty.cpu_threads}
            >
              <Select
                value={String(draft.cpu_threads)}
                onValueChange={(v) => patch({ cpu_threads: Number(v) })}
              >
                <SelectTrigger id="cpu-threads">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">自动</SelectItem>
                  <SelectItem value="2">2 线程</SelectItem>
                  <SelectItem value="4">4 线程</SelectItem>
                  <SelectItem value="6">6 线程</SelectItem>
                  <SelectItem value="8">8 线程</SelectItem>
                </SelectContent>
              </Select>
            </FieldRow>

            {/* 高级设置折叠 */}
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronDown
                size={14}
                style={{ transform: showAdvanced ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}
              />
              高级设置
            </button>

            {showAdvanced && (
              <FieldRow
                htmlFor="beam-size"
                label="Beam 宽度"
                hint="越低越快。3 以上质量几乎无差别"
                dirty={dirty.beam_size}
              >
                <Select
                  value={String(draft.beam_size)}
                  onValueChange={(v) => patch({ beam_size: Number(v) })}
                >
                  <SelectTrigger id="beam-size">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1（最快·贪心）</SelectItem>
                    <SelectItem value="2">2</SelectItem>
                    <SelectItem value="3">3（推荐）</SelectItem>
                    <SelectItem value="4">4</SelectItem>
                    <SelectItem value="5">5（默认·最准）</SelectItem>
                  </SelectContent>
                </Select>
              </FieldRow>
            )}
          </div>
        </Section>
      )}
    </div>
  )
}

export default TranscriberPage

