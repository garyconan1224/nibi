import { Pencil, Plus } from 'lucide-react'
import type { WorkspaceBackground } from '@/types/workspace'

interface TaskboardHeadProps {
  name: string
  background: WorkspaceBackground
  onEditBackground?: () => void
  onAddMaterial?: () => void
}

/**
 * Taskboard 顶部：工作空间名 + 5 维度上下文 + 操作按钮。
 * 设计稿来源：taskboard.jsx 第 55-74 行。
 */
export function TaskboardHead({
  name,
  background,
  onEditBackground,
  onAddMaterial,
}: TaskboardHeadProps) {
  const ctxRows: [string, string][] = [
    ['内容类型', background.content_type || '—'],
    ['人物', background.participants?.join('、') || '—'],
    ['背景', background.topic || '—'],
    ['专有词', background.glossary?.join('、') || '—'],
    ['目的', background.purpose || '—'],
  ]

  return (
    <div className="tb-head">
      <div className="tb-head-l">
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
          TASK · 工作空间 · 本地
        </div>
        <h1
          className="display"
          style={{ fontSize: 56, margin: '8px 0 16px', lineHeight: 0.95 }}
        >
          {name}
        </h1>
        <div className="tb-ctx">
          {ctxRows.flatMap(([k, v]) => [
            <span key={`${k}-k`} className="ctx-k">{k}</span>,
            <span key={`${k}-v`} className="ctx-v">{v}</span>,
          ])}
        </div>
      </div>
      <div className="tb-head-r">
        <button className="btn" onClick={onEditBackground}>
          <Pencil size={14} />
          编辑背景
        </button>
        <button className="btn btn-primary" onClick={onAddMaterial}>
          <Plus size={14} />
          添加素材
        </button>
      </div>
    </div>
  )
}
