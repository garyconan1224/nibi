import { useState, useRef, useEffect } from 'react'
import {
  ArrowLeft,
  Pencil,
  Plus,
  Download,
  ArrowLeftRight,
  Sparkles,
  Share2,
  MoreHorizontal,
  List,
  Star,
  Clock,
  Tag,
  MessageCircle,
  BookOpen,
  Layers,
  FileText,
  Globe,
} from 'lucide-react'
import type { WorkspaceBackground } from '@/types/workspace'

/** 「更多」下拉菜单项 */
export interface MoreMenuItem {
  id: string
  label: string
  icon: React.ElementType
  disabled?: boolean
  disabledHint?: string
}

interface TaskboardHeadProps {
  name: string
  materialCount: number
  background: WorkspaceBackground
  description?: string
  updatedAt?: string
  onBack?: () => void
  onEditBackground?: () => void
  onAddMaterial?: () => void
  onExport?: () => void
  onCompare?: () => void
  onMerge?: () => void
  onShareMarkdown?: () => void
  onShareHtml?: () => void
  onMenuAction?: (id: string) => void
}

/** 「更多」菜单默认项 */
const MORE_ITEMS: MoreMenuItem[] = [
  { id: 'queue', label: '队列', icon: List },
  { id: 'favs', label: '收藏夹', icon: Star },
  { id: 'history', label: '版本', icon: Clock },
  { id: 'tags', label: '标签库', icon: Tag },
  { id: 'chat', label: 'AI 对话', icon: MessageCircle },
  { id: 'knowledgeQA', label: '知识库', icon: BookOpen },
  { id: 'style', label: '风格报告', icon: Sparkles, disabled: true, disabledHint: 'Phase [C]' },
]

/**
 * Taskboard 顶部 — BiliNote 式布局：
 * 名称 + 素材计数 + 操作按钮行（加入素材 / 导出 / 对比 / 融合 / 分享 / 编辑背景 / 更多）。
 */
export function TaskboardHead({
  name,
  materialCount,
  background: _background,
  description,
  updatedAt,
  onBack,
  onEditBackground,
  onAddMaterial,
  onExport,
  onCompare,
  onMerge,
  onShareMarkdown,
  onShareHtml,
  onMenuAction,
}: TaskboardHeadProps) {
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const shareRef = useRef<HTMLDivElement>(null)

  // 点击外部关闭下拉
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false)
      }
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) {
        setShareOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="tb-head">
      {/* 左侧：返回 + 信息 */}
      <div className="tb-head-l">
        {onBack && (
          <button className="tb-head-back" onClick={onBack}>
            <ArrowLeft size={14} />
            返回笔记库
          </button>
        )}
        <div className="tb-head-title-row">
          <h1 className="display">
            {name}
          </h1>
        </div>
        {description && <p className="tb-head-desc">{description}</p>}
        <div className="tb-head-count">
          <span className="tb-head-tag">
            <Layers size={13} />
            {materialCount} 篇笔记
          </span>
          {updatedAt && <span>更新于 {updatedAt}</span>}
        </div>
      </div>

      {/* 右侧：操作按钮行 */}
      <div className="tb-head-actions">
        <button className="btn btn-primary" onClick={onAddMaterial}>
          <Plus size={14} />
          加入素材
        </button>
        <button className="btn" onClick={onExport}>
          <Download size={14} />
          导出
        </button>
        <button className="btn" onClick={onCompare}>
          <ArrowLeftRight size={14} />
          对比
        </button>
        <button className="btn" onClick={onMerge}>
          <Sparkles size={14} />
          融合
        </button>
        {/* 分享下拉 */}
        <div className="tb-head-more-wrap" ref={shareRef}>
          <button
            className="btn"
            data-active={shareOpen}
            onClick={() => setShareOpen(!shareOpen)}
          >
            <Share2 size={14} />
            分享
          </button>
          {shareOpen && (
            <div className="tb-head-more-menu">
              <button
                className="tb-head-more-item"
                onClick={() => { setShareOpen(false); onShareMarkdown?.() }}
              >
                <FileText size={14} />
                <span>复制 Markdown</span>
              </button>
              <button
                className="tb-head-more-item"
                onClick={() => { setShareOpen(false); onShareHtml?.() }}
              >
                <Globe size={14} />
                <span>导出 HTML</span>
              </button>
            </div>
          )}
        </div>
        <button className="btn" onClick={onEditBackground}>
          <Pencil size={14} />
          编辑背景
        </button>

        {/* 更多下拉 */}
        <div className="tb-head-more-wrap" ref={moreRef}>
          <button
            className="btn"
            data-active={moreOpen}
            onClick={() => setMoreOpen(!moreOpen)}
          >
            <MoreHorizontal size={14} />
          </button>
          {moreOpen && (
            <div className="tb-head-more-menu">
              {MORE_ITEMS.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    className="tb-head-more-item"
                    disabled={item.disabled}
                    title={item.disabled ? item.disabledHint : undefined}
                    onClick={() => {
                      setMoreOpen(false)
                      onMenuAction?.(item.id)
                    }}
                  >
                    <Icon size={14} />
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
