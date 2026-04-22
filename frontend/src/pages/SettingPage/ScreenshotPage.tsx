import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Camera, Construction } from 'lucide-react'
import { useTranslation } from 'react-i18next'

/**
 * 视频截图设置页（骨架）。
 * 预留后续集中管理抽帧间隔、网格拼图尺寸、图片压缩质量、
 * 视觉理解默认模型等截图相关配置。
 */
const ScreenshotPage = () => {
  const { t } = useTranslation('settings')
  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t('screenshot.title')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('screenshot.subtitle')}
        </p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>{t('screenshot.cardTitle')}</CardTitle>
              <CardDescription>
                {t('screenshot.cardDescription')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-4 text-sm text-muted-foreground">
            <Construction className="h-4 w-4" />
            <span>{t('screenshot.placeholderMessage')}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default ScreenshotPage

