import { useEffect, useMemo, useRef } from 'react'
import type { VideoResultTranscriptLine } from '@/services/workspaces'

interface LNTranscriptPanelProps {
  transcript: VideoResultTranscriptLine[]
  currentTime: number
  onSeek: (sec: number) => void
}

function activeTranscriptIdx(
  transcript: VideoResultTranscriptLine[],
  currentSec: number,
): number {
  let best = -1
  for (let i = 0; i < transcript.length; i++) {
    if (transcript[i].t_sec <= currentSec) best = i
  }
  return best
}

export default function LNTranscriptPanel({
  transcript,
  currentTime,
  onSeek,
}: LNTranscriptPanelProps) {
  const activeIdx = useMemo(
    () => activeTranscriptIdx(transcript, currentTime),
    [transcript, currentTime],
  )
  const activeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [activeIdx])

  if (transcript.length === 0) {
    return (
      <div className="ln-transcript-panel">
        <div className="ln-tr-empty">暂无字幕轨（该素材未生成转录）</div>
      </div>
    )
  }

  return (
    <div className="ln-transcript-panel">
      {transcript.map((line, i) => (
        <div
          key={`${line.t_sec}-${i}`}
          ref={i === activeIdx ? activeRef : undefined}
          className="ln-tr-row"
          data-active={i === activeIdx}
          onClick={() => onSeek(line.t_sec)}
        >
          <span className="ln-tr-time">{line.t_str}</span>
          <span className="ln-tr-text">{line.text}</span>
        </div>
      ))}
    </div>
  )
}
