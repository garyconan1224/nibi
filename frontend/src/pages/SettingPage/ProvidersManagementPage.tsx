import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { AlertCircle, Loader2 } from 'lucide-react'
import OpenAIMono from '@lobehub/icons/es/OpenAI/components/Mono'
import AnthropicMono from '@lobehub/icons/es/Anthropic/components/Mono'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { http } from '@/services/client'
import {
  useProviderStore,
  type ProviderItem,
} from '@/store/providerStore'
import { useSettingsShellStore } from '@/store/settingsShellStore'
import { useDirtyGuard } from '@/hooks/useDirtyGuard'
import { ProviderList } from '@/components/settings/providers/ProviderList'
import {
  ProviderDetailPanel,
  type EditDraft,
  type ProviderDetail,
} from '@/components/settings/providers/ProviderDetailPanel'

/** 新增对话框草稿（与 ProviderCreateRequest 对齐） */
interface CreateForm {
  name: string
  kind: 'openai_compatible' | 'anthropic'
  api_key: string
  base_url: string
}

const EMPTY_CREATE_FORM: CreateForm = {
  name: '',
  kind: 'openai_compatible',
  api_key: '',
  base_url: '',
}

/** 从 detail 推导 draft 基线（api_key 永远以空串开始） */
function baselineFromDetail(detail: ProviderDetail): EditDraft {
  return {
    api_key: '',
    base_url: detail.base_url,
    enabled: detail.enabled,
    name: detail.name,
  }
}

const EMPTY_DRAFT: EditDraft = { api_key: '', base_url: '', enabled: false, name: '' }
const EMPTY_DIRTY_MAP: Record<keyof EditDraft, boolean> = {
  api_key: false,
  base_url: false,
  enabled: false,
  name: false,
}

