import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Check,
  ChevronDown,
  FileAudio,
  FileImage,
  FileText,
  FileVideo,
  Link2,
  Settings2,
  Sparkles,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { FEATURES_BY_SCOPE, FEATURES_BY_TYPE, type Feature } from '@/lib/featuresToSteps'
import type { SniffResult } from '@/services/workspaces'
import {
  sniffUrl,
  autoCreateWorkspace,
  addWorkspaceItem,
  savePreflight,
  startItemPipeline,
} from '@/services/workspaces'
import type {
  AnalysisScope,
  ItemType,
  WorkspaceBackground,
} from '@/types/workspace'

const TYPE_META: Record<ItemType, { icon: typeof FileVideo; label: string; sub: string }> = {
  video: { icon: FileVideo, label: '视频', sub: 'Video · URL/文件' },
  audio: { icon: FileAudio, label: '音频', sub: 'Audio · MP3/WAV' },
  image: { icon: FileImage, label: '图片', sub: 'Image · 批量' },
  text:  { icon: FileText,  label: '文字', sub: 'Text · 链接/粘贴' },
}

const BG_CONTENT_TYPES = ['课程', '会议', '宣传片', 'Vlog', '访谈', '纯音乐', '新闻报道']
const BG_PURPOSES = ['复刻参考', '竞品分析', '内容总结', '学习研究']

// ── Analysis Scope ─────────────────────────────────────────

const SCOPE_META: Record<AnalysisScope, { icon: typeof FileVideo; label: string; sub: string; itemType: ItemType }> = {
  audio_only:  { icon: FileAudio, label: '只听音频', sub: '抽取音频 · 转写 · 音乐分析', itemType: 'audio' },
  visual_only: { icon: FileVideo, label: '只看画面', sub: '截帧 · VLM 视觉分析 · 无 ASR', itemType: 'video' },
  av_combined: { icon: Sparkles,  label: '音视频综合', sub: 'ASR 转写 + 截帧 VLM + 合并总结', itemType: 'video' },
}

// ── Props ──────────────────────────────────────────────────

export interface StagedConfig {
  types: ItemType[]
  features: Partial<Record<ItemType, Record<string, boolean>>>
  tasks?: Partial<Record<ItemType, Record<string, unknown>>>
  models?: Record<string, string>
  background: Partial<WorkspaceBackground>
  workspaceIds: string[]
  urlValue?: string
  analysisScope?: AnalysisScope
}

