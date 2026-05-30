import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Star } from 'lucide-react'
import { getWorkspace } from '@/services/workspaces'
import { getAVSynthesisMarkdown } from '@/services/workspaces'
import type { WorkspaceRecord, WorkspaceItem } from '@/types/workspace'
import LNVideoPanel from './LNVideoPanel'
import LNNotesPanel from './LNNotesPanel'
import './learning-notes.css'

type PageState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; workspace: WorkspaceRecord; videoItem: WorkspaceItem; markdown: string }

export default function LearningNotesPage() {
  const { workspaceId = '' } = useParams<{ workspaceId: string }>()
  const navigate = useNavigate()
  const [pageState, setPageState] = useState<PageState>({ kind: 'loading' })
  const [currentTime, setCurrentTime] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [ws, md] = await Promise.all([
          getWorkspace(workspaceId),
          getAVSynthesisMarkdown(workspaceId).catch(() => ''),
        ])
        if (cancelled) return

        const videoItem = ws.items.find((i) => i.type === 'video')
        if (!videoItem) {
          setPageState({ kind: 'error', message: '该工作空间没有视频素材' })
          return
        }
        setPageState({ kind: 'ready', workspace: ws, videoItem, markdown: md })
      } catch (err: unknown) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : '加载失败'
        setPageState({ kind: 'error', message })
      }
    }
    load()
    return () => { cancelled = true }
  }, [workspaceId])

  const videoSrc = useMemo(() => {
    if (pageState.kind !== 'ready') return ''
    const { videoItem } = pageState
    const results = videoItem.results as Record<string, unknown>
    const videoResult = results.video as { url?: string } | undefined

    // 优先用 results.video.url（可能是本地 /static/ 路径或外部 URL）
    if (videoResult?.url) return videoResult.url

    // 兜底：尝试从 workspace 目录构造本地路径
    // 本地视频文件一般在 data/workspaces/{workspace_id}/videos/ 下
    // 但需要知道文件名，这里只能返回空
    return ''
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
          <LNVideoPanel
            src={videoSrc}
            title={pageState.videoItem.name}
            onTimeUpdate={handleTimeUpdate}
          />
          <LNNotesPanel
            markdown={pageState.markdown}
            currentTime={currentTime}
          />
        </div>
      )}
    </div>
  )
}
