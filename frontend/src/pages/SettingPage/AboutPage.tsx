import { Server, Github, FileText } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Section } from '@/components/ui/section'
import { useHealthPulse } from '@/hooks/useHealthPulse'

/**
 * 关于页面（M5）
 *
 * 用途：展示应用信息、版本号、技术栈与许可证
 * - 应用信息：从 /health 动态获取版本号
 * - 技术栈：列出核心前端后端依赖
 * - 许可证与开源：MIT License 和 GitHub 链接
 */

interface Dependency {
  name: string
  purpose: string
  version?: string
}

const FRONTEND_DEPS: Dependency[] = [
  { name: 'React', purpose: '前端框架', version: '19.x' },
  { name: 'Vite', purpose: '构建工具', version: '6.x' },
  { name: 'TypeScript', purpose: '类型系统', version: '5.x' },
  { name: 'Tailwind CSS', purpose: '样式框架' },
  { name: 'Zustand', purpose: '状态管理' },
  { name: 'React Router', purpose: '路由管理', version: '7.x' },
  { name: 'React-i18next', purpose: '国际化' },
  { name: 'Lucide React', purpose: 'Icon 库' },
]

const BACKEND_DEPS: Dependency[] = [
  { name: 'FastAPI', purpose: 'Web 框架' },
  { name: 'Pydantic', purpose: '数据验证' },
  { name: 'psutil', purpose: '系统监控' },
  { name: 'python-multipart', purpose: '文件上传' },
  { name: 'python-dotenv', purpose: '环境变量' },
]

export default function AboutPage() {
  const { t } = useTranslation('settings')
  const health = useHealthPulse(0) // 仅执行一次，不轮询

  const dynamicVersion = health.data?.version || t('about.versionNumber')

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight">
          {t('about.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('about.subtitle')}
        </p>
      </div>

      {/* Section 1: 应用信息 */}
      <Section
        title={t('about.appInfoTitle')}
        description={t('about.appInfoDescription')}
        icon={<Server className="size-4" />}
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="flex items-center gap-4">
              <div className="flex size-12 items-center justify-center rounded-lg bg-violet-100">
                <Server className="size-6 text-violet-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">{t('about.appName')}</h3>
                <p className="text-sm text-muted-foreground">
                  {t('about.appDescription')}
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              {t('about.appSummary')}
            </p>
          </div>

          {/* 版本信息行 */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-zinc-200 bg-white p-3">
              <div className="text-xs font-medium text-muted-foreground">
                {t('about.versionLabel')}
              </div>
              <div className="mt-1 font-mono text-sm font-semibold">
                {dynamicVersion}
              </div>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-3">
              <div className="text-xs font-medium text-muted-foreground">
                {t('about.statusLabel')}
              </div>
              <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                <span className="size-1.5 rounded-full bg-emerald-600" />
                {t('about.statusActive')}
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Section 2: 技术栈与依赖 */}
      <Section
        title={t('about.dependenciesTitle')}
        description={t('about.dependenciesDescription')}
        icon={<FileText className="size-4" />}
      >
        <div className="space-y-6">
          {/* 前端依赖 */}
          <div>
            <h4 className="mb-3 text-sm font-semibold text-foreground">
              {t('about.frontendStack')}
            </h4>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {FRONTEND_DEPS.map((dep) => (
                <div
                  key={dep.name}
                  className="rounded-lg border border-zinc-200 bg-white p-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">{dep.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {dep.purpose}
                      </div>
                    </div>
                    {dep.version && (
                      <div className="text-xs font-mono text-muted-foreground">
                        {dep.version}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 后端依赖 */}
          <div>
            <h4 className="mb-3 text-sm font-semibold text-foreground">
              {t('about.backendStack')}
            </h4>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {BACKEND_DEPS.map((dep) => (
                <div
                  key={dep.name}
                  className="rounded-lg border border-zinc-200 bg-white p-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">{dep.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {dep.purpose}
                      </div>
                    </div>
                    {dep.version && (
                      <div className="text-xs font-mono text-muted-foreground">
                        {dep.version}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* Section 3: 许可证与开源 */}
      <Section
        title={t('about.licenseTitle')}
        description={t('about.licenseDescription')}
        icon={<Github className="size-4" />}
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="flex items-start gap-3">
              <FileText className="mt-1 size-5 shrink-0 text-violet-600" />
              <div>
                <h4 className="font-semibold">{t('about.mitLicense')}</h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('about.licenseText')}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="flex items-start gap-3">
              <Github className="mt-1 size-5 shrink-0 text-violet-600" />
              <div>
                <h4 className="font-semibold">{t('about.githubTitle')}</h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('about.githubDescription')}
                </p>
                <a
                  href="https://github.com/your-org/VidMirror"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-violet-600 hover:text-violet-700"
                >
                  View on GitHub
                  <span className="text-xs">→</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </Section>
    </div>
  )
}

