import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Star } from 'lucide-react'
import { getWorkspace, getLnMarkdown, getItemResult, patchLnMarkdown } from '@/services/workspaces'
import type { VideoResultTranscriptLine } from '@/services/workspaces'
import type { WorkspaceRecord, WorkspaceItem } from '@/types/workspace'
import LNVideoPanel, { type LNVideoPanelHandle } from './LNVideoPanel'
import LNNotesPanel from './LNNotesPanel'
import LNTranscriptPanel from './LNTranscriptPanel'
import './learning-notes.css'

type PageState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; workspace: WorkspaceRecord; videoItem: WorkspaceItem; markdown: string; transcript: VideoResultTranscriptLine[] }

export default function LearningNotesPage() {
  const { workspaceId = '' } = useParams<{ workspaceId: string }>()
  const navigate = useNavigate()
  const [pageState, setPageState] = useState<PageState>({ kind: 'loading' })
  const [currentTime, setCurrentTime] = useState(0)
  const videoPanelRef = useRef<LNVideoPanelHandle>(null)

  // B-3: 可编辑的 markdown state
  const [markdown, setMarkdown] = useState('')

  // B-3: 视图偏好（localStorage 持久化）
  const [view, setView] = useState<'html' | 'md'>(() => {
    const saved = localStorage.getItem('ln-view')
    return saved === 'md' ? 'md' : 'html'
  })

  const switchView = useCallback((v: 'html' | 'md') => {
    // 切走前 blur 当前活动元素，flush HTML 视图的编辑
    ;(document.activeElement as HTMLElement | null)?.blur()
    setView(v)
    localStorage.setItem('ln-view', v)
  }, [])

  // B-4: 自动保存
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [lastSavedAt, setLastSavedAt] = useState('')
  // 记录最后一次与服务端一致的内容（含初始加载值），用于判断是否真有编辑
  const lastSavedMarkdownRef = useRef<string | null>(null)
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    if (pageState.kind !== 'ready') return
    // 内容与服务端一致（含初始加载那次 setMarkdown）时不触发保存，避免"白存"
    if (markdown === lastSavedMarkdownRef.current) return

    clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(async () => {
      setSaveState('saving')
      try {
        const { saved_at } = await patchLnMarkdown(workspaceId, markdown)
        lastSavedMarkdownRef.current = markdown
        setSaveState('saved')
        setLastSavedAt(new Date(saved_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }))
      } catch {
        setSaveState('error')
      }
    }, 1500)

    return () => clearTimeout(debounceTimer.current)
  }, [markdown, workspaceId, pageState.kind])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [ws, md] = await Promise.all([
          getWorkspace(workspaceId),
          getLnMarkdown(workspaceId).catch(() => ''),
        ])
        if (cancelled) return

        const videoItem = ws.items.find((i) => i.type === 'video')
        if (!videoItem) {
          setPageState({ kind: 'error', message: '该工作空间没有视频素材' })
          return
        }

        // 取 transcript（第三个请求，失败时兜底空数组）
        let transcript: VideoResultTranscriptLine[] = []
        try {
          const result = await getItemResult(workspaceId, videoItem.item_id)
          transcript = result.transcript || []
        } catch {
          transcript = []
        }
        if (cancelled) return

        setPageState({ kind: 'ready', workspace: ws, videoItem, markdown: md, transcript })
        setMarkdown(md)
        lastSavedMarkdownRef.current = md
      } catch (err: unknown) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : '加载失败'
        setPageState({ kind: 'error', message })
      }
    }
    load()
    return () => { cancelled = true }
  }, [workspaceId])

  // 区分"可内嵌播放的视频文件"与"在线平台网页链接"
  // 后者（如 B 站 / YouTube 页面）无法用 <video> 播放，降级为外链
  const { videoSrc, externalUrl } = useMemo(() => {
    if (pageState.kind !== 'ready') return { videoSrc: '', externalUrl: '' }
    const results = pageState.videoItem.results as Record<string, unknown>
    const videoResult = results.video as { url?: string; source_url?: string } | undefined
    const url = videoResult?.url ?? ''
    // 仅本地 /static 路径或视频文件扩展名可内嵌播放
    const isPlayable = url.startsWith('/static') || /\.(mp4|webm|ogg|mov|m4v)(\?|$)/i.test(url)
    if (isPlayable) return { videoSrc: url, externalUrl: '' }
    // 平台网页链接 → 不喂给 <video>，保留为外链
    return { videoSrc: '', externalUrl: videoResult?.source_url || url }
  }, [pageState])

  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time)
  }, [])

  return (
    <div className="vm-ln-scope">
      {/* Nav bar */}
      <div className="ln-nav">
        <button className="ln-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={14} /> 返回
        </button>
        <span className="ln-title">学习笔记</span>
        <span className="ln-badge">
          <Star size={10} /> Learning Notes
        </span>
        <span className="ln-save-status">
          {saveState === 'saving' && '保存中…'}
          {saveState === 'saved' && `已保存 ${lastSavedAt}`}
          {saveState === 'error' && '保存失败，重试中…'}
        </span>
      </div>

      {/* Loading / Error */}
      {pageState.kind === 'loading' && (
        <div className="ln-status">加载中…</div>
      )}
      {pageState.kind === 'error' && (
        <div className="ln-status ln-error">{pageState.message}</div>
      )}

      {/* Main body: dual-column */}
      {pageState.kind === 'ready' && (
        <div className="ln-body">
          <div className="ln-left-col">
            <LNVideoPanel
              ref={videoPanelRef}
              src={videoSrc}
              externalUrl={externalUrl}
              title={pageState.videoItem.name}
              workspaceId={workspaceId}
              onTimeUpdate={handleTimeUpdate}
            />
            <LNTranscriptPanel
              transcript={pageState.transcript}
              currentTime={currentTime}
              onSeek={(sec) => videoPanelRef.current?.seekTo(sec)}
            />
          </div>
          <LNNotesPanel
            markdown={markdown}
            onMarkdownChange={setMarkdown}
            view={view}
            onSwitchView={switchView}
            onSeek={(sec) => videoPanelRef.current?.seekTo(sec)}
          />
        </div>
      )}
    </div>
  )
}
