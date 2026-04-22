import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AudioLines, Cpu } from 'lucide-react'
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
  type TranscriberConfigPayload,
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
    }
  }, [transcriber])

  // 草稿状态（本地 form state）
  const [draft, setDraft] = useState<TranscriberConfigPayload>(baseline)
  const [isSaving, setIsSaving] = useState(false)

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
                  {getWhisperModelSizes().map((size) => (
                    <SelectItem key={size} value={size}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldRow>
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
    </div>
  )
}

export default TranscriberPage

