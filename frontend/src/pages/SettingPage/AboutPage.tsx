import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const AboutPage = () => {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">关于</h1>
        <p className="text-sm text-muted-foreground">应用信息和版本</p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>VidMirror</CardTitle>
          <CardDescription>一个强大的视频处理工具</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <span className="text-sm font-medium text-gray-600">版本号</span>
            <span className="text-sm text-gray-900">v0.5.0</span>
          </div>
          <div className="flex items-center justify-between border-b pb-3">
            <span className="text-sm font-medium text-gray-600">项目名称</span>
            <span className="text-sm text-gray-900">VidMirror</span>
          </div>
          <div className="pt-2">
            <p className="text-sm text-muted-foreground">
              VidMirror 是一个功能丰富的视频处理应用，支持多个 AI 提供商集成。
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default AboutPage

