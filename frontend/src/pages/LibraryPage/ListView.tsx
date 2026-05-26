import type { LibraryItem } from '@/services/library'
import {
  TYPE_ICON,
  STATE_COLOR,
  STATE_LABEL,
  primaryStatusToState,
  formatDuration,
  formatDate,
} from './libraryHelpers'

interface ListViewProps {
  items: LibraryItem[]
  selectMode?: boolean
  selectedSet: Set<string>
  selectionKey: (wsId: string, itemId: string) => string
  onToggle: (itemId: string, wsId: string) => void
  onOpen: (item: LibraryItem) => void
  onDelete: (item: LibraryItem) => void
}

const TH: React.CSSProperties = {
  padding: '10px 14px',
  textAlign: 'left',
  fontWeight: 500,
  fontFamily: 'var(--mono)',
  fontSize: 10.5,
  letterSpacing: '0.08em',
  color: 'var(--ink-3)',
  textTransform: 'uppercase',
  background: 'var(--bg-sunken)',
}

const TD: React.CSSProperties = { padding: '12px 14px', fontSize: 13 }

const MONO_TD: React.CSSProperties = {
  padding: '12px 14px',
  fontFamily: 'var(--mono)',
  fontSize: 11,
  color: 'var(--ink-3)',
}

export function ListView({ items, selectMode, selectedSet, selectionKey, onToggle, onOpen, onDelete }: ListViewProps) {
  return (
    <div
      style={{
        borderRadius: 'var(--radius)',
        border: '1px solid var(--line)',
        overflow: 'hidden',
        background: 'var(--bg-elev)',
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {selectMode && <th style={{ ...TH, width: 36 }}></th>}
            <th style={TH}>名称</th>
            <th style={{ ...TH, width: 80 }}>类型</th>
            <th style={{ ...TH, width: 110 }}>状态</th>
            <th style={{ ...TH, width: 80 }}>时长</th>
            <th style={{ ...TH, width: 160 }}>工作空间</th>
            <th style={{ ...TH, width: 100 }}>创建时间</th>
            <th style={{ ...TH, width: 40 }}></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const Icon = TYPE_ICON[item.type] || TYPE_ICON.text
            const state = primaryStatusToState(item.primary_task_status)
            const stateColor = STATE_COLOR[state] || STATE_COLOR.queued
            const stateLabel = STATE_LABEL[state] || 'queued'
            const isSel = selectedSet.has(selectionKey(item.workspace_id, item.item_id))

            return (
              <tr
                key={`${item.workspace_id}:${item.item_id}`}
                onClick={() => (selectMode ? onToggle(item.item_id, item.workspace_id) : onOpen(item))}
                style={{
                  cursor: 'pointer',
                  borderTop: '1px solid var(--line)',
                  transition: 'background 120ms',
                }}
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLElement).style.background = 'var(--bg-sunken)'
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLElement).style.background = ''
                }}
              >
                {selectMode && (
                  <td style={TD} onClick={(e) => e.stopPropagation()}>
                    <span
                      onClick={() => onToggle(item.item_id, item.workspace_id)}
                      style={{
                        display: 'grid',
                        placeItems: 'center',
                        width: 18,
                        height: 18,
                        borderRadius: 99,
                        background: isSel ? 'var(--ink)' : 'transparent',
                        color: isSel ? 'var(--bg)' : 'var(--ink-3)',
                        border: '1.5px solid',
                        borderColor: isSel ? 'var(--ink)' : 'var(--line-strong)',
                      }}
                    >
                      {isSel && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      )}
                    </span>
                  </td>
                )}
                <td style={TD}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Icon size={16} strokeWidth={1.4} style={{ color: 'var(--ink-3)', flexShrink: 0 }} />
                    <span
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.name || '未命名'}
                    </span>
                  </div>
                </td>
                <td style={MONO_TD}>{item.type}</td>
                <td style={{ padding: '12px 14px' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      fontSize: 11,
                      fontFamily: 'var(--mono)',
                    }}
                  >
                    <span
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: 99,
                        background: stateColor,
                        flexShrink: 0,
                      }}
                    />
                    {stateLabel}
                  </span>
                </td>
                <td style={MONO_TD}>{formatDuration(item.duration_seconds)}</td>
                <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--ink-2)' }}>
                  {item.workspace_name}
                </td>
                <td style={MONO_TD}>{formatDate(item.created_at)}</td>
                <td style={{ padding: '12px 14px' }} onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => onDelete(item)}
                    title="删除"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--ink-4)',
                      display: 'grid',
                      placeItems: 'center',
                      padding: 4,
                      borderRadius: 4,
                      transition: 'color 120ms',
                    }}
                    onMouseEnter={(e) => {
                      ;(e.currentTarget as HTMLElement).style.color = 'var(--accent)'
                    }}
                    onMouseLeave={(e) => {
                      ;(e.currentTarget as HTMLElement).style.color = 'var(--ink-4)'
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" />
                    </svg>
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
