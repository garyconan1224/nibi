import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Check, Copy, Pause, Play, Settings2, Star } from 'lucide-react'

import {
  type PromptVersion,
  type VideoResult,
  type VideoResultFrame,
  addPromptVersion,
  // downloadExport, -- N11: 导出功能 UI 隐藏
  getItemResult,
  listPromptVersions,
} from '@/services/workspaces'
import { PromptVersionStack } from '@/components/result/PromptVersionStack'
import {
  type PromptFormat,
  type PromptFormatsConfig,
  getPromptFormatsConfig,
  isJsonFormat,
  renderJsonForFrame,
  renderTemplate,
  savePromptFormatsConfig,
} from '@/services/promptFormats'
import { TripleTrack } from './TripleTrack'
import { nearestFrameIdx } from './helpers'
import { ItemTagsPanel } from '@/components/workspace/ItemTagsPanel'

import './tokens.css'

const ACTIVE_LIMIT = 3

interface TabDescriptor {
  key: string
  label: string
  format: PromptFormat
}

function buildPromptText(frame: VideoResultFrame, format: PromptFormat): string {
  if (isJsonFormat(format)) return renderJsonForFrame(frame)
  return renderTemplate(format.template, frame)
}

function formatSec(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m.toString().padStart(2, '0')}:${r.toString().padStart(2, '0')}`
}

export default function VideoResultPage() {
  const { workspaceId = '', itemId = '' } = useParams<{ workspaceId: string; itemId: string }>()
  const navigate = useNavigate()

  // 合并 loading/result/error 到单一 state，避免在 effect 内多次 setState 触发级联渲染
  type FetchState =
    | { kind: 'loading' }
    | { kind: 'ready'; data: VideoResult }
    | { kind: 'error'; message: string }
  const [fetchState, setFetchState] = useState<FetchState>({ kind: 'loading' })

  const [currentSec, setCurrentSec] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [promptStyle, setPromptStyle] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const [favored, setFavored] = useState<Record<number, boolean>>({})

  // 提示词格式配置（异步加载；失败时 tabs 退化为内置 fallback）
  const [formatsCfg, setFormatsCfg] = useState<PromptFormatsConfig | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerSelection, setPickerSelection] = useState<string[]>([])
  const [promptVersions, setPromptVersions] = useState<PromptVersion[]>([])

  const videoRef = useRef<HTMLVideoElement>(null)

  // 拉提示词格式配置；失败容忍（result 页仍可看，只是 tabs 用 fallback）
  useEffect(() => {
    let cancelled = false
    getPromptFormatsConfig()
      .then((data) => {
        if (!cancelled) setFormatsCfg(data)
      })
      .catch(() => {
        // 静默：UI 用 fallback
      })
    return () => {
      cancelled = true
    }
  }, [])

  // 拉视频结果 + 提示词版本（合并为单个 effect 避免重复 cleanup）
  useEffect(() => {
    let cancelled = false
    getItemResult(workspaceId, itemId)
      .then((data) => {
        if (!cancelled) setFetchState({ kind: 'ready', data })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const message = err instanceof Error ? err.message : '加载视频结果失败'
        setFetchState({ kind: 'error', message })
      })
    listPromptVersions(workspaceId, itemId)
      .then((data) => {
        if (!cancelled) setPromptVersions(data)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [workspaceId, itemId])

  const result = fetchState.kind === 'ready' ? fetchState.data : null
  const frames = useMemo(() => result?.frames ?? [], [result])
  const transcript = useMemo(() => result?.transcript ?? [], [result])
  const totalSec = result?.tracks_meta.total_sec ?? 0

  // currentSec → activeFrame 派生（避免在 effect 里 setState 产生级联渲染）
  const activeFrame = useMemo(() => {
    if (!frames.length) return 0
    return nearestFrameIdx(frames, currentSec)
  }, [frames, currentSec])

  const frame: VideoResultFrame | null = frames[activeFrame] ?? null

  // 构造 tabs：active_image_ids 对应 format + JSON 永远附加在末尾
  const tabs = useMemo<TabDescriptor[]>(() => {
    const formats = formatsCfg?.formats ?? []
    const imageFormats = formats.filter((f) => f.category === 'image')
    if (!imageFormats.length) {
      // fallback：未拉到配置时给两个最小 tabs，避免页面空白
      return []
    }
    const idMap = new Map(imageFormats.map((f) => [f.id, f]))
    const active = formatsCfg?.active_image_ids ?? []
    const picked: PromptFormat[] = []
    for (const id of active) {
      const fmt = idMap.get(id)
      if (fmt && !isJsonFormat(fmt) && !picked.find((p) => p.id === fmt.id)) {
        picked.push(fmt)
      }
    }
    // 不足 ACTIVE_LIMIT 时补齐（非 JSON 优先按 formats 顺序）
    if (picked.length < ACTIVE_LIMIT) {
      for (const fmt of imageFormats) {
        if (picked.length >= ACTIVE_LIMIT) break
        if (isJsonFormat(fmt)) continue
        if (!picked.find((p) => p.id === fmt.id)) picked.push(fmt)
      }
    }
    const jsonFmt = imageFormats.find((f) => isJsonFormat(f))
    const built: TabDescriptor[] = picked.slice(0, ACTIVE_LIMIT).map((f) => ({
      key: f.id,
      label: f.name,
      format: f,
    }))
    if (jsonFmt) {
      built.push({ key: jsonFmt.id, label: jsonFmt.name, format: jsonFmt })
    }
    return built
  }, [formatsCfg])

  // promptStyle 没匹配上时由 activeTab fallback 选第一个 tab；
  // 不在 effect 里 setState，避免级联渲染。
  const activeTab = tabs.find((t) => t.key === promptStyle) ?? tabs[0]
  const promptText = useMemo(() => {
    if (!frame || !activeTab) return ''
    return buildPromptText(frame, activeTab.format)
  }, [frame, activeTab])

  // 视频 timeupdate → currentSec → 自动找最近帧
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const onTime = () => setCurrentSec(v.currentTime)
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    v.addEventListener('timeupdate', onTime)
    v.addEventListener('play', onPlay)
    v.addEventListener('pause', onPause)
    return () => {
      v.removeEventListener('timeupdate', onTime)
      v.removeEventListener('play', onPlay)
      v.removeEventListener('pause', onPause)
    }
  }, [result])

  // 没有真实 video 元素可播放时，由 setInterval 推动 currentSec（demo fallback）
  const hasVideoSource = !!result?.video.url
  useEffect(() => {
    if (hasVideoSource) return
    if (!playing) return
    if (!frames.length) return
    const id = window.setInterval(() => {
      setCurrentSec((s) => {
        const next = s + 1
        if (next >= totalSec) {
          setPlaying(false)
          return totalSec
        }
        return next
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [hasVideoSource, playing, frames.length, totalSec])

  // 跳到指定秒
  const seekTo = useCallback(
    (sec: number) => {
      const clamped = Math.max(0, Math.min(totalSec, sec))
      const v = videoRef.current
      if (v && hasVideoSource) {
        v.currentTime = clamped
      }
      setCurrentSec(clamped)
    },
    [hasVideoSource, totalSec],
  )

  const togglePlay = useCallback(() => {
    const v = videoRef.current
    if (v && hasVideoSource) {
      if (v.paused) v.play().catch(() => {})
      else v.pause()
      return
    }
    setPlaying((p) => !p)
  }, [hasVideoSource])

  const setRate = useCallback(
    (delta: number) => {
      const v = videoRef.current
      if (!v) return
      const next = delta > 0 ? Math.min(4, v.playbackRate * 2) : Math.max(0.25, v.playbackRate / 2)
      v.playbackRate = next
      toast.info(`播放速度 ×${next}`)
    },
    [],
  )

  const handleCopy = useCallback(() => {
    if (!promptText) return
    navigator.clipboard?.writeText(promptText).catch(() => {})
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }, [promptText])

  const handleFavorite = useCallback(() => {
    if (!frame) return
    setFavored((prev) => {
      const next = !prev[activeFrame]
      console.log('[Phase 1G] favorite frame', {
        workspaceId,
        itemId,
        idx: activeFrame,
        ts: frame.ts,
        favored: next,
      })
      toast.success(next ? `已收藏帧 ${frame.ts}` : `已取消收藏 ${frame.ts}`)
      return { ...prev, [activeFrame]: next }
    })
  }, [frame, activeFrame, workspaceId, itemId])

  /* N11: 导出功能 UI 隐藏（代码保留，见 SPEC §8.2）
  const handleExport = useCallback(async () => {
    try {
      await downloadExport(workspaceId, itemId)
      toast.success('工作包已下载')
    } catch (err) {
      toast.error('导出失败：' + (err instanceof Error ? err.message : '未知'))
    }
  }, [workspaceId, itemId])
  */

  const handleAddPromptVersion = useCallback(async (content: string) => {
    const pv = await addPromptVersion(workspaceId, itemId, content)
    setPromptVersions((prev) => [...prev, pv])
    toast.success(`已保存 v${pv.version}`)
  }, [workspaceId, itemId])

  const openPicker = useCallback(() => {
    if (!formatsCfg) return
    setPickerSelection(
      tabs.filter((t) => !isJsonFormat(t.format)).map((t) => t.key),
    )
    setPickerOpen(true)
  }, [formatsCfg, tabs])

  const togglePickerId = useCallback((id: string) => {
    setPickerSelection((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id)
      if (cur.length >= ACTIVE_LIMIT) {
        toast.error(`最多选 ${ACTIVE_LIMIT} 个`)
        return cur
      }
      return [...cur, id]
    })
  }, [])

  const savePicker = useCallback(async () => {
    if (!formatsCfg) return
    if (pickerSelection.length !== ACTIVE_LIMIT) {
      toast.error(`请选满 ${ACTIVE_LIMIT} 个`)
      return
    }
    try {
      const saved = await savePromptFormatsConfig({
        active_image_ids: pickerSelection,
      })
      setFormatsCfg(saved)
      setPickerOpen(false)
      toast.success('已更新提示词格式 tabs')
    } catch (err) {
      toast.error('保存失败：' + (err instanceof Error ? err.message : '未知'))
    }
  }, [formatsCfg, pickerSelection])

  const jumpFrame = useCallback(
    (delta: number) => {
      if (!frames.length) return
      const nextIdx = Math.max(0, Math.min(frames.length - 1, activeFrame + delta))
      const nf = frames[nextIdx]
      seekTo(nf.sec)
    },
    [frames, activeFrame, seekTo],
  )

  // v1.1 §5.4 键盘快捷键
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return
      if (e.code === 'Space') {
        e.preventDefault()
        togglePlay()
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault()
        if (e.shiftKey) jumpFrame(-1)
        else seekTo(currentSec - 5)
      } else if (e.code === 'ArrowRight') {
        e.preventDefault()
        if (e.shiftKey) jumpFrame(1)
        else seekTo(currentSec + 5)
      } else if (e.key === '[') {
        setRate(-1)
      } else if (e.key === ']') {
        setRate(1)
      } else if (e.key === 'c' || e.key === 'C') {
        handleCopy()
      } else if (e.key === 'f' || e.key === 'F') {
        handleFavorite()
      } else if (e.key >= '1' && e.key <= '9') {
        const idx = parseInt(e.key, 10) - 1
        if (idx < tabs.length) setPromptStyle(tabs[idx].key)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [togglePlay, jumpFrame, seekTo, currentSec, setRate, handleCopy, handleFavorite, tabs])

  if (fetchState.kind === 'loading') {
    return (
      <div className="vm-video-result-scope" style={{ height: '100%', display: 'grid', placeItems: 'center' }}>
        <span className="mono" style={{ color: 'var(--ink-3)' }}>加载视频结果…</span>
      </div>
    )
  }
  if (fetchState.kind === 'error' || !result || !frame) {
    return (
      <div
        className="vm-video-result-scope"
        style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}
      >
        <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
          {fetchState.kind === 'error' ? fetchState.message : '没有可显示的视频结果'}
        </span>
        <button className="btn-ghost" style={{ padding: '6px 12px' }} onClick={() => navigate(-1)}>
          <ArrowLeft size={14} /> 返回
        </button>
      </div>
    )
  }

  const progress = totalSec > 0 ? Math.min(1, currentSec / totalSec) : 0

  return (
    <div
      className="vm-video-result-scope"
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 320px',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* ════════ 左：播放器 + 三轨 ════════ */}
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
            <ArrowLeft size={13} /> 任务中心
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
            {result.video.title}
          </span>
          <span className="kw mono" style={{ fontSize: 10, flexShrink: 0 }}>
            VIDEO · {result.video.duration_str || formatSec(totalSec)}
          </span>
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
          {/* N11: 导出工作包入口隐藏（代码保留，见 SPEC §8.2）
          <button
            className="btn-ghost"
            onClick={handleExport}
            title="导出复刻工作包 (.zip)"
            style={{ height: 28, padding: '0 10px', fontSize: 12, flexShrink: 0 }}
          >
            <Download size={13} /> 导出
          </button>
          */}
        </div>

        {/* 标签展示 */}
        <div style={{ padding: '10px 20px 0', flexShrink: 0 }}>
          <ItemTagsPanel workspaceId={workspaceId} itemId={itemId} />
        </div>

        {/* 播放器 */}
        <div style={{ padding: '14px 20px 10px', flexShrink: 0 }}>
          <div
            onClick={togglePlay}
            style={{
              position: 'relative',
              borderRadius: 16,
              overflow: 'hidden',
              cursor: 'pointer',
              background: `linear-gradient(135deg, var(--accent), var(--accent-2))`,
              aspectRatio: '16/9',
              maxHeight: 260,
            }}
          >
            {hasVideoSource ? (
              <video
                ref={videoRef}
                src={result.video.url}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                preload="metadata"
              />
            ) : (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'grid',
                  placeItems: 'center',
                  color: 'rgba(255,255,255,0.92)',
                  fontFamily: 'var(--display)',
                  fontSize: 28,
                  letterSpacing: '-0.01em',
                  textAlign: 'center',
                  padding: 24,
                }}
              >
                {frame.title}
              </div>
            )}

            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                padding: '14px 16px',
                background: 'linear-gradient(0deg,rgba(0,0,0,0.78) 0%,transparent)',
              }}
            >
              <div className="mono" style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>
                {frame.ts} · {frame.shot_type}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginTop: 2 }}>
                {frame.title}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 1 }}>
                {frame.subtitle}
              </div>
            </div>

            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%,-50%)',
                width: 48,
                height: 48,
                borderRadius: 99,
                background: 'rgba(255,255,255,0.9)',
                display: 'grid',
                placeItems: 'center',
                color: '#000',
              }}
            >
              {playing ? <Pause size={18} /> : <Play size={18} />}
            </div>

            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: 3,
                background: 'rgba(255,255,255,0.15)',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${progress * 100}%`,
                  background: 'var(--accent)',
                  transition: 'width 200ms linear',
                }}
              />
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 8,
            }}
          >
            <span className="mono" style={{ fontSize: 10, color: 'var(--ink-4)' }}>
              {formatSec(currentSec)} / {formatSec(totalSec)}
            </span>
            <span className="mono" style={{ fontSize: 10, color: 'var(--ink-4)' }}>
              快捷键：Space 播放 · ←/→ ±5s · Shift+←/→ 切镜头 · C 复制 · F 收藏 · 1/2/3 切格式
            </span>
          </div>
        </div>

        {/* 三轨 */}
        <TripleTrack
          frames={frames}
          transcript={transcript}
          activeFrame={activeFrame}
          currentSec={currentSec}
          onFrameClick={(idx) => seekTo(frames[idx].sec)}
          onTranscriptClick={(l) => seekTo(l.t_sec)}
        />
      </div>

      {/* ════════ 右：当前帧浮动面板 ════════ */}
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
            position: 'relative',
            flexShrink: 0,
            aspectRatio: '16/9',
            background: `linear-gradient(135deg, var(--accent-2), var(--accent-3))`,
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
              color: 'rgba(255,255,255,0.92)',
              fontFamily: 'var(--display)',
              fontSize: 22,
              padding: 16,
              textAlign: 'center',
            }}
          >
            {frame.title}
          </div>
          <div
            className="mono"
            style={{
              position: 'absolute',
              bottom: 8,
              left: 10,
              fontSize: 9,
              color: 'rgba(255,255,255,0.85)',
              background: 'rgba(0,0,0,0.55)',
              padding: '2px 7px',
              borderRadius: 5,
            }}
          >
            {frame.ts} · {frame.shot_type}
          </div>
          {favored[activeFrame] && (
            <div style={{ position: 'absolute', top: 8, right: 10 }}>
              <Star size={16} fill="var(--accent-warm)" color="var(--accent-warm)" />
            </div>
          )}
        </div>

        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3 }}>{frame.title}</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{frame.subtitle}</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
            {Object.values(frame.tags ?? {})
              .flat()
              .slice(0, 6)
              .map((t) => (
                <span key={t} className="kw" style={{ fontSize: 10 }}>
                  {t}
                </span>
              ))}
          </div>
        </div>

        {/* tabs */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '8px 12px',
            borderBottom: '1px solid var(--line)',
            flexShrink: 0,
            background: 'var(--bg-sunken)',
          }}
        >
          <span className="eyebrow" style={{ flex: 1 }}>提示词格式</span>
          <button
            onClick={openPicker}
            title="选择 3 个图片类格式作为 tabs（JSON 自动附加）"
            style={{
              height: 26,
              padding: '0 8px',
              borderRadius: 6,
              fontSize: 10,
              fontFamily: 'var(--mono)',
              border: '1px solid var(--line)',
              background: 'transparent',
              color: 'var(--ink-3)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Settings2 size={11} /> 选择
          </button>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '6px 12px 8px',
            borderBottom: '1px solid var(--line)',
            flexShrink: 0,
            background: 'var(--bg-sunken)',
            overflowX: 'auto',
          }}
        >
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setPromptStyle(t.key)}
              style={{
                height: 26,
                padding: '0 10px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 700,
                fontFamily: 'var(--mono)',
                border: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                background: promptStyle === t.key ? 'var(--ink)' : 'transparent',
                color: promptStyle === t.key ? 'var(--bg)' : 'var(--ink-3)',
              }}
            >
              {t.label}
            </button>
          ))}
          {!tabs.length && (
            <span className="mono" style={{ fontSize: 10, color: 'var(--ink-4)' }}>
              （提示词格式未加载）
            </span>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
          <div
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 11.5,
              lineHeight: 1.72,
              background: 'var(--bg-sunken)',
              padding: '12px 13px',
              borderRadius: 12,
              border: '1px solid var(--line)',
              color: 'var(--ink)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {promptText}
          </div>

          {/* 提示词版本栈 */}
          <div style={{ marginTop: 14 }}>
            <PromptVersionStack
              versions={promptVersions}
              onAddVersion={handleAddPromptVersion}
            />
          </div>
        </div>

        <div
          style={{
            padding: '10px 12px',
            borderTop: '1px solid var(--line)',
            display: 'flex',
            flexDirection: 'column',
            gap: 7,
            flexShrink: 0,
          }}
        >
          <button
            onClick={handleCopy}
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
              border: 'none',
              background: 'var(--ink)',
              color: 'var(--bg)',
            }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? '已复制！' : '一键复制提示词'}
          </button>
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
              background: favored[activeFrame] ? 'rgba(255,184,76,0.12)' : 'var(--bg-sunken)',
              color: favored[activeFrame] ? 'var(--accent-warm)' : 'var(--ink-2)',
            }}
          >
            <Star
              size={14}
              fill={favored[activeFrame] ? 'var(--accent-warm)' : 'none'}
              color={favored[activeFrame] ? 'var(--accent-warm)' : 'currentColor'}
            />
            {favored[activeFrame] ? '已收藏此帧 ★' : '收藏此帧'}
          </button>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="mono" style={{ fontSize: 10, color: 'var(--ink-4)' }}>
              帧 {activeFrame + 1} / {frames.length} · {frame.shot_type}
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                className="btn-ghost"
                style={{ width: 26, height: 26, padding: 0, display: 'grid', placeItems: 'center' }}
                onClick={() => jumpFrame(-1)}
                title="上一帧 (Shift+←)"
              >
                ‹
              </button>
              <button
                className="btn-ghost"
                style={{ width: 26, height: 26, padding: 0, display: 'grid', placeItems: 'center' }}
                onClick={() => jumpFrame(1)}
                title="下一帧 (Shift+→)"
              >
                ›
              </button>
            </div>
          </div>
        </div>
      </div>

      {pickerOpen && formatsCfg && (
        <FormatPicker
          allFormats={formatsCfg.formats.filter(
            (f) => f.category === 'image' && !isJsonFormat(f),
          )}
          selection={pickerSelection}
          onToggle={togglePickerId}
          onCancel={() => setPickerOpen(false)}
          onSave={savePicker}
        />
      )}
    </div>
  )
}

