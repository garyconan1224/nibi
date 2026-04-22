import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Network, ShieldCheck, FolderCog } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Section } from '@/components/ui/section'
import { FieldRow } from '@/components/ui/field-row'
import { useConfigStore } from '@/store/configStore'
import { useSettingsShellStore } from '@/store/settingsShellStore'
import { useDirtyGuard } from '@/hooks/useDirtyGuard'

/**
 * 网络设置页（DESIGN_NOTES_SETTINGS.md §4.3）。
 *
 * - 三 Section：代理 / PO Token / Cookie 目录；
 * - 草稿-快照模型：本地 draft + useDirtyGuard(config) 基线；
 * - 顶层 SaveBar 由 settingsShellStore 桥接，不再使用页内 Save 按钮。
 */
interface NetworkDraft extends Record<string, unknown> {
  httpProxy: string
  poToken: string
  visitorData: string
  cookieBaseDirs: string
}

const NetworkSettingsPage = () => {
  const { t } = useTranslation('settings')

  // 分片订阅 configStore：仅在相关字段变化时 re-render
  const httpProxy      = useConfigStore((s) => s.httpProxy)
  const poToken        = useConfigStore((s) => s.poToken)
  const visitorData    = useConfigStore((s) => s.visitorData)
  const cookieBaseDirs = useConfigStore((s) => s.cookieBaseDirs)
  const setConfig      = useConfigStore((s) => s.setConfig)

  const setSaveBar   = useSettingsShellStore((s) => s.setSaveBar)
  const resetSaveBar = useSettingsShellStore((s) => s.resetSaveBar)

  // 基线快照：来自持久化 store；store 外部变更时（例如另一个 Tab 修改）通过 useEffect 同步
  const baseline = useMemo<NetworkDraft>(
    () => ({ httpProxy, poToken, visitorData, cookieBaseDirs }),
    [httpProxy, poToken, visitorData, cookieBaseDirs],
  )

  const [draft, setDraft] = useState<NetworkDraft>(baseline)
  const [isSaving, setIsSaving] = useState(false)

  // 基线刷新：仅在 store 侧值变化时同步（避免本地草稿被外部回填覆盖）
  useEffect(() => {
    setDraft((prev) =>
      prev.httpProxy === baseline.httpProxy &&
      prev.poToken === baseline.poToken &&
      prev.visitorData === baseline.visitorData &&
      prev.cookieBaseDirs === baseline.cookieBaseDirs
        ? prev
        : baseline,
    )
  }, [baseline])

  const guard = useDirtyGuard<NetworkDraft>({
    initial: baseline,
    current: draft,
    message: t('dirty.leaveConfirm'),
  })

  const patch = useCallback((p: Partial<NetworkDraft>) => {
    setDraft((prev) => ({ ...prev, ...p }))
  }, [])

  const handleReset = useCallback(() => {
    setDraft(baseline)
  }, [baseline])

  const handleSave = useCallback(() => {
    setIsSaving(true)
    try {
      const next: NetworkDraft = {
        httpProxy: draft.httpProxy.trim(),
        poToken: draft.poToken.trim(),
        visitorData: draft.visitorData.trim(),
        cookieBaseDirs: draft.cookieBaseDirs,
      }
      setConfig(next)
      setDraft(next)
      guard.commit(next)
      toast.success(t('network.saved'))
    } finally {
      setIsSaving(false)
    }
  }, [draft, setConfig, guard, t])

  // SaveBar 桥：推送脏计数 + 保存/重置回调；卸载归零
  useEffect(() => {
    setSaveBar({
      dirtyCount: guard.dirtyCount,
      saving: isSaving,
      onSave: handleSave,
      onReset: handleReset,
    })
    return () => resetSaveBar()
  }, [guard.dirtyCount, isSaving, handleSave, handleReset, setSaveBar, resetSaveBar])

  const dirty = guard.dirtyMap

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight">{t('network.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('network.subtitle')}</p>
      </div>

      {/* ── Section A · 网络代理 ── */}
      <Section
        icon={<Network className="size-4" />}
        title={t('network.proxyTitle')}
        description={t('network.proxyDescription')}
      >
        <FieldRow
          htmlFor="proxy"
          label={t('network.proxyLabel')}
          hint={t('network.proxySupport')}
          dirty={dirty.httpProxy}
        >
          <Input
            id="proxy"
            type="text"
            value={draft.httpProxy}
            onChange={(e) => patch({ httpProxy: e.target.value })}
            placeholder={t('network.proxyPlaceholder')}
            className="text-sm"
          />
        </FieldRow>
      </Section>

      {/* ── Section B · PO Token ── */}
      <Section
        icon={<ShieldCheck className="size-4" />}
        title={t('network.poTokenSectionTitle')}
        description={t('network.poTokenSectionDescription')}
      >
        <FieldRow
          htmlFor="po-token"
          label={t('network.poTokenLabel')}
          dirty={dirty.poToken}
        >
          <Input
            id="po-token"
            type="text"
            value={draft.poToken}
            onChange={(e) => patch({ poToken: e.target.value })}
            placeholder={t('network.poTokenPlaceholder')}
            className="text-sm font-mono"
          />
        </FieldRow>
        <FieldRow
          htmlFor="visitor-data"
          label={t('network.visitorDataLabel')}
          dirty={dirty.visitorData}
        >
          <Input
            id="visitor-data"
            type="text"
            value={draft.visitorData}
            onChange={(e) => patch({ visitorData: e.target.value })}
            placeholder={t('network.visitorDataPlaceholder')}
            className="text-sm font-mono"
          />
        </FieldRow>
      </Section>

      {/* ── Section C · Cookie 目录 ── */}
      <Section
        icon={<FolderCog className="size-4" />}
        title={t('network.cookieSectionTitle')}
        description={t('network.cookieSectionDescription')}
      >
        <FieldRow
          htmlFor="cookie-dirs"
          label={t('network.cookieDirsLabel')}
          hint={t('network.cookieDirsDescription')}
          dirty={dirty.cookieBaseDirs}
        >
          <Textarea
            id="cookie-dirs"
            value={draft.cookieBaseDirs}
            onChange={(e) => patch({ cookieBaseDirs: e.target.value })}
            placeholder={t('network.cookieDirsPlaceholder')}
            className="min-h-[88px] text-sm font-mono"
          />
        </FieldRow>
      </Section>
    </div>
  )
}

export default NetworkSettingsPage

