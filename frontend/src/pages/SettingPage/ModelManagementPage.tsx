import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { AlertCircle, Loader2, RefreshCw, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { http } from '@/services/client'
import { useConfigStore } from '@/store/configStore'
import {
  ModelProviderGroup,
  type ModelProviderGroupItem,
} from '@/components/settings/models/ModelProviderGroup'

/** 后端 /providers 返回项 */
interface ProviderSummary {
  id: string
  name: string
  kind: string
  enabled: boolean
  base_url: string
  has_api_key: boolean
  capabilities?: string[]
}

interface ModelItem {
  id: string
  name: string
}

/** 页面本地状态：在 ProviderSummary 基础上挂模型加载态 */
interface ProviderWithModels extends ProviderSummary {
  models: ModelItem[]
  modelError?: string
  loadingModels: boolean
  expanded: boolean
}

/** capability 过滤：chat=文本对话;vision=视觉理解 */
type CapabilityFilter = 'all' | 'chat' | 'vision'

const ModelManagementPage = () => {
  const { t } = useTranslation('settings')
  const [providers, setProviders] = useState<ProviderWithModels[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 顶部搜索关键字(同时匹配 provider name/kind 与 model id/name)
  const [keyword, setKeyword] = useState('')
  const [capFilter, setCapFilter] = useState<CapabilityFilter>('all')

  // configStore:读取/写入默认文本与视觉模型
  const textProviderId = useConfigStore((s) => s.textProviderId)
  const textModelId = useConfigStore((s) => s.textModelId)
  const visionProviderId = useConfigStore((s) => s.visionProviderId)
  const visionModelId = useConfigStore((s) => s.visionModelId)
  const setConfig = useConfigStore((s) => s.setConfig)

  /* ── 加载提供商列表 ── */
  const fetchProviders = async () => {
    try {
      setListLoading(true)
      const res = await http.get('/providers')
      const list: ProviderSummary[] = res.data.data ?? res.data
      setProviders(list.map(p => ({
        ...p,
        models: [],
        loadingModels: false,
        expanded: false,
      })))
      setError(null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('model.fetchProvidersFailed')
      setError(msg)
      // 仅在第一次触发错误时显示 toast，避免重复提示
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
          ? { ...p, models: data.models ?? [], modelError: undefined, loadingModels: false }
          : p
      ))
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('model.fetchModelsFailed')
      setProviders(prev => prev.map(p =>
        p.id === id ? { ...p, modelError: msg, loadingModels: false } : p
      ))
      // 仅在无全局错误时显示 toast 提示，避免重复
      if (!error) {
        toast.error(msg)
      }
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
          ? { ...p, models: data.models ?? [], modelError: undefined, loadingModels: false }
          : p
      ))
      // 刷新成功，清除全局错误
      setError(null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('model.refreshFailed')
      setProviders(prev => prev.map(p =>
        p.id === id ? { ...p, modelError: msg, loadingModels: false } : p
      ))
      toast.error(msg)
    }
  }

  /* ── 设为默认文本/视觉模型(role=text|vision);next=false 代表清除默认 ── */
  const setAsDefault = (
    providerId: string,
    role: 'text' | 'vision',
    modelId: string,
    next: boolean,
  ) => {
    if (role === 'text') {
      setConfig(
        next
          ? { textProviderId: providerId, textModelId: modelId }
          : { textProviderId: '', textModelId: '' },
      )
      toast.success(
        next ? t('model.defaultText.saved') : t('model.defaultText.cleared'),
      )
    } else {
      setConfig(
        next
          ? { visionProviderId: providerId, visionModelId: modelId }
          : { visionProviderId: '', visionModelId: '' },
      )
      toast.success(
        next ? t('model.defaultVision.saved') : t('model.defaultVision.cleared'),
      )
    }
  }

  /* ── 过滤 + 适配到 ModelProviderGroup 入参 ── */
  const lowerKw = keyword.trim().toLowerCase()
  const groupedList: ModelProviderGroupItem[] = useMemo(
    () =>
      providers
        // capability 过滤:all 通过;chat/vision 仅保留声明对应 capability 的 provider
        .filter((p) => {
          if (capFilter === 'all') return true
          return Array.isArray(p.capabilities) && p.capabilities.includes(capFilter)
        })
        .map((p) => {
          const filteredModels = !lowerKw
            ? p.models
            : p.models.filter(
                (m) =>
                  m.id.toLowerCase().includes(lowerKw) ||
                  (m.name ?? '').toLowerCase().includes(lowerKw),
              )
          return {
            id: p.id,
            name: p.name,
            kind: p.kind,
            enabled: p.enabled,
            capabilities: p.capabilities,
            loadingModels: p.loadingModels,
            modelError: p.modelError,
            filteredModels,
            totalModels: p.models.length,
          }
        })
        // 若关键字匹配了 provider 名称本身,即便模型未展开也保留;否则在存在关键字时仅保留有命中模型的组
        .filter((g) => {
          if (!lowerKw) return true
          const nameHit =
            g.name.toLowerCase().includes(lowerKw) || g.kind.toLowerCase().includes(lowerKw)
          return nameHit || g.filteredModels.length > 0
        }),
    [providers, capFilter, lowerKw],
  )

  /* ─── 渲染 ─── */
  if (listLoading) {
    return (
      <div className="flex h-full items-center justify-center gap-2" style={{ color: 'var(--mut)' }}>
        <Loader2 className="size-5 animate-spin" />
        <span>{t('model.loading')}</span>
      </div>
    )
  }

  const capChips: { key: CapabilityFilter; label: string }[] = [
    { key: 'all', label: t('model.filter.all') },
    { key: 'chat', label: t('model.filter.chat') },
    { key: 'vision', label: t('model.filter.vision') },
  ]

  return (
    <div className="settings-panel">
      {/* 顶部标题栏 */}
      <div className="settings-header">
        <div>
          <h2>{t('model.title')}</h2>
          <div className="settings-header-desc">{t('model.subtitle')}</div>
        </div>
        <div className="settings-header-actions">
          <button
            type="button"
            className="settings-reset-btn"
            onClick={fetchProviders}
          >
            <RefreshCw size={14} />
            {t('model.refresh')}
          </button>
        </div>
      </div>

      {/* 搜索 + capability 过滤 */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          marginBottom: 20,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--mut)',
            }}
          />
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder={t('model.searchPlaceholder')}
            style={{ paddingLeft: 34 }}
          />
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {capChips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setCapFilter(c.key)}
              className="chip"
              style={{
                background:
                  capFilter === c.key ? 'var(--fg)' : 'var(--bgalt)',
                color:
                  capFilter === c.key ? 'var(--bg)' : 'var(--fg2)',
                border:
                  capFilter === c.key
                    ? '1px solid var(--fg)'
                    : '1px solid var(--bdr)',
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* 全局错误横幅 */}
      {error && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: 10,
          marginBottom: 16,
          borderRadius: 'var(--r)',
          border: '1px solid #fca5a5',
          background: '#fef2f2',
          color: '#b91c1c',
          fontSize: 'var(--xs)',
        }}>
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
          <button
            style={{ marginLeft: 'auto', color: '#f87171' }}
            onClick={() => setError(null)}
          >
            ✕
          </button>
        </div>
      )}

      {/* 分组列表 */}
      <div className="settings-section">
        <div className="settings-section-title">
          {t('model.providersSection', '提供商模型列表')}
        </div>
        {groupedList.length === 0 ? (
          <div className="settings-empty">
            <Search size={24} />
            <p>
              {t(keyword || capFilter !== 'all' ? 'model.noMatch' : 'model.noProviders')}
            </p>
          </div>
        ) : (
          groupedList.map((g) => (
            <ModelProviderGroup
              key={g.id}
              provider={g}
              expanded={providers.find((p) => p.id === g.id)?.expanded ?? false}
              onToggleExpand={() => toggleProvider(g.id)}
              onRefresh={() => refreshModels(g.id)}
              defaultText={{ providerId: textProviderId, modelId: textModelId }}
              defaultVision={{ providerId: visionProviderId, modelId: visionModelId }}
              onSetDefault={(role, modelId, next) =>
                setAsDefault(g.id, role, modelId, next)
              }
            />
          ))
        )}
      </div>
    </div>
  )
}

export default ModelManagementPage