interface FormatPickerProps {
  allFormats: PromptFormat[]
  selection: string[]
  onToggle: (id: string) => void
  onCancel: () => void
  onSave: () => void
}

function FormatPicker({ allFormats, selection, onToggle, onCancel, onSave }: FormatPickerProps) {
  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        zIndex: 50,
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-elev)',
          border: '1px solid var(--line)',
          borderRadius: 14,
          padding: 18,
          width: 420,
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>选择 3 个图片类格式</div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>
            JSON 永远附加在末尾，不在此处枚举。已选 {selection.length} / 3。
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {allFormats.map((f) => {
            const checked = selection.includes(f.id)
            const index = checked ? selection.indexOf(f.id) + 1 : null
            return (
              <label
                key={f.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: `1px solid ${checked ? 'var(--accent)' : 'var(--line)'}`,
                  cursor: 'pointer',
                  background: checked ? 'rgba(255,77,126,0.08)' : 'transparent',
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(f.id)}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {f.name}
                    {index !== null && (
                      <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--accent)' }}>
                        #{index}
                      </span>
                    )}
                  </div>
                  {f.description && (
                    <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
                      {f.description}
                    </div>
                  )}
                </div>
              </label>
            )
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn-ghost" style={{ padding: '6px 12px' }} onClick={onCancel}>
            取消
          </button>
          <button
            onClick={onSave}
            disabled={selection.length !== 3}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              border: 'none',
              cursor: selection.length === 3 ? 'pointer' : 'not-allowed',
              background: selection.length === 3 ? 'var(--ink)' : 'var(--bg-sunken)',
              color: selection.length === 3 ? 'var(--bg)' : 'var(--ink-4)',
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
