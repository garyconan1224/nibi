import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Quote } from 'lucide-react'
import { toast } from 'sonner'
import type { VideoResultTranscriptLine } from '@/services/workspaces'
import { updateTranscriptSegment } from '@/services/workspaces'
import { useLnEditorStore } from '@/store/lnEditorStore'

type TranscriptMode = 'original' | 'speaker' | 'translated'

interface LNTranscriptPanelProps {
  transcript: VideoResultTranscriptLine[]
  currentTime: number
  onSeek: (sec: number) => void
  workspaceId: string
  itemId: string
  /** 字幕保存成功后回调（父组件可借此刷新 source.md 展示） */
  onSaved?: () => void
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
  onSaved,
}: LNTranscriptPanelProps) {
  const hasSpeaker = useMemo(() => transcript.some((l) => l.speaker), [transcript])
  const [mode, setMode] = useState<TranscriptMode>('original')
  const activeIdx = useMemo(
    () => activeTranscriptIdx(transcript, currentTime),
    [transcript, currentTime],
  )
  const activeRef = useRef<HTMLDivElement>(null)
  const insertAtCursor = useLnEditorStore((s) => s.insertAtCursor)

  // ── 双击编辑状态 ──
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [editText, setEditText] = useState('')
  // 乐观更新：保存成功后立即在面板回显新文字（key=段下标），免刷新；重进页面组件重挂即清空
  const [localEdits, setLocalEdits] = useState<Record<number, string>>({})

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [activeIdx])

  const handleEditSave = useCallback(
    async (idx: number) => {
      const trimmed = editText.trim()
      const current = localEdits[idx] ?? transcript[idx]?.text ?? ''
      if (trimmed === current) {
        setEditingIdx(null)
        return
      }
      try {
        await updateTranscriptSegment(workspaceId, itemId, idx, trimmed)
        // 乐观更新：空内容 = 恢复原文（移除 override 回退到原 text），否则记下新文字
        setLocalEdits((prev) => {
          const next = { ...prev }
          if (trimmed) next[idx] = trimmed
          else delete next[idx]
          return next
        })
        toast.success('字幕已保存')
        onSaved?.()
      } catch {
        toast.error('保存失败，请重试')
      }
      setEditingIdx(null)
    },
    [editText, transcript, workspaceId, itemId, localEdits, onSaved],
  )

  const handleEditCancel = useCallback(() => {
    setEditingIdx(null)
    setEditText('')
  }, [])

  function handleQuote(line: VideoResultTranscriptLine, text: string, e: React.MouseEvent) {
    e.stopPropagation()
    const md = `> [${line.t_str}] ${text}\n`
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
      {/* 模式 tab 栏 */}
      {hasSpeaker && (
        <div className="ln-tr-mode-tabs">
          {([
            { key: 'original' as const, label: '原文' },
            { key: 'speaker' as const, label: '说话人' },
            { key: 'translated' as const, label: '译文' },
          ]).map((t) => (
            <button
              key={t.key}
              className="ln-tr-tab"
              data-active={mode === t.key ? 'true' : undefined}
              disabled={t.key === 'translated'}
              onClick={() => setMode(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
      {transcript.map((line, i) => {
        const isEditing = editingIdx === i
        const displayText = localEdits[i] ?? line.text
        const speakerPrefix = mode === 'speaker' && line.speaker ? `[${line.speaker}] ` : ''
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
              setEditText(displayText)
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
              <span className="ln-tr-text">{speakerPrefix}{displayText}</span>
            )}
            <button
              className="ln-tr-quote"
              title="引用到笔记"
              onClick={(e) => handleQuote(line, displayText, e)}
            >
              <Quote size={12} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
