/**
 * NoteMediaCompanion — R3.2 伴随区媒体组件（video 分支）。
 *
 * 复用 ln 的 LNVideoPanel + LNTranscriptPanel，内部维护 currentTime
 * 实现播放器 ↔ 转录轴双向联动。
 */
import { useCallback, useRef, useState } from 'react'

import LNVideoPanel, { type LNVideoPanelHandle } from '@/pages/results/LearningNotesPage/LNVideoPanel'
import LNTranscriptPanel from '@/pages/results/LearningNotesPage/LNTranscriptPanel'
import type { NoteMedia } from '@/types/workspace'

// 复用 ln 样式（全部 scoped 在 .vm-ln-scope 下，不会污染 NoteShell）
import '@/pages/results/LearningNotesPage/learning-notes.css'

/** 转录行结构（与 LNTranscriptPanel 的 VideoResultTranscriptLine 一致） */
interface TranscriptLine {
  t_sec: number
  t_str: string
  text: string
}

interface NoteMediaCompanionProps {
  media: NoteMedia
  transcript: TranscriptLine[]
  workspaceId?: string
}

export default function NoteMediaCompanion({ media, transcript, workspaceId }: NoteMediaCompanionProps) {
  const [currentTime, setCurrentTime] = useState(0)
  const videoRef = useRef<LNVideoPanelHandle>(null)

  // 播放器时间更新 → 驱动转录轴高亮
  const handleTimeUpdate = useCallback((t: number) => {
    setCurrentTime(t)
  }, [])

  // 转录轴点击 → 跳转播放器
  const handleSeek = useCallback((sec: number) => {
    videoRef.current?.seekTo(sec)
  }, [])

  // video 分支
  if (media.video?.url) {
    return (
      <div className="vm-ln-scope" style={{ display: 'flex', flexDirection: 'column', gap: 0, borderTop: '1px solid var(--border)' }}>
        {/* 播放器 */}
        <div style={{ maxHeight: 240, overflow: 'hidden' }}>
          <LNVideoPanel
            ref={videoRef}
            src={media.video.url}
            title=""
            workspaceId={workspaceId}
            onTimeUpdate={handleTimeUpdate}
          />
        </div>
        {/* 转录轴 */}
        {transcript.length > 0 && (
          <div style={{ maxHeight: 200, overflowY: 'auto', borderTop: '1px solid var(--border)' }}>
            <LNTranscriptPanel
              transcript={transcript}
              currentTime={currentTime}
              onSeek={handleSeek}
            />
          </div>
        )}
      </div>
    )
  }

  // 无媒体 — 不渲染
  return null
}