interface AddMaterialModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceIds: string[]
  workspaceBackgrounds?: Record<string, WorkspaceBackground>
  sniffResult?: SniffResult | null
  urlValue?: string
  /** R7.4: stage 回写配置，modal 打开时用其回填 selectedTypes / features / bgOverrides */
  initialStaged?: StagedConfig
  onAdded?: () => void
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
  initialStaged,
  onAdded,
  onFineTune,
}: AddMaterialModalProps) {
  const navigate = useNavigate()
  // ── 类型选择 ──
  const propInitial = useMemo(() => resolveInitialTypes(sniffResult), [sniffResult])
  const [selectedTypes, setSelectedTypes] = useState<ItemType[]>(propInitial.types)
  const [analysisScope, setAnalysisScope] = useState<AnalysisScope>('av_combined')

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
  const showScopeCards = sniffTypes.includes('video') && sniffTypes.includes('audio')

  // ── open / sniff / initialStaged 变化时重置类型与 features ──
  useEffect(() => {
    if (!open) return
    const { types } = effectiveInitial
    /* eslint-disable react-hooks/set-state-in-effect */
    // R7.4: initialStaged 回填优先于 sniff 默认值
    if (initialStaged?.types?.length) {
      setSelectedTypes(initialStaged.types)
      setFeatures({
        ...buildDefaults(initialStaged.types),
        ...(initialStaged.features ?? {}),
      })
      setBgOverrides(initialStaged.background ?? {})
      if (initialStaged.analysisScope) setAnalysisScope(initialStaged.analysisScope)
    } else {
      setSelectedTypes(types)
      setFeatures(buildDefaults(types))
      setBgOverrides({})
      setAnalysisScope('av_combined')
    }
    setBgOpen(false)
    setError(null)
    setSubmitting(false)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, effectiveInitial, initialStaged])

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

  // ── 类型勾选切换 ──
  const toggleType = (t: ItemType) => {
    // 嗅探锁定类型不可切换；嗅探多选时只能选 sniff 返回的类型
    if (typeLocked) return
    if (sniffTypes.length > 1 && !sniffTypes.includes(t)) return

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

  // ── 一键解析（标准 workspace flow）──
  const handleQuickSubmit = async () => {
    if (!effectiveUrl) {
      setError('请先输入素材链接')
      return
    }
    if (!showScopeCards && selectedTypes.length === 0) {
      setError('请至少选择一种素材类型')
      return
    }
    setSubmitting(true)
    setError(null)

    // 分析范围模式下确定创建类型列表
    const typesToCreate: { type: ItemType; summaryPath?: string }[] = showScopeCards
      ? [{ type: SCOPE_META[analysisScope].itemType, summaryPath: analysisScope }]
      : selectedTypes.map((t) => ({ type: t }))

    try {
      // 1. 无选择时自动创建工作空间
      let wsId = workspaceIds[0]
      if (!wsId) {
        const ws = await autoCreateWorkspace({ hint_url: effectiveUrl })
        wsId = ws.workspace_id
        toast.info(`已自动创建工作空间「${ws.name}」`)
      }

      const effectiveBackground: Partial<WorkspaceBackground> = {
        ...(mergedBg ?? {}),
        ...bgOverrides,
      }
      let firstTaskId: string | null = null
      let firstItemId: string | null = null
      let succeeded = 0
      const errors: string[] = []

      for (const { type, summaryPath } of typesToCreate) {
        try {
          const allowed = showScopeCards ? new Set(FEATURES_BY_SCOPE[analysisScope]) : null
          const enabledFeatures = Object.entries(features[type] ?? {})
            .filter(([id, on]) => on && (!allowed || allowed.has(id as Feature)))
            .map(([id]) => id)

          // 2. addWorkspaceItem
          const ws = await addWorkspaceItem(wsId, {
            type,
            source: 'url',
            source_value: effectiveUrl,
            name: effectiveSniff?.title ?? effectiveUrl,
          })
          const item = ws.items[ws.items.length - 1]
          const itemId = item.item_id

          // 3. savePreflight — fine-tune 回写时优先保留 R8 任务子参数
          const stagedTasks = initialStaged?.tasks?.[type]
          const tasks: Record<string, unknown> = stagedTasks
            ? { ...stagedTasks }
            : {}
          for (const feat of enabledFeatures) {
            if (!stagedTasks) tasks[feat] = true
          }
          if (type === 'video' || type === 'audio' || stagedTasks) {
            tasks.material_type = type
            tasks.enabled_features = stagedTasks?.enabled_features ?? enabledFeatures
          }
          // analysisScope → canonical summary_path
          if (summaryPath === 'visual_only') {
            tasks.summary = { on: true, summary_path: '只看画面' }
            tasks.frame_prompt = { ...(tasks.frame_prompt as Record<string, unknown> || {}), on: true }
          } else if (summaryPath === 'av_combined') {
            tasks.summary = { on: true, summary_path: '音视频综合' }
            tasks.frame_prompt = { ...(tasks.frame_prompt as Record<string, unknown> || {}), on: true }
            tasks.srt = { ...(tasks.srt as Record<string, unknown> || {}), on: true }
          } else if (summaryPath === 'audio_only') {
            tasks.material_type = 'audio'
          }
          await savePreflight(wsId, itemId, {
            background_overrides: effectiveBackground,
            models: initialStaged?.models ?? {},
            tasks,
          })

          // 4. startItemPipeline
          const { task_id } = await startItemPipeline(wsId, itemId)

          if (!firstTaskId) { firstTaskId = task_id; firstItemId = itemId }
          succeeded++
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : '创建失败'
          errors.push(`${TYPE_META[type].label}: ${msg}`)
          toast.error(`${TYPE_META[type].label}任务创建失败: ${msg}`)
        }
      }

      if (succeeded === 0) throw new Error('所有素材创建失败')

      if (errors.length > 0) {
        toast.warning(`已创建 ${succeeded}/${selectedTypes.length} 个素材`, {
          description: errors.join('；'),
        })
      } else {
        toast.success(
          selectedTypes.length > 1 ? `已创建 ${succeeded} 个素材` : '任务已开始',
          { description: effectiveUrl },
        )
      }

      onAdded?.()
      onOpenChange(false)
      if (firstTaskId) {
        navigate(`/processing/${firstTaskId}`, {
          state: { url: effectiveUrl, workspaceId: wsId, itemId: firstItemId },
        })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '提交失败'
      setError(msg)
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  // ── 细调 ──
  const handleFineTune = () => {
    const staged: StagedConfig = {
      types: selectedTypes,
      features,
      tasks: initialStaged?.tasks,
      models: initialStaged?.models,
      background: bgOverrides,
      workspaceIds,
      urlValue: effectiveUrl,
      analysisScope: showScopeCards ? analysisScope : undefined,
    }
    onFineTune?.(staged)
  }

  // ── 派生值 ──
  const hasContent = effectiveUrl.length > 0 && (showScopeCards || selectedTypes.length > 0)
  const enabledCount = useMemo(() => {
    let n = 0
    for (const t of selectedTypes) {
      if (features[t]) {
        n += Object.values(features[t]).filter(Boolean).length
      }
    }
    return n
  }, [selectedTypes, features])

  const sourceSummary = effectiveSniff?.title
    ? `${effectiveSniff.platform ?? '未知平台'} · ${effectiveSniff.title}`
    : effectiveUrl
      ? '网络链接'
      : '配置素材类型与分析选项'
  const workspaceSummary =
    workspaceIds.length > 1
      ? `${workspaceIds.length} 个工作空间`
      : workspaceIds.length === 1
        ? '当前工作空间'
        : '未选择工作空间'

  // ── 判断某类型是否可选择 ──
  const isTypeSelectable = (t: ItemType): boolean => {
    if (typeLocked) return selectedTypes.includes(t)
    if (sniffTypes.length > 1) return sniffTypes.includes(t)
    return true
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="remix-modal-content"
        overlayClassName="remix-modal-backdrop"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">添加素材</DialogTitle>
        <DialogDescription className="sr-only">
          配置素材类型、输入源、分析任务与背景信息
        </DialogDescription>

        {/* ── m-head ── */}
        <div className="m-head">
          <div>
            <div className="eyebrow">ADD MATERIAL · 添加素材</div>
            <h3 className="display" style={{ fontSize: 28, margin: '4px 0 0' }}>
              添加素材
            </h3>
            <p className="modal-subtitle">{workspaceSummary} · {sourceSummary}</p>
          </div>
          <DialogClose className="btn btn-ghost modal-close">
            <X size={16} />
          </DialogClose>
        </div>

        {/* ── m-body ── */}
        <div className="m-body">
          {error && (
            <div className="modal-error">{error}</div>
          )}

          {/* ① 素材类型 / 分析范围 */}
          <div className="m-section">
            <div className="eyebrow" style={{ marginBottom: 10 }}>
              {showScopeCards ? '① 分析范围 · 三选一' : '① 素材类型'}
            </div>
            {showScopeCards ? (
              <div className="type-row">
                {(Object.entries(SCOPE_META) as [AnalysisScope, typeof SCOPE_META[AnalysisScope]][]).map(([scope, meta]) => {
                  const Icon = meta.icon
                  const active = analysisScope === scope
                  return (
                    <button
                      key={scope}
                      type="button"
                      className="type-card"
                      data-active={active ? 'true' : 'false'}
                      onClick={() => {
                        setAnalysisScope(scope)
                        setSelectedTypes([meta.itemType])
                        // 切换 scope 必清 features，避免隐藏 chip 状态泄漏到后端
                        setFeatures({} as Record<ItemType, Record<string, boolean>>)
                      }}
                    >
                      <Icon size={22} />
                      <div className="tc-l">{meta.label}</div>
                      <div className="mono tc-en">{meta.sub}</div>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="type-row">
                {ALL_TYPES.map((t) => {
                  const meta = TYPE_META[t]
                  const Icon = meta.icon
                  const active = selectedTypes.includes(t)
                  const selectable = isTypeSelectable(t)
                  return (
                    <button
                      key={t}
                      type="button"
                      className="type-card"
                      data-active={active ? 'true' : 'false'}
                      onClick={() => selectable && toggleType(t)}
                      disabled={!selectable}
                    >
                      <Icon size={22} />
                      <div className="tc-l">{meta.label}</div>
                      <div className="mono tc-en">{meta.sub}</div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* ② 输入源 */}
          <div className="m-section">
            <div className="eyebrow" style={{ marginBottom: 10 }}>② 输入源</div>
            {urlValue ? (
              <div className="composer-url modal-composer-url">
                <div className="platform">
                  <Link2 size={16} />
                </div>
                <span className="modal-source-value">{urlValue}</span>
                <span className="kw">Composer 传入</span>
              </div>
            ) : (
              <div className="composer-url modal-composer-url">
                <div className="platform">
                  <Link2 size={16} />
                </div>
                <input
                  value={internalUrl}
                  onChange={(e) => handleInternalUrlChange(e.target.value)}
                  placeholder="B站 / 小红书 / 抖音 / YouTube / 本地文件路径"
                />
              </div>
            )}
            {!urlValue && (
            <div className="modal-kw-row">
              <span className="kw">
                <Link2 size={11} />
                支持网络链接
              </span>
              <span className="kw">本地版无大小限制</span>
              <span className="kw" data-state={internalSniff ? 'recognized' : undefined}>
                {internalSniff ? '已识别' : '输入后自动识别'}
              </span>
            </div>
            )}
          </div>

          {/* ③ 分析任务 */}
          {selectedTypes.length > 0 && (
            <div className="m-section">
              <div className="eyebrow" style={{ marginBottom: 10 }}>
                ③ 勾选分析任务 · 已按类型智能默认
              </div>
              {selectedTypes.map((type) => {
                const meta = TYPE_META[type]
                const Icon = meta.icon
                const baseFeatures = FEATURES_BY_TYPE[type]
                const typeFeatures = showScopeCards
                  ? baseFeatures.filter(f => FEATURES_BY_SCOPE[analysisScope].includes(f.id))
                  : baseFeatures
                return (
                  <div key={type} style={{ marginBottom: 10 }}>
                    <div
                      className="mono"
                      style={{
                        fontSize: 10,
                        color: 'var(--ink-3)',
                        marginBottom: 6,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                      }}
                    >
                      <Icon size={12} />
                      {meta.label}
                    </div>
                    <div className="task-chips">
                      {typeFeatures.map((feat) => {
                        const on = features[type]?.[feat.id] ?? false
                        return (
                          <button
                            key={feat.id}
                            type="button"
                            className="task-chip"
                            data-on={on ? 'true' : 'false'}
                            onClick={() => toggleFeature(type, feat.id)}
                          >
                            <span className="tc-box">
                              {on && <Check size={12} strokeWidth={2.5} />}
                            </span>
                            {feat.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ④ 背景信息 */}
          <div className="m-section">
            <button
              type="button"
              onClick={() => setBgOpen((o) => !o)}
              className="bg-toggle"
            >
              <Sparkles size={14} className="bg-toggle-icon" />
              <span className="mono bg-toggle-label">
                ④ 背景信息（可选 · 强烈推荐）
              </span>
              <span className="kw bg-toggle-tag">
                注入所有 AI 调用
              </span>
              <ChevronDown
                size={12}
                className="bg-toggle-chevron"
                data-open={bgOpen ? 'true' : 'false'}
              />
            </button>

            {bgOpen && (
              <div className="bg-panel" style={{ marginTop: 10 }}>
                {/* 内容类型 */}
                <div>
                  <div className="field-label">
                    内容类型 <span style={{ opacity: 0.5 }}>· 影响分析视角</span>
                  </div>
                  <div className="pill-row">
                    {BG_CONTENT_TYPES.map((ct) => {
                      const current = bgOverrides.content_type ?? mergedBg?.content_type
                      const on = current === ct
                      return (
                        <button
                          key={ct}
                          type="button"
                          className="pill"
                          data-on={on ? 'true' : 'false'}
                          onClick={() =>
                            updateBg('content_type', on ? '' : ct)
                          }
                        >
                          {ct}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* 参与人物 */}
                <div>
                  <div className="field-label">
                    参与人物 <span style={{ opacity: 0.5 }}>· 用于说话人识别匹配</span>
                  </div>
                  <input
                    className="field-input"
                    placeholder={mergedBg?.participants?.join(', ') || '张总、李总、产品负责人…'}
                    value={bgOverrides.participants?.join(', ') ?? ''}
                    onChange={(e) =>
                      updateBg(
                        'participants',
                        e.target.value ? e.target.value.split(/[,，]/).map((s) => s.trim()) : [],
                      )
                    }
                  />
                </div>

                {/* 主题背景 */}
                <div>
                  <div className="field-label">
                    主题背景 <span style={{ opacity: 0.5 }}>· 注入 LLM 上下文</span>
                  </div>
                  <input
                    className="field-input"
                    placeholder={mergedBg?.topic || 'Q3 战略会议 · AI 工具评测…'}
                    value={bgOverrides.topic ?? ''}
                    onChange={(e) => updateBg('topic', e.target.value)}
                  />
                </div>

                {/* 专有名词 */}
                <div>
                  <div className="field-label">
                    专有名词 <span style={{ opacity: 0.5 }}>· 提升 Whisper 识别准确率</span>
                  </div>
                  <input
                    className="field-input"
                    placeholder={mergedBg?.glossary?.join(', ') || 'Pocket 4, D-Log M, ProRes RAW…'}
                    value={bgOverrides.glossary?.join(', ') ?? ''}
                    onChange={(e) =>
                      updateBg(
                        'glossary',
                        e.target.value ? e.target.value.split(/[,，]/).map((s) => s.trim()) : [],
                      )
                    }
                  />
                </div>

                {/* 分析目的 */}
                <div>
                  <div className="field-label">
                    分析目的 <span style={{ opacity: 0.5 }}>· 影响总结侧重点</span>
                  </div>
                  <div className="pill-row">
                    {BG_PURPOSES.map((p) => {
                      const current = bgOverrides.purpose ?? mergedBg?.purpose
                      const on = current === p
                      return (
                        <button
                          key={p}
                          type="button"
                          className="pill"
                          data-on={on ? 'true' : 'false'}
                          onClick={() =>
                            updateBg('purpose', on ? '' : p)
                          }
                        >
                          {p}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="mono" style={{ fontSize: 10, color: 'var(--ink-4)', marginTop: 2 }}>
                  以上信息将注入到所有后续 AI 调用（视觉分析 · 文本总结 · LLM 对话），提升准确率。
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── m-foot ── */}
        <div className="m-foot">
          <span className="mono modal-foot-status">
            <span className="chip-dot" style={{ marginRight: 6 }} />
            {showScopeCards
              ? `${SCOPE_META[analysisScope].label} · ${SCOPE_META[analysisScope].sub}`
              : `已勾选 ${enabledCount} 项 · ${selectedTypes.length} 种素材类型`}
          </span>
          <div className="modal-actions">
            <button
              type="button"
              className="btn"
              onClick={handleFineTune}
              disabled={!hasContent || !onFineTune}
            >
              <Settings2 size={14} />
              细调…
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleQuickSubmit}
              disabled={!hasContent || submitting}
            >
              {submitting ? (
                '提交中…'
              ) : (
                <>
                  <Sparkles size={14} />
                  一键解析
                </>
              )}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
