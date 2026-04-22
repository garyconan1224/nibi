import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useTranslation } from 'react-i18next'

const AboutPage = () => {
  const { t } = useTranslation('settings')
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t('about.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('about.subtitle')}</p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{t('about.appName')}</CardTitle>
          <CardDescription>{t('about.appDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <span className="text-sm font-medium text-gray-600">{t('about.version')}</span>
            <span className="text-sm text-gray-900">{t('about.versionNumber')}</span>
          </div>
          <div className="flex items-center justify-between border-b pb-3">
            <span className="text-sm font-medium text-gray-600">{t('about.projectName')}</span>
            <span className="text-sm text-gray-900">{t('about.appName')}</span>
          </div>
          <div className="pt-2">
            <p className="text-sm text-muted-foreground">
              {t('about.appSummary')}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default AboutPage

