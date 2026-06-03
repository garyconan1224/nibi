/**
 * SummariesTab — 结果页「总结」标签页。
 *
 * 左侧：按 template 分组的总结列表（可展开版本）。
 * 右侧：主显示区（react-markdown 渲染）。
 * 底部/弹窗：新建总结面板。
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { toast } from 'sonner'

const MAX_COMPARE = 3

import {
  createSummary,
  deleteSummary,
  listSummaries,
  type ItemSummary,
} from '@/services/summaries'

import './summaries-tab.css'

// remarkGfm 类型与 react-markdown 不完全兼容，统一 cast 一次
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const remarkPlugins: any[] = [remarkGfm]

/* ── 模板选项（与 backend summary_templates.py 对齐） ────────── */

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

/** 4 个常用模板（segmented control 展示） */
const QUICK_TEMPLATES = [
  { value: 'concise', label: '精简' },
  { value: 'lecture', label: '教学' },
  { value: 'oral', label: '口播' },
  { value: 'steps', label: '教程' },
]

/** 4 个常用模板卡片（空态引导 2×2 grid） */
const QUICK_TEMPLATE_CARDS: { value: string; label: string; desc: string }[] = [
  { value: 'concise', label: '精简摘要', desc: '几句话概括核心内容' },
  { value: 'lecture', label: '教学笔记', desc: '知识点 + 例子 + 重点' },
  { value: 'oral', label: '口播稿', desc: '可直接念的口语化文案' },
  { value: 'steps', label: '步骤教程', desc: '有序步骤清单，可照着做' },
]

const TEMPLATE_LABEL_MAP = Object.fromEntries(
  TEMPLATE_OPTIONS.map((o) => [o.value, o.label]),
)

function templateLabel(id: string): string {
  return TEMPLATE_LABEL_MAP[id] ?? id
}

/* ── 分组结构 ────────────────────────────────────────────────── */

interface TemplateGroup {
  template: string
  label: string
  versions: ItemSummary[]
}

function groupByTemplate(items: ItemSummary[]): TemplateGroup[] {
  const map = new Map<string, ItemSummary[]>()
  for (const s of items) {
    const arr = map.get(s.template) ?? []
    arr.push(s)
    map.set(s.template, arr)
  }
  return Array.from(map.entries()).map(([tpl, versions]) => ({
    template: tpl,
    label: templateLabel(tpl),
    versions: versions.sort((a, b) => a.version - b.version),
  }))
}

/* ── Props ───────────────────────────────────────────────────── */

interface SummariesTabProps {
  workspaceId: string
  itemId: string
}

/* ── localStorage 缓存 ────────────────────────────────────────── */

const CACHE_PREFIX = 'nibi_summary_cache_'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 小时

function getCacheKey(workspaceId: string, itemId: string, template: string): string {
  return `${CACHE_PREFIX}${workspaceId}_${itemId}_${template}`
}

interface CachedSummary {
  summary_id: string
  content_md: string
  template: string
  version: number
  cached_at: number
}

function getCachedSummary(workspaceId: string, itemId: string, template: string): CachedSummary | null {
  try {
    const key = getCacheKey(workspaceId, itemId, template)
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const cached = JSON.parse(raw) as CachedSummary
    if (Date.now() - cached.cached_at > CACHE_TTL_MS) {
      localStorage.removeItem(key)
      return null
    }
    return cached
  } catch {
    return null
  }
}

function setCachedSummary(workspaceId: string, itemId: string, summary: ItemSummary): void {
  try {
    const key = getCacheKey(workspaceId, itemId, summary.template)
    const cached: CachedSummary = {
      summary_id: summary.summary_id,
      content_md: summary.content_md,
      template: summary.template,
      version: summary.version,
      cached_at: Date.now(),
    }
    localStorage.setItem(key, JSON.stringify(cached))
  } catch {
    // localStorage 满或不可用时静默失败
  }
}

/* ── 主组件 ──────────────────────────────────────────────────── */

