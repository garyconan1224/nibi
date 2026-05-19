import { ArrowRight, Film, Mic, Image, FileText } from 'lucide-react'
import type { TaskCard } from './types'

const STATE_COLOR: Record<TaskCard['state'], string> = {
  done:    'var(--accent-green)',
  running: 'var(--accent-blue)',
  error:   'var(--accent-pink)',
  queued:  'var(--ink-4)',
}

const TYPE_ICON = {
  video: Film,
  audio: Mic,
  image: Image,
  text:  FileText,
}

const MOCK_TASKS: TaskCard[] = [
  { id: '1', title: 'Linus Tech Tips - Is AI Making Us Dumber?', src: 'YouTube', type: 'video', state: 'done' },
  { id: '2', title: '2024 年最强提示词技巧合集', src: 'Bilibili', type: 'video', state: 'done' },
  { id: '3', title: '小红书爆款笔记拆解 · 家居风格', src: '小红书', type: 'image', state: 'done' },
  { id: '4', title: 'The Lex Fridman Podcast - Sam Altman', src: 'YouTube', type: 'audio', state: 'running' },
  { id: '5', title: 'Stable Diffusion 3.5 完整教程', src: 'Bilibili', type: 'video', state: 'queued' },
  { id: '6', title: '大模型训练全流程文档', src: '本地文件', type: 'text', state: 'done' },
  { id: '7', title: 'MrBeast - $1 vs $1,000,000 Vacation', src: 'YouTube', type: 'video', state: 'error' },
  { id: '8', title: '抖音 AI 绘画爆款视频分析', src: '抖音', type: 'video', state: 'done' },
]

interface RecentTasksProps {
  tasks?: TaskCard[]
}

export function RecentTasks({ tasks = MOCK_TASKS }: RecentTasksProps) {
  return (
    <section className="examples">
      <div className="examples-head">
        <h2 className="display" style={{ margin: 0, fontSize: 36 }}>
          最近任务
        </h2>
        <button className="btn btn-ghost">
          全部 · {tasks.length} <ArrowRight size={14} />
        </button>
      </div>

      <div className="ex-grid">
        {tasks.slice(0, 8).map((task) => {
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
