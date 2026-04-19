import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, Plus, RotateCcw } from 'lucide-react'

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

interface ExpandedState {
  [key: string]: boolean
}

const ProvidersManagementPage = () => {
  const [providers, setProviders] = useState<Provider[]>([])
  const [expanded, setExpanded] = useState<ExpandedState>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingData, setEditingData] = useState<Record<string, ProviderDetail>>({})
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<Record<string, string>>({})

  const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000/api'

  useEffect(() => {
    fetchProviders()
  }, [])

  const fetchProviders = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_BASE}/providers`)
      if (!response.ok) throw new Error('获取提供商列表失败')
      const data = await response.json()
      setProviders(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误')
    } finally {
      setLoading(false)
    }
  }

  const toggleExpand = async (providerId: string) => {
    const isExpanding = !expanded[providerId]
    setExpanded({ ...expanded, [providerId]: isExpanding })

    if (isExpanding && !editingData[providerId]) {
      try {
        const response = await fetch(`${API_BASE}/providers/${providerId}`)
        if (!response.ok) throw new Error('获取详情失败')
        const data = await response.json()
        setEditingData({ ...editingData, [providerId]: data })
      } catch (err) {
        setError(err instanceof Error ? err.message : '获取详情失败')
      }
    }
  }

  const testConnection = async (providerId: string) => {
    try {
      setTestingId(providerId)
      const response = await fetch(`${API_BASE}/providers/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider_id: providerId }),
      })
      if (!response.ok) throw new Error('连接测试失败')
      const data = await response.json()
      setTestResult({ ...testResult, [providerId]: data.message || '连接成功' })
    } catch (err) {
      setTestResult({
        ...testResult,
        [providerId]: err instanceof Error ? err.message : '连接失败',
      })
    } finally {
      setTestingId(null)
    }
  }

  const handleSaveProvider = async (providerId: string) => {
    const data = editingData[providerId]
    if (!data) return

    try {
      const response = await fetch(`${API_BASE}/providers/${providerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: data.api_key,
          base_url: data.base_url,
          enabled: data.enabled,
          default_models: data.default_models,
        }),
      })
      if (!response.ok) throw new Error('保存失败')
      await fetchProviders()
      setExpanded({ ...expanded, [providerId]: false })
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">提供商管理</h1>
          <p className="text-sm text-muted-foreground">配置和管理 AI 提供商</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          新增提供商
        </Button>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <div className="space-y-3">
        {providers.map((provider) => (
          <Card key={provider.id} className="overflow-hidden">
            <CardHeader
              className="cursor-pointer hover:bg-slate-50"
              onClick={() => toggleExpand(provider.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <CardTitle>{provider.name}</CardTitle>
                  <CardDescription>{provider.kind}</CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={provider.enabled}
                    onChange={(e) => {
                      e.stopPropagation()
                    }}
                    className="h-4 w-4 rounded"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onClick={(e) => {
                      e.stopPropagation()
                      testConnection(provider.id)
                    }}
                    disabled={testingId === provider.id}
                  >
                    <RotateCcw className="h-3 w-3" />
                    测试
                  </Button>
                </div>
              </div>
            </CardHeader>
            {testResult[provider.id] && (
              <CardContent className="border-t pt-3">
                <div className="text-xs text-muted-foreground">{testResult[provider.id]}</div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}

export default ProvidersManagementPage

