import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, RefreshCw, ChevronDown, ChevronRight, AlertCircle, Bot } from 'lucide-react'
import { http } from '@/services/client'

/* ─── 类型定义 ─── */
interface Provider {
  id: string
  name: string
  kind: string
  enabled: boolean
  base_url: string
  has_api_key: boolean
}

interface ModelItem {
  id: string
  name: string
}

interface ProviderWithModels extends Provider {
  models: ModelItem[]
  modelError?: string
  loadingModels: boolean
  expanded: boolean
}

const ModelManagementPage = () => {
  const [providers, setProviders] = useState<ProviderWithModels[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /* ── 加载提供商列表 ── */
  const fetchProviders = async () => {
    try {
      setListLoading(true)
      const res = await http.get('/providers')
      const list: Provider[] = res.data.data ?? res.data
      setProviders(list.map(p => ({
        ...p,
        models: [],
        loadingModels: false,
        expanded: false,
      })))
      setError(null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : '加载提供商失败'
      setError(msg)
      toast.error(msg)
    } finally {
      setListLoading(false)
    }
  }

  useEffect(() => { fetchProviders() }, [])

  /* ── 展开/收起并加载模型 ── */
  const toggleProvider = async (id: string) => {
    setProviders(prev => prev.map(p => {
      if (p.id !== id) return p
      // 已有模型数据 → 直接切换展开
      if (p.models.length > 0 || p.modelError) {
        return { ...p, expanded: !p.expanded }
      }
      return { ...p, expanded: true, loadingModels: true }
    }))

    const provider = providers.find(p => p.id === id)
    // 已加载过则不重复请求
    if (!provider || provider.models.length > 0 || provider.modelError) return

    try {
      const res = await http.get(`/providers/${id}/models`)
      const data = res.data.data ?? res.data
      setProviders(prev => prev.map(p =>
        p.id === id
          ? { ...p, models: data.models ?? [], modelError: data.error, loadingModels: false }
          : p
      ))
    } catch (e) {
      const msg = e instanceof Error ? e.message : '获取模型失败'
      setProviders(prev => prev.map(p =>
        p.id === id ? { ...p, modelError: msg, loadingModels: false } : p
      ))
    }
  }

  /* ── 刷新单个提供商模型 ── */
  const refreshModels = async (id: string) => {
    setProviders(prev => prev.map(p =>
      p.id === id ? { ...p, models: [], modelError: undefined, loadingModels: true } : p
    ))
    try {
      const res = await http.get(`/providers/${id}/models`)
      const data = res.data.data ?? res.data
      setProviders(prev => prev.map(p =>
        p.id === id
          ? { ...p, models: data.models ?? [], modelError: data.error, loadingModels: false }
          : p
      ))
    } catch (e) {
      const msg = e instanceof Error ? e.message : '刷新失败'
      setProviders(prev => prev.map(p =>
        p.id === id ? { ...p, modelError: msg, loadingModels: false } : p
      ))
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
          <h1 className="text-2xl font-bold">模型管理</h1>
          <p className="text-sm text-muted-foreground">查看各提供商支持的模型列表</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={fetchProviders}>
          <RefreshCw className="h-4 w-4" />
          刷新
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
            暂无提供商，请先在「提供商管理」中添加配置
          </div>
        )}

        {providers.map(provider => (
          <Card key={provider.id} className="overflow-hidden">
            {/* 提供商行 */}
            <CardHeader
              className="cursor-pointer select-none hover:bg-slate-50 transition-colors py-4"
              onClick={() => toggleProvider(provider.id)}
            >
              <div className="flex items-center gap-3">
                {provider.expanded
                  ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                }
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base">{provider.name}</CardTitle>
                  <CardDescription className="text-xs">{provider.kind}</CardDescription>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  provider.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {provider.enabled ? '已启用' : '已禁用'}
                </span>
                {provider.expanded && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1 shrink-0 h-7 px-2"
                    onClick={e => { e.stopPropagation(); refreshModels(provider.id) }}
                    disabled={provider.loadingModels}
                    title="刷新模型列表"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${provider.loadingModels ? 'animate-spin' : ''}`} />
                  </Button>
                )}
              </div>
            </CardHeader>

            {/* 模型列表展开区 */}
            {provider.expanded && (
              <CardContent className="border-t bg-slate-50 pt-4 pb-5">
                {provider.loadingModels ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> 正在从提供商接口获取模型列表…
                  </div>
                ) : provider.modelError ? (
                  <div className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-xs text-red-600">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium mb-1">获取模型列表失败</p>
                      <p>{provider.modelError}</p>
                    </div>
                  </div>
                ) : provider.models.length === 0 ? (
                  <p className="text-sm text-muted-foreground">该提供商暂无可用模型</p>
                ) : (
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {provider.models.map(model => (
                      <div
                        key={model.id}
                        className="flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs"
                      >
                        <Bot className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                        <span className="truncate font-mono text-gray-700">{model.id}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}

export default ModelManagementPage

