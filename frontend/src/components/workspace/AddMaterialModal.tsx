import { useEffect, useMemo, useState } from 'react'
import {
  FileAudio,
  FileImage,
  FileText,
  FileVideo,
  Link2,
  Settings2,
  Sparkles,
  Upload,
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
import type { SniffResult } from '@/services/workspaces'
import { addWorkspaceItem } from '@/services/workspaces'
import type {
  ItemType,
  WorkspaceBackground,
  WorkspaceRecord,
} from '@/types/workspace'

// ── 一级 Feature 定义（SPEC §2.6 表格）────────────────────

interface FeatureDef {
  id: string
  label: string
  defaultChecked: boolean
}

const FEATURES_BY_TYPE: Record<ItemType, FeatureDef[]> = {
  video: [
    { id: 'visual_prompt', label: '画面提示词', defaultChecked: true },
    { id: 'summary', label: '文案总结', defaultChecked: true },
    { id: 'subtitle_export', label: '字幕导出', defaultChecked: true },
    { id: 'music_analysis', label: '音乐分析', defaultChecked: false },
  ],
  audio: [
    { id: 'transcribe_summary', label: '转写+总结', defaultChecked: true },
    { id: 'speaker_diarize', label: '说话人音色', defaultChecked: false },
    { id: 'subtitle_export', label: '字幕导出', defaultChecked: true },
    { id: 'music_analysis', label: '音乐分析', defaultChecked: false },
  ],
  image: [
    { id: 'describe', label: '内容识别', defaultChecked: true },
    { id: 'ocr', label: 'OCR', defaultChecked: false },
    { id: 'prompt', label: '提示词', defaultChecked: true },
    { id: 'assoc', label: '联想总结', defaultChecked: false },
  ],
  text: [
    { id: 'summary_keypoints', label: '摘要+要点+金句', defaultChecked: true },
    { id: 'rewrite', label: '改写', defaultChecked: false },
    { id: 'translate', label: '翻译', defaultChecked: false },
    { id: 'multi_compare', label: '多文对比', defaultChecked: false },
  ],
}

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
  const initial = useMemo(() => resolveInitialTypes(sniffResult), [sniffResult])
  const [selectedTypes, setSelectedTypes] = useState<ItemType[]>(initial.types)
  const typeLocked = initial.locked

  // ── Feature 勾选（按类型）──
  const [features, setFeatures] = useState<Record<ItemType, Record<string, boolean>>>(
    () => buildDefaults(initial.types),
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

  // ── sniffResult 变化时重置类型与 features ──
  useEffect(() => {
    if (open) {
      const { types } = resolveInitialTypes(sniffResult)
      setSelectedTypes(types)
      setFeatures(buildDefaults(types))
      setBgOverrides({})
      setBgOpen(false)
      setError(null)
      setSubmitting(false)
    }
  }, [open, sniffResult])

  // ── 类型勾选切换（仅混合类型模式）──
  const toggleType = (t: ItemType) => {
    if (typeLocked) return
    setSelectedTypes((prev) => {
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
    try {
      // R2 阶段：仅对第一个类型创建单条素材（循环 POST 在 R3 实现）
      const firstType = selectedTypes[0]
      const updated = await addWorkspaceItem(primaryWs, {
        type: firstType,
        source: urlValue ? 'url' : 'local',
        source_value: urlValue ?? '',
      })
      toast.success(`${TYPE_META[firstType].label}素材已入队`)
      onAdded?.(updated)
      onOpenChange(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '添加失败')
    } finally {
      setSubmitting(false)
    }
  }

  // ── 细调 ──
  const handleFineTune = () => {
    const staged: StagedConfig = {
      types: selectedTypes,
      features,
      background: bgOverrides,
      workspaceIds,
      urlValue,
    }
    onFineTune?.(staged)
  }

  // ── 渲染 ──
  const sourceLabel = urlValue ? '网络链接' : '本地文件'
  const hasContent = urlValue || selectedTypes.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>添加素材</DialogTitle>
          <DialogDescription>
            {sniffResult?.title
              ? `来自 ${sniffResult.platform ?? '未知平台'} · ${sniffResult.title}`
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
          {sniffResult && typeLocked ? (
            <TypeChip type={selectedTypes[0]} />
          ) : sniffResult && !typeLocked ? (
            <div className="space-y-1">
              {selectedTypes.map((t) => {
                const meta = TYPE_META[t]
                const Icon = meta.icon
                return (
                  <label
                    key={t}
                    className="flex items-center gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/30"
                  >
                    <Checkbox
                      checked={true}
                      disabled={selectedTypes.length === 1}
                      onCheckedChange={() => toggleType(t)}
                    />
                    <Icon className="size-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{meta.label}</span>
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      {sniffResult.platform ?? '已识别'}
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

        {/* ── 输入源展示（只读）── */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">输入源</Label>
          <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2.5 text-sm">
            {urlValue ? (
              <>
                <Link2 className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate text-muted-foreground">{urlValue}</span>
              </>
            ) : (
              <>
                <Upload className="size-4 shrink-0 text-muted-foreground" />
                <span className="text-muted-foreground">本地文件</span>
              </>
            )}
            <span className="ml-auto shrink-0 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {sourceLabel}
            </span>
          </div>
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

        {/* ── 底部双按钮 ── */}
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleFineTune}
            disabled={!hasContent}
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
