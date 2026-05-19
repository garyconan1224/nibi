import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import ScreenshotPage from './ScreenshotPage'
import TranscriberPage from './TranscriberPage'
import PromptFormatPage from './PromptFormatPage'

type TabKey = 'screenshot' | 'transcriber' | 'prompt' | 'defaults'

/**
 * 分析默认偏好（SPEC §3.5 第 4 页）。
 *
 * 合并原 ScreenshotPage + TranscriberPage + PromptFormatPage + 任务勾选默认偏好
 * 为一个设置页，内部用 Tabs 切换子视图。
 */
export default function AnalysisDefaultsPage() {
  const { t } = useTranslation('settings')
  const [tab, setTab] = useState<TabKey>('screenshot')

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* 内部 Tab 切换 */}
      <div className="flex items-center gap-1 border-b border-border bg-background px-6">
        <TabBtn
          active={tab === 'screenshot'}
          onClick={() => setTab('screenshot')}
        >
          {t('layout.menu.screenshot', '截帧设置')}
        </TabBtn>
        <TabBtn
          active={tab === 'transcriber'}
          onClick={() => setTab('transcriber')}
        >
          {t('layout.menu.transcriber', '转写设置')}
        </TabBtn>
        <TabBtn
          active={tab === 'prompt'}
          onClick={() => setTab('prompt')}
        >
          {t('layout.menu.promptFormats', '提示词模板')}
        </TabBtn>
        <TabBtn
          active={tab === 'defaults'}
          onClick={() => setTab('defaults')}
        >
          任务默认勾选
        </TabBtn>
      </div>

      {/* 内容区：只渲染激活的子页面 */}
      <div className="flex-1 overflow-auto">
        {tab === 'screenshot' && <ScreenshotPage />}
        {tab === 'transcriber' && <TranscriberPage />}
        {tab === 'prompt' && <PromptFormatPage />}
        {tab === 'defaults' && <TaskDefaultsPlaceholder />}
      </div>
    </div>
  )
}

/** 任务默认勾选偏好（SPEC §2.6）——占位，后续实现 */
function TaskDefaultsPlaceholder() {
  return (
    <div className="p-6">
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        任务默认勾选偏好功能开发中。用户将可自定义「添加素材时默认勾选哪些分析任务」。
      </div>
    </div>
  )
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={[
        'relative px-4 py-3 text-sm font-medium transition-colors',
        active
          ? 'text-foreground'
          : 'text-muted-foreground hover:text-foreground',
      ].join(' ')}
    >
      {children}
      {active && (
        <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-violet-500" />
      )}
    </button>
  )
}
