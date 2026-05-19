import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import {
  Link2, Upload, Search, X, Check, Plus, ArrowRight,
  Download, Film, Mic, Eye, Cpu, Wand2, Layers,
} from 'lucide-react'
import { toast } from 'sonner'
import type { PipelineStep, QualityOption, FrameMode } from './types'
import type { WorkspaceRecord } from '@/types/workspace'
import { detectPlatform } from './platforms'
import { listWorkspaces, createWorkspace } from '@/services/workspaces'
import { useProviderStore } from '@/store/providerStore'
import { useTaskStore } from '@/store/taskStore'
import { createPipelineTask } from '@/services/pipeline'

const PIPE_STEPS: PipelineStep[] = [
  { n: '1', t: '下载',   s: 'Download',  tone: null,     defaultOn: true  },
  { n: '2', t: '抽帧',   s: 'Frames',    tone: null,     defaultOn: true  },
  { n: '3', t: '转录',   s: 'ASR',       tone: 'pink',   defaultOn: true  },
  { n: '4', t: '视觉',   s: 'VLM',       tone: 'purple', defaultOn: true  },
  { n: '5', t: '结构化', s: 'Summarize', tone: 'blue',   defaultOn: true  },
  { n: '6', t: '分镜',   s: 'Storyboard',tone: 'amber',  defaultOn: false },
  { n: '7', t: '切片',   s: 'Clips',     tone: null,     defaultOn: false },
]

const STEP_ICONS = [Download, Film, Mic, Eye, Cpu, Wand2, Layers]

const QUALITY_OPTS: QualityOption[] = ['最高画质', '1080p', '720p', '仅音频']

const WS_COLORS = [
  '#22c55e', '#f59e0b', '#a855f7', '#0ea5e9',
  '#ef4444', '#ec4899', '#14b8a6', '#eab308',
]

const STEP_BACKEND_MAP: Record<string, string> = {
  '下载': 'download',
  '抽帧': 'analyze',
  '转录': 'transcribe',
  '视觉': 'analyze',
  '结构化': 'note',
  '分镜': 'storyboard',
}

interface ComposerProps {
  onTaskCreated?: () => void
}

