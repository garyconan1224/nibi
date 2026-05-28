/**
 * SummariesTab — 结果页「总结」标签页。
 *
 * 左侧：按 template 分组的总结列表（可展开版本）。
 * 右侧：主显示区（react-markdown 渲染）。
 * 底部/弹窗：新建总结面板。
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
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

/* ── 主组件 ──────────────────────────────────────────────────── */

export function SummariesTab({ workspaceId, itemId }: SummariesTabProps) {
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
    setCreating(true)
    try {
      const s = await createSummary(
        workspaceId,
        itemId,
        newTemplate,
        newBackground,
      )
      toast.success(`${templateLabel(s.template)} v${s.version} 生成完成`)
      setShowNew(false)
      setNewBackground('')
      await refresh()
      setSelected(s)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '生成失败'
      toast.error(msg)
    } finally {
      setCreating(false)
    }
  }, [workspaceId, itemId, newTemplate, newBackground, refresh])

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

  return (
    <div className="sm-summaries-root">
      {/* 左侧列表 */}
      <aside className="sm-sidebar">
        <div className="sm-sidebar-header">
          <span style={{ fontWeight: 600, fontSize: 13 }}>总结列表</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {selectedIds.size >= 2 && !isCompareMode && (
              <button className="sm-btn-compare" onClick={enterCompare}>
                ⇄ 进入对比 ({selectedIds.size})
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

        {/* 新建面板 */}
        {showNew && (
          <div className="sm-new-panel">
            <label style={{ fontSize: 12, marginBottom: 4 }}>模板</label>
            <select
              value={newTemplate}
              onChange={(e) => setNewTemplate(e.target.value)}
              className="sm-select"
            >
              {TEMPLATE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <label style={{ fontSize: 12, marginTop: 8, marginBottom: 4 }}>
              总结用背景（可选）
            </label>
            <textarea
              value={newBackground}
              onChange={(e) => setNewBackground(e.target.value)}
              placeholder="补充背景信息，帮助 LLM 更好理解…"
              className="sm-textarea"
              rows={3}
            />
            <button
              className="sm-btn-generate"
              onClick={handleCreate}
              disabled={creating}
            >
              {creating ? '生成中…' : '生成'}
            </button>
          </div>
        )}

        {/* 分组列表 */}
        {groups.length === 0 && (
          <div style={{ padding: 16, color: 'var(--ink-3)', fontSize: 13 }}>
            暂无总结，点击「+ 新建」生成
          </div>
        )}
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
                <span>v{s.version}</span>
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
          /* 对比模式：多栏并排 */
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
          /* 单栏模式 */
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
              <button onClick={handleCopy}>复制 markdown</button>
              <button onClick={() => handleDelete(selected.summary_id)}>
                删除
              </button>
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
            选择一份总结查看，或点击「+ 新建」生成
          </div>
        )}
      </main>
    </div>
  )
}
