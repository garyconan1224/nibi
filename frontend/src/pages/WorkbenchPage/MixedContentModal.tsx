import { X, Download } from 'lucide-react'
import type { PlatformInfo } from './types'

interface MixedContentModalProps {
  open: boolean
  platform: PlatformInfo | null
  selected: Record<string, boolean>
  onToggle: (type: string) => void
  onConfirm: () => void
  onClose: () => void
}

const TYPE_DESC: Record<string, string> = {
  video:   '下载视频文件 · yt-dlp',
  audio:   '仅下载音频 · MP3/WAV',
  image:   '下载图片素材',
  article: '抓取文章文字 · 通用抓取',
}

export function MixedContentModal({
  open,
  platform,
  selected,
  onToggle,
  onConfirm,
  onClose,
}: MixedContentModalProps) {
  if (!platform) return null
  const count = Object.values(selected).filter(Boolean).length

  return (
    <>
      <div
        className="wb-modal-backdrop"
        data-open={open}
        onClick={onClose}
      />
      <div className="wb-modal" data-open={open} style={{ width: 460 }}>
        <div className="m-head">
          <div>
            <div className="eyebrow">混合内容 · 请选择下载范围</div>
            <h3 className="display" style={{ fontSize: 24, margin: '4px 0 0' }}>
              {platform.name} 页面
            </h3>
          </div>
          <button className="btn btn-ghost" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="m-body" style={{ gap: 12 }}>
          {platform.types.map((t) => (
            <label
              key={t}
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr',
                gap: 12,
                alignItems: 'center',
                cursor: 'pointer',
                padding: '8px 0',
              }}
            >
              <input
                type="checkbox"
                checked={selected[t] || false}
                onChange={() => onToggle(t)}
                style={{ accentColor: 'var(--accent)', width: 16, height: 16 }}
              />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, textTransform: 'capitalize' }}>
                  {t}
                </div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                  {TYPE_DESC[t] ?? t}
                </div>
              </div>
            </label>
          ))}
        </div>

        <div className="m-foot">
          <span className="mono" style={{ fontSize: 12, color: 'var(--ink-3)' }}>
            已选 {count} 类内容
          </span>
          <button
            className="btn btn-primary"
            disabled={count === 0}
            onClick={onConfirm}
          >
            <Download size={13} />
            确认下载
          </button>
        </div>
      </div>
    </>
  )
}
