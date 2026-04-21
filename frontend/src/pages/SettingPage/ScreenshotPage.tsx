import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Camera, Construction } from 'lucide-react'

/**
 * 视频截图设置页（骨架）。
 * 预留后续集中管理抽帧间隔、网格拼图尺寸、图片压缩质量、
 * 视觉理解默认模型等截图相关配置。
 */
const ScreenshotPage = () => {
  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">视频截图</h1>
        <p className="text-sm text-muted-foreground">
          配置抽帧、拼图与视觉理解的默认参数
        </p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>截图与抽帧</CardTitle>
              <CardDescription>
                控制关键帧提取、网格拼图尺寸及视觉理解触发条件
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-4 text-sm text-muted-foreground">
            <Construction className="h-4 w-4" />
            <span>该页面为占位骨架，具体表单项将在后续版本中补齐。</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default ScreenshotPage

