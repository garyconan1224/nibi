/**
 * NewSummaryModal — 新建总结弹窗。
 *
 * 内含：模板选择（grid + 下拉）+ 模型选择 + 联网搜索开关
 *      + 可选「补充背景」textarea + 「生成」按钮。
 */

import { useEffect, useState } from 'react'

import { listProviders, type ProviderInfo } from '@/services/providers'

import './new-summary-modal.css'

/* ── 模板选项 ────────────────────────────────────────────── */

const TEMPLATE_OPTIONS: { value: string; label: string }[] = [
  { value: 'concise', label: '简洁摘要' },
  { value: 'detailed', label: '详细要点' },
  { value: 'quotes', label: '金句提取' },
  { value: 'meeting', label: '会议纪要' },
  { value: 'xhs', label: '小红书风格' },
  { value: 'longform', label: '公众号长文' },
  { value: 'lecture', label: '教学笔记' },
  { value: 'interview', label: '访谈整理' },
  { value: 'shownotes', label: '播客 shownotes' },
  { value: 'oral', label: '口播稿' },
  { value: 'steps', label: '步骤教程' },
  { value: 'outline', label: '大纲' },
  { value: 'qa', label: '问答卡(Anki)' },
  { value: 'actions', label: '行动清单' },
]

const QUICK_CARDS: { value: string; label: string; desc: string }[] = [
  { value: 'concise', label: '精简摘要', desc: '几句话概括核心内容' },
  { value: 'lecture', label: '教学笔记', desc: '知识点 + 例子 + 重点' },
  { value: 'oral', label: '口播稿', desc: '可直接念的口语化文案' },
  { value: 'steps', label: '步骤教程', desc: '有序步骤清单，可照着做' },
]

const QUICK_VALUES = new Set(QUICK_CARDS.map((c) => c.value))

/* ── 接口 ───────────────────────────────────────────────── */

interface NewSummaryModalProps {
  creating: boolean
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
  onSubmit,
  onClose,
}: NewSummaryModalProps) {
  const [template, setTemplate] = useState('concise')
  const [background, setBackground] = useState('')
  const [searchWeb, setSearchWeb] = useState(false)

  // 模型选择
  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const [selectedProvider, setSelectedProvider] = useState('')
  const [customModel, setCustomModel] = useState('')

  useEffect(() => {
    listProviders().then(setProviders).catch(() => {})
  }, [])

  const handleGenerate = () => {
    onSubmit({
      template,
      background,
      providerId: selectedProvider,
      model: customModel,
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
                  onClick={() => setTemplate(c.value)}
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
                onChange={(e) => e.target.value && setTemplate(e.target.value)}
                className="nsm-select"
              >
                <option value="" disabled>选择其他模板</option>
                {TEMPLATE_OPTIONS.filter((o) => !QUICK_VALUES.has(o.value)).map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 模型选择 + 联网开关 */}
          <div className="nsm-section">
            <div className="nsm-section-label">模型与搜索</div>
            <div className="nsm-row" style={{ marginBottom: 8 }}>
              <span className="nsm-field-label">模型：</span>
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                className="nsm-select"
              >
                <option value="">默认模型</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="nsm-row" style={{ marginBottom: 8 }}>
              <span className="nsm-field-label">自定义模型名：</span>
              <input
                type="text"
                className="nsm-input"
                value={customModel}
                onChange={(e) => setCustomModel(e.target.value)}
                placeholder="留空用默认（如 gpt-4o）"
              />
            </div>
            <label className="nsm-toggle-row">
              <input
                type="checkbox"
                checked={searchWeb}
                onChange={(e) => setSearchWeb(e.target.checked)}
              />
              <span className="nsm-toggle-label">联网搜索补充上下文</span>
              <span className="nsm-toggle-hint">（需配置 TAVILY_API_KEY）</span>
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
