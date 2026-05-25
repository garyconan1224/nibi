import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, ArrowRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useProviderStore } from '@/store/providerStore'
import { useTemplateStore } from '@/store/templateStore'
import {
  autoCreateWorkspace,
  addWorkspaceItem,
  savePreflight,
  startItemPipeline,
} from '@/services/workspaces'
import type { SniffResult } from '@/services/workspaces'
import type { ItemType, WorkspaceBackground } from '@/types/workspace'
import type { StagedConfig } from '@/components/workspace/AddMaterialModal'
import { FEATURES_BY_TYPE, type Feature } from '@/lib/featuresToSteps'
import { OUTPUT_FORMAT_OPTIONS } from '@/lib/preflightTasks'
import type { RewriteStyle, VideoOutputFormat } from '@/lib/preflightTasks'

const CONTENT_TYPES = ['课程', '会议', '宣传片', 'Vlog', '访谈', '纯音乐', '其他']
const PURPOSES = ['复刻参考', '竞品分析', '内容学习', '其他']
const ITEM_TYPE_ALIASES: Record<string, ItemType> = {
  article: 'text',
  audio: 'audio',
  image: 'image',
  text: 'text',
  video: 'video',
}
const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  video: '视频',
  audio: '音频',
  image: '图片',
  text: '文字',
}
type SummaryPath = 'subtitle' | 'detailed' | 'video_model'

interface PreflightDrawerProps {
  open: boolean
  url: string
  platformName: string | null
  /** 当混合内容场景下用户选了多种类型时传入 */
  selectedTypes?: string[]
  /** F4.2: URL 嗅探结果——用于自动确定 item type */
  sniffResult?: SniffResult | null
  /** IP.6: 选中的工作空间 ID（简化方案：只传第一个） */
  workspaceId?: string
  /** R4: 模态传入的 staged config，优先于设置页默认 */
  stagedConfig?: StagedConfig
  /** R7.4: 执行模式——execute 直接执行任务；stage 收集配置回写 */
  mode?: 'execute' | 'stage'
  /** R7.4 stage 模式回调——收集当前抽屉配置并回写 StagedConfig */
  onSaveStaged?: (staged: StagedConfig) => void
  onClose: () => void
  onCreated: () => void
}

