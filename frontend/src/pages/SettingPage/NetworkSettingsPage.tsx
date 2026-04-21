import { useState } from 'react'
import { toast } from 'sonner'
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
  const config = useConfigStore()

  // 本地草稿（避免每键入一次就触发持久化）
  const [proxy, setProxy]               = useState(config.httpProxy)
  const [poToken, setPoToken]           = useState(config.poToken)
  const [visitorData, setVisitorData]   = useState(config.visitorData)
  const [cookieDirs, setCookieDirs]     = useState(config.cookieBaseDirs)

  const saveProxy = () => {
    config.setConfig({ httpProxy: proxy.trim() })
    toast.success('网络代理已保存')
  }

  const saveDownloadExtras = () => {
    config.setConfig({
      poToken: poToken.trim(),
      visitorData: visitorData.trim(),
      cookieBaseDirs: cookieDirs,
    })
    toast.success('下载增强配置已保存')
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">网络设置</h1>
        <p className="text-sm text-muted-foreground">
          配置外网访问与媒体下载相关的全局参数
        </p>
      </div>

      {/* ── 代理服务器 ── */}
      <Card className="mb-6">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Network className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>网络代理服务器</CardTitle>
              <CardDescription>
                访问海外平台时的网络代理；留空表示直连
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="proxy" className="text-sm">代理地址</Label>
            <Input
              id="proxy"
              type="text"
              value={proxy}
              onChange={e => setProxy(e.target.value)}
              placeholder="示例：http://127.0.0.1:7890 或 socks5://127.0.0.1:1080"
              className="text-sm"
            />
            <p className="text-xs text-muted-foreground">
              支持 http:// 或 socks5:// 协议，仅在媒体抓取阶段生效
            </p>
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={saveProxy} className="gap-2">
              <Save className="h-4 w-4" /> 保存代理
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
              <CardTitle>下载增强</CardTitle>
              <CardDescription>
                用于突破风控与限流；可选，留空即使用默认策略
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="po-token" className="text-sm">PO Token</Label>
            <Input
              id="po-token"
              type="text"
              value={poToken}
              onChange={e => setPoToken(e.target.value)}
              placeholder="YouTube PO Token（可选）"
              className="text-sm font-mono"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="visitor-data" className="text-sm">Visitor Data</Label>
            <Input
              id="visitor-data"
              type="text"
              value={visitorData}
              onChange={e => setVisitorData(e.target.value)}
              placeholder="YouTube Visitor Data（可选）"
              className="text-sm font-mono"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="cookie-dirs" className="text-sm flex items-center gap-1.5">
              <FolderCog className="h-3.5 w-3.5" />
              Cookie 文件目录
            </Label>
            <Textarea
              id="cookie-dirs"
              value={cookieDirs}
              onChange={e => setCookieDirs(e.target.value)}
              placeholder={'每行一个绝对路径，例如：\n/Users/you/cookies\n/data/cookies'}
              className="text-sm font-mono min-h-[88px]"
            />
            <p className="text-xs text-muted-foreground">
              留空将使用内置默认目录；目录下可放置 cookies.txt 或 bilibili_cookies.txt
            </p>
          </div>

          <div className="flex justify-end">
            <Button size="sm" onClick={saveDownloadExtras} className="gap-2">
              <Save className="h-4 w-4" /> 保存下载增强
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default NetworkSettingsPage

