import { ArrowRight, Film, Mic, Image, FileText } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTaskStore } from '@/store/taskStore'
import { usePipelineTasks } from '@/hooks/usePipelineTasks'
import { isTaskTerminal, getStatusText } from '@/types/task'
import type { TaskRecord } from '@/types/task'
import type { TaskCard } from './types'

const STATE_COLOR: Record<TaskCard['state'], string> = {
  done:      'var(--accent-green)',
  running:   'var(--accent-blue)',
  error:     'var(--accent-pink)',
  cancelled: 'var(--ink-3)',
  queued:    'var(--ink-4)',
}

const TYPE_ICON = {
  video: Film,
  audio: Mic,
  image: Image,
  text:  FileText,
}

function taskToCard(t: TaskRecord): TaskCard {
  const payload = (t.payload ?? {}) as Record<string, unknown>
  const result = (t.result ?? {}) as Record<string, unknown>

  let state: TaskCard['state'] = 'queued'
  if (t.status === 'SUCCESS') state = 'done'
  else if (t.status === 'FAILED') state = 'error'
  else if (t.status === 'CANCELLED') state = 'cancelled'
  else if (isTaskTerminal(t.status)) state = 'done'
  else state = 'running'

  // 真实标题：视频标题 > url 截断 > 状态文案
  const url = payload.url as string | undefined
  const videoTitle = (result.video_title || payload.video_title) as string | undefined
  const title = videoTitle?.trim()
    ? videoTitle
    : url
      ? (url.length > 50 ? url.slice(0, 47) + '...' : url)
      : getStatusText(t.status)

  // 真实封面（PROBE 后已是 static URL，可直接用）
  const thumb = (result.video_thumbnail_url || result.cover_thumbnail || '') as string

  // 真实类型
  const noteKind = result.note_kind as string | undefined
  const type =
    noteKind === 'image_text' ? 'image' : t.task_type === 'audio' ? 'audio' : 'video'

  return {
    id: t.task_id,
    title,
    src: t.task_type,
    type,
    state,
    thumb,
  }
}

interface RecentTasksProps {
  tasks?: TaskRecord[]
}

export function RecentTasks({ tasks: tasksProp }: RecentTasksProps) {
  const navigate = useNavigate()
  usePipelineTasks({ pollInterval: 5000 })
  const storeTasks = useTaskStore((s) => s.tasks)
  const tasks = tasksProp ?? storeTasks
  const cards = tasks.slice(0, 8).map(taskToCard)

  if (cards.length === 0) {
    return (
      <section className="examples">
        <div className="examples-head">
          <h2 className="display rt-title">
            最近任务
          </h2>
        </div>
        <div className="rt-empty">
          暂无任务 — 在上方粘贴链接开始解析
        </div>
      </section>
    )
  }

  return (
    <section className="examples">
      <div className="examples-head">
        <h2 className="display rt-title">
          最近任务
        </h2>
        <button className="btn btn-ghost">
          全部 · {cards.length} <ArrowRight size={14} />
        </button>
      </div>

      <div className="ex-grid">
        {cards.map((task) => {
          const Icon = TYPE_ICON[task.type as keyof typeof TYPE_ICON] ?? Film
          return (
            <div
              key={task.id}
              className="ex-card"
              onClick={() => navigate(`/processing/${task.id}`)}
            >
              <div className="ex-thumb">
                {task.thumb ? (
                  <img
                    src={task.thumb}
                    alt={task.title}
                    referrerPolicy="no-referrer"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                ) : (
                  <Icon size={28} />
                )}
                <div className="rt-badge">
                  <span
                    className="rt-status-dot"
                    style={{ background: STATE_COLOR[task.state] }}
                  />
                  {task.state}
                </div>
              </div>
              <div className="ex-meta">
                <div className="ex-title">{task.title}</div>
                <div className="ex-sub">
                  {task.src} · {task.type}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
