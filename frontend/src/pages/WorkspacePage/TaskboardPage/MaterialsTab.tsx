import { Plus } from 'lucide-react'
import { FileVideo, FileAudio, FileImage, FileText } from 'lucide-react'
import { useTaskStore } from '@/store/taskStore'
import { isTaskTerminal } from '@/types/task'
import type { WorkspaceItem } from '@/types/workspace'
import { MaterialCard } from './MaterialCard'

const ADD_GROUPS = [
  { type: 'video', icon: FileVideo, label: '视频' },
  { type: 'audio', icon: FileAudio, label: '音频' },
  { type: 'image', icon: FileImage, label: '图片' },
  { type: 'text', icon: FileText, label: '文字' },
] as const

interface MaterialsTabProps {
  items: WorkspaceItem[]
  workspaceId: string
  onAddMaterial?: () => void
}

/**
 * Materials tab — 素材网格 + 添加素材卡。
 * 设计稿来源：taskboard.jsx TBMaterials + VidMirror.html .tb-mat-grid / .mat-add。
 */
export function MaterialsTab({ items, workspaceId, onAddMaterial }: MaterialsTabProps) {
  const tasks = useTaskStore((s) => s.tasks)

  /** 通过 related_task_ids 查找 processing 任务的进度 */
  const getProgress = (item: WorkspaceItem): number | undefined => {
    if (item.status !== 'processing') return undefined
    for (const tid of item.related_task_ids) {
      const t = tasks.find((tk) => tk.task_id === tid)
      if (t && !isTaskTerminal(t.status)) return t.progress
    }
    return undefined
  }

  if (items.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0' }}>
        <div style={{ color: 'var(--ink-3)', fontSize: 14, marginBottom: 16 }}>
          还没有素材
        </div>
        <button className="btn btn-primary" onClick={onAddMaterial}>
          <Plus size={14} /> 添加素材
        </button>
      </div>
    )
  }

  return (
    <div className="tb-mat-grid">
      {items.map((item) => (
        <MaterialCard
          key={item.item_id}
          item={item}
          workspaceId={workspaceId}
          progress={getProgress(item)}
        />
      ))}
      <div className="mat-card mat-add" onClick={onAddMaterial}>
        <div className="mat-add-inner">
          <Plus size={24} />
          <div style={{ marginTop: 10, fontSize: 14, fontWeight: 600 }}>添加素材</div>
          <div
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 10,
              color: 'var(--ink-3)',
              marginTop: 4,
              letterSpacing: '0.1em',
            }}
          >
            URL · FILE · DRAG
          </div>
          <div className="mat-add-types">
            {ADD_GROUPS.map((g) => {
              const Icon = g.icon
              return (
                <span key={g.type} className="kw">
                  <Icon size={11} />
                  {g.label}
                </span>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
