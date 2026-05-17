import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { useProviderStore, type Model } from '@/store/providerStore'
import type {
  ItemType,
  PreflightSaveRequest,
  WorkspaceItem,
} from '@/types/workspace'

/**
 * 前置配置面板（设计文档第 4 章）。
 *
 * 三大区：
 *   1. 背景信息——内容类型 / 参与人员 / 主题 / 专有名词 / 分析目的
 *   2. 模型选择——视觉 / 文本 / 视频三类模型下拉，从已配置 provider 拉
 *   3. 任务勾选——按 item.type 显示不同的勾选项 + 子参数
 *
 * 用法：
 *   <PreflightConfigPanel
 *     open={open}
 *     onOpenChange={setOpen}
 *     item={item}
 *     onSave={(config) => savePreflight(...).then(() => startItemPipeline(...))}
 *   />
 */

interface PreflightConfigPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: WorkspaceItem
  /** 点击「保存并开始分析」时回调，传入待提交的 PreflightSaveRequest */
  onSave: (config: PreflightSaveRequest) => Promise<void> | void
  /** 是否处于提交中 */
  submitting?: boolean
}

// ── 内容类型下拉选项（设计文档 4.2） ─────────────────
const CONTENT_TYPE_OPTIONS = [
  '课程',
  '会议',
  '宣传片',
  'Vlog',
  '访谈',
  '纯音乐',
  '其他',
]

const PURPOSE_OPTIONS = ['复刻参考', '竞品分析', '内容学习', '其他']

