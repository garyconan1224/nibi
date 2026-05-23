import { useCallback, useEffect, useState } from 'react'
import { Pencil, Trash2, Copy, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useTemplateStore } from '@/store/templateStore'
import type { VideoTemplateItem } from '@/services/templates'
import {
  fetchTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  duplicateTemplate,
} from '@/services/templates'

type ModalMode = 'closed' | 'create' | 'edit'

export default function VideoTemplatesPage() {
  const [templates, setTemplates] = useState<VideoTemplateItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  // Modal state
  const [modalMode, setModalMode] = useState<ModalMode>('closed')
  const [editingId, setEditingId] = useState('')
  const [formName, setFormName] = useState('')
  const [formPrompt, setFormPrompt] = useState('')

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setTemplates(await fetchTemplates())
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await fetchTemplates()
        if (!cancelled) setTemplates(data)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  const openCreate = () => {
    setModalMode('create')
    setEditingId('')
    setFormName('')
    setFormPrompt('')
  }

  const openEdit = (t: VideoTemplateItem) => {
    setModalMode('edit')
    setEditingId(t.template_id)
    setFormName(t.name)
    setFormPrompt(t.prompt)
  }

  const closeModal = () => {
    setModalMode('closed')
    setEditingId('')
    setFormName('')
    setFormPrompt('')
  }

  const handleSave = async () => {
    const name = formName.trim()
    const prompt = formPrompt.trim()
    if (!name || !prompt) {
      toast.error('名称和 prompt 不能为空')
      return
    }
    try {
      if (modalMode === 'create') {
        await createTemplate({ name, prompt })
        toast.success(`模板「${name}」已创建`)
      } else {
        await updateTemplate(editingId, { name, prompt })
        toast.success(`模板「${name}」已更新`)
      }
      useTemplateStore.getState().invalidate()
      closeModal()
      await reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存失败')
    }
  }

  const handleDelete = async (t: VideoTemplateItem) => {
    if (!confirm(`确定删除模板「${t.name}」？此操作不可撤销。`)) return
    setBusyId(t.template_id)
    try {
      await deleteTemplate(t.template_id)
      useTemplateStore.getState().invalidate()
      toast.success(`模板「${t.name}」已删除`)
      await reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败')
    } finally {
      setBusyId(null)
    }
  }

  const handleDuplicate = async (t: VideoTemplateItem) => {
    setBusyId(t.template_id)
    try {
      const copy = await duplicateTemplate(t.template_id, {
        source_prompt: t.prompt,
      })
      useTemplateStore.getState().invalidate()
      toast.success(`已复制为「${copy.name}」`)
      await reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '复制失败')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <h2 className="text-lg font-semibold">视频模板</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            自定义视频类型模板，在分析时与内置 6 类一起出现在 Preflight 选择中
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="size-4" />
          新建模板
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading && (
          <p className="text-sm text-muted-foreground text-center py-12">加载中…</p>
        )}
        {error && (
          <p className="text-sm text-red-500 text-center py-12">{error}</p>
        )}
        {!loading && !error && templates.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-12">暂无模板</p>
        )}
        {!loading &&
          !error &&
          templates.map((t) => (
            <div
              key={t.template_id}
              className="flex items-start gap-4 py-3 border-b border-border last:border-0"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{t.name}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                      t.is_builtin
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-green-100 text-green-700'
                    }`}
                  >
                    {t.is_builtin ? '内置' : '自定义'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate max-w-lg">
                  {t.prompt.slice(0, 80)}
                  {t.prompt.length > 80 ? '…' : ''}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {t.is_builtin ? (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      disabled
                      title="内置模板不可编辑"
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      disabled
                      title="内置模板不可删除"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => openEdit(t)}
                      disabled={busyId === t.template_id}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => handleDelete(t)}
                      disabled={busyId === t.template_id}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => handleDuplicate(t)}
                  disabled={busyId === t.template_id}
                  title="复制为可编辑副本"
                >
                  <Copy className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
      </div>

      {/* Create / Edit Modal */}
      {modalMode !== 'closed' && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={closeModal} />
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
            <div className="bg-background rounded-lg shadow-xl w-full max-w-lg mx-4 pointer-events-auto">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <h3 className="font-semibold">
                  {modalMode === 'create' ? '新建视频模板' : '编辑视频模板'}
                </h3>
                <Button variant="ghost" size="icon" className="size-7" onClick={closeModal}>
                  <X className="size-4" />
                </Button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">
                    模板名称
                  </label>
                  <Input
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="例：学术讲座"
                    maxLength={60}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">
                    System Prompt
                  </label>
                  <Textarea
                    value={formPrompt}
                    onChange={(e) => setFormPrompt(e.target.value)}
                    placeholder={
                      '这是一段学术讲座类视频的转写文本。请按以下结构输出总结：\n1. 一句话摘要（30字以内）\n2. 核心论点列表\n3. 关键引用\n4. 研究启示'
                    }
                    rows={8}
                    maxLength={5000}
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {formPrompt.length}/5000
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
                <Button variant="ghost" size="sm" onClick={closeModal}>
                  取消
                </Button>
                <Button size="sm" onClick={handleSave}>
                  保存
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
