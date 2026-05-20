import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { updateWorkspace } from '@/services/workspaces'
import type { WorkspaceBackground, WorkspaceRecord } from '@/types/workspace'

interface BackgroundEditorProps {
  open: boolean
  workspaceId: string
  initial: WorkspaceBackground
  onClose: () => void
  onSaved: (updated: WorkspaceRecord) => void
}

export function BackgroundEditor({
  open,
  workspaceId,
  initial,
  onClose,
  onSaved,
}: BackgroundEditorProps) {
  const [contentType, setContentType] = useState('')
  const [participants, setParticipants] = useState('')
  const [topic, setTopic] = useState('')
  const [glossary, setGlossary] = useState('')
  const [purpose, setPurpose] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Form reset on open
      setContentType(initial.content_type ?? '')
      setParticipants(initial.participants?.join('、') ?? '')
      setTopic(initial.topic ?? '')
      setGlossary(initial.glossary?.join('、') ?? '')
      setPurpose(initial.purpose ?? '')
    }
  }, [open, initial])

  const handleSave = async () => {
    setSaving(true)
    try {
      const background: WorkspaceBackground = {
        content_type: contentType.trim(),
        participants: participants.split(/[、,，]/).map((s) => s.trim()).filter(Boolean),
        topic: topic.trim(),
        glossary: glossary.split(/[、,，]/).map((s) => s.trim()).filter(Boolean),
        purpose: purpose.trim(),
      }
      const updated = await updateWorkspace(workspaceId, { background })
      toast.success('背景信息已更新')
      onSaved(updated)
      onClose()
    } catch {
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="wb-modal-backdrop" data-open={open} onClick={onClose} />
      <div className="pf-drawer" data-open={open} style={{ maxWidth: 420 }}>
        <div className="pf-drawer-head">
          <div>
            <div className="eyebrow">背景信息</div>
            <h3 className="display" style={{ fontSize: 22, margin: '4px 0 0' }}>
              编辑背景
            </h3>
          </div>
          <button className="btn btn-ghost" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="pf-drawer-body">
          <section className="pf-section">
            <div className="pf-field">
              <label>内容类型</label>
              <input
                value={contentType}
                onChange={(e) => setContentType(e.target.value)}
                placeholder="例：课程、会议、Vlog"
              />
            </div>
            <div className="pf-field">
              <label>人物</label>
              <input
                value={participants}
                onChange={(e) => setParticipants(e.target.value)}
                placeholder="用 、 分隔多人"
              />
            </div>
            <div className="pf-field">
              <label>背景/主题</label>
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="例：Q3 战略会议"
              />
            </div>
            <div className="pf-field">
              <label>专有词</label>
              <input
                value={glossary}
                onChange={(e) => setGlossary(e.target.value)}
                placeholder="用 、 分隔多个术语"
              />
            </div>
            <div className="pf-field">
              <label>目的</label>
              <input
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="例：复刻参考、竞品分析"
              />
            </div>
          </section>
        </div>

        <div className="pf-drawer-foot">
          <button className="btn btn-ghost" onClick={onClose}>取消</button>
          <button className="wb-btn-run" onClick={handleSave} disabled={saving}>
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </>
  )
}