export function Composer({ onTaskCreated }: ComposerProps) {
  const [url, setUrl] = useState('')
  const [steps, setSteps] = useState(() => PIPE_STEPS.map((s) => s.defaultOn))
  const [quality, setQuality] = useState<QualityOption>('1080p')
  const [frameMode, setFrameMode] = useState<FrameMode>('A')
  const [fps, setFps] = useState(2)
  const [maxFrames, setMaxFrames] = useState(128)
  const [submitting, setSubmitting] = useState(false)

  const [workspaces, setWorkspaces] = useState<WorkspaceRecord[]>([])
  const [workspaceSel, setWorkspaceSel] = useState<string[]>([])
  const [wsOpen, setWsOpen] = useState(false)
  const [wsQuery, setWsQuery] = useState('')

  const popRef = useRef<HTMLDivElement>(null)

  const { providers, providerModels, fetchProviders } = useProviderStore()
  const addTask = useTaskStore((s) => s.addTask)

  // Fetch workspaces on mount
  useEffect(() => {
    listWorkspaces().then(setWorkspaces).catch(() => {})
  }, [])

  // Fetch providers on mount
  useEffect(() => {
    fetchProviders()
  }, [fetchProviders])

  useEffect(() => {
    if (!wsOpen) return
    const handler = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setWsOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [wsOpen])

  const wsById = useMemo(
    () => Object.fromEntries(workspaces.map((w) => [w.workspace_id, w])),
    [workspaces],
  )

  const filteredWs = wsQuery
    ? workspaces.filter((w) => w.name.toLowerCase().includes(wsQuery.toLowerCase()))
    : workspaces

  // Build model options from providerStore
  const { asrOpts, visionOpts, textOpts } = useMemo(() => {
    const asr: { label: string; value: string }[] = []
    const vision: { label: string; value: string }[] = []
    const text: { label: string; value: string }[] = []
    for (const p of providers) {
      if (!p.enabled) continue
      const models = providerModels[p.id]
      if (!models?.length) continue
      const caps = p.capabilities ?? []
      for (const m of models) {
        const entry = { label: m.name, value: m.id }
        if (caps.includes('asr') || caps.includes('audio')) asr.push(entry)
        if (caps.includes('vision')) vision.push(entry)
        if (caps.includes('chat') || caps.includes('text')) text.push(entry)
      }
    }
    return { asrOpts: asr, visionOpts: vision, textOpts: text }
  }, [providers, providerModels])

  const toggleWs = useCallback((id: string) =>
    setWorkspaceSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id])), [])

  const removeWs = useCallback((id: string) =>
    setWorkspaceSel((s) => s.filter((x) => x !== id)), [])

  const handleNewWorkspace = useCallback(async () => {
    const name = wsQuery.trim() || '新工作空间'
    try {
      const created = await createWorkspace({ name })
      setWorkspaces((prev) => [...prev, created])
      setWorkspaceSel((s) => [...s, created.workspace_id])
      setWsQuery('')
      toast.success(`工作空间「${name}」已创建`)
    } catch {
      toast.error('创建工作空间失败')
    }
  }, [wsQuery])

  const platform = detectPlatform(url)
  const isMixed = platform !== null && platform.types.length > 1
  const showQualityRow = !platform || platform.types.includes('video')

  const toggle = (i: number) =>
    setSteps((ss) => ss.map((v, j) => (j === i ? !v : v)))

  const handleRun = async () => {
    if (!url.trim()) return
    setSubmitting(true)
    try {
      const activeSteps = PIPE_STEPS
        .filter((_, i) => steps[i])
        .map((s) => STEP_BACKEND_MAP[s.t])
        .filter(Boolean)
      const uniqueSteps = [...new Set(activeSteps)]

      const res = await createPipelineTask({
        project_id: crypto.randomUUID(),
        task_type: 'analyze',
        payload: { url: url.trim() },
        steps: uniqueSteps.length ? uniqueSteps : undefined,
      })

      addTask({
        task_id: res.task_id,
        project_id: '',
        task_type: 'analyze',
        payload: { url: url.trim() },
        status: 'PENDING',
        progress: 0,
        log: [],
        result: {},
        error: '',
        retry_of: '',
        cancel_requested: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      toast.success('任务已创建', { description: url.trim() })
      setUrl('')
      onTaskCreated?.()
    } catch {
      toast.error('创建任务失败，请检查后端连接')
    } finally {
      setSubmitting(false)
    }
  }

  const metaText =
    frameMode === 'A'
      ? `按秒截帧 ${fps}s · ≤${maxFrames}帧`
      : 'AI 镜头分析模式'

  return (
    <div className="composer">
      {/* URL row */}
      <div className="composer-url">
        {platform ? (
          <div
            className="platform"
            style={{ background: platform.color, color: '#fff', width: 'auto', padding: '0 10px' }}
          >
            {platform.name}
          </div>
        ) : (
          <div className="platform">
            <Link2 size={18} />
          </div>
        )}

        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="粘贴 B站 / YouTube / 小红书 / 抖音 / 本地文件路径..."
        />

        {platform && (
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            {platform.types.map((t) => (
              <span key={t} className="kw" style={{ background: 'var(--bg-sunken)', fontSize: 11 }}>
                {t}
              </span>
            ))}
          </div>
        )}

        <button className="btn btn-ghost" title="上传本地文件" style={{ gap: 6 }}>
          <Upload size={15} />
          上传
        </button>
      </div>

      {/* Workspace assignment row */}
      <div className="composer-projects">
        <span className="pp-label">归入工作空间</span>

        {workspaceSel.length === 0 && <span className="pp-none">不归入 · 可选</span>}

        {workspaceSel.map((id) => {
          const ws = wsById[id]
          if (!ws) return null
          const color = WS_COLORS[Math.abs(id.charCodeAt(0)) % WS_COLORS.length]
          return (
            <span key={id} className="pp-chip">
              <span className="pp-dot" style={{ background: color }} />
              {ws.name}
              <button className="pp-x" onClick={() => removeWs(id)} title="移除">
                <X size={11} />
              </button>
            </span>
          )
        })}

        <button className="pp-add" onClick={() => setWsOpen((o) => !o)}>
          <Layers size={11} />
          {workspaceSel.length ? '继续添加' : '选择工作空间'}
        </button>

        <span
          style={{
            marginLeft: 'auto',
            fontSize: 10,
            color: 'var(--ink-4)',
            fontFamily: 'var(--mono)',
          }}
          title="一个内容可同时归入多个工作空间"
        >
          可多选 · 一个内容可归入多个空间
        </span>

        {wsOpen && (
          <div className="pp-popover" ref={popRef}>
            <div className="pp-search">
              <Search size={14} />
              <input
                autoFocus
                placeholder="搜索工作空间..."
                value={wsQuery}
                onChange={(e) => setWsQuery(e.target.value)}
              />
              {workspaceSel.length > 0 && (
                <button
                  className="btn btn-ghost"
                  onClick={() => setWorkspaceSel([])}
                  style={{ height: 24, padding: '0 8px', fontSize: 11 }}
                >
                  清空
                </button>
              )}
            </div>

            <div className="pp-list">
              {filteredWs.length === 0 && (
                <div
                  style={{
                    padding: '18px 12px',
                    textAlign: 'center',
                    fontSize: 12,
                    color: 'var(--ink-4)',
                    fontFamily: 'var(--mono)',
                  }}
                >
                  无匹配工作空间
                </div>
              )}
              {filteredWs.map((ws) => {
                const on = workspaceSel.includes(ws.workspace_id)
                const color = WS_COLORS[Math.abs(ws.workspace_id.charCodeAt(0)) % WS_COLORS.length]
                return (
                  <div
                    key={ws.workspace_id}
                    className="pp-row"
                    data-on={on}
                    onClick={() => toggleWs(ws.workspace_id)}
                  >
                    <span className="pp-check">
                      <Check size={11} strokeWidth={3} />
                    </span>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 99,
                        background: color,
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div className="pp-name">{ws.name}</div>
                    </div>
                    <span className="pp-count">{ws.items.length} 项</span>
                  </div>
                )
              })}
            </div>

            <div className="pp-foot">
              <button
                className="pp-new"
                onClick={handleNewWorkspace}
              >
                <Plus size={11} />
                新建工作空间{wsQuery ? ` "${wsQuery}"` : ''}
              </button>
              <button className="pp-done" onClick={() => setWsOpen(false)}>
                完成
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Quality / frame mode row */}
      {showQualityRow && (
        <div className="composer-quality">
          <span className="q-label">画质</span>
          <div className="tw-segm">
            {QUALITY_OPTS.map((q) => (
              <button key={q} data-active={quality === q} onClick={() => setQuality(q)}>
                {q}
              </button>
            ))}
          </div>

          <span className="seg-divider" />

          <span className="q-label">抽帧</span>
          {(['A', 'B'] as FrameMode[]).map((m) => (
            <button
              key={m}
              className="tw-segm"
              data-active={frameMode === m}
              onClick={() => setFrameMode(m)}
              style={{
                height: 28,
                padding: '0 10px',
                fontSize: 11,
                borderRadius: 7,
                border: 'none',
                background: frameMode === m ? 'var(--ink)' : 'transparent',
                color: frameMode === m ? 'var(--bg)' : 'var(--ink-3)',
                cursor: 'pointer',
              }}
            >
              {m === 'A' ? 'A: 按秒截帧' : 'B: AI 镜头分析'}
            </button>
          ))}

          {frameMode === 'A' && (
            <>
              <span className="q-unit">每</span>
              <input
                type="number"
                min={1}
                max={60}
                value={fps}
                onChange={(e) => setFps(Number(e.target.value))}
              />
              <span className="q-unit">秒 · 上限</span>
              <input
                type="number"
                className="wide"
                min={16}
                max={512}
                value={maxFrames}
                onChange={(e) => setMaxFrames(Number(e.target.value))}
              />
              <span className="q-unit">帧</span>
            </>
          )}
        </div>
      )}

      {/* LLM options 4-column */}
      <div className="composer-options">
        <div className="opt-cell">
          <div className="opt-label">ASR</div>
          <div className="opt-value">
            {asrOpts.length > 0 ? (
              <select>
                {asrOpts.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            ) : (
              <span style={{ color: 'var(--ink-4)', fontSize: 13 }}>未配置</span>
            )}
          </div>
        </div>
        <div className="opt-cell">
          <div className="opt-label">视觉 LLM</div>
          <div className="opt-value">
            {visionOpts.length > 0 ? (
              <select>
                {visionOpts.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            ) : (
              <span style={{ color: 'var(--ink-4)', fontSize: 13 }}>未配置</span>
            )}
          </div>
        </div>
        <div className="opt-cell">
          <div className="opt-label">文本 LLM</div>
          <div className="opt-value">
            {textOpts.length > 0 ? (
              <select>
                {textOpts.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            ) : (
              <span style={{ color: 'var(--ink-4)', fontSize: 13 }}>未配置</span>
            )}
          </div>
        </div>
        <div className="opt-cell">
          <div className="opt-label">提示词风格</div>
          <div className="opt-value">
            Midjourney · 双语 <ArrowRight size={12} />
          </div>
        </div>
      </div>

      {/* Pipeline pills */}
      <div className="composer-pipeline">
        <span className="pipe-label">Pipeline</span>
        {PIPE_STEPS.map((step, i) => {
          const Icon = STEP_ICONS[i]
          return (
            <button
              key={i}
              className="step-pill"
              data-on={steps[i]}
              data-tone={step.tone ?? undefined}
              onClick={() => toggle(i)}
            >
              <span className="spn">{step.n}</span>
              <Icon size={14} />
              {step.t}
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10, opacity: 0.5 }}>
                {step.s}
              </span>
            </button>
          )
        })}
      </div>

      {/* Run row */}
      <div className="composer-run">
        <div className="meta">
          <span className="chip">
            <span className="chip-dot" />
            预计 ~ 4 min
          </span>
          <span style={{ opacity: 0.5 }}>·</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{metaText}</span>
        </div>
        <button className="wb-btn-run" onClick={handleRun} disabled={submitting || !url.trim()}>
          {submitting ? '创建中...' : isMixed ? '选择内容类型' : '开始解析'}
          <span className="iconwrap">
            <ArrowRight size={14} />
          </span>
        </button>
      </div>
    </div>
  )
}
