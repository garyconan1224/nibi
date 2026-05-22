import { ArrowRight, Film, Mic, Image, FileText } from 'lucide-react'
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
  let state: TaskCard['state'] = 'queued'
  if (t.status === 'SUCCESS') state = 'done'
  else if (t.status === 'FAILED') state = 'error'
  else if (t.status === 'CANCELLED') state = 'cancelled'
  else if (isTaskTerminal(t.status)) state = 'done'
  else state = 'running'

  const url = (t.payload as Record<string, unknown>).url as string | undefined
  const title = url
    ? (url.length > 50 ? url.slice(0, 47) + '...' : url)
    : getStatusText(t.status)

  return {
    id: t.task_id,
    title,
    src: t.task_type,
    type: 'video',
    state,
  }
}

interface RecentTasksProps {
  tasks?: TaskRecord[]
}

export function RecentTasks({ tasks: tasksProp }: RecentTasksProps) {
  usePipelineTasks({ pollInterval: 5000 })
  const storeTasks = useTaskStore((s) => s.tasks)
  const tasks = tasksProp ?? storeTasks
  const cards = tasks.slice(0, 8).map(taskToCard)

  if (cards.length === 0) {
    return (
      <section className="examples">
        <div className="examples-head">
          <h2 className="display" style={{ margin: 0, fontSize: 36 }}>
            最近任务
          </h2>
        </div>
        <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13, fontFamily: 'var(--mono)' }}>
          暂无任务 — 在上方粘贴链接开始解析
        </div>
      </section>
    )
  }

  return (
    <section className="examples">
      <div className="examples-head">
        <h2 className="display" style={{ margin: 0, fontSize: 36 }}>
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
            <div key={task.id} className="ex-card">
              <div className="ex-thumb">
                <Icon size={28} />
                <div
                  style={{
                    position: 'absolute',
                    top: 8,
                    left: 8,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '3px 8px',
                    borderRadius: 99,
                    background: 'rgba(0,0,0,0.65)',
                    fontSize: 10,
                    color: '#fff',
                    fontFamily: 'var(--mono)',
                  }}
                >
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: 99,
                      background: STATE_COLOR[task.state],
                      flexShrink: 0,
                    }}
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
