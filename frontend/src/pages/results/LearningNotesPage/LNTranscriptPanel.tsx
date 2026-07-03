import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FileCode, Globe, Loader2, Quote } from 'lucide-react'
import { toast } from 'sonner'
import type { VideoResultTranscriptLine } from '@/services/workspaces'
import { updateTranscriptSegment, translateTranscriptSegments } from '@/services/workspaces'
import { useLnEditorStore } from '@/store/lnEditorStore'

type TranscriptMode = 'original' | 'speaker' | 'translated'

const TRANSLATE_LANGS: { value: string; label: string }[] = [
  { value: 'zh', label: '中文' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
]

interface LNTranscriptPanelProps {
  transcript: VideoResultTranscriptLine[]
  currentTime: number
  onSeek: (sec: number) => void
  workspaceId: string
  itemId: string
  /** 字幕保存成功后回调（父组件可借此刷新 source.md 展示） */
  onSaved?: () => void
  /** 原始素材 Markdown（有值时显示「字幕/原始素材」切换 tab） */
  sourceMd?: string
  /** 已有的译文缓存（key=目标语言，value={idx→text}） */
  translations?: Record<string, Record<number, string>> | null
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
  sourceMd,
  translations,
}: LNTranscriptPanelProps) {
  const hasSpeaker = useMemo(() => transcript.some((l) => l.speaker), [transcript])
  const [mode, setMode] = useState<TranscriptMode>('original')
  const [showSourceMd, setShowSourceMd] = useState(false)
  const [translateLang, setTranslateLang] = useState('zh')
  const [translating, setTranslating] = useState(false)
  // 本地缓存译文（key=idx），来源：后端 translations 缓存 或 本次翻译结果
  const [localTranslations, setLocalTranslations] = useState<Record<number, string> | null>(
    () => (translations?.['zh'] as Record<number, string>) ?? null,
  )
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

  const handleTranslate = useCallback(async () => {
    setTranslating(true)
    try {
      const res = await translateTranscriptSegments(workspaceId, itemId, translateLang)
      const idxMap: Record<number, string> = {}
      for (const s of res.segments) {
        if (s.text) idxMap[s.idx] = s.text
      }
      setLocalTranslations(idxMap)
      setMode('translated')
      toast.success(res.cached ? '已加载缓存译文' : '翻译完成')
    } catch {
      toast.error('翻译失败，请重试')
    }
    setTranslating(false)
  }, [workspaceId, itemId, translateLang])

  // 切换翻译语言时，如果已有该语言缓存则直接启用
  useEffect(() => {
    if (translations?.[translateLang]) {
      setLocalTranslations(translations[translateLang] as Record<number, string>)
    } else {
      setLocalTranslations(null)
      if (mode === 'translated') setMode('original')
    }
  }, [translateLang, translations, mode])

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
      {/* 顶层切换：字幕 | 原始素材（仅当 sourceMd 有值时显示） */}
      {sourceMd && (
        <div className="ln-tr-mode-tabs">
          <button
            className="ln-tr-tab"
            data-active={!showSourceMd ? 'true' : undefined}
            onClick={() => setShowSourceMd(false)}
          >
            字幕
          </button>
          <button
            className="ln-tr-tab"
            data-active={showSourceMd ? 'true' : undefined}
            onClick={() => setShowSourceMd(true)}
          >
            <FileCode size={11} style={{ marginRight: 3 }} /> 原始素材
          </button>
        </div>
      )}
      {showSourceMd ? (
        <div style={{ padding: '10px 14px', fontSize: 13, lineHeight: 1.7, color: 'var(--ink-2)', overflowY: 'auto' }}>
          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>{sourceMd}</pre>
        </div>
      ) : (
        <>
          {/* 字幕工具栏：模式 tab + 翻译按钮 */}
          <div className="ln-tr-toolbar">
            <div className="ln-tr-mode-tabs">
              {/* 原文总是可见 */}
              <button
                className="ln-tr-tab"
                data-active={mode === 'original' ? 'true' : undefined}
                onClick={() => setMode('original')}
              >
                原文
              </button>
              {hasSpeaker && (
                <button
                  className="ln-tr-tab"
                  data-active={mode === 'speaker' ? 'true' : undefined}
                  onClick={() => setMode('speaker')}
                >
                  说话人
                </button>
              )}
              <button
                className="ln-tr-tab"
                data-active={mode === 'translated' ? 'true' : undefined}
                disabled={!localTranslations}
                onClick={() => setMode('translated')}
              >
                译文
              </button>
            </div>
            <div className="ln-tr-translate-actions">
              <select
                className="ln-tr-lang-select"
                value={translateLang}
                onChange={(e) => setTranslateLang(e.target.value)}
              >
                {TRANSLATE_LANGS.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
              <button
                className="ln-tr-translate-btn"
                disabled={translating}
                onClick={handleTranslate}
              >
                {translating ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Globe size={13} />
                )}
                <span>{translating ? '翻译中…' : '翻译'}</span>
              </button>
            </div>
          </div>
          {transcript.map((line, i) => {
            const isEditing = editingIdx === i
            const displayText = localEdits[i] ?? line.text
            const speakerPrefix = mode === 'speaker' && line.speaker ? `[${line.speaker}] ` : ''
            const translatedText = localTranslations?.[i]
            const shownText = mode === 'translated' && translatedText
              ? translatedText
              : displayText
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
                  <span className="ln-tr-text">
                    {speakerPrefix}
                    {mode === 'translated' && translatedText ? (
                      <span className="ln-tr-translated">{shownText}</span>
                    ) : (
                      shownText
                    )}
                  </span>
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
        </>
      )}
    </div>
  )
}
