/**
 * NoteAudioPanel — R3.3 音频播放器（仿 LNVideoPanel 接口）。
 *
 * 原生 <audio> 封装；ref 暴露 seekTo(sec)；onTimeUpdate 驱动转录轴联动。
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react'

interface NoteAudioPanelProps {
  src: string
  onTimeUpdate?: (currentTime: number) => void
}

export interface NoteAudioPanelHandle {
  seekTo: (sec: number) => void
}

const NoteAudioPanel = forwardRef<NoteAudioPanelHandle, NoteAudioPanelProps>(
  ({ src, onTimeUpdate }, ref) => {
    const audioRef = useRef<HTMLAudioElement>(null)

    useImperativeHandle(ref, () => ({
      seekTo(sec: number) {
        const a = audioRef.current
        if (!a) return
        a.currentTime = Math.max(0, Math.min(a.duration || 0, sec))
      },
    }))

    const handleTimeUpdate = useCallback(() => {
      const a = audioRef.current
      if (a && onTimeUpdate) {
        onTimeUpdate(a.currentTime)
      }
    }, [onTimeUpdate])

    // 键盘快捷键：Space 暂停/播放，← → 快退/快进 5s
    useEffect(() => {
      function handleKey(e: KeyboardEvent) {
        const a = audioRef.current
        if (!a) return
        if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return
        if (e.code === 'Space') {
          e.preventDefault()
          a.paused ? a.play() : a.pause()
        } else if (e.code === 'ArrowLeft') {
          e.preventDefault()
          a.currentTime = Math.max(0, a.currentTime - 5)
        } else if (e.code === 'ArrowRight') {
          e.preventDefault()
          a.currentTime = Math.min(a.duration || 0, a.currentTime + 5)
        }
      }
      window.addEventListener('keydown', handleKey)
      return () => window.removeEventListener('keydown', handleKey)
    }, [])

    if (!src) {
      return (
        <div style={{ padding: 16, textAlign: 'center', color: 'var(--mut)', fontSize: 13 }}>
          暂无可用音频源
        </div>
      )
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <audio
          ref={audioRef}
          src={src}
          controls
          preload="metadata"
          onTimeUpdate={handleTimeUpdate}
          style={{ width: '100%' }}
        />
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, fontSize: 11, color: 'var(--mut)' }}>
          <span>Space 暂停/播放</span>
          <span>← → 快退/快进 5s</span>
        </div>
      </div>
    )
  },
)

export default NoteAudioPanel
