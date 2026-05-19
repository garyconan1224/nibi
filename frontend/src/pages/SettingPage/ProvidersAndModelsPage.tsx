import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import ProvidersManagementPage from './ProvidersManagementPage'
import ModelManagementPage from './ModelManagementPage'

type TabKey = 'providers' | 'models'

/**
 * 模型与渠道（SPEC §3.5 第 2 页）。
 *
 * 合并原 ProvidersManagement + ModelManagement 为一个设置页，
 * 内部用 Tabs 切换「供应商管理」和「模型管理」两个子视图。
 */
export default function ProvidersAndModelsPage() {
  const { t } = useTranslation('settings')
  const [tab, setTab] = useState<TabKey>('providers')

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* 内部 Tab 切换 */}
      <div className="flex items-center gap-1 border-b border-border bg-background px-6">
        <TabBtn
          active={tab === 'providers'}
          onClick={() => setTab('providers')}
        >
          {t('layout.menu.providers', '供应商管理')}
        </TabBtn>
        <TabBtn
          active={tab === 'models'}
          onClick={() => setTab('models')}
        >
          {t('layout.menu.models', '模型管理')}
        </TabBtn>
      </div>

      {/* 内容区：只渲染激活的子页面 */}
      <div className="flex-1 overflow-auto">
        {tab === 'providers' && <ProvidersManagementPage />}
        {tab === 'models' && <ModelManagementPage />}
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
