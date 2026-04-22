import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { AudioLines, Construction } from 'lucide-react'
import { useTranslation } from 'react-i18next'

/**
 * 音频转写设置页（骨架）。
 * 预留后续集中管理 ASR 引擎（fast-whisper / groq / bcut / kuaishou）、
 * 模型大小、语言偏好、GPU/CPU 模式等配置。
 */
const TranscriberPage = () => {
  const { t } = useTranslation('settings')
  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t('transcriber.title')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('transcriber.subtitle')}
        </p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <AudioLines className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>{t('transcriber.cardTitle')}</CardTitle>
              <CardDescription>
                {t('transcriber.cardDescription')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-4 text-sm text-muted-foreground">
            <Construction className="h-4 w-4" />
            <span>{t('transcriber.placeholderMessage')}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default TranscriberPage

