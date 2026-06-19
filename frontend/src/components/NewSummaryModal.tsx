/**
 * NewSummaryModal — 新建总结弹窗。
 *
 * 模板选择 + 模型选择（复用 providerStore 双下拉）+ 联网搜索开关
 * + 可选「补充背景」textarea + 「生成」按钮。
 * 模型选择记忆上次（configStore）。
 */

import { useEffect, useRef, useState } from 'react'

import { useProviderStore, type Model } from '@/store/providerStore'
import { useConfigStore } from '@/store/configStore'

import './new-summary-modal.css'

/* ── 模板选项 ────────────────────────────────────────────── */

const QUICK_CARDS: { value: string; label: string; desc: string }[] = [
  { value: 'standard', label: '标准总结', desc: '按内容结构生成学习笔记' },
  { value: 'tool_recommendation', label: '工具推荐', desc: '提炼工具用途、亮点与取舍' },
  { value: 'concise', label: '精简摘要', desc: '几句话概括核心内容' },
  { value: 'steps', label: '步骤教程', desc: '有序步骤清单，可照着做' },
  { value: 'meeting', label: '会议纪要', desc: '议题 / 决议 / 待办 / 参会人' },
  { value: 'xhs', label: '小红书风格', desc: '标题党 + emoji + 话题标签' },
  { value: 'quotes', label: '金句提取', desc: '5-10 条金句，适合转发' },
]

const MORE_GROUPS: { label: string; items: { value: string; label: string }[] }[] = [
  { label: '学习笔记', items: [
    { value: 'lecture', label: '教学笔记' },
    { value: 'detailed', label: '详细要点' },
    { value: 'outline', label: '大纲' },
    { value: 'qa', label: '问答卡(Anki)' },
    { value: 'science_popularization', label: '知识科普' },
  ]},
  { label: '创作改写', items: [
    { value: 'longform', label: '公众号长文' },
    { value: 'oral', label: '口播稿' },
  ]},
  { label: '对话记录', items: [
    { value: 'interview', label: '访谈整理' },
    { value: 'shownotes', label: '播客 shownotes' },
  ]},
  { label: '行动规划', items: [
    { value: 'actions', label: '行动清单' },
  ]},
]

const QUICK_VALUES = new Set(QUICK_CARDS.map((c) => c.value))

/* ── 接口 ───────────────────────────────────────────────── */

interface NewSummaryModalProps {
  creating: boolean
  defaultTemplate?: string
  onSubmit: (opts: {
    template: string
    background: string
    providerId: string
    model: string
    searchWeb: boolean
  }) => void
  onClose: () => void
}