const ProvidersManagementPage = () => {
  const { t } = useTranslation(['providers', 'settings', 'common'])

  // ── 列表状态 ──
  const [providers, setProviders] = useState<ProviderItem[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ── Master-Detail 选中态 ──
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // ── 详情 / 草稿缓存（按 id 索引，离开再回来不丢） ──
  const [detailCache, setDetailCache] = useState<Record<string, ProviderDetail>>({})
  const [drafts, setDrafts] = useState<Record<string, EditDraft>>({})

  // ── 过渡态 ──
  const [savingId, setSavingId] = useState<string | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<
    Record<string, { ok: boolean; msg: string }>
  >({})

  // ── 新增 / 删除对话框 ──
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState<CreateForm>(EMPTY_CREATE_FORM)
  const [creating, setCreating] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<ProviderItem | null>(null)
  const [deleting, setDeleting] = useState(false)
  const removeProviderInStore = useProviderStore((s) => s.removeProvider)

  // ── SaveBar 桥：子页面 → SettingsShell ──
  const setSaveBar = useSettingsShellStore((s) => s.setSaveBar)
  const resetSaveBar = useSettingsShellStore((s) => s.resetSaveBar)

  /* ── 拉取列表 ── */
  const fetchProviders = async () => {
    try {
      setListLoading(true)
      const res = await http.get('/providers')
      const list: ProviderItem[] = res.data.data ?? res.data
      setProviders(list)
      setError(null)
      setSelectedId((prev) => {
        if (prev && list.some((p) => p.id === prev)) return prev
        return list[0]?.id ?? null
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('common:status.unknownError')
      setError(msg)
      toast.error(msg)
    } finally {
      setListLoading(false)
    }
  }
  useEffect(() => {
    void fetchProviders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── 懒加载选中项的详情 ── */
  useEffect(() => {
    if (!selectedId) return
    if (detailCache[selectedId]) return
    let aborted = false
    ;(async () => {
      try {
        const res = await http.get(`/providers/${selectedId}`)
        const detail: ProviderDetail = res.data.data ?? res.data
        if (aborted) return
        setDetailCache((prev) => ({ ...prev, [selectedId]: detail }))
        setDrafts((prev) =>
          prev[selectedId] ? prev : { ...prev, [selectedId]: baselineFromDetail(detail) },
        )
      } catch (e) {
        const msg = e instanceof Error ? e.message : t('detail.fetchFailed')
        setError(msg)
        toast.error(msg)
      }
    })()
    return () => {
      aborted = true
    }
  }, [selectedId, detailCache, t])

  /* ── 逐 provider 脏判定：驱动左侧 DirtyDot ── */
  const dirtyIds = useMemo(() => {
    const s = new Set<string>()
    for (const [id, draft] of Object.entries(drafts)) {
      const detail = detailCache[id]
      if (!detail) continue
      if (
        draft.api_key !== '' ||
        draft.base_url !== detail.base_url ||
        draft.enabled !== detail.enabled ||
        draft.name !== detail.name
      ) {
        s.add(id)
      }
    }
    return s
  }, [drafts, detailCache])

  /* ── 当前选中项的草稿 + 基线（供 useDirtyGuard 使用） ── */
  const currentBaseline = useMemo<EditDraft>(() => {
    if (!selectedId) return EMPTY_DRAFT
    const detail = detailCache[selectedId]
    return detail ? baselineFromDetail(detail) : EMPTY_DRAFT
  }, [selectedId, detailCache])

  const currentDraft: EditDraft =
    (selectedId && drafts[selectedId]) || currentBaseline

  /* 路由级脏守卫：beforeunload + useBlocker；页面内切换的拦截走下面的 handleSelect */
  const guard = useDirtyGuard<EditDraft>({
    initial: currentBaseline,
    current: currentDraft,
    message: t('settings:dirty.leaveConfirm'),
    enabled: !!selectedId && !!detailCache[selectedId ?? ''],
  })

  const currentDirtyMap: Record<keyof EditDraft, boolean> = guard.isDirty
    ? guard.dirtyMap
    : EMPTY_DIRTY_MAP

  /* ── 草稿 patch / reset ── */
  const patchDraft = (patch: Partial<EditDraft>) => {
    if (!selectedId) return
    setDrafts((prev) => ({
      ...prev,
      [selectedId]: { ...(prev[selectedId] ?? currentBaseline), ...patch },
    }))
  }

  const resetDraft = () => {
    if (!selectedId) return
    const detail = detailCache[selectedId]
    if (!detail) return
    setDrafts((prev) => ({ ...prev, [selectedId]: baselineFromDetail(detail) }))
  }

  /* ── 保存 ── */
  const handleSave = async (id = selectedId) => {
    if (!id) return
    const draft = drafts[id]
    const detail = detailCache[id]
    if (!draft || !detail) return
    setSavingId(id)
    try {
      const body: Record<string, unknown> = {
        base_url: draft.base_url,
        enabled: draft.enabled,
        name: draft.name,
        default_models: detail.default_models,
      }
      if (draft.api_key.trim() !== '') body.api_key = draft.api_key

      await http.put(`/providers/${id}`, body)
      toast.success(t('save.success'))

      const updated: ProviderDetail = {
        ...detail,
        base_url: draft.base_url,
        enabled: draft.enabled,
        name: draft.name,
        has_api_key:
          draft.api_key.trim() !== '' ? true : detail.has_api_key,
      }
      setDetailCache((prev) => ({ ...prev, [id]: updated }))
      const nextDraft = baselineFromDetail(updated)
      setDrafts((prev) => ({ ...prev, [id]: nextDraft }))
      guard.commit(nextDraft)
      setProviders((prev) =>
        prev.map((p) =>
          p.id === id
            ? { ...p, enabled: draft.enabled, name: draft.name, base_url: draft.base_url }
            : p,
        ),
      )
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('save.failed')
      setError(msg)
      toast.error(msg)
    } finally {
      setSavingId(null)
    }
  }

  /* ── 连接测试 ── */
  const handleTest = async () => {
    if (!selectedId) return
    const prov = providers.find((p) => p.id === selectedId)
    if (!prov) return
    setTestingId(selectedId)
    setTestResult((prev) => ({ ...prev, [selectedId]: { ok: false, msg: '' } }))
    try {
      const res = await http.post('/providers/test', { provider_id: selectedId })
      const data = res.data.data ?? res.data
      setTestResult((prev) => ({
        ...prev,
        [selectedId]: { ok: true, msg: data.message || t('test.successDefault') },
      }))
      toast.success(t('test.successToast', { name: prov.name }))
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('test.failedDefault')
      setTestResult((prev) => ({ ...prev, [selectedId]: { ok: false, msg } }))
      toast.error(t('test.failedToast', { name: prov.name, msg }))
    } finally {
      setTestingId(null)
    }
  }

  /* ── 切换选中：脏态下 window.confirm 拦截 ── */
  const handleSelect = (id: string) => {
    if (id === selectedId) return
    if (selectedId && dirtyIds.has(selectedId)) {
      const ok = window.confirm(t('settings:dirty.leaveConfirm'))
      if (!ok) return
      const detail = detailCache[selectedId]
      if (detail) {
        setDrafts((prev) => ({
          ...prev,
          [selectedId]: baselineFromDetail(detail),
        }))
      }
    }
    setSelectedId(id)
  }

  /* ── 删除 / 新增 ── */
  const handleConfirmDelete = async () => {
    if (!pendingDelete) return
    const target = pendingDelete
    setDeleting(true)
    try {
      await removeProviderInStore(target.id)
      setProviders((prev) => prev.filter((p) => p.id !== target.id))
      setDetailCache((prev) => {
        const n = { ...prev }
        delete n[target.id]
        return n
      })
      setDrafts((prev) => {
        const n = { ...prev }
        delete n[target.id]
        return n
      })
      setTestResult((prev) => {
        const n = { ...prev }
        delete n[target.id]
        return n
      })
      if (selectedId === target.id) {
        setSelectedId((prev) => {
          const rest = providers.filter((p) => p.id !== target.id)
          return prev === target.id ? rest[0]?.id ?? null : prev
        })
      }
      toast.success(t('delete.successToast', { name: target.name }))
      setPendingDelete(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('delete.failed'))
    } finally {
      setDeleting(false)
    }
  }

  const handleCreate = async () => {
    if (!createForm.name.trim()) {
      toast.error(t('create.nameRequired'))
      return
    }
    setCreating(true)
    try {
      await http.post('/providers', createForm)
      toast.success(t('create.successToast', { name: createForm.name }))
      setCreateOpen(false)
      setCreateForm(EMPTY_CREATE_FORM)
      await fetchProviders()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('create.failed'))
    } finally {
      setCreating(false)
    }
  }

  /* ── SaveBar 联动：推送至 SettingsShell 顶层 store ── */
  useEffect(() => {
    const isDirty = !!selectedId && dirtyIds.has(selectedId)
    setSaveBar({
      dirtyCount: isDirty
        ? Object.values(currentDirtyMap).filter(Boolean).length
        : 0,
      saving: savingId === selectedId,
      onSave: selectedId ? () => void handleSave(selectedId) : undefined,
      onReset: selectedId ? () => resetDraft() : undefined,
    })
    return () => resetSaveBar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, dirtyIds, savingId, currentDirtyMap])

  /* ─── 渲染 ─── */
  if (listLoading) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        <span>{t('common:status.loading')}</span>
      </div>
    )
  }

  const selectedProvider =
    (selectedId && providers.find((p) => p.id === selectedId)) || null

  return (
    <div className="flex h-full w-full flex-col">
      {/* 全局错误横幅 */}
      {error ? (
        <div className="mx-6 mt-4 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
          <button
            type="button"
            className="ml-auto text-rose-400 hover:text-rose-600"
            onClick={() => setError(null)}
            aria-label="dismiss-error"
          >
            ✕
          </button>
        </div>
      ) : null}

      {/* Master-Detail 双栏 */}
      <div className="flex flex-1 overflow-hidden">
        <ProviderList
          providers={providers}
          selectedId={selectedId}
          dirtyIds={dirtyIds}
          onSelect={handleSelect}
          onAdd={() => setCreateOpen(true)}
          onDelete={(p) => setPendingDelete(p)}
        />
        <ProviderDetailPanel
          provider={selectedProvider}
          detail={selectedId ? detailCache[selectedId] ?? null : null}
          draft={selectedId ? drafts[selectedId] ?? null : null}
          dirtyMap={currentDirtyMap}
          savingId={savingId}
          testingId={testingId}
          testResult={selectedId ? testResult[selectedId] : undefined}
          onChange={patchDraft}
          onSave={() => void handleSave()}
          onTest={handleTest}
        />
      </div>

      {/* 新增提供商 Dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          if (creating) return
          setCreateOpen(open)
          if (!open) setCreateForm(EMPTY_CREATE_FORM)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('create.title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-[80px_1fr] items-center gap-3">
              <label className="text-right text-sm font-medium">
                {t('create.nameLabel')}
              </label>
              <Input
                value={createForm.name}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder={t('create.namePlaceholder')}
              />
            </div>
            <div className="grid grid-cols-[80px_1fr] items-center gap-3">
              <label className="text-right text-sm font-medium">
                {t('create.kindLabel')}
              </label>
              <Select
                value={createForm.kind}
                onValueChange={(v) =>
                  setCreateForm((f) => ({ ...f, kind: v as CreateForm['kind'] }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai_compatible">
                    <span className="inline-flex items-center gap-2">
                      <OpenAIMono size={16} />
                      OpenAI Compatible
                    </span>
                  </SelectItem>
                  <SelectItem value="anthropic">
                    <span className="inline-flex items-center gap-2">
                      <AnthropicMono size={16} />
                      Anthropic
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-[80px_1fr] items-center gap-3">
              <label className="text-right text-sm font-medium">
                {t('form.apiKey')}
              </label>
              <Input
                type="password"
                autoComplete="new-password"
                value={createForm.api_key}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, api_key: e.target.value }))
                }
                placeholder={t('create.apiKeyPlaceholder')}
              />
            </div>
            <div className="grid grid-cols-[80px_1fr] items-center gap-3">
              <label className="text-right text-sm font-medium">
                {t('form.baseUrl')}
              </label>
              <Input
                value={createForm.base_url}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, base_url: e.target.value }))
                }
                placeholder={t('create.baseUrlPlaceholder')}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setCreateOpen(false)
                setCreateForm(EMPTY_CREATE_FORM)
              }}
              disabled={creating}
            >
              {t('common:actions.cancel')}
            </Button>
            <Button onClick={handleCreate} disabled={creating} className="gap-2">
              {creating ? <Loader2 className="size-4 animate-spin" /> : null}
              {t('create.submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除二次确认 */}
      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setPendingDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('delete.description', { name: pendingDelete?.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>
              {t('delete.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void handleConfirmDelete()
              }}
              disabled={deleting}
              className="gap-2"
            >
              {deleting ? <Loader2 className="size-4 animate-spin" /> : null}
              {t('delete.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default ProvidersManagementPage

