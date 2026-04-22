import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Camera, Save, AlertCircle } from 'lucide-react'
import { useConfigStore } from '@/store/configStore'
import {
  fetchScreenshotConfig,
  updateScreenshotConfig,
  getQualityLevels,
  getGridPresets,
} from '@/services/screenshot'

/**
 * 视频截图设置页（实现）。
 * 管理抽帧间隔、网格拼图尺寸、图片压缩质量、视觉理解默认参数等配置。
 */
const ScreenshotPage = () => {
  const { t } = useTranslation('settings')
  const configStore = useConfigStore()

  // 本地表单状态
  const [defaultInterval, setDefaultInterval] = useState(configStore.screenshotSettings.defaultInterval)
  const [gridSize, setGridSize] = useState(`${configStore.screenshotSettings.gridSize[0]}x${configStore.screenshotSettings.gridSize[1]}`)
  const [jpegQuality, setJpegQuality] = useState(configStore.screenshotSettings.jpegQuality)
  const [embedInNote, setEmbedInNote] = useState(configStore.screenshotSettings.embedInNote)

  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // 同步后端配置（可选）
  useEffect(() => {
    const load = async () => {
      try {
        await fetchScreenshotConfig()
        // 可选：与前端状态同步（取决于需求）
      } catch (err) {
        console.error('Failed to fetch screenshot config:', err)
      }
    }
    load()
  }, [])

  // 处理保存
  const handleSave = async () => {
    try {
      setIsSaving(true)
      setError(null)
      setSuccess(false)

      const [cols, rows] = gridSize.split('x').map(Number)
      if (!cols || !rows || cols < 1 || cols > 10 || rows < 1 || rows > 10) {
        setError('网格大小必须为 1-10 的整数')
        setIsSaving(false)
        return
      }

      // 更新后端配置
      await updateScreenshotConfig({
        defaultInterval,
        gridSize: [cols, rows],
        jpegQuality,
        embedInNote,
      })

      // 更新前端 store
      configStore.setConfig({
        screenshotSettings: {
          defaultInterval,
          gridSize: [cols, rows],
          jpegQuality,
          embedInNote,
        },
      })

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration')
    } finally {
      setIsSaving(false)
    }
  }



  return (
    <div className="p-6 max-w-3xl space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold">{t('screenshot.title')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('screenshot.subtitle')}
        </p>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {/* 成功提示 */}
      {success && (
        <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          ✓ {t('settings.common.savSuccess') || '配置已保存'}
        </div>
      )}

      {/* 截图配置卡 */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>{t('screenshot.title')}</CardTitle>
              <CardDescription>
                {t('screenshot.subtitle')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* 默认抽帧间隔 */}
          <div className="space-y-2">
            <Label>{t('screenshot.interval.title') || '默认抽帧间隔'}</Label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="1"
                max="60"
                step="1"
                value={defaultInterval}
                onChange={(e) => setDefaultInterval(Number(e.target.value))}
                className="flex-1 h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-sm font-semibold w-12 text-right">{defaultInterval}s</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('screenshot.interval.description') || '每多少秒抽取一帧关键画面'}
            </p>
          </div>

          {/* 网格拼图大小 */}
          <div className="space-y-2">
            <Label>{t('screenshot.grid.title') || '网格拼图大小'}</Label>
            <div className="flex gap-2">
              <Select value={gridSize} onValueChange={setGridSize}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getGridPresets().map((preset) => (
                    <SelectItem key={preset.label} value={`${preset.value[0]}x${preset.value[1]}`}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-sm text-muted-foreground pt-2">
                {(() => {
                  const [cols, rows] = gridSize.split('x').map(Number)
                  return `总共 ${cols * rows} 帧`
                })()}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('screenshot.grid.description') || '选择网格尺寸，推荐 3x3 用于平衡性能与质量'}
            </p>
          </div>

          {/* JPEG 质量 */}
          <div className="space-y-2">
            <Label>{t('screenshot.quality.title') || '图片质量'}</Label>
            <Select
              value={String(jpegQuality)}
              onValueChange={(val) => setJpegQuality(Number(val))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getQualityLevels().map((opt) => (
                  <SelectItem key={opt.value} value={String(opt.value)}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t('screenshot.quality.description') || '越高的质量会产生更大的文件'}
            </p>
          </div>

          {/* 嵌入笔记 */}
          <div className="flex items-center justify-between p-3 rounded-md border border-neutral-200 bg-neutral-50">
            <div className="space-y-1">
              <Label className="text-base">{t('screenshot.embed.title') || '自动嵌入笔记'}</Label>
              <p className="text-xs text-muted-foreground">
                {t('screenshot.embed.description') || '生成笔记时是否自动包含截图网格'}
              </p>
            </div>
            <Switch checked={embedInNote} onCheckedChange={setEmbedInNote} />
          </div>
        </CardContent>
      </Card>

      {/* 保存按钮 */}
      <div className="flex gap-2">
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="gap-2"
        >
          <Save className="h-4 w-4" />
          {isSaving ? (t('settings.common.saving') || '保存中...') : (t('settings.common.save') || '保存')}
        </Button>
      </div>
    </div>
  )
}

export default ScreenshotPage