export function SummariesTab({ workspaceId, itemId }: SummariesTabProps) {
  const navigate = useNavigate()
  const [summaries, setSummaries] = useState<ItemSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<ItemSummary | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [creating, setCreating] = useState(false)

  // 对比模式
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isCompareMode, setIsCompareMode] = useState(false)

  // 新建表单状态
  const [newTemplate, setNewTemplate] = useState('concise')
  const [newBackground, setNewBackground] = useState('')

  /* ── 加载列表 ────────────────────────────────────────────── */

  const refresh = useCallback(async () => {
    try {
      const data = await listSummaries(workspaceId, itemId)
      setSummaries(data)
      // 自动选中第一项
      if (!selected && data.length > 0) {
        setSelected(data[0])
      }
    } catch {
      toast.error('加载总结列表失败')
    } finally {
      setLoading(false)
    }
  }, [workspaceId, itemId, selected])

  useEffect(() => {
    refresh()
  }, [refresh])

  /* ── 创建 ────────────────────────────────────────────────── */

  const handleCreate = useCallback(async () => {
    // 检查 localStorage 缓存
    const cached = getCachedSummary(workspaceId, itemId, newTemplate)
    if (cached && !newBackground) {
      // 从缓存中找到对应的 summary
      const cachedSummary = summaries.find(s => s.summary_id === cached.summary_id)
      if (cachedSummary) {
        toast.success(`使用缓存的 ${templateLabel(newTemplate)}`)
        setShowNew(false)
        setSelected(cachedSummary)
        return
      }
    }

    setCreating(true)
    try {
      const s = await createSummary(
        workspaceId,
        itemId,
        newTemplate,
        newBackground,
      )
      // 写入缓存
      setCachedSummary(workspaceId, itemId, s)
      toast.success(`${templateLabel(s.template)} v${s.version} 生成完成`)
      setShowNew(false)
      setNewBackground('')
      await refresh()
      setSelected(s)
    } catch (err: unknown) {
      // 检查 axios 500 错误中的 "chat model" 关键词
      const axiosData = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      if (axiosData && axiosData.includes('chat model')) {
        toast.error('请先在设置中配置 LLM 模型', {
          action: { label: '去设置', onClick: () => navigate('/settings/models') },
        })
      } else {
        const msg = err instanceof Error ? err.message : '生成失败'
        toast.error(msg)
      }
    } finally {
      setCreating(false)
    }
  }, [workspaceId, itemId, newTemplate, newBackground, refresh, summaries])

  /* ── 删除 ────────────────────────────────────────────────── */

  const handleDelete = useCallback(
    async (summaryId: string) => {
      try {
        await deleteSummary(workspaceId, itemId, summaryId)
        toast.success('已删除')
        if (selected?.summary_id === summaryId) {
          setSelected(null)
        }
        await refresh()
      } catch {
        toast.error('删除失败')
      }
    },
    [workspaceId, itemId, selected, refresh],
  )

  /* ── 复制 markdown ───────────────────────────────────────── */

  const handleCopy = useCallback(() => {
    if (selected) {
      navigator.clipboard.writeText(selected.content_md)
      toast.success('已复制 markdown')
    }
  }, [selected])

  const handleRegenerate = useCallback(() => {
    if (!selected) return
    setNewTemplate(selected.template)
    setNewBackground(selected.background_for_summary || '')
    setShowNew(true)
  }, [selected])

  /* ── 对比模式 ────────────────────────────────────────────── */

  const toggleSelect = useCallback((summaryId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(summaryId)) {
        next.delete(summaryId)
      } else if (next.size < MAX_COMPARE) {
        next.add(summaryId)
      } else {
        toast.warning(`最多对比 ${MAX_COMPARE} 份`)
      }
      return next
    })
  }, [])

  const enterCompare = useCallback(() => {
    setIsCompareMode(true)
  }, [])

  const exitCompare = useCallback(() => {
    setIsCompareMode(false)
    setSelectedIds(new Set())
  }, [])

  /* ── 分组 ────────────────────────────────────────────────── */

  const groups = useMemo(() => groupByTemplate(summaries), [summaries])

  const compareItems = useMemo(
    () => summaries.filter((s) => selectedIds.has(s.summary_id)),
    [summaries, selectedIds],
  )

  /* ── 渲染 ────────────────────────────────────────────────── */

  if (loading) {
    return <div style={{ padding: 24, color: 'var(--ink-3)' }}>加载中…</div>
  }

  // ── 空态：居中引导卡片 ────────────────────────────────────
  if (summaries.length === 0 && !showNew) {
    return (
      <div className="sm-empty-guide">
        <h2 className="sm-empty-title">生成一份内容总结</h2>
        <p className="sm-empty-subtitle">选一个模板，AI 帮你把转录文本整理成可读笔记</p>
        <div className="sm-template-grid">
          {QUICK_TEMPLATE_CARDS.map((t) => (
            <button
              key={t.value}
              className="sm-template-card"
              onClick={() => {
                setNewTemplate(t.value)
                setShowNew(true)
              }}
            >
              <span className="sm-template-card-label">{t.label}</span>
              <span className="sm-template-card-desc">{t.desc}</span>
            </button>
          ))}
        </div>
        <button
          className="sm-link-more"
          onClick={() => {
            setNewTemplate('concise')
            setShowNew(true)
          }}
        >
          + 更多模板
        </button>
      </div>
    )
  }

  // ── 空态 + 新建面板展开 ──────────────────────────────────
  if (summaries.length === 0 && showNew) {
    return (
      <div className="sm-empty-guide">
        <h2 className="sm-empty-title">生成一份内容总结</h2>
        <p className="sm-empty-subtitle">选一个模板，AI 帮你把转录文本整理成可读笔记</p>
        <div className="sm-template-grid">
          {QUICK_TEMPLATE_CARDS.map((t) => (
            <button
              key={t.value}
              className={`sm-template-card ${newTemplate === t.value ? 'active' : ''}`}
              onClick={() => setNewTemplate(t.value)}
            >
              <span className="sm-template-card-label">{t.label}</span>
              <span className="sm-template-card-desc">{t.desc}</span>
            </button>
          ))}
        </div>
        <div className="sm-empty-more-select">
          <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>更多模板：</span>
          <select
            value={QUICK_TEMPLATE_CARDS.some(t => t.value === newTemplate) ? '' : newTemplate}
            onChange={(e) => e.target.value && setNewTemplate(e.target.value)}
            className="sm-select"
          >
            <option value="" disabled>选择其他模板</option>
            {TEMPLATE_OPTIONS.filter(o => !QUICK_TEMPLATE_CARDS.some(t => t.value === o.value)).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <textarea
          value={newBackground}
          onChange={(e) => setNewBackground(e.target.value)}
          placeholder="补充背景信息，帮助 LLM 更好理解…（可选）"
          className="sm-textarea sm-empty-textarea"
          rows={3}
        />
        <div className="sm-empty-actions">
          <button className="sm-btn-back" onClick={() => setShowNew(false)}>返回</button>
          <button className="sm-btn-generate" onClick={handleCreate} disabled={creating}>
            {creating ? '生成中…' : '生成'}
          </button>
        </div>
      </div>
    )
  }

  // ── 有总结：sidebar + main ────────────────────────────────
  return (
    <div className="sm-summaries-root">
      {/* 左侧列表 */}
      <aside className="sm-sidebar">
        <div className="sm-sidebar-header">
          <span style={{ fontWeight: 600, fontSize: 13 }}>总结列表</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {selectedIds.size >= 2 && !isCompareMode && (
              <button className="sm-btn-compare" onClick={enterCompare}>
                ⇄ 对比 ({selectedIds.size})
              </button>
            )}
            {isCompareMode && (
              <button className="sm-btn-compare" onClick={exitCompare}>
                ✕ 退出对比
              </button>
            )}
            <button
              className="sm-btn-new"
              onClick={() => setShowNew(!showNew)}
              title="新建总结"
            >
              + 新建
            </button>
          </div>
        </div>

        {/* 新建面板（有总结时的简化版） */}
        {showNew && (
          <div className="sm-new-panel">
            <div className="sm-segmented">
              {QUICK_TEMPLATES.map((t) => (
                <button
                  key={t.value}
                  className={`sm-segment ${newTemplate === t.value ? 'active' : ''}`}
                  onClick={() => setNewTemplate(t.value)}
                  type="button"
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>更多：</span>
              <select
                value={QUICK_TEMPLATES.some(t => t.value === newTemplate) ? '' : newTemplate}
                onChange={(e) => e.target.value && setNewTemplate(e.target.value)}
                className="sm-select"
                style={{ flex: 1 }}
              >
                <option value="" disabled>选择其他模板</option>
                {TEMPLATE_OPTIONS.filter(o => !QUICK_TEMPLATES.some(t => t.value === o.value)).map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <textarea
              value={newBackground}
              onChange={(e) => setNewBackground(e.target.value)}
              placeholder="补充背景信息…（可选）"
              className="sm-textarea"
              rows={2}
            />
            <button className="sm-btn-generate" onClick={handleCreate} disabled={creating}>
              {creating ? '生成中…' : '生成'}
            </button>
          </div>
        )}

        {/* 分组列表 */}
        {groups.map((g) => (
          <div key={g.template} className="sm-group">
            <div className="sm-group-label">{g.label}</div>
            {g.versions.map((s) => (
              <div
                key={s.summary_id}
                className={`sm-version-item ${selected?.summary_id === s.summary_id ? 'active' : ''}`}
                onClick={() => setSelected(s)}
              >
                <input
                  type="checkbox"
                  className="sm-checkbox"
                  checked={selectedIds.has(s.summary_id)}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => toggleSelect(s.summary_id)}
                  title={
                    !selectedIds.has(s.summary_id) && selectedIds.size >= MAX_COMPARE
                      ? `最多对比 ${MAX_COMPARE} 份`
                      : undefined
                  }
                />
                <div className="sm-version-info">
                  <span className="sm-version-label">v{s.version}</span>
                  <span className="sm-version-preview">
                    {s.content_md.replace(/[#*_>\-\n]/g, ' ').trim().slice(0, 30)}
                    {s.content_md.length > 30 ? '…' : ''}
                  </span>
                </div>
                <button
                  className="sm-btn-delete"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDelete(s.summary_id)
                  }}
                  title="删除"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ))}
      </aside>

      {/* 右侧主显示 */}
      <main className={`sm-main ${isCompareMode ? 'sm-compare' : ''}`}>
        {isCompareMode ? (
          <div className="sm-compare-columns">
            {compareItems.map((s) => (
              <div key={s.summary_id} className="sm-compare-col">
                <div className="sm-compare-col-head">
                  <span className="sm-main-title">
                    {templateLabel(s.template)} v{s.version}
                  </span>
                  <span className="sm-main-meta">
                    {new Date(s.created_at).toLocaleString()}
                    {s.model_used && ` · ${s.model_used}`}
                  </span>
                  <button
                    className="sm-btn-delete"
                    onClick={() => handleDelete(s.summary_id)}
                    title="删除"
                  >
                    ×
                  </button>
                </div>
                <div className="sm-compare-col-body">
                  <ReactMarkdown remarkPlugins={remarkPlugins}>
                    {s.content_md}
                  </ReactMarkdown>
                </div>
                <div className="sm-compare-col-actions">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(s.content_md)
                      toast.success('已复制')
                    }}
                  >
                    复制 markdown
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : selected ? (
          <>
            <div className="sm-main-header">
              <span className="sm-main-title">
                {templateLabel(selected.template)} v{selected.version}
              </span>
              <span className="sm-main-meta">
                {new Date(selected.created_at).toLocaleString()}
                {selected.model_used && ` · ${selected.model_used}`}
              </span>
            </div>
            <div className="sm-main-content">
              <ReactMarkdown remarkPlugins={remarkPlugins}>
                {selected.content_md}
              </ReactMarkdown>
            </div>
            <div className="sm-main-actions">
              <button onClick={handleCopy}>复制</button>
              <button onClick={handleRegenerate}>重新生成</button>
              <button onClick={() => handleDelete(selected.summary_id)}>删除</button>
            </div>
          </>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'var(--ink-3)',
            }}
          >
            选择一份总结查看
          </div>
        )}
      </main>
    </div>
  )
}
