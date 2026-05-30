import HtmlView from './HtmlView'
import MdView from './MdView'

interface LNNotesPanelProps {
  markdown: string
  onMarkdownChange: (md: string) => void
  view: 'html' | 'md'
  onSwitchView: (v: 'html' | 'md') => void
}

export default function LNNotesPanel({ markdown, onMarkdownChange, view, onSwitchView }: LNNotesPanelProps) {
  return (
    <div className="ln-notes-panel">
      <div className="ln-toolbar">
        <button
          data-active={view === 'html'}
          onClick={() => onSwitchView('html')}
        >HTML</button>
        <button
          data-active={view === 'md'}
          onClick={() => onSwitchView('md')}
        >MD 源码</button>
      </div>
      {view === 'html'
        ? <HtmlView markdown={markdown} onMarkdownChange={onMarkdownChange} />
        : <MdView markdown={markdown} onMarkdownChange={onMarkdownChange} />}
    </div>
  )
}
