import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { SYSTEM_TAG_DIMENSIONS } from '@/constants/tagDimensions'
import type { WorkspaceItem, SystemTagDimension } from '@/types/workspace'

type FilterMode = 'all' | 'auto' | 'manual'

interface TagEntry {
  tag: string
  count: number
  auto: boolean
}

interface TagsTabProps {
  items: WorkspaceItem[]
}

/**
 * Tags tab — 标签库，从 workspace items 的 tags 中聚合标签，按维度分组展示。
 * 设计稿来源：taskboard.jsx TBTags。
 */
export function TagsTab({ items }: TagsTabProps) {
  const [filter, setFilter] = useState<FilterMode>('all')

  /** 按维度聚合标签 */
  const tagLib = useMemo(() => {
    const result: Record<string, TagEntry[]> = {}
    for (const dim of SYSTEM_TAG_DIMENSIONS) {
      const counts = new Map<string, { count: number; auto: boolean }>()
      for (const item of items) {
        const val = item.tags?.[dim.key as SystemTagDimension]
        if (!val) continue
        const existing = counts.get(val)
        if (existing) {
          existing.count++
        } else {
          counts.set(val, { count: 1, auto: true })
        }
      }
      // 也收集 custom_tags
      for (const item of items) {
        for (const ct of item.tags?.custom_tags ?? []) {
          const existing = counts.get(ct)
          if (existing) {
            existing.count++
          } else {
            counts.set(ct, { count: 1, auto: false })
          }
        }
      }
      result[dim.label] = Array.from(counts.entries()).map(([tag, v]) => ({
        tag,
        count: v.count,
        auto: v.auto,
      }))
    }
    return result
  }, [items])

  const allEntries = Object.entries(tagLib)
  const totalTags = allEntries.reduce((a, [, tags]) => a + tags.length, 0)

  return (
    <>
      <div className="tb-head-mini">
        <div>
          <div
            className="eyebrow"
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 11,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--ink-3)',
            }}
          >
            提示词维度 · {SYSTEM_TAG_DIMENSIONS.length}类 · 共 {totalTags} 个标签
          </div>
          <h2 className="display" style={{ fontSize: 28, margin: '4px 0 0' }}>
            标签库 · Tag Library
          </h2>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="tw-segm">
            {(['all', 'auto', 'manual'] as const).map((mode) => (
              <button
                key={mode}
                data-active={filter === mode}
                onClick={() => setFilter(mode)}
              >
                {mode === 'all' ? '全部' : mode === 'auto' ? '自动' : '手动'}
              </button>
            ))}
          </div>
          <button className="btn">
            <Plus size={13} /> 新标签
          </button>
        </div>
      </div>

      <div className="tb-tag-grid">
        {allEntries.map(([dim, tags]) => {
          const filtered = tags.filter(
            (t) =>
              filter === 'all' || (filter === 'auto' ? t.auto : !t.auto),
          )
          if (filtered.length === 0) return null
          return (
            <div key={dim} className="tag-col">
              <div className="tag-col-h">
                <span>{dim}</span>
                <span className="mono" style={{ fontSize: 10, color: 'var(--ink-3)' }}>
                  {filtered.length}
                </span>
              </div>
              <div className="tag-col-b">
                {filtered.map((t) => (
                  <div key={t.tag} className="tag-row" data-auto={t.auto}>
                    <div className="tag-l">
                      <span className="tag-name">{t.tag}</span>
                      <span className={`tag-badge ${t.auto ? 'auto' : 'manual'}`}>
                        {t.auto ? '自动' : '手动'}
                      </span>
                    </div>
                    <div className="tag-r">
                      <span className="tag-bar">
                        <span style={{ width: `${Math.min(100, t.count * 8)}%` }} />
                      </span>
                      <span
                        className="mono"
                        style={{
                          fontSize: 11,
                          color: 'var(--ink-3)',
                          minWidth: 22,
                          textAlign: 'right',
                        }}
                      >
                        {t.count}
                      </span>
                      <span className="mono" style={{ fontSize: 10, color: 'var(--ink-4)' }}>
                        {t.count}素材
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
