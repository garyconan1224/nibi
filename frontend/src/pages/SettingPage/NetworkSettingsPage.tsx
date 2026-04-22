import { useState } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Network, Save, ShieldCheck, FolderCog } from 'lucide-react'
import { useConfigStore } from '@/store/configStore'

/**
 * 网络设置页：集中管理与"下载引擎 + 外网访问"相关的全局配置。
 * 与「提供商管理」彻底解耦——提供商负责模型 API，网络设置负责媒体抓取。
 */
const NetworkSettingsPage = () => {
  const { t } = useTranslation('settings')
  const config = useConfigStore()

  // 本地草稿（避免每键入一次就触发持久化）
  const [proxy, setProxy]               = useState(config.httpProxy)
  const [poToken, setPoToken]           = useState(config.poToken)
  const [visitorData, setVisitorData]   = useState(config.visitorData)
  const [cookieDirs, setCookieDirs]     = useState(config.cookieBaseDirs)

  const saveProxy = () => {
    config.setConfig({ httpProxy: proxy.trim() })
    toast.success(t('network.proxySaved'))
  }

  const saveDownloadExtras = () => {
    config.setConfig({
      poToken: poToken.trim(),
      visitorData: visitorData.trim(),
      cookieBaseDirs: cookieDirs,
    })
    toast.success(t('network.downloadEnhancementSaved'))
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t('network.title')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('network.subtitle')}
        </p>
      </div>

      {/* ── 代理服务器 ── */}
      <Card className="mb-6">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Network className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>{t('network.proxyTitle')}</CardTitle>
              <CardDescription>
                {t('network.proxyDescription')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="proxy" className="text-sm">{t('network.proxyLabel')}</Label>
            <Input
              id="proxy"
              type="text"
              value={proxy}
              onChange={e => setProxy(e.target.value)}
              placeholder={t('network.proxyPlaceholder')}
              className="text-sm"
            />
            <p className="text-xs text-muted-foreground">
              {t('network.proxySupport')}
            </p>
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={saveProxy} className="gap-2">
              <Save className="h-4 w-4" /> {t('network.proxySaveButton')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── 下载增强（Token / Cookie） ── */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>{t('network.downloadEnhancementCardTitle')}</CardTitle>
              <CardDescription>
                {t('network.downloadEnhancementCardDescription')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="po-token" className="text-sm">{t('network.poTokenLabel')}</Label>
            <Input
              id="po-token"
              type="text"
              value={poToken}
              onChange={e => setPoToken(e.target.value)}
              placeholder={t('network.poTokenPlaceholder')}
              className="text-sm font-mono"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="visitor-data" className="text-sm">{t('network.visitorDataLabel')}</Label>
            <Input
              id="visitor-data"
              type="text"
              value={visitorData}
              onChange={e => setVisitorData(e.target.value)}
              placeholder={t('network.visitorDataPlaceholder')}
              className="text-sm font-mono"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="cookie-dirs" className="text-sm flex items-center gap-1.5">
              <FolderCog className="h-3.5 w-3.5" />
              {t('network.cookieDirsLabel')}
            </Label>
            <Textarea
              id="cookie-dirs"
              value={cookieDirs}
              onChange={e => setCookieDirs(e.target.value)}
              placeholder={t('network.cookieDirsPlaceholder')}
              className="text-sm font-mono min-h-[88px]"
            />
            <p className="text-xs text-muted-foreground">
              {t('network.cookieDirsDescription')}
            </p>
          </div>

          <div className="flex justify-end">
            <Button size="sm" onClick={saveDownloadExtras} className="gap-2">
              <Save className="h-4 w-4" /> {t('network.downloadEnhancementSaveButton')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default NetworkSettingsPage