export function NewSummaryModal({
  creating,
  defaultTemplate,
  onSubmit,
  onClose,
}: NewSummaryModalProps) {
  const [template, setTemplate] = useState(defaultTemplate || 'standard')
  const [background, setBackground] = useState('')
  const [searchWeb, setSearchWeb] = useState(false)
  const userPickedRef = useRef(false)

  // defaultTemplate 异步到达时自动选中，但不覆盖用户已手动选择的模板
  useEffect(() => {
    if (defaultTemplate && !userPickedRef.current) setTemplate(defaultTemplate)
  }, [defaultTemplate])

  const chooseTemplate = (value: string) => {
    userPickedRef.current = true
    setTemplate(value)
  }

  // ── 模型选择：复用 providerStore + configStore 记忆 ──
  const providers = useProviderStore((s) => s.providers)
  const providerModels = useProviderStore((s) => s.providerModels)
  const modelsLoading = useProviderStore((s) => s.modelsLoading)
  const fetchProviders = useProviderStore((s) => s.fetchProviders)

  const savedProviderId = useConfigStore((s) => s.summaryProviderId)
  const savedModelId = useConfigStore((s) => s.summaryModelId)
  const setConfig = useConfigStore((s) => s.setConfig)

  const [providerId, setProviderId] = useState(savedProviderId)
  const [modelId, setModelId] = useState(savedModelId)

  // 拉取 provider 列表（如果还没有）
  useEffect(() => {
    if (providers.length === 0) fetchProviders()
  }, [providers.length, fetchProviders])

  // 可用 provider（有 chat 能力的）
  const chatProviders = providers.filter(
    (p) => p.enabled && (p.capabilities ?? []).includes('chat'),
  )

  // 当前 provider 的模型列表
  const models: Model[] = providerId ? providerModels[providerId] ?? [] : []
  // 只保留能做文字总结的模型：capabilities 含 'chat'；无标签的旧数据放行
  const textModels = models.filter((m) => !m.capabilities || m.capabilities.includes('chat'))
  const isLoading = providerId ? !!modelsLoading[providerId] : false

  // 切换 provider 时清空 model
  const handleProviderChange = (id: string) => {
    setProviderId(id)
    setModelId('')
  }

  const handleGenerate = () => {
    // 记忆本次选择
    setConfig({ summaryProviderId: providerId, summaryModelId: modelId })
    onSubmit({
      template,
      background,
      providerId,
      model: modelId,
      searchWeb,
    })
  }

  return (
    <div className="nsm-overlay" onClick={onClose}>
      <div className="nsm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="nsm-header">
          <span className="nsm-title">新建总结</span>
          <button className="nsm-close" onClick={onClose}>✕</button>
        </div>

        <div className="nsm-body">
          {/* 常用模板卡片 */}
          <div className="nsm-section">
            <div className="nsm-section-label">常用模板</div>
            <div className="nsm-grid">
              {QUICK_CARDS.map((c) => (
                <button
                  key={c.value}
                  className={`nsm-card ${template === c.value ? 'active' : ''}`}
                  onClick={() => chooseTemplate(c.value)}
                >
                  <span className="nsm-card-label">{c.label}</span>
                  <span className="nsm-card-desc">{c.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 更多模板下拉 */}
          <div className="nsm-section">
            <div className="nsm-row">
              <span className="nsm-section-label" style={{ margin: 0 }}>更多模板：</span>
              <select
                value={QUICK_VALUES.has(template) ? '' : template}
                onChange={(e) => e.target.value && chooseTemplate(e.target.value)}
                className="nsm-select"
              >
                <option value="" disabled>选择其他模板</option>
                {MORE_GROUPS.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.items.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>

          {/* 模型选择（与 PreflightConfigPanel 对齐的双下拉） */}
          <div className="nsm-section">
            <div className="nsm-section-label">模型</div>
            <div className="nsm-model-row">
              <select
                value={providerId}
                onChange={(e) => handleProviderChange(e.target.value)}
                className="nsm-select"
              >
                <option value="">默认供应商</option>
                {chatProviders.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <select
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                disabled={!providerId || isLoading}
                className="nsm-select"
              >
                <option value="">
                  {isLoading ? '加载中…' : textModels.length === 0 && providerId ? '无可用模型' : '默认模型'}
                </option>
                {textModels.map((m) => (
                  <option key={m.id} value={m.id}>{m.name || m.id}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 联网搜索开关 */}
          <div className="nsm-section">
            <label className="nsm-toggle-row">
              <input
                type="checkbox"
                checked={searchWeb}
                onChange={(e) => setSearchWeb(e.target.checked)}
              />
              <span className="nsm-toggle-label">联网搜索补充上下文</span>
              <span className="nsm-toggle-hint">（需在设置中配置 Tavily API Key）</span>
            </label>
          </div>

          {/* 补充背景 */}
          <div className="nsm-section">
            <textarea
              value={background}
              onChange={(e) => setBackground(e.target.value)}
              placeholder="补充背景信息，帮助 LLM 更好理解…（可选）"
              className="nsm-textarea"
              rows={3}
            />
          </div>
        </div>

        <div className="nsm-footer">
          <button className="nsm-btn-cancel" onClick={onClose}>取消</button>
          <button
            className="nsm-btn-confirm"
            disabled={creating}
            onClick={handleGenerate}
          >
            {creating ? '生成中…' : '生成'}
          </button>
        </div>
      </div>
    </div>
  )
}
