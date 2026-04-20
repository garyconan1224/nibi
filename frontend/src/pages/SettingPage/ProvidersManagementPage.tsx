import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Loader2,
  Plus,
  RotateCcw,
  Save,
} from 'lucide-react'

/* ─── 类型定义 ─── */
interface Provider {
  id: string
  name: string
  kind: string
  enabled: boolean
  capabilities: string[]
  base_url: string
  has_api_key: boolean
}

interface ProviderDetail extends Provider {
  api_key: string
  default_models: Record<string, string>
  rate_limit_rpm: number
  timeout_sec: number
}

/** 编辑表单的本地草稿（字段与 ProviderUpdateRequest 对齐） */
interface EditDraft {
  api_key: string          // 空字符串 = 不修改
  base_url: string
  enabled: boolean
  name: string
}

/** 新增对话框表单（字段与 ProviderCreateRequest 对齐） */
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

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

const ProvidersManagementPage = () => {
  const [providers, setProviders]     = useState<Provider[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [error, setError]             = useState<string | null>(null)

  // 展开状态
  const [expanded, setExpanded]       = useState<Record<string, boolean>>({})
  // 已加载的详情缓存
  const [detailCache, setDetailCache] = useState<Record<string, ProviderDetail>>({})
  // 编辑草稿
  const [drafts, setDrafts]           = useState<Record<string, EditDraft>>({})
  // 保存中
  const [savingId, setSavingId]       = useState<string | null>(null)
  // 测试中
  const [testingId, setTestingId]     = useState<string | null>(null)
  // 测试结果
  const [testResult, setTestResult]   = useState<Record<string, { ok: boolean; msg: string }>>({})

  // 新增 Dialog
  const [createOpen, setCreateOpen]   = useState(false)
  const [createForm, setCreateForm]   = useState<CreateForm>(EMPTY_CREATE_FORM)
  const [creating, setCreating]       = useState(false)

  /* ── 获取提供商列表 ── */
  const fetchProviders = async () => {
    try {
      setListLoading(true)
      const res = await fetch(`${API_BASE}/providers`)
      if (!res.ok) throw new Error(`获取提供商列表失败 (${res.status})`)
      setProviders(await res.json())
      setError(null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : '未知错误'
      setError(msg)
      toast.error(msg)
    } finally {
      setListLoading(false)
    }
  }

  useEffect(() => { fetchProviders() }, [])

  /* ── 展开 / 收起 ── */
  const toggleExpand = async (id: string) => {
    const opening = !expanded[id]
    setExpanded(prev => ({ ...prev, [id]: opening }))

    if (opening && !detailCache[id]) {
      try {
        const res = await fetch(`${API_BASE}/providers/${id}`)
        if (!res.ok) throw new Error(`获取详情失败 (${res.status})`)
        const detail: ProviderDetail = await res.json()
        setDetailCache(prev => ({ ...prev, [id]: detail }))
        setDrafts(prev => ({
          ...prev,
          [id]: {
            api_key: '',
            base_url: detail.base_url,
            enabled: detail.enabled,
            name: detail.name,
          },
        }))
      } catch (e) {
        const msg = e instanceof Error ? e.message : '获取详情失败'
        setError(msg)
        toast.error(msg)
        setExpanded(prev => ({ ...prev, [id]: false }))
      }
    }
  }

  /* ── 更新草稿字段 ── */
  const patchDraft = (id: string, patch: Partial<EditDraft>) =>
    setDrafts(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }))

  /* ── 测试连接 ── */
  const testConnection = async (provider: Provider) => {
    const id = provider.id
    setTestingId(id)
    setTestResult(prev => ({ ...prev, [id]: { ok: false, msg: '' } }))
    try {
      const res = await fetch(`${API_BASE}/providers/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider_id: id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || '连接测试失败')
      setTestResult(prev => ({ ...prev, [id]: { ok: true, msg: data.message || '连接成功' } }))
      toast.success(`${provider.name} 连接成功`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : '连接失败'
      setTestResult(prev => ({ ...prev, [id]: { ok: false, msg } }))
      toast.error(`${provider.name} 连接失败：${msg}`)
    } finally {
      setTestingId(null)
    }
  }

  /* ── 保存编辑 ── */
  const handleSave = async (id: string) => {
    const draft = drafts[id]
    const detail = detailCache[id]
    if (!draft || !detail) return

    setSavingId(id)
    try {
      const body: Record<string, unknown> = {
        base_url: draft.base_url,
        enabled: draft.enabled,
        default_models: detail.default_models,
      }
      if (draft.api_key.trim() !== '') body.api_key = draft.api_key

      const res = await fetch(`${API_BASE}/providers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || `保存失败 (${res.status})`)
      }
      toast.success('保存成功')
      setDetailCache(prev => { const n = { ...prev }; delete n[id]; return n })
      setExpanded(prev => ({ ...prev, [id]: false }))
      await fetchProviders()
    } catch (e) {
      const msg = e instanceof Error ? e.message : '保存失败'
      setError(msg)
      toast.error(msg)
    } finally {
      setSavingId(null)
    }
  }

  /* ── 新增提供商 ── */
  const handleCreate = async () => {
    if (!createForm.name.trim()) { toast.error('名称不能为空'); return }
    setCreating(true)
    try {
      const res = await fetch(`${API_BASE}/providers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || `创建失败 (${res.status})`)
      }
      toast.success(`提供商 "${createForm.name}" 已创建`)
      setCreateOpen(false)
      setCreateForm(EMPTY_CREATE_FORM)
      await fetchProviders()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '创建失败')
    } finally {
      setCreating(false)
    }
  }

  /* ─── 渲染 ─── */
  if (listLoading) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>加载中…</span>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl">
      {/* 顶部标题栏 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">提供商管理</h1>
          <p className="text-sm text-muted-foreground">配置和管理 AI 提供商</p>
        </div>
        <Button className="gap-2" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          新增提供商
        </Button>
      </div>

      {/* 全局错误横幅 */}
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
          <button className="ml-auto text-red-400 hover:text-red-600" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* 提供商列表 */}
      <div className="space-y-3">
        {providers.length === 0 && (
          <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground text-sm">
            暂无提供商，点击「新增提供商」开始配置
          </div>
        )}

        {providers.map(provider => {
          const isExpanded = !!expanded[provider.id]
          const draft      = drafts[provider.id]
          const isSaving   = savingId === provider.id
          const isTesting  = testingId === provider.id
          const result     = testResult[provider.id]

          return (
            <Card key={provider.id} className="overflow-hidden">
              {/* 列表行 */}
              <CardHeader
                className="cursor-pointer select-none hover:bg-slate-50 transition-colors py-4"
                onClick={() => toggleExpand(provider.id)}
              >
                <div className="flex items-center gap-3">
                  {isExpanded
                    ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  }
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base">{provider.name}</CardTitle>
                    <CardDescription className="text-xs">{provider.kind}</CardDescription>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      provider.enabled
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                    onClick={e => e.stopPropagation()}
                  >
                    {provider.enabled ? '已启用' : '已禁用'}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1 shrink-0"
                    onClick={e => { e.stopPropagation(); testConnection(provider) }}
                    disabled={isTesting}
                  >
                    {isTesting
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <RotateCcw className="h-3 w-3" />
                    }
                    测试连接
                  </Button>
                </div>
                {/* 测试结果内联提示 */}
                {result?.msg && (
                  <p className={`mt-1 ml-7 text-xs ${result.ok ? 'text-green-600' : 'text-red-500'}`}>
                    {result.ok ? '✓ ' : '✗ '}{result.msg}
                  </p>
                )}
              </CardHeader>

              {/* 编辑表单区域 */}
              {isExpanded && (
                <CardContent className="border-t bg-slate-50 pt-4 pb-5 space-y-4">
                  {!draft ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> 加载中…
                    </div>
                  ) : (
                    <>
                      {/* name */}
                      <div className="grid grid-cols-[120px_1fr] items-center gap-3">
                        <label className="text-sm font-medium text-right">名称</label>
                        <Input
                          value={draft.name}
                          onChange={e => patchDraft(provider.id, { name: e.target.value })}
                          placeholder="提供商名称"
                        />
                      </div>
                      {/* api_key */}
                      <div className="grid grid-cols-[120px_1fr] items-center gap-3">
                        <label className="text-sm font-medium text-right">API Key</label>
                        <Input
                          type="password"
                          value={draft.api_key}
                          onChange={e => patchDraft(provider.id, { api_key: e.target.value })}
                          placeholder={
                            detailCache[provider.id]?.has_api_key
                              ? '已设置（留空保持不变）'
                              : '输入 API Key'
                          }
                          autoComplete="new-password"
                        />
                      </div>
                      {/* base_url */}
                      <div className="grid grid-cols-[120px_1fr] items-center gap-3">
                        <label className="text-sm font-medium text-right">Base URL</label>
                        <Input
                          value={draft.base_url}
                          onChange={e => patchDraft(provider.id, { base_url: e.target.value })}
                          placeholder="https://api.example.com/v1"
                        />
                      </div>
                      {/* enabled */}
                      <div className="grid grid-cols-[120px_1fr] items-center gap-3">
                        <label className="text-sm font-medium text-right">启用</label>
                        <Switch
                          checked={draft.enabled}
                          onCheckedChange={val => patchDraft(provider.id, { enabled: val })}
                        />
                      </div>
                      {/* 保存按钮 */}
                      <div className="flex justify-end pt-1">
                        <Button
                          size="sm"
                          className="gap-2"
                          onClick={() => handleSave(provider.id)}
                          disabled={isSaving}
                        >
                          {isSaving
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <Save className="h-4 w-4" />
                          }
                          保存
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              )}
            </Card>
          )
        })}
      </div>

      {/* 新增提供商 Dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={open => {
          if (!creating) { setCreateOpen(open); if (!open) setCreateForm(EMPTY_CREATE_FORM) }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>新增提供商</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* name */}
            <div className="grid grid-cols-[80px_1fr] items-center gap-3">
              <label className="text-sm font-medium text-right">名称 *</label>
              <Input
                value={createForm.name}
                onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                placeholder="我的提供商"
              />
            </div>
            {/* kind */}
            <div className="grid grid-cols-[80px_1fr] items-center gap-3">
              <label className="text-sm font-medium text-right">类型</label>
              <Select
                value={createForm.kind}
                onValueChange={v => setCreateForm(f => ({ ...f, kind: v as CreateForm['kind'] }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai_compatible">OpenAI Compatible</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* api_key */}
            <div className="grid grid-cols-[80px_1fr] items-center gap-3">
              <label className="text-sm font-medium text-right">API Key</label>
              <Input
                type="password"
                value={createForm.api_key}
                onChange={e => setCreateForm(f => ({ ...f, api_key: e.target.value }))}
                placeholder="sk-..."
                autoComplete="new-password"
              />
            </div>
            {/* base_url */}
            <div className="grid grid-cols-[80px_1fr] items-center gap-3">
              <label className="text-sm font-medium text-right">Base URL</label>
              <Input
                value={createForm.base_url}
                onChange={e => setCreateForm(f => ({ ...f, base_url: e.target.value }))}
                placeholder="https://api.openai.com/v1"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => { setCreateOpen(false); setCreateForm(EMPTY_CREATE_FORM) }}
              disabled={creating}
            >
              取消
            </Button>
            <Button onClick={handleCreate} disabled={creating} className="gap-2">
              {creating && <Loader2 className="h-4 w-4 animate-spin" />}
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default ProvidersManagementPage


