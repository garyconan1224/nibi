import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import { toast } from 'sonner'
import { uploadLnScreenshot } from '@/services/lnScreenshots'
import { useLnEditorStore } from '@/store/lnEditorStore'

interface LNVideoPanelProps {
  src: string
  /** 在线平台网页链接（src 为空时降级展示，供用户去原平台观看） */
  externalUrl?: string
  title: string
  workspaceId?: string
  onTimeUpdate?: (currentTime: number) => void
}

export interface LNVideoPanelHandle {
  seekTo: (sec: number) => void
}

function formatTs(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const LNVideoPanel = forwardRef<LNVideoPanelHandle, LNVideoPanelProps>(
  ({ src, externalUrl, title, workspaceId, onTimeUpdate }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null)
    const [shooting, setShooting] = useState(false)
    const insertAtCursor = useLnEditorStore((s) => s.insertAtCursor)

    useImperativeHandle(ref, () => ({
      seekTo(sec: number) {
        const v = videoRef.current
        if (!v) return
        const clamped = Math.max(0, Math.min(v.duration || 0, sec))
        v.currentTime = clamped
      },
    }))

    // 键盘快捷键：Space 暂停/播放，← → 快退/快进 5s
    useEffect(() => {
      function handleKey(e: KeyboardEvent) {
        const v = videoRef.current
        if (!v) return
        if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return

        if (e.code === 'Space') {
          e.preventDefault()
          v.paused ? v.play() : v.pause()
        } else if (e.code === 'ArrowLeft') {
          e.preventDefault()
          v.currentTime = Math.max(0, v.currentTime - 5)
        } else if (e.code === 'ArrowRight') {
          e.preventDefault()
          v.currentTime = Math.min(v.duration || 0, v.currentTime + 5)
        }
      }
      window.addEventListener('keydown', handleKey)
      return () => window.removeEventListener('keydown', handleKey)
    }, [])

    const handleTimeUpdate = useCallback(() => {
      const v = videoRef.current
      if (v && onTimeUpdate) {
        onTimeUpdate(v.currentTime)
      }
    }, [onTimeUpdate])

    const handleScreenshot = useCallback(async () => {
      const video = videoRef.current
      if (!video) return
      if (video.readyState < 2) {
        toast.error('视频未加载完成')
        return
      }
      if (!workspaceId) {
        toast.error('缺少合集 ID')
        return
      }

      setShooting(true)
      try {
        if (!video.paused) video.pause()

        // canvas 抓帧
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          toast.error('截图失败：浏览器不支持 canvas')
          return
        }
        ctx.drawImage(video, 0, 0)

        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (b) => b ? resolve(b) : reject(new Error('toBlob failed')),
            'image/png',
          )
        })

        // 上传
        const ts = video.currentTime
        const { url } = await uploadLnScreenshot(workspaceId, blob, ts)

        // 拼 markdown 并插入光标处
        const tsStr = formatTs(ts)
        const md = `\n![截图@${tsStr}](${url})\n`
        const inserted = insertAtCursor(md)

        if (inserted) {
          toast.success(`已插入笔记 @ ${tsStr}`)
        } else {
          toast.error('未找到笔记编辑器（请先切到 MD 视图）')
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : '截图失败'
        toast.error(msg)
      } finally {
        setShooting(false)
      }
    }, [workspaceId, insertAtCursor])

    if (!src) {
      return (
        <div className="ln-video-panel">
          <div className="ln-video-placeholder">
            {externalUrl ? (
              <>
                <p>该视频为在线链接，暂不支持内嵌播放</p>
                <a className="ln-video-extlink" href={externalUrl} target="_blank" rel="noreferrer">
                  ↗ 在原平台打开观看
                </a>
                <p className="ln-video-hint">下载到本地后即可在此直接播放</p>
              </>
            ) : (
              <>
                <p>暂无可用视频源</p>
                <p className="ln-video-hint">视频可能尚未下载完成</p>
              </>
            )}
          </div>
        </div>
      )
    }

    return (
      <div className="ln-video-panel">
        <div className="ln-video-wrapper">
          <video
            ref={videoRef}
            src={src}
            controls
            preload="metadata"
            onTimeUpdate={handleTimeUpdate}
          />
        </div>
        <div className="ln-video-toolbar">
          <button
            className="ln-shot-btn"
            onClick={handleScreenshot}
            disabled={shooting}
          >
            <Camera size={14} />
            {shooting ? '截图中…' : '截图插入'}
          </button>
        </div>
        {title && <div className="ln-video-title">{title}</div>}
        <div className="ln-video-shortcuts">
          <span>Space 暂停/播放</span>
          <span>← → 快退/快进 5s</span>
        </div>
      </div>
    )
  },
)

export default LNVideoPanel
