import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, BookOpen, Clapperboard, Download, MessageSquare } from 'lucide-react'

import {
  type AudioResult,
  type ImageResult,
  type TextResult,
  type VideoResult,
  downloadExport,
  getAudioItemResult,
  getImageResult,
  getItemResult,
  getTextItemResult,
  getWorkspace,
} from '@/services/workspaces'
import {
  type ItemType,
  type WorkspaceItem,
  type WorkspaceRecord,
  ITEM_TYPE_TEXT,
} from '@/types/workspace'
import { ItemTagsPanel } from '@/components/workspace/ItemTagsPanel'

import '../tokens.css'
import './overview.css'

/** type → detail 页路由后缀 */
const DETAIL_ROUTE: Record<ItemType, string> = {
  video: 'video_detail',
  audio: 'audio_detail',
  image: 'image_detail',
  text: 'text_detail',
}

type ItemResult = VideoResult | AudioResult | ImageResult | TextResult

type PageState =
  | { kind: 'loading' }
  | { kind: 'ready'; workspace: WorkspaceRecord; item: WorkspaceItem; result: ItemResult }
  | { kind: 'error'; message: string }

function formatSec(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m.toString().padStart(2, '0')}:${r.toString().padStart(2, '0')}`
}

/** 从 result 中提取摘要文本（按类型取不同字段） */
function extractSummary(itemType: ItemType, result: ItemResult): string | null {
  if (itemType === 'video') {
    const r = result as VideoResult
    // video result 没有直接的 summary 字段，取第一帧 description 作为摘要
    return r.frames?.[0]?.description ?? null
  }
  if (itemType === 'audio') {
    return (result as AudioResult).summary || null
  }
  if (itemType === 'text') {
    return (result as TextResult).summary || null
  }
  if (itemType === 'image') {
    return (result as ImageResult).description || null
  }
  return null
}

/** 从 result 中提取转录预览文本 */
function extractTranscriptPreview(itemType: ItemType, result: ItemResult): string {
  let lines: { text: string }[] = []
  if (itemType === 'video') {
    lines = (result as VideoResult).transcript ?? []
  } else if (itemType === 'audio') {
    const raw = (result as AudioResult).transcript
    if (Array.isArray(raw)) lines = raw
    else if (typeof raw === 'string') return raw.slice(0, 500)
  }
  if (!lines.length) return ''
  const full = lines.map((l) => l.text).join('\n')
  return full.slice(0, 500)
}

/** 转录总段数 */
function extractTranscriptCount(itemType: ItemType, result: ItemResult): number {
  if (itemType === 'video') return (result as VideoResult).tracks_meta?.transcript_count ?? 0
  if (itemType === 'audio') return (result as AudioResult).tracks_meta?.transcript_count ?? 0
  if (itemType === 'text') return (result as TextResult).char_count ?? 0
  return 0
}

/** 时长（秒） */
function extractDuration(itemType: ItemType, result: ItemResult): number {
  if (itemType === 'video') return (result as VideoResult).tracks_meta?.total_sec ?? 0
  if (itemType === 'audio') return (result as AudioResult).tracks_meta?.total_sec ?? 0
  return 0
}

/** 关键帧数（仅视频） */
function extractFrameCount(result: VideoResult): number {
  return result.frames?.length ?? result.tracks_meta?.frame_count ?? 0
}

export default function ResultsOverview() {
  const { workspaceId = '', itemId = '' } = useParams<{ workspaceId: string; itemId: string }>()
  const navigate = useNavigate()
  const [pageState, setPageState] = useState<PageState>({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const ws = await getWorkspace(workspaceId)
        if (cancelled) return
        const item = ws.items.find((it) => it.item_id === itemId)
        if (!item) {
          setPageState({ kind: 'error', message: '素材不存在' })
          return
        }

        let result: ItemResult
        switch (item.type) {
          case 'video':
            result = await getItemResult(workspaceId, itemId)
            break
          case 'audio':
            result = await getAudioItemResult(workspaceId, itemId)
            break
          case 'image':
            result = await getImageResult(workspaceId, itemId)
            break
          case 'text':
            result = await getTextItemResult(workspaceId, itemId)
            break
          default:
            setPageState({ kind: 'error', message: `不支持的类型: ${item.type}` })
            return
        }
        if (cancelled) return
        setPageState({ kind: 'ready', workspace: ws, item, result })
      } catch (err: unknown) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : '加载结果失败'
        setPageState({ kind: 'error', message })
      }
    }

    load()
    return () => { cancelled = true }
  }, [workspaceId, itemId])

  const handleExport = async () => {
    try {
      await downloadExport(workspaceId, itemId)
    } catch {
      // downloadExport 内部已 toast
    }
  }

  // ── Loading ──
  if (pageState.kind === 'loading') {
    return (
      <div className="vm-overview-scope" style={{ height: '100%', display: 'grid', placeItems: 'center' }}>
        <span className="mono" style={{ color: 'var(--ink-3)' }}>加载结果总览…</span>
      </div>
    )
  }

  // ── Error ──
  if (pageState.kind === 'error') {
    return (
      <div className="vm-overview-scope" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{pageState.message}</span>
        <button className="btn-ghost" style={{ padding: '6px 12px' }} onClick={() => navigate(-1)}>
          <ArrowLeft size={14} /> 返回
        </button>
      </div>
    )
  }

  // ── Ready ──
  const { item, result } = pageState
  const itemType = item.type
  const title = item.name || (result as VideoResult).video?.title || (result as AudioResult).audio?.title || (result as TextResult).title || ITEM_TYPE_TEXT[itemType]
  const summary = extractSummary(itemType, result)
  const transcriptPreview = extractTranscriptPreview(itemType, result)
  const transcriptCount = extractTranscriptCount(itemType, result)
  const duration = extractDuration(itemType, result)
  const showTimeline = itemType === 'video' || itemType === 'audio'

  return (
    <div className="vm-overview-scope" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Nav bar */}
      <div className="ov-nav">
        <button className="btn-ghost" onClick={() => navigate(-1)}>
          <ArrowLeft size={13} /> 任务中心
        </button>
        <span className="ov-sep" />
        <span className="ov-title">{title}</span>
        <span className="kw mono" style={{ fontSize: 10, flexShrink: 0 }}>
          {ITEM_TYPE_TEXT[itemType].toUpperCase()}
          {duration > 0 && ` · ${formatSec(duration)}`}
        </span>
        <span
          className="ov-status-chip"
          style={{
            background: item.status === 'done' ? 'rgba(34, 211, 154, 0.12)' : 'var(--bg-sunken)',
            color: item.status === 'done' ? 'var(--accent-green)' : 'var(--ink-3)',
          }}
        >
          <span className="dot" style={{ background: item.status === 'done' ? 'var(--accent-green)' : 'var(--ink-4)' }} />
          {item.status === 'done' ? '完成' : item.status === 'processing' ? '处理中' : item.status}
        </span>
        {result.source === 'demo_fixture' && (
          <span className="mono" style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: 'var(--accent-warm)', color: '#fff', fontWeight: 600 }}>DEMO</span>
        )}
      </div>

      {/* Tags */}
      <div style={{ padding: '10px 20px 0', flexShrink: 0 }}>
        <ItemTagsPanel workspaceId={workspaceId} itemId={itemId} />
      </div>

      {/* Main content */}
      <div className="ov-main">
        {/* Summary card */}
        {summary && (
          <div className="ov-card">
            <div className="ov-card-head">
              <div>
                <div className="eyebrow">OVERVIEW · {ITEM_TYPE_TEXT[itemType]}</div>
                <h2 style={{ marginTop: 4 }}>内容摘要</h2>
              </div>
            </div>
            <div className="ov-summary-text">{summary}</div>
            {/* Stat row */}
            <div className="ov-stat-row">
              {duration > 0 && (
                <div className="ov-stat-cell">
                  <div className="label">时长</div>
                  <div className="value">{formatSec(duration)}</div>
                </div>
              )}
              {itemType === 'video' && (
                <div className="ov-stat-cell">
                  <div className="label">关键帧</div>
                  <div className="value">{extractFrameCount(result as VideoResult)}</div>
                </div>
              )}
              {transcriptCount > 0 && (
                <div className="ov-stat-cell">
                  <div className="label">{itemType === 'text' ? '字符数' : '转录段落'}</div>
                  <div className="value">{transcriptCount}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Timeline card (video / audio) */}
        {showTimeline && itemType === 'video' && (result as VideoResult).frames?.length > 0 && (
          <div className="ov-card">
            <div className="ov-card-head">
              <h2>时间轴</h2>
              <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>
                前 {Math.min(10, (result as VideoResult).frames.length)} 帧
              </span>
            </div>
            <div className="ov-timeline-strip">
              {(result as VideoResult).frames.slice(0, 10).map((f) => (
                <div key={f.idx} className="ov-tl-frame">
                  <div className="ov-tl-thumb">{f.ts}</div>
                  <div className="ov-tl-ts">{f.shot_type}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Transcript preview */}
        {transcriptPreview && (
          <div className="ov-card">
            <div className="ov-card-head">
              <h2>转录预览</h2>
              <button
                className="btn-ghost"
                style={{ fontSize: 11, height: 24, padding: '0 8px' }}
                onClick={() => navigate(`/workspaces/${workspaceId}/items/${itemId}/${DETAIL_ROUTE[itemType]}`)}
              >
                查看全部
              </button>
            </div>
            <div className="ov-transcript-preview">
              {transcriptPreview}
            </div>
          </div>
        )}

        {/* Action cards */}
        <div className="ov-actions">
          {/* 详情页 */}
          <div
            className="ov-action-card"
            onClick={() => navigate(`/workspaces/${workspaceId}/items/${itemId}/${DETAIL_ROUTE[itemType]}`)}
          >
            <div className="ov-action-icon">
              <BookOpen size={18} />
            </div>
            <div className="ov-action-text">
              <div className="title">{ITEM_TYPE_TEXT[itemType]}详情</div>
              <div className="desc">查看完整分析结果</div>
            </div>
          </div>

          {/* 分镜 */}
          <div
            className="ov-action-card"
            onClick={() => navigate(`/storyboard?workspace=${workspaceId}&item=${itemId}`)}
          >
            <div className="ov-action-icon">
              <Clapperboard size={18} />
            </div>
            <div className="ov-action-text">
              <div className="title">进入分镜</div>
              <div className="desc">生成分镜脚本</div>
            </div>
          </div>

          {/* LLM 对话 */}
          <div
            className="ov-action-card"
            onClick={() => navigate(`/workspaces/${workspaceId}?tab=chat`)}
          >
            <div className="ov-action-icon">
              <MessageSquare size={18} />
            </div>
            <div className="ov-action-text">
              <div className="title">LLM 对话</div>
              <div className="desc">与 AI 讨论内容</div>
            </div>
          </div>

          {/* 导出 */}
          <div className="ov-action-card" onClick={handleExport}>
            <div className="ov-action-icon">
              <Download size={18} />
            </div>
            <div className="ov-action-text">
              <div className="title">导出工作包</div>
              <div className="desc">下载分析结果</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