export default function PreflightConfigPanel({
  open,
  onOpenChange,
  item,
  onSave,
  submitting = false,
}: PreflightConfigPanelProps) {
  // ── 1. 背景信息 state ─────────────────────────────
  const [contentType, setContentType] = useState('')
  const [participants, setParticipants] = useState('')
  const [topic, setTopic] = useState('')
  const [glossary, setGlossary] = useState('')
  const [purpose, setPurpose] = useState('')

  // ── 2. 模型选择 state ─────────────────────────────
  const [visionProviderId, setVisionProviderId] = useState('')
  const [textProviderId, setTextProviderId] = useState('')
  const [videoProviderId, setVideoProviderId] = useState('')
  const [visionModelId, setVisionModelId] = useState('')
  const [textModelId, setTextModelId] = useState('')
  const [videoModelId, setVideoModelId] = useState('')

  // ── 3. 任务勾选 state（与 item.type 强相关） ─────
  const [tasks, setTasks] = useState<Record<string, boolean>>({})

  const {
    providers,
    loading: providersLoading,
    fetchProviders,
    providerModels,
    modelsLoading,
  } = useProviderStore()

  // 首次打开拉一次 providers
  useEffect(() => {
    if (open && providers.length === 0) {
      fetchProviders()
    }
  }, [open, providers.length, fetchProviders])

  // 打开时：用 item.preflight 回填，避免每次都从空开始
  useEffect(() => {
    if (!open) return
    const bg = item.preflight.background_overrides ?? {}
    setContentType(bg.content_type ?? '')
    setParticipants((bg.participants ?? []).join(', '))
    setTopic(bg.topic ?? '')
    setGlossary((bg.glossary ?? []).join(', '))
    setPurpose(bg.purpose ?? '')

    // models 里存的是模型 ID，回填时反查它属于哪家 provider
    const findProviderByModel = (modelId: string): string => {
      if (!modelId) return ''
      for (const [pid, list] of Object.entries(providerModels)) {
        if (list?.some((m) => m.id === modelId)) return pid
      }
      return ''
    }
    const vId = item.preflight.models?.vision ?? ''
    const tId = item.preflight.models?.text ?? ''
    const vidId = item.preflight.models?.video ?? ''
    setVisionModelId(vId)
    setTextModelId(tId)
    setVideoModelId(vidId)
    setVisionProviderId(findProviderByModel(vId))
    setTextProviderId(findProviderByModel(tId))
    setVideoProviderId(findProviderByModel(vidId))

    setTasks((item.preflight.tasks as Record<string, boolean>) ?? {})
  }, [open, item, providerModels])

  // 默认勾选项（仅在用户未配置过时使用，避免覆盖已保存值）
  // 直接读 item.preflight.tasks 而非 tasks state，避免与上方回填 effect 的 race condition
  const taskOptions = useMemo(() => getTaskOptionsByType(item.type), [item.type])
  useEffect(() => {
    if (!open) return
    const saved = (item.preflight?.tasks as Record<string, boolean>) ?? {}
    if (Object.keys(saved).length > 0) return
    const defaults: Record<string, boolean> = {}
    for (const opt of taskOptions) defaults[opt.id] = opt.defaultChecked
    setTasks(defaults)
  }, [open, item.type, item.preflight?.tasks, taskOptions])

  const enabledProviders = providers.filter((p) => p.enabled && p.has_api_key)
  const visionProviders = enabledProviders.filter((p) =>
    (p.capabilities ?? []).includes('vision'),
  )
  const textProviders = enabledProviders.filter((p) =>
    (p.capabilities ?? []).includes('chat'),
  )
  const videoProviders = enabledProviders // 视频模型暂无专用 capability，全部可选

  const handleSave = () => {
    const payload: PreflightSaveRequest = {
      background_overrides: {
        content_type: contentType.trim(),
        participants: splitCsv(participants),
        topic: topic.trim(),
        glossary: splitCsv(glossary),
        purpose: purpose.trim(),
      },
      models: {
        ...(visionModelId && { vision: visionModelId }),
        ...(textModelId && { text: textModelId }),
        ...(videoModelId && { video: videoModelId }),
      },
      tasks: { ...tasks },
    }
    onSave(payload)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>前置配置 · {item.name}</DialogTitle>
          <DialogDescription>
            填好背景信息和模型，勾选要执行的分析项，点底部「保存并开始分析」。
            未勾选的步骤会被完全跳过。
          </DialogDescription>
        </DialogHeader>

        {/* 第一区：背景信息 */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">第一区 · 背景信息（可选）</h3>
          <p className="text-xs text-muted-foreground">
            注入到所有后续 AI 调用，提升识别和总结准确率。
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="content-type">内容类型</Label>
              <Select value={contentType} onValueChange={setContentType}>
                <SelectTrigger id="content-type">
                  <SelectValue placeholder="选择内容类型" />
                </SelectTrigger>
                <SelectContent>
                  {CONTENT_TYPE_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="purpose">分析目的</Label>
              <Select value={purpose} onValueChange={setPurpose}>
                <SelectTrigger id="purpose">
                  <SelectValue placeholder="选择分析目的" />
                </SelectTrigger>
                <SelectContent>
                  {PURPOSE_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="topic">主题背景</Label>
            <Input
              id="topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="例：Q3 战略会议"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="participants">参与人员（逗号分隔）</Label>
            <Input
              id="participants"
              value={participants}
              onChange={(e) => setParticipants(e.target.value)}
              placeholder="张总, 李总, 产品负责人"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="glossary">专有名词（逗号分隔）</Label>
            <Textarea
              id="glossary"
              value={glossary}
              onChange={(e) => setGlossary(e.target.value)}
              placeholder="产品名, 技术术语, 内部代号"
              rows={2}
            />
          </div>
        </section>

        <Separator />

        {/* 第二区：模型选择 */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">第二区 · 模型选择</h3>
          {providersLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> 加载 provider 列表中…
            </div>
          ) : enabledProviders.length === 0 ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
              还没有可用的 provider。请先去
              <a href="/settings/providers" className="mx-1 underline">
                设置 → 提供商管理
              </a>
              添加并启用至少一个。
            </div>
          ) : (
            <div className="space-y-3">
              <ModelPicker
                label="视觉大模型（截帧分析 / 图片分析）"
                providers={visionProviders}
                providerValue={visionProviderId}
                modelValue={visionModelId}
                onProviderChange={(pid) => {
                  setVisionProviderId(pid)
                  setVisionModelId('')
                }}
                onModelChange={setVisionModelId}
                providerModels={providerModels}
                modelsLoading={modelsLoading}
              />
              <ModelPicker
                label="文本大模型（总结 / 归纳 / 对话）"
                providers={textProviders}
                providerValue={textProviderId}
                modelValue={textModelId}
                onProviderChange={(pid) => {
                  setTextProviderId(pid)
                  setTextModelId('')
                }}
                onModelChange={setTextModelId}
                providerModels={providerModels}
                modelsLoading={modelsLoading}
              />
              <ModelPicker
                label="视频大模型（仅勾选「视频模型直接分析」时启用）"
                providers={videoProviders}
                providerValue={videoProviderId}
                modelValue={videoModelId}
                onProviderChange={(pid) => {
                  setVideoProviderId(pid)
                  setVideoModelId('')
                }}
                onModelChange={setVideoModelId}
                providerModels={providerModels}
                modelsLoading={modelsLoading}
              />
            </div>
          )}
        </section>

        <Separator />

        {/* 第三区：任务勾选 */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">
            第三区 · 任务勾选（{ITEM_TYPE_LABEL[item.type]}）
          </h3>
          <p className="text-xs text-muted-foreground">
            未勾选项完全跳过，不消耗模型调用。
          </p>
          <div className="space-y-2">
            {taskOptions.map((opt) => (
              <label
                key={opt.id}
                className="flex cursor-pointer items-start gap-2 rounded-md border p-3 transition hover:bg-muted/50"
              >
                <Checkbox
                  checked={!!tasks[opt.id]}
                  onCheckedChange={(v) =>
                    setTasks((prev) => ({ ...prev, [opt.id]: !!v }))
                  }
                />
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">{opt.label}</div>
                  {opt.desc && (
                    <div className="text-xs text-muted-foreground">{opt.desc}</div>
                  )}
                </div>
              </label>
            ))}
          </div>
        </section>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            取消
          </Button>
          <Button onClick={handleSave} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                提交中…
              </>
            ) : (
              '保存并开始分析'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── 子组件：provider + model 两级下拉 ─────────────────

function ModelPicker({
  label,
  providers,
  providerValue,
  modelValue,
  onProviderChange,
  onModelChange,
  providerModels,
  modelsLoading,
}: {
  label: string
  providers: { id: string; name: string }[]
  providerValue: string
  modelValue: string
  onProviderChange: (id: string) => void
  onModelChange: (id: string) => void
  providerModels: Record<string, Model[]>
  modelsLoading: Record<string, boolean>
}) {
  const models = providerValue ? providerModels[providerValue] ?? [] : []
  const isLoading = providerValue ? !!modelsLoading[providerValue] : false
  const modelDisabled = !providerValue || isLoading || models.length === 0

  let modelPlaceholder = '请先选供应商'
  if (providerValue) {
    if (isLoading) modelPlaceholder = '加载模型中…'
    else if (models.length === 0) modelPlaceholder = '该供应商无可用模型'
    else modelPlaceholder = '选择模型'
  }

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="grid grid-cols-2 gap-2">
        <Select value={providerValue} onValueChange={onProviderChange}>
          <SelectTrigger>
            <SelectValue placeholder="选择供应商" />
          </SelectTrigger>
          <SelectContent>
            {providers.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                没有具备此能力的 provider
              </div>
            ) : (
              providers.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        <Select
          value={modelValue}
          onValueChange={onModelChange}
          disabled={modelDisabled}
        >
          <SelectTrigger>
            <SelectValue placeholder={modelPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {models.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name || m.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

// ── 工具：按 item type 给出勾选项配置 ───────────────

interface TaskOption {
  id: string
  label: string
  desc?: string
  defaultChecked: boolean
}

const ITEM_TYPE_LABEL: Record<ItemType, string> = {
  video: '视频内容',
  audio: '音频内容',
  image: '图片内容',
  text: '文字内容',
}

function getTaskOptionsByType(type: ItemType): TaskOption[] {
  switch (type) {
    case 'video':
      return [
        {
          id: 'frame_prompts',
          label: '画面提示词生成',
          desc: '截帧 → 视觉模型 → MJ/SD 提示词',
          defaultChecked: true,
        },
        {
          id: 'video_summary',
          label: '视频文案总结',
          desc: '字幕直接总结 / 音视频合并 / 视频模型直接分析',
          defaultChecked: true,
        },
        {
          id: 'music_analysis',
          label: '音乐分析（视频中的背景音乐）',
          desc: '风格 / BPM / Suno-Udio 提示词',
          defaultChecked: false,
        },
        {
          id: 'subtitle_export',
          label: '字幕导出',
          desc: '转写完成后导出 .srt 文件',
          defaultChecked: true,
        },
      ]
    case 'audio':
      return [
        {
          id: 'asr',
          label: '人声转写 + 内容总结',
          desc: 'Whisper 转写 + LLM 总结',
          defaultChecked: true,
        },
        {
          id: 'speaker_diarization',
          label: '说话人音色区分',
          desc: '配合「人声转写」使用',
          defaultChecked: false,
        },
        {
          id: 'subtitle_file',
          label: '生成字幕文件（.srt / .txt）',
          defaultChecked: true,
        },
        {
          id: 'music_analysis',
          label: '音乐分析',
          desc: '风格 / BPM / 乐器 / Suno-Udio 提示词',
          defaultChecked: false,
        },
      ]
    case 'image':
      return [
        {
          id: 'content_describe',
          label: '内容识别描述',
          desc: '主体 / 场景 / 色调 / 构图 / 风格',
          defaultChecked: true,
        },
        { id: 'ocr', label: 'OCR 文字提取', defaultChecked: false },
        {
          id: 'frame_prompts',
          label: '画面提示词生成',
          desc: 'MJ / SD / JSON 多格式',
          defaultChecked: true,
        },
        {
          id: 'association',
          label: '内容联想总结',
          desc: '用途推断 / 设计分析 / 竞品洞察 / 情绪解读',
          defaultChecked: false,
        },
      ]
    case 'text':
      return [
        {
          id: 'summary',
          label: '摘要 / 要点 / 金句',
          defaultChecked: true,
        },
        {
          id: 'association',
          label: '联想归纳',
          desc: '深度解读 / 观点提炼 / 趋势判断 / 行动建议',
          defaultChecked: false,
        },
        {
          id: 'rewrite',
          label: '改写 / 润色',
          desc: '正式 / 口语 / 简洁 / 丰富',
          defaultChecked: false,
        },
        { id: 'translate', label: '翻译', defaultChecked: false },
      ]
  }
}

function splitCsv(input: string): string[] {
  return input
    .split(/[,，;；\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
}
