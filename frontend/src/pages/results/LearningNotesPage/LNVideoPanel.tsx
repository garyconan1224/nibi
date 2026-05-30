import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react'

interface LNVideoPanelProps {
  src: string
  title: string
  onTimeUpdate?: (currentTime: number) => void
}

export interface LNVideoPanelHandle {
  seekTo: (sec: number) => void
}

const LNVideoPanel = forwardRef<LNVideoPanelHandle, LNVideoPanelProps>(
  ({ src, title, onTimeUpdate }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null)

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
      // 避免在输入框内触发
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

  if (!src) {
    return (
      <div className="ln-video-panel">
        <div className="ln-video-placeholder">
          <p>暂无可用视频源</p>
          <p className="ln-video-hint">视频可能尚未下载完成</p>
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
      {title && <div className="ln-video-title">{title}</div>}
      <div className="ln-video-shortcuts">
        <span>Space 暂停/播放</span>
        <span>← → 快退/快进 5s</span>
      </div>
    </div>
  )
})

export default LNVideoPanel
