import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { toast } from 'sonner'
import { ArrowLeft, Download, Pause, Play, Star } from 'lucide-react'

import {
  type AudioResult,
  type VideoResultTranscriptLine,
  downloadExport,
  getAudioItemResult,
} from '@/services/workspaces'

import './tokens.css'

export default function AudioResultPage() {
  const { workspaceId = '', itemId = '' } = useParams<{ workspaceId: string; itemId: string }>()
  const navigate = useNavigate()

  type FetchState =
    | { kind: 'loading' }
    | { kind: 'ready'; data: AudioResult }
    | { kind: 'error'; message: string }
  const [fetchState, setFetchState] = useState<FetchState>({ kind: 'loading' })

  const [currentSec, setCurrentSec] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [favored, setFavored] = useState(false)

  const audioRef = useRef<HTMLAudioElement>(null)

  // 拉音频结果数据
  useEffect(() => {
    let cancelled = false
    getAudioItemResult(workspaceId, itemId)
      .then((data) => {
        if (!cancelled) setFetchState({ kind: 'ready', data })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const message = err instanceof Error ? err.message : '加载音频结果失败'
        setFetchState({ kind: 'error', message })
      })
    return () => { cancelled = true }
  }, [workspaceId, itemId])

  const result = fetchState.kind === 'ready' ? fetchState.data : null
  const transcript = useMemo(() => {
    const raw = result?.transcript
    if (Array.isArray(raw)) return raw
    if (typeof raw === 'string' && raw.length > 0) {
      return [{ t_sec: 0, t_str: '00:00', text: raw }]
    }
    return []
  }, [result])

  // 音频 timeupdate 回调
  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) setCurrentSec(audioRef.current.currentTime)
  }, [])

  const handlePlayPause = useCallback(() => {
    const el = audioRef.current
    if (!el) return
    if (el.paused) {
      el.play().catch(() => {})
    } else {
      el.pause()
    }
  }, [])

  const handleSeek = useCallback((sec: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = sec
      setCurrentSec(sec)
    }
  }, [])

  const handleFavorite = useCallback(() => {
    setFavored((prev) => {
      const next = !prev
      toast.success(next ? '已收藏此音频' : '已取消收藏')
      return next
    })
  }, [])

  const handleExport = useCallback(async () => {
    try {
      await downloadExport(workspaceId, itemId)
      toast.success('工作包已下载')
    } catch (err) {
      toast.error('导出失败：' + (err instanceof Error ? err.message : '未知'))
    }
  }, [workspaceId, itemId])

  // 高亮当前对应的 transcript 行
  const activeLineIdx = useMemo(() => {
    if (!transcript.length) return -1
    let best = 0
    for (let i = 0; i < transcript.length; i++) {
      if (transcript[i].t_sec <= currentSec) best = i
      else break
    }
    return best
  }, [transcript, currentSec])

  // 键盘快捷键：空格播放/暂停
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return
      if (e.code === 'Space') {
        e.preventDefault()
        handlePlayPause()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handlePlayPause])

  if (fetchState.kind === 'loading') {
    return (
      <div className="vm-video-result-scope" style={{ height: '100%', display: 'grid', placeItems: 'center' }}>
        <span className="mono" style={{ color: 'var(--ink-3)' }}>加载音频结果…</span>
      </div>
    )
  }
  if (fetchState.kind === 'error' || !result) {
    return (
      <div
        className="vm-video-result-scope"
        style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}
      >
        <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
          {fetchState.kind === 'error' ? fetchState.message : '没有可显示的音频结果'}
        </span>
        <button className="btn-ghost" style={{ padding: '6px 12px' }} onClick={() => navigate(-1)}>
          <ArrowLeft size={14} /> 返回
        </button>
      </div>
    )
  }

  return (
    <div
      className="vm-video-result-scope"
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 360px',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* ════════ 左：播放器 + transcript ════════ */}
      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* 顶部导航 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 20px',
            borderBottom: '1px solid var(--line)',
            flexShrink: 0,
            background: 'var(--bg-elev)',
          }}
        >
          <button
            className="btn-ghost"
            onClick={() => navigate(-1)}
            style={{ height: 28, padding: '0 10px', fontSize: 12 }}
          >
            <ArrowLeft size={13} /> 返回
          </button>
          <span style={{ width: 1, height: 16, background: 'var(--line)', flexShrink: 0 }} />
          <span
            style={{
              fontWeight: 600,
              fontSize: 13,
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {result.audio?.title || result.audio?.filename || '音频'}
          </span>
          <span className="kw mono" style={{ fontSize: 10, flexShrink: 0 }}>AUDIO</span>
          {result.source === 'demo_fixture' && (
            <span
              className="mono"
              style={{
                fontSize: 10,
                padding: '2px 8px',
                borderRadius: 6,
                background: 'var(--accent-warm)',
                color: '#fff',
                fontWeight: 600,
              }}
              title="results 尚未填充，正在使用 demo fixture"
            >
              DEMO
            </span>
          )}
          <button
            className="btn-ghost"
            onClick={handleExport}
            title="导出复刻工作包 (.zip)"
            style={{ height: 28, padding: '0 10px', fontSize: 12, flexShrink: 0 }}
          >
            <Download size={13} /> 导出
          </button>
        </div>

        {/* 音频播放器区域 */}
        <div
          style={{
            padding: '24px 20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
            background: 'var(--bg-sunken)',
            borderBottom: '1px solid var(--line)',
            flexShrink: 0,
          }}
        >
          {/* 自定义播放控制 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button
              onClick={handlePlayPause}
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                border: 'none',
                background: 'var(--ink)',
                color: 'var(--bg)',
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
              }}
            >
              {playing ? <Pause size={20} /> : <Play size={20} style={{ marginLeft: 2 }} />}
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 200 }}>
              <span className="mono" style={{ fontSize: 12, color: 'var(--ink-2)' }}>
                {formatSec(currentSec)} / {result.audio?.duration_str || formatSec(result.audio?.duration_sec ?? 0)}
              </span>
            </div>
          </div>
          {/* 原生 audio 元素（隐藏，由自定义按钮控制） */}
          <audio
            ref={audioRef}
            src={result.audio?.url || (typeof result.source === 'string' ? result.source : undefined) || undefined}
            onTimeUpdate={handleTimeUpdate}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            style={{ display: 'none' }}
          />
        </div>

        {/* Transcript 列表 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>字幕 / 转写</div>
          {transcript.length === 0 ? (
            <span className="mono" style={{ fontSize: 12, color: 'var(--ink-4)' }}>暂无转写数据</span>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {transcript.map((line, idx) => (
                <TranscriptRow
                  key={idx}
                  line={line}
                  active={idx === activeLineIdx}
                  onClick={() => handleSeek(line.t_sec)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ════════ 右：摘要面板 ════════ */}
      <div
        style={{
          borderLeft: '1px solid var(--line)',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-elev)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '10px 14px',
            borderBottom: '1px solid var(--line)',
            flexShrink: 0,
            background: 'var(--bg-sunken)',
          }}
        >
          <span className="eyebrow">音频摘要</span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
          {/* 摘要（markdown 渲染） */}
          {result.summary && (
            <div style={{ marginBottom: 14, fontSize: 13, lineHeight: 1.7, color: 'var(--ink-2)' }}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm as any]}
                components={{
                  h1: ({ children }) => <h1 style={{ fontSize: 18, fontWeight: 700, margin: '12px 0 8px' }}>{children}</h1>,
                  h2: ({ children }) => <h2 style={{ fontSize: 15, fontWeight: 600, margin: '10px 0 6px' }}>{children}</h2>,
                  h3: ({ children }) => <h3 style={{ fontSize: 14, fontWeight: 600, margin: '8px 0 4px' }}>{children}</h3>,
                  p: ({ children }) => <p style={{ margin: '0 0 8px' }}>{children}</p>,
                  ul: ({ children }) => <ul style={{ margin: '0 0 8px', paddingLeft: 20 }}>{children}</ul>,
                  ol: ({ children }) => <ol style={{ margin: '0 0 8px', paddingLeft: 20 }}>{children}</ol>,
                  li: ({ children }) => <li style={{ lineHeight: 1.6 }}>{children}</li>,
                  blockquote: ({ children }) => (
                    <blockquote style={{ borderLeft: '3px solid var(--accent-warm)', paddingLeft: 12, margin: '8px 0', color: 'var(--ink-3)' }}>
                      {children}
                    </blockquote>
                  ),
                  code: ({ children, className }) => {
                    const isBlock = className?.includes('language-')
                    return isBlock
                      ? <pre style={{ background: 'var(--bg-sunken)', padding: 10, borderRadius: 6, overflow: 'auto', fontSize: 12, margin: '8px 0' }}><code>{children}</code></pre>
                      : <code style={{ background: 'var(--bg-sunken)', padding: '1px 4px', borderRadius: 3, fontSize: 12 }}>{children}</code>
                  },
                }}
              >
                {result.summary}
              </ReactMarkdown>
            </div>
          )}

          {/* 元信息 */}
          <div style={{ marginBottom: 14 }}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>元信息</div>
            <div style={{ fontSize: 12, lineHeight: 1.8, color: 'var(--ink-2)' }}>
              <div>时长：{result.audio?.duration_str || formatSec(result.audio?.duration_sec ?? 0)}</div>
              <div>转写行数：{result.tracks_meta?.transcript_count ?? transcript.length}</div>
            </div>
          </div>
        </div>

        {/* 底部操作 */}
        <div
          style={{
            padding: '10px 14px',
            borderTop: '1px solid var(--line)',
            display: 'flex',
            flexDirection: 'column',
            gap: 7,
            flexShrink: 0,
          }}
        >
          <button
            onClick={handleFavorite}
            style={{
              width: '100%',
              height: 36,
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              cursor: 'pointer',
              border: '1px solid var(--line)',
              background: favored ? 'rgba(255,184,76,0.12)' : 'var(--bg-sunken)',
              color: favored ? 'var(--accent-warm)' : 'var(--ink-2)',
            }}
          >
            <Star
              size={14}
              fill={favored ? 'var(--accent-warm)' : 'none'}
              color={favored ? 'var(--accent-warm)' : 'currentColor'}
            />
            {favored ? '已收藏' : '收藏'}
          </button>
        </div>
      </div>
    </div>
  )
}


/** 单行 transcript：时间戳 + 文本，点击跳转 */
function TranscriptRow({
  line,
  active,
  onClick,
}: {
  line: VideoResultTranscriptLine
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '6px 10px',
        borderRadius: 8,
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        background: active ? 'rgba(255,184,76,0.10)' : 'transparent',
        transition: 'background 0.15s',
      }}
    >
      <span
        className="mono"
        style={{
          fontSize: 11,
          color: active ? 'var(--accent-warm)' : 'var(--ink-4)',
          flexShrink: 0,
          paddingTop: 1,
          fontWeight: active ? 700 : 400,
        }}
      >
        {line.t_str}
      </span>
      <span
        style={{
          fontSize: 13,
          lineHeight: 1.6,
          color: active ? 'var(--ink)' : 'var(--ink-2)',
          fontWeight: active ? 600 : 400,
        }}
      >
        {line.text}
      </span>
    </button>
  )
}


function formatSec(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m.toString().padStart(2, '0')}:${r.toString().padStart(2, '0')}`
}