export function PreflightDrawer({
  open,
  url,
  platformName,
  selectedTypes,
  sniffResult,
  workspaceId,
  stagedConfig,
  mode = 'execute',
  onSaveStaged,
  onClose,
  onCreated,
}: PreflightDrawerProps) {
  const [contentType, setContentType] = useState('')
  const [purpose, setPurpose] = useState('')
  const [topic, setTopic] = useState('')
  const [textProviderId, setTextProviderId] = useState('')
  const [textModelId, setTextModelId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [summaryPath, setSummaryPath] = useState<SummaryPath>('detailed')
  const [videoTemplate, setVideoTemplate] = useState('auto')
  const [outputFormat, setOutputFormat] = useState<VideoOutputFormat>('summary')
  const [textRewriteEnabled, setTextRewriteEnabled] = useState(false)
  const [textRewriteStyle, setTextRewriteStyle] = useState<RewriteStyle>('formal')
  const [textTranslateEnabled, setTextTranslateEnabled] = useState(false)
  const [textTranslateLang, setTextTranslateLang] = useState('en')
  const navigate = useNavigate()

  // F4.2: 组件级素材类型——嗅探结果优先，失败退化为 video
  const resolvedType = sniffResult?.primary_type ?? 'video'

  // R4: 从 stagedConfig 提取 feature 列表
  const stagedFeaturesForType = (type: ItemType): Feature[] => {
    if (!stagedConfig?.features?.[type]) return []
    return (Object.entries(stagedConfig.features[type]) as [Feature, boolean][])
      .filter(([, enabled]) => enabled)
      .map(([id]) => id)
  }

  const sc = stagedConfig

  const { providers, providerModels, fetchProviders, modelsLoading } = useProviderStore()
  const templateOptions = useTemplateStore((s) => s.getOptions)
  const fetchTemplates = useTemplateStore((s) => s.fetch)

  useEffect(() => {
    if (open && providers.length === 0) fetchProviders()
  }, [open, providers.length, fetchProviders])

  useEffect(() => {
    if (open) fetchTemplates()
  }, [open, fetchTemplates])

  // Reset form when opened, R4: stagedConfig 优先，否则用设置页默认。
  // react-hooks/set-state-in-effect: intentional reset-on-open pattern, consistent with codebase.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (open) {
      setContentType(sc?.background?.content_type ?? '')
      setPurpose(sc?.background?.purpose ?? '')
      setTopic(sc?.background?.topic ?? '')
      setTextProviderId('')
      setTextModelId('')
      setSummaryPath('detailed')
      setVideoTemplate('auto')
      setOutputFormat('summary')
      setTextRewriteEnabled(sc?.features?.text?.rewrite ?? false)
      setTextRewriteStyle('formal')
      setTextTranslateEnabled(sc?.features?.text?.translate ?? false)
      setTextTranslateLang('en')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  /* eslint-enable react-hooks/set-state-in-effect */

  const enabledProviders = providers.filter((p) => p.enabled && p.has_api_key)
  const textProviders = useMemo(
    () => enabledProviders.filter((p) => (p.capabilities ?? []).includes('chat')),
    [enabledProviders],
  )

  const textModels = textProviderId ? (providerModels[textProviderId] ?? []) : []

  const normalizeItemType = (type: string): ItemType => ITEM_TYPE_ALIASES[type] ?? (type as ItemType)

  // R4: stagedConfig.types 优先，否则退化为 selectedTypes → sniffResult → resolvedType
  const typesToCreate: ItemType[] = (() => {
    if (sc?.types?.length) return sc.types
    const rawTypes = selectedTypes?.length
      ? selectedTypes
      : sniffResult?.possible_types?.length
        ? sniffResult.possible_types
        : [resolvedType]
    return Array.from(new Set(rawTypes.map(normalizeItemType)))
  })()

  const typeLabel = (type: ItemType): string => ITEM_TYPE_LABELS[type]

  // R4: 标准 workspace flow — autoCreateWorkspace → addWorkspaceItem → savePreflight → startItemPipeline → navigate
  const handleConfirm = async () => {
    setSubmitting(true)
    try {
      let wsId = workspaceId
      if (!wsId) {
        const ws = await autoCreateWorkspace({ hint_url: url })
        wsId = ws.workspace_id
        toast.info(`已自动创建工作空间「${ws.name}」`)
      }

      let firstTaskId: string | null = null
      let firstItemId: string | null = null
      let successCount = 0
      const errors: string[] = []

      for (const itemType of typesToCreate) {
        try {
          // 1. addWorkspaceItem
          const ws = await addWorkspaceItem(wsId, {
            type: itemType,
            source: 'url',
            source_value: url,
            name: url,
          })
          const item = ws.items[ws.items.length - 1]
          const itemId = item.item_id

          // 2. build preflight config
          const features: Feature[] = stagedFeaturesForType(itemType).length > 0
            ? stagedFeaturesForType(itemType)
            : FEATURES_BY_TYPE[itemType].filter(f => f.defaultChecked).map(f => f.id)

          const bg: Partial<WorkspaceBackground> = {}
          if (contentType) bg.content_type = contentType
          if (purpose) bg.purpose = purpose
          if (topic) bg.topic = topic

          const tasks: Record<string, unknown> = {
            material_type: itemType,
            enabled_features: features,
          }
          for (const feat of features) {
            tasks[feat] = true
          }
          if (itemType === 'video') {
            tasks.summary_path = summaryPath
            tasks.video_template = videoTemplate
            tasks.output_format = outputFormat
          }
          if (itemType === 'text') {
            tasks.text_rewrite = { enabled: textRewriteEnabled, style: textRewriteStyle }
            tasks.text_translate = { enabled: textTranslateEnabled, target_lang: textTranslateLang }
          }
          const preflightModels: Record<string, string> = {}
          if (textModelId) preflightModels.text = textModelId

          // 3. savePreflight
          await savePreflight(wsId, itemId, {
            background_overrides: bg,
            models: preflightModels,
            tasks,
          })

          // 4. startItemPipeline
          const { task_id } = await startItemPipeline(wsId, itemId)

          if (!firstTaskId) { firstTaskId = task_id; firstItemId = itemId }
          successCount++
        } catch (e) {
          errors.push(`${typeLabel(itemType)}: ${e instanceof Error ? e.message : '创建失败'}`)
        }
      }

      if (successCount === 0) throw new Error('所有素材创建失败')

      if (errors.length > 0) {
        toast.warning(`已创建 ${successCount}/${typesToCreate.length} 个素材`, {
          description: errors.join('；'),
        })
      } else {
        toast.success(
          typesToCreate.length > 1 ? `已创建 ${successCount} 个素材` : '任务已创建',
          { description: url },
        )
      }

      onCreated()
      if (firstTaskId) {
        navigate(`/processing/${firstTaskId}`, {
          state: { url, workspaceId: wsId, itemId: firstItemId },
        })
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  // R7.4 stage 模式：收集配置回写，不动后端、不 navigate
  const handleSaveStaged = () => {
    const features: StagedConfig['features'] = { ...sc?.features }
    // 叠加 PreflightDrawer 中 text 类可调参数
    if (typesToCreate.includes('text') && (textRewriteEnabled || textTranslateEnabled)) {
      features.text = {
        ...(features.text ?? {}),
        ...(textRewriteEnabled && { rewrite: true }),
        ...(textTranslateEnabled && { translate: true }),
      }
    }
    const bg: Partial<WorkspaceBackground> = {}
    if (contentType) bg.content_type = contentType
    if (purpose) bg.purpose = purpose
    if (topic) bg.topic = topic

    onSaveStaged?.({
      types: typesToCreate,
      features,
      background: bg,
      workspaceIds: workspaceId ? [workspaceId] : [],
      urlValue: url,
    })
  }

  return (
    <>
      <div
        className="wb-modal-backdrop"
        data-open={open}
        onClick={onClose}
      />
      <div
        className="pf-drawer"
        data-open={open}
      >
        <div className="pf-drawer-head">
          <div>
            <div className="eyebrow">前置配置</div>
            <h3 className="display" style={{ fontSize: 22, margin: '4px 0 0' }}>
              {platformName ?? '未知来源'}
            </h3>
            {selectedTypes && selectedTypes.length > 0 && (
              <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                {selectedTypes.map((t) => (
                  <span key={t} className="kw">{t}</span>
                ))}
              </div>
            )}
          </div>
          <button className="btn btn-ghost" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="pf-drawer-body">
          {/* Section 1: Background info */}
          <section className="pf-section">
            <h4 className="pf-section-title">背景信息 · 可选</h4>
            <div className="pf-field">
              <label>内容类型</label>
              <select value={contentType} onChange={(e) => setContentType(e.target.value)}>
                <option value="">不指定</option>
                {CONTENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="pf-field">
              <label>分析目的</label>
              <select value={purpose} onChange={(e) => setPurpose(e.target.value)}>
                <option value="">不指定</option>
                {PURPOSES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="pf-field">
              <label>主题背景</label>
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="例：Q3 战略会议"
              />
            </div>
          </section>

          {/* Section 2: Video summary path (F4.2: 用 resolvedType 替代 selectedTypes 的宽松判空) */}
          {(selectedTypes?.length
            ? selectedTypes.some((t) => t === '视频' || t === 'video')
            : resolvedType === 'video') && (
            <section className="pf-section">
              <h4 className="pf-section-title">视频分析路径</h4>
              <div className="pf-field">
                <label>摘要方式</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {([
                    { value: 'subtitle', label: '路径 1：字幕直接总结', desc: '便宜快，适合口播/访谈' },
                    { value: 'detailed', label: '路径 2：详细总结（套模板）', desc: '推荐 · 字幕 + 截帧画面合并分析' },
                    { value: 'video_model', label: '路径 3：视频大模型直传', desc: '~$0.05/min，整段视频送大模型' },
                  ] as const).map((opt) => (
                    <label key={opt.value} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 12px', border: `1px solid ${summaryPath === opt.value ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 8, cursor: 'pointer', background: summaryPath === opt.value ? 'var(--accent-bg)' : 'transparent' }}>
                      <input
                        type="radio"
                        name="summaryPath"
                        value={opt.value}
                        checked={summaryPath === opt.value}
                        onChange={() => setSummaryPath(opt.value)}
                        style={{ marginTop: 2 }}
                      />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{opt.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{opt.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              {summaryPath === 'subtitle' && (
                <>
                  <div className="pf-field">
                    <label>视频类型模板</label>
                    <select value={videoTemplate} onChange={(e) => setVideoTemplate(e.target.value)}>
                      {templateOptions().map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="pf-field">
                    <label>输出格式</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {OUTPUT_FORMAT_OPTIONS.map((opt) => (
                        <label
                          key={opt.value}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 8,
                            padding: '6px 10px',
                            border: `1px solid ${outputFormat === opt.value ? 'var(--accent)' : 'var(--border)'}`,
                            borderRadius: 6,
                            cursor: 'pointer',
                            background: outputFormat === opt.value ? 'var(--accent-bg)' : 'transparent',
                          }}
                        >
                          <input
                            type="radio"
                            name="outputFormat"
                            value={opt.value}
                            checked={outputFormat === opt.value}
                            onChange={() => setOutputFormat(opt.value)}
                          />
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 500 }}>{opt.label}</div>
                            <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{opt.desc}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </section>
          )}

          {/* Section 2b: Text processing options */}
          {(selectedTypes?.length
            ? selectedTypes.some((t) => t === '文字' || t === 'text')
            : resolvedType === 'text') && (
            <section className="pf-section">
              <h4 className="pf-section-title">文本处理选项</h4>

              {/* 改写 / 润色 */}
              <div className="pf-field">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={textRewriteEnabled}
                    onChange={(e) => setTextRewriteEnabled(e.target.checked)}
                  />
                  改写 / 润色
                </label>
                {textRewriteEnabled && (
                  <select
                    value={textRewriteStyle}
                    onChange={(e) => setTextRewriteStyle(e.target.value as RewriteStyle)}
                    style={{ marginTop: 6 }}
                  >
                    <option value="formal">正式</option>
                    <option value="casual">口语</option>
                    <option value="concise">简洁</option>
                    <option value="rich">丰富</option>
                  </select>
                )}
              </div>

              {/* 翻译 */}
              <div className="pf-field">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={textTranslateEnabled}
                    onChange={(e) => setTextTranslateEnabled(e.target.checked)}
                  />
                  翻译
                </label>
                {textTranslateEnabled && (
                  <select
                    value={textTranslateLang}
                    onChange={(e) => setTextTranslateLang(e.target.value)}
                    style={{ marginTop: 6 }}
                  >
                    <option value="en">英文</option>
                    <option value="ja">日文</option>
                    <option value="ko">韩文</option>
                    <option value="zh">中文</option>
                    <option value="es">西班牙文</option>
                    <option value="fr">法文</option>
                    <option value="de">德文</option>
                    <option value="ru">俄文</option>
                    <option value="pt">葡萄牙文</option>
                  </select>
                )}
              </div>
            </section>
          )}

          {/* Section 3: Model selection */}
          <section className="pf-section">
            <h4 className="pf-section-title">模型选择</h4>
            {enabledProviders.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--ink-4)', padding: '8px 0' }}>
                还没有可用的 provider，请先去设置页面添加
              </div>
            ) : (
              <>
                <div className="pf-field">
                  <label>文本大模型</label>
                  <div className="pf-model-row">
                    <select
                      value={textProviderId}
                      onChange={(e) => { setTextProviderId(e.target.value); setTextModelId('') }}
                    >
                      <option value="">选择 provider</option>
                      {textProviders.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <select
                      value={textModelId}
                      onChange={(e) => setTextModelId(e.target.value)}
                      disabled={!textProviderId}
                    >
                      <option value="">选择模型</option>
                      {modelsLoading[textProviderId] ? (
                        <option value="" disabled>加载中…</option>
                      ) : (
                        textModels.map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))
                      )}
                    </select>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>

        <div className="pf-drawer-foot">
          <button className="btn btn-ghost" onClick={onClose}>取消</button>
          {mode === 'stage' ? (
            <button className="wb-btn-run" onClick={handleSaveStaged}>
              保存配置 & 返回
            </button>
          ) : (
          <button
            className="wb-btn-run"
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting ? (
              <><Loader2 size={14} className="animate-spin" /> 创建中…</>
            ) : (
              <>开始解析 <span className="iconwrap"><ArrowRight size={14} /></span></>
            )}
          </button>
          )}
        </div>
      </div>
    </>
  )
}
