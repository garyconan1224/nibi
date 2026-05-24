import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  FileAudio,
  FileImage,
  FileText,
  FileVideo,
  Link2,
  Settings2,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { FEATURES_BY_TYPE, type Feature } from '@/lib/featuresToSteps'
import { createNoteTask } from '@/services/pipeline'
import type { SniffResult } from '@/services/workspaces'
import { sniffUrl } from '@/services/workspaces'
import type {
  ItemType,
  WorkspaceBackground,
  WorkspaceRecord,
} from '@/types/workspace'

const TYPE_META: Record<ItemType, { icon: typeof FileVideo; label: string }> = {
  video: { icon: FileVideo, label: '视频' },
  audio: { icon: FileAudio, label: '音频' },
  image: { icon: FileImage, label: '图片' },
  text: { icon: FileText, label: '文字' },
}

// ── Props ──────────────────────────────────────────────────

export interface StagedConfig {
  types: ItemType[]
  features: Record<ItemType, Record<string, boolean>>
  background: Partial<WorkspaceBackground>
  workspaceIds: string[]
  urlValue?: string
}

interface AddMaterialModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceIds: string[]
  workspaceBackgrounds?: Record<string, WorkspaceBackground>
  sniffResult?: SniffResult | null
  urlValue?: string
  onAdded?: (updated: WorkspaceRecord) => void
  onFineTune?: (staged: StagedConfig) => void
}

// ── 辅助 ──────────────────────────────────────────────────

const ALL_TYPES: ItemType[] = ['video', 'audio', 'image', 'text']

function resolveInitialTypes(
  sniffResult: SniffResult | null | undefined,
): { types: ItemType[]; locked: boolean } {
  if (sniffResult && sniffResult.possible_types.length > 0) {
    const types = sniffResult.possible_types.filter((t): t is ItemType =>
      ALL_TYPES.includes(t as ItemType),
    )
    if (types.length === 0) return { types: ['video'], locked: false }
    return { types, locked: types.length === 1 }
  }
  return { types: ['video'], locked: false }
}

function getSniffTypes(sniffResult: SniffResult | null | undefined): ItemType[] {
  if (!sniffResult) return []
  return sniffResult.possible_types.filter((t): t is ItemType =>
    ALL_TYPES.includes(t as ItemType),
  )
}

// ── 组件 ──────────────────────────────────────────────────

