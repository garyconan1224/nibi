import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileVideo, FileAudio, FileImage, FileText, MoreHorizontal, Film, Subtitles } from 'lucide-react'
import type { WorkspaceItem, ItemType } from '@/types/workspace'
import { TranscriptPreviewModal } from '@/components/workspace/TranscriptPreviewModal'
import { StoryboardLaunchModal } from './StoryboardLaunchModal'

/** 类型 → 图标 */
const TYPE_ICON: Record<ItemType, React.ElementType> = {
  video: FileVideo,
  audio: FileAudio,
  image: FileImage,
  text: FileText,
}

/** 类型 → 中文 label */
const TYPE_LABEL: Record<ItemType, string> = {
  video: '视频',
  audio: '音频',
  image: '图片',
  text: '文字',
}

/** 类型 → 设计稿 tone（颜色语义） */
const TYPE_TONE: Record<ItemType, string> = {
  video: 'pink',
  audio: 'purple',
  image: 'blue',
  text: 'amber',
}

/** 后端 status → 设计稿 state dot 颜色 */
const STATUS_DOT: Record<string, string> = {
  done: 'var(--accent-green)',
  processing: 'var(--ink)',
  pending: 'var(--ink-4)',
  failed: 'var(--accent-pink)',
}

/** 后端 status → 设计稿中文 */
const STATUS_LABEL: Record<string, string> = {
  done: '完成',
  processing: '处理中',
  pending: '等待中',
  failed: '失败',
}

/** status → 结果路由后缀 */
const RESULT_ROUTE: Record<ItemType, string> = {
  video: 'result',
  image: 'image_result',
  audio: 'audio_result',
  text: 'text_result',
}

interface MaterialCardProps {
  item: WorkspaceItem
  workspaceId: string
  /** 该 item 关联任务的进度（0~1），仅 processing 时有意义 */
  progress?: number
}

/**
 * 单张素材卡片。
 * 设计稿来源：taskboard.jsx MaterialCard + VidMirror.html .mat-* 类。
 */
export function MaterialCard({ item, workspaceId, progress }: MaterialCardProps) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [sbOpen, setSbOpen] = useState(false)
  const [transcriptOpen, setTranscriptOpen] = useState(false)
  const Icon = TYPE_ICON[item.type]
  const tone = TYPE_TONE[item.type]
  const dotColor = STATUS_DOT[item.status] ?? 'var(--ink-4)'
  const isRunning = item.status === 'processing'
  const tags = item.tags?.custom_tags ?? []

  // Extract frame paths from item results (if available)
  const framePaths: string[] = (item.results?.frame_paths as string[]) ?? []

  const handleClick = () => {
    const suffix = RESULT_ROUTE[item.type]
    navigate(`/workspaces/${workspaceId}/items/${item.item_id}/${suffix}`)
  }

  return (
    <>
    <div className="mat-card" data-type={item.type} onClick={handleClick}>
      <div className="mat-thumb">
        {/* 缩略图占位：无真实图片时显示类型图标 */}
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'grid',
            placeItems: 'center',
            color: 'var(--ink-4)',
          }}
        >
          <Icon size={32} />
        </div>
        <span className="mat-type" data-tone={tone}>
          <Icon size={11} />
          {TYPE_LABEL[item.type]}
        </span>
        {isRunning && progress != null && (
          <div className="mat-prog">
            <div style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        )}

        {/* … 菜单 */}
        <div style={{ position: 'absolute', top: 4, right: 4 }}>
          <button
            className="btn btn-ghost"
            style={{ width: 24, height: 24, padding: 0 }}
            onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o) }}
          >
            <MoreHorizontal size={14} />
          </button>
          {menuOpen && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: 4,
                zIndex: 10,
                minWidth: 120,
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  width: '100%',
                  padding: '6px 10px',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  fontSize: 12,
                  borderRadius: 4,
                }}
                onClick={() => { setMenuOpen(false); setSbOpen(true) }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-sunken)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
              >
                <Film size={13} />
                生成分镜
              </button>
              {(item.type === 'video' || item.type === 'audio') && (
                <button
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    width: '100%',
                    padding: '6px 10px',
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    fontSize: 12,
                    borderRadius: 4,
                  }}
                  onClick={() => { setMenuOpen(false); setTranscriptOpen(true) }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-sunken)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                >
                  <Subtitles size={13} />
                  快速抽字幕
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="mat-body">
        <div className="mat-title">{item.name || '未命名素材'}</div>
        <div className="mat-meta">
          <span className="dot" style={{ background: dotColor }} />
          <span>{STATUS_LABEL[item.status] ?? item.status}</span>
        </div>
        <div className="mat-sub" style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-4)' }}>
          {item.source_value}
        </div>
        {tags.length > 0 && (
          <div className="mat-tags">
            {tags.slice(0, 3).map((t) => (
              <span key={t} className="kw">{t}</span>
            ))}
            {tags.length > 3 && (
              <span className="kw" style={{ opacity: 0.5 }}>+{tags.length - 3}</span>
            )}
          </div>
        )}
      </div>
    </div>
      <StoryboardLaunchModal
        open={sbOpen}
        itemName={item.name || '未命名素材'}
        workspaceId={workspaceId}
        framePaths={framePaths}
        onClose={() => setSbOpen(false)}
      />
      <TranscriptPreviewModal
        open={transcriptOpen}
        sourceUrl={item.source_value}
        onClose={() => setTranscriptOpen(false)}
      />
    </>
  )
}
