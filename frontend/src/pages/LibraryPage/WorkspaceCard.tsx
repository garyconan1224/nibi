import { useNavigate } from 'react-router-dom'
import { FolderOpen } from 'lucide-react'
import type { LibraryWorkspace } from '@/services/library'

const TYPE_LABEL: Record<string, string> = {
  video: '视频',
  audio: '音频',
  image: '图片',
  text: '文字',
}

interface WorkspaceCardProps {
  workspace: LibraryWorkspace
}

export function WorkspaceCard({ workspace }: WorkspaceCardProps) {
  const navigate = useNavigate()

  const typeChips = Object.entries(workspace.items_count_by_type)
    .filter(([, count]) => count > 0)
    .map(([type, count]) => `${TYPE_LABEL[type] || type} ${count}`)
    .join(' · ')

  return (
    <div
      className="ex-card"
      onClick={() => navigate(`/workspaces/${workspace.workspace_id}`)}
    >
      <div className="ex-thumb">
        {workspace.cover_thumbnail ? (
          <img src={workspace.cover_thumbnail} alt={workspace.name} />
        ) : (
          <FolderOpen size={28} strokeWidth={1.2} />
        )}
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
            background: 'rgba(0,0,0,0.6)',
            fontSize: 10,
            color: '#fff',
            fontFamily: 'var(--mono)',
          }}
        >
          {workspace.items_count} items
        </div>
      </div>
      <div className="ex-meta">
        <div className="ex-title" title={workspace.name}>
          {workspace.name}
        </div>
        <div className="ex-sub">{typeChips || '空工作空间'}</div>
      </div>
    </div>
  )
}