export function AddMaterialModal({
  open,
  onOpenChange,
  workspaceIds,
  workspaceBackgrounds,
  sniffResult,
  urlValue,
  onAdded,
  onFineTune,
}: AddMaterialModalProps) {
  // ── 类型选择 ──
  const propInitial = useMemo(() => resolveInitialTypes(sniffResult), [sniffResult])
  const [selectedTypes, setSelectedTypes] = useState<ItemType[]>(propInitial.types)

  // ── Feature 勾选（按类型）──
  const [features, setFeatures] = useState<Record<ItemType, Record<string, boolean>>>(
    () => buildDefaults(propInitial.types),
  )

  // ── 背景信息 ──
  const mergedBg = useMemo(() => {
    if (!workspaceBackgrounds || workspaceIds.length === 0) return undefined
    return workspaceBackgrounds[workspaceIds[0]]
  }, [workspaceBackgrounds, workspaceIds])
  const [bgOpen, setBgOpen] = useState(false)
  const [bgOverrides, setBgOverrides] = useState<Partial<WorkspaceBackground>>({})

  // ── 提交状态 ──
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── 内部 URL 输入（调用方未传 urlValue 时使用）──
  const [internalUrl, setInternalUrl] = useState('')
  const [internalSniff, setInternalSniff] = useState<SniffResult | null>(null)
  const sniffTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const effectiveSniff = sniffResult ?? internalSniff
  const effectiveUrl = (urlValue ?? internalUrl).trim()
  const sniffTypes = useMemo(() => getSniffTypes(effectiveSniff), [effectiveSniff])
  const effectiveInitial = useMemo(() => resolveInitialTypes(effectiveSniff), [effectiveSniff])
  const typeLocked = sniffTypes.length === 1

  // ── open / sniff 变化时重置类型与 features ──
  useEffect(() => {
    if (!open) return
    const { types } = effectiveInitial
    /* eslint-disable react-hooks/set-state-in-effect */
    setSelectedTypes(types)
    setFeatures(buildDefaults(types))
    setBgOverrides({})
    setBgOpen(false)
    setError(null)
    setSubmitting(false)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, effectiveInitial])

  useEffect(() => {
    if (!open) return
    /* eslint-disable react-hooks/set-state-in-effect */
    setInternalUrl('')
    setInternalSniff(null)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, urlValue])

  // ── 内部 URL 变化时 debounced 嗅探 ──
  const doSniff = useCallback(async (url: string) => {
    try {
      const result = await sniffUrl(url)
      setInternalSniff(result)
    } catch {
      setInternalSniff(null)
    }
  }, [])

  useEffect(() => {
    if (!internalUrl.trim() || urlValue) return
    clearTimeout(sniffTimer.current)
    sniffTimer.current = setTimeout(() => {
      doSniff(internalUrl.trim())
    }, 500)
    return () => clearTimeout(sniffTimer.current)
  }, [internalUrl, urlValue, doSniff])

  const handleInternalUrlChange = (value: string) => {
    setInternalUrl(value)
    setError(null)
    setInternalSniff(null)
  }

  // ── 类型勾选切换（仅混合类型模式）──
  const toggleType = (t: ItemType) => {
    if (typeLocked) return
    setSelectedTypes((prev) => {
      if (prev.includes(t) && prev.length === 1) return prev
      const next = prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
      if (!prev.includes(t)) {
        setFeatures((f) => ({ ...f, [t]: buildTypeDefaults(t) }))
      }
      return next
    })
  }

  // ── Feature 勾选切换 ──
  const toggleFeature = (type: ItemType, featId: string) => {
    setFeatures((prev) => ({
      ...prev,
      [type]: { ...prev[type], [featId]: !prev[type]?.[featId] },
    }))
  }

  // ── 背景字段更新 ──
  const updateBg = <K extends keyof WorkspaceBackground>(key: K, value: WorkspaceBackground[K]) => {
    setBgOverrides((prev) => ({ ...prev, [key]: value }))
  }

  // ── 一键解析 ──
  const handleQuickSubmit = async () => {
    if (!effectiveUrl) {
      setError('请先输入素材链接')
      return
    }
    if (selectedTypes.length === 0) {
      setError('请至少选择一种素材类型')
      return
    }
    if (workspaceIds.length === 0) {
      setError('请先选择工作空间')
      return
    }
    setSubmitting(true)
    setError(null)

    const primaryWs = workspaceIds[0]
    const merged: Partial<WorkspaceBackground> = {
      ...mergedBg,
      ...bgOverrides,
    }
    let succeeded = 0
    const total = selectedTypes.length

    for (const type of selectedTypes) {
      try {
        const enabledFeatures = Object.entries(features[type] ?? {})
          .filter(([, v]) => v)
          .map(([k]) => k as Feature)

        await createNoteTask({
          url: effectiveUrl,
          material_type: type,
          enabled_features: enabledFeatures,
          background: merged,
          workspace_id: primaryWs,
        })
        succeeded++
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '创建失败'
        toast.error(`${TYPE_META[type].label}任务创建失败: ${msg}`)
      }
    }

    if (succeeded === total) {
      toast.success(`${total} 个任务已入队`)
    } else if (succeeded > 0) {
      toast.warning(`已入队 ${succeeded}/${total}，部分失败请重试`)
    }
    onAdded?.({} as WorkspaceRecord)
    onOpenChange(false)
    setSubmitting(false)
  }

  // ── 细调 ──
  const handleFineTune = () => {
    const staged: StagedConfig = {
      types: selectedTypes,
      features,
      background: bgOverrides,
      workspaceIds,
      urlValue: effectiveUrl,
    }
    onFineTune?.(staged)
  }

  // ── 渲染 ──
  const sourceLabel = effectiveUrl ? '网络链接' : '待输入'
  const hasContent = effectiveUrl.length > 0 && selectedTypes.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>添加素材</DialogTitle>
          <DialogDescription>
            {effectiveSniff?.title
              ? `来自 ${effectiveSniff.platform ?? '未知平台'} · ${effectiveSniff.title}`
              : '配置素材类型与分析选项'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* ── 素材类型区 ── */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">素材类型</Label>
          {effectiveSniff && typeLocked ? (
            <TypeChip type={selectedTypes[0]} />
          ) : effectiveSniff && sniffTypes.length > 1 ? (
            <div className="space-y-1">
              {sniffTypes
                .map((t) => {
                  const meta = TYPE_META[t]
                  const Icon = meta.icon
                  const checked = selectedTypes.includes(t)
                  return (
                    <label
                      key={t}
                      className="flex items-center gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/30"
                    >
                      <Checkbox
                        checked={checked}
                        disabled={checked && selectedTypes.length === 1}
                        onCheckedChange={() => toggleType(t)}
                      />
                      <Icon className="size-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{meta.label}</span>
                      <span className="ml-auto text-[10px] text-muted-foreground">
                        {effectiveSniff.platform ?? '已识别'}
                      </span>
                    </label>
                  )
                })}
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {ALL_TYPES.map((t) => {
                const meta = TYPE_META[t]
                const Icon = meta.icon
                const on = selectedTypes.includes(t)
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleType(t)}
                    className={[
                      'flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 text-sm transition-colors',
                      on
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border hover:border-primary/40',
                    ].join(' ')}
                  >
                    <Icon className="size-5" />
                    <span>{meta.label}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* ── 输入源 ── */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">输入源</Label>
          {urlValue ? (
            <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2.5 text-sm">
              <Link2 className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate text-muted-foreground">{urlValue}</span>
              <span className="ml-auto shrink-0 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                {sourceLabel}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Input
                placeholder="粘贴 B站 / YouTube / 小红书 / 抖音链接..."
                value={internalUrl}
                onChange={(e) => handleInternalUrlChange(e.target.value)}
                className="flex-1 text-sm"
              />
              <span className="shrink-0 text-[10px] text-muted-foreground">
                {internalSniff ? '已识别' : '输入后自动识别'}
              </span>
            </div>
          )}
        </div>

        {/* ── 一级勾选区（按类型分组）── */}
        {selectedTypes.length > 0 && (
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground">
              分析任务 · 已按类型智能默认勾选
            </Label>
            {selectedTypes.map((type) => {
              const meta = TYPE_META[type]
              const Icon = meta.icon
              const typeFeatures = FEATURES_BY_TYPE[type]
              return (
                <div key={type} className="rounded-lg border p-3">
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Icon className="size-3.5" />
                    {meta.label}
                  </div>
                  <div className="space-y-1">
                    {typeFeatures.map((feat) => (
                      <label
                        key={feat.id}
                        className="flex items-center gap-2.5 rounded py-1 cursor-pointer hover:bg-muted/30"
                      >
                        <Checkbox
                          checked={features[type]?.[feat.id] ?? false}
                          onCheckedChange={() => toggleFeature(type, feat.id)}
                        />
                        <span className="text-sm">{feat.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── 背景信息（折叠）── */}
        <Collapsible open={bgOpen} onOpenChange={setBgOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="w-full text-xs">
              {bgOpen ? '收起背景信息' : '展开背景信息（从工作空间继承）'}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 space-y-3">
            <BgField
              label="内容类型"
              placeholder={mergedBg?.content_type || '课程 / 宣传片 / Vlog / 访谈 / 纯音乐'}
              value={bgOverrides.content_type ?? ''}
              onChange={(v) => updateBg('content_type', v)}
            />
            <BgField
              label="参与人物"
              placeholder={mergedBg?.participants?.join(', ') || '例：Hugo · 影视飓风'}
              value={bgOverrides.participants?.join(', ') ?? ''}
              onChange={(v) =>
                updateBg('participants', v ? v.split(/[,，]/).map((s) => s.trim()) : [])
              }
            />
            <BgField
              label="主题背景"
              placeholder={mergedBg?.topic || '例：Q2 数码产品开箱评测'}
              value={bgOverrides.topic ?? ''}
              onChange={(v) => updateBg('topic', v)}
            />
            <BgField
              label="专有名词"
              placeholder={mergedBg?.glossary?.join(', ') || '用逗号分隔'}
              value={bgOverrides.glossary?.join(', ') ?? ''}
              onChange={(v) =>
                updateBg('glossary', v ? v.split(/[,，]/).map((s) => s.trim()) : [])
              }
            />
            <BgField
              label="分析目的"
              placeholder={mergedBg?.purpose || '复刻参考 / 竞品分析 / 内容学习'}
              value={bgOverrides.purpose ?? ''}
              onChange={(v) => updateBg('purpose', v)}
            />
          </CollapsibleContent>
        </Collapsible>

        {/* ── 底部按钮 ── */}
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleFineTune}
            disabled={!hasContent || !onFineTune}
            title={onFineTune ? undefined : 'R4 接入细调参数'}
          >
            <Settings2 className="mr-1 size-3.5" />
            细调…
          </Button>
          <Button
            size="sm"
            onClick={handleQuickSubmit}
            disabled={!hasContent || submitting}
          >
            {submitting ? (
              '提交中…'
            ) : (
              <>
                <Sparkles className="mr-1 size-3.5" />
                一键解析
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── 子组件 ──────────────────────────────────────────────────

function TypeChip({ type }: { type: ItemType }) {
  const meta = TYPE_META[type]
  const Icon = meta.icon
  return (
    <div className="inline-flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
      <Icon className="size-4 text-primary" />
      <span className="text-sm font-medium">{meta.label}</span>
      <span className="text-[10px] text-muted-foreground bg-muted px-1 py-0.5 rounded">
        已识别
      </span>
    </div>
  )
}

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

// ── 默认值构建 ──────────────────────────────────────────────

function buildTypeDefaults(type: ItemType): Record<string, boolean> {
  const defaults: Record<string, boolean> = {}
  for (const f of FEATURES_BY_TYPE[type]) {
    defaults[f.id] = f.defaultChecked
  }
  return defaults
}

function buildDefaults(types: ItemType[]): Record<ItemType, Record<string, boolean>> {
  const result = {} as Record<ItemType, Record<string, boolean>>
  for (const t of types) {
    result[t] = buildTypeDefaults(t)
  }
  return result
}
