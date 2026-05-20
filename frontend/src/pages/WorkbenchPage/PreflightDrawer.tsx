import { useState, useEffect, useMemo } from 'react'
import { X, ArrowRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useProviderStore } from '@/store/providerStore'
import { useTaskStore } from '@/store/taskStore'
import { createPipelineTask } from '@/services/pipeline'

const CONTENT_TYPES = ['课程', '会议', '宣传片', 'Vlog', '访谈', '纯音乐', '其他']
const PURPOSES = ['复刻参考', '竞品分析', '内容学习', '其他']

interface PreflightDrawerProps {
  open: boolean
  url: string
  platformName: string | null
  /** 当混合内容场景下用户选了多种类型时传入 */
  selectedTypes?: string[]
  onClose: () => void
  onCreated: () => void
}

export function PreflightDrawer({
  open,
  url,
  platformName,
  selectedTypes,
  onClose,
  onCreated,
}: PreflightDrawerProps) {
  const [contentType, setContentType] = useState('')
  const [purpose, setPurpose] = useState('')
  const [topic, setTopic] = useState('')
  const [visionProviderId, setVisionProviderId] = useState('')
  const [textProviderId, setTextProviderId] = useState('')
  const [visionModelId, setVisionModelId] = useState('')
  const [textModelId, setTextModelId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const { providers, providerModels, fetchProviders, modelsLoading } = useProviderStore()
  const addTask = useTaskStore((s) => s.addTask)

  useEffect(() => {
    if (open && providers.length === 0) fetchProviders()
  }, [open, providers.length, fetchProviders])

  // Reset form when opened
  useEffect(() => {
    if (open) {
      setContentType('')
      setPurpose('')
      setTopic('')
      setVisionProviderId('')
      setTextProviderId('')
      setVisionModelId('')
      setTextModelId('')
    }
  }, [open])

  const enabledProviders = providers.filter((p) => p.enabled && p.has_api_key)
  const visionProviders = useMemo(
    () => enabledProviders.filter((p) => (p.capabilities ?? []).includes('vision')),
    [enabledProviders],
  )
  const textProviders = useMemo(
    () => enabledProviders.filter((p) => (p.capabilities ?? []).includes('chat')),
    [enabledProviders],
  )

  const visionModels = visionProviderId ? (providerModels[visionProviderId] ?? []) : []
  const textModels = textProviderId ? (providerModels[textProviderId] ?? []) : []

  const handleConfirm = async () => {
    setSubmitting(true)
    try {
      const payload: Record<string, unknown> = { url }
      if (visionModelId) payload.vision_model = visionModelId
      if (textModelId) payload.text_model = textModelId
      if (contentType) payload.content_type = contentType
      if (purpose) payload.purpose = purpose
      if (topic) payload.topic = topic

      const res = await createPipelineTask({
        project_id: crypto.randomUUID(),
        task_type: 'analyze',
        payload,
      })

      addTask({
        task_id: res.task_id,
        project_id: '',
        task_type: 'analyze',
        payload,
        status: 'PENDING',
        progress: 0,
        log: [],
        result: {},
        error: '',
        retry_of: '',
        cancel_requested: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      toast.success('任务已创建', { description: url })
      onCreated()
    } catch {
      toast.error('创建任务失败')
    } finally {
      setSubmitting(false)
    }
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

          {/* Section 2: Model selection */}
          <section className="pf-section">
            <h4 className="pf-section-title">模型选择</h4>
            {enabledProviders.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--ink-4)', padding: '8px 0' }}>
                还没有可用的 provider，请先去设置页面添加
              </div>
            ) : (
              <>
                <div className="pf-field">
                  <label>视觉大模型</label>
                  <div className="pf-model-row">
                    <select
                      value={visionProviderId}
                      onChange={(e) => { setVisionProviderId(e.target.value); setVisionModelId('') }}
                    >
                      <option value="">选择 provider</option>
                      {visionProviders.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <select
                      value={visionModelId}
                      onChange={(e) => setVisionModelId(e.target.value)}
                      disabled={!visionProviderId}
                    >
                      <option value="">选择模型</option>
                      {modelsLoading[visionProviderId] ? (
                        <option value="" disabled>加载中…</option>
                      ) : (
                        visionModels.map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))
                      )}
                    </select>
                  </div>
                </div>
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
        </div>
      </div>
    </>
  )
}
