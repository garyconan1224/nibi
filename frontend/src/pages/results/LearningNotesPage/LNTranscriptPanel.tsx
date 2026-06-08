import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Quote } from 'lucide-react'
import { toast } from 'sonner'
import type { VideoResultTranscriptLine } from '@/services/workspaces'
import { updateTranscriptSegment } from '@/services/workspaces'
import { useLnEditorStore } from '@/store/lnEditorStore'

interface LNTranscriptPanelProps {
  transcript: VideoResultTranscriptLine[]
  currentTime: number
  onSeek: (sec: number) => void
  workspaceId: string
  itemId: string
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
  workspaceId,
  itemId,
}: LNTranscriptPanelProps) {
  const activeIdx = useMemo(
    () => activeTranscriptIdx(transcript, currentTime),
    [transcript, currentTime],
  )
  const activeRef = useRef<HTMLDivElement>(null)
  const insertAtCursor = useLnEditorStore((s) => s.insertAtCursor)

  // ── 双击编辑状态 ──
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [editText, setEditText] = useState('')

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [activeIdx])

  const handleEditSave = useCallback(
    async (idx: number) => {
      const trimmed = editText.trim()
      const original = transcript[idx]?.text || ''
      if (trimmed === original) {
        setEditingIdx(null)
        return
      }
      try {
        await updateTranscriptSegment(workspaceId, itemId, idx, trimmed)
        toast.success('字幕已保存')
      } catch {
        toast.error('保存失败，请重试')
      }
      setEditingIdx(null)
    },
    [editText, transcript, workspaceId, itemId],
  )

  const handleEditCancel = useCallback(() => {
    setEditingIdx(null)
    setEditText('')
  }, [])

  function handleQuote(line: VideoResultTranscriptLine, e: React.MouseEvent) {
    e.stopPropagation()
    const md = `> [${line.t_str}] ${line.text}\n`
    const inserted = insertAtCursor(md)
    if (inserted) {
      toast.success('已引用字幕')
    } else {
      toast.error('请先切到 MD 视图')
    }
  }

  if (transcript.length === 0) {
    return (
      <div className="ln-transcript-panel">
        <div className="ln-tr-empty">暂无字幕轨（该素材未生成转录）</div>
      </div>
    )
  }

  return (
    <div className="ln-transcript-panel">
      {transcript.map((line, i) => {
        const isEditing = editingIdx === i
        return (
          <div
            key={`${line.t_sec}-${i}`}
            ref={i === activeIdx ? activeRef : undefined}
            className="ln-tr-row"
            data-active={i === activeIdx}
            onClick={() => !isEditing && onSeek(line.t_sec)}
            onDoubleClick={(e) => {
              e.stopPropagation()
              setEditingIdx(i)
              setEditText(line.text)
            }}
          >
            <span className="ln-tr-time">{line.t_str}</span>
            {isEditing ? (
              <input
                className="ln-tr-edit-input"
                autoFocus
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleEditSave(i)
                  if (e.key === 'Escape') handleEditCancel()
                }}
                onBlur={() => handleEditSave(i)}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="ln-tr-text">{line.text}</span>
            )}
            <button
              className="ln-tr-quote"
              title="引用到笔记"
              onClick={(e) => handleQuote(line, e)}
            >
              <Quote size={12} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
