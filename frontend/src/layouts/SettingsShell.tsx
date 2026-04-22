import * as React from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { ArrowLeft, Save as SaveIcon, RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { LangSwitcher } from '@/components/LangSwitcher'
import { Button } from '@/components/ui/button'
import { DirtyDot } from '@/components/ui/dirty-dot'
import { cn } from '@/lib/utils'
import { useSettingsShellStore } from '@/store/settingsShellStore'

/**
 * 设置页通用布局（DESIGN_NOTES_SETTINGS.md §4.1）。
 *
 * - 顶部 Header（返回/语言切换）；
 * - 居中 Tab 条导航（替代旧版左侧 250px 菜单）；
 * - 主内容区 `<Outlet />`；
 * - 底部粘性 SaveBar：展示 dirtyCount 徽章 + Save/Reset/Export 插槽。
 *
 * 子页面通过 `<SaveBarPortal />` 向底部栏注入 action 区；
 * 当前版本为最小可用骨架，Portal 逻辑预留给 M1+ 接入 Zustand bus。
 */
export interface TabItem {
  /** 路径（完整绝对路径，如 `/settings/providers`） */
  path: string
  /** Tab 文案 */
  label: React.ReactNode
  /** 图标（可选，lucide） */
  icon?: React.ReactNode
}

export interface SaveBarState {
  dirtyCount: number
  saving?: boolean
  onSave?: () => void
  onReset?: () => void
  /** 额外右侧插槽，例如 Export 按钮 */
  extra?: React.ReactNode
}

export interface SettingsShellProps {
  /** Tab 定义列表；缺省使用内置默认清单 */
  tabs?: TabItem[]
  /** SaveBar 当前态；由调用方（路由层或 hook）推送 */
  saveBar?: SaveBarState
}

/**
 * 默认 Tab 清单构造器：基于 `t` 生成 i18n 文案，避免在模块级把运行期
 * 的 i18n 实例冻结为硬编码字符串。
 */
function buildDefaultTabs(
  t: (key: string) => string,
): TabItem[] {
  return [
    { path: '/settings/providers', label: t('layout.menu.providers') },
    { path: '/settings/models', label: t('layout.menu.models') },
    { path: '/settings/network', label: t('layout.menu.network') },
    { path: '/settings/download', label: t('layout.menu.download') },
    { path: '/settings/transcriber', label: t('layout.menu.transcriber') },
    { path: '/settings/screenshot', label: t('layout.menu.screenshot') },
    { path: '/settings/about', label: t('layout.menu.about') },
  ]
}

function TabBar({ tabs }: { tabs: TabItem[] }) {
  const location = useLocation()
  return (
    <nav
      role="tablist"
      aria-label="settings-navigation"
      className="flex items-center justify-center gap-1 border-b border-zinc-200 bg-white px-6"
    >
      {tabs.map((tab) => {
        const active = location.pathname === tab.path
        return (
          <Link
            key={tab.path}
            to={tab.path}
            role="tab"
            aria-selected={active}
            className={cn(
              'relative flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors',
              active
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.icon ? <span className="size-4">{tab.icon}</span> : null}
            <span>{tab.label}</span>
            {active ? (
              <span className="pointer-events-none absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-violet-500" />
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}

function SaveBar({ state }: { state: SaveBarState | undefined }) {
  const { t } = useTranslation('settings')
  const dirty = (state?.dirtyCount ?? 0) > 0
  return (
    <div
      role="toolbar"
      aria-label="save-bar"
      className={cn(
        'sticky bottom-0 flex h-14 items-center justify-between gap-3 border-t border-zinc-200 bg-white/90 px-6 backdrop-blur',
      )}
    >
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {dirty ? (
          <>
            <DirtyDot aria-label="dirty" />
            <span>
              {t('shell.saveBar.dirtyCount', '{{count}} 项未保存', {
                count: state?.dirtyCount ?? 0,
              })}
            </span>
          </>
        ) : (
          <span>{t('shell.saveBar.allSaved', '所有变更已保存')}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {state?.extra}
        <Button
          variant="ghost"
          size="sm"
          onClick={state?.onReset}
          disabled={!dirty || state?.saving}
        >
          <RotateCcw className="size-4" />
          {t('shell.saveBar.reset', '重置')}
        </Button>
        <Button
          size="sm"
          onClick={state?.onSave}
          disabled={!dirty || state?.saving}
        >
          <SaveIcon className="size-4" />
          {state?.saving
            ? t('shell.saveBar.saving', '保存中...')
            : t('shell.saveBar.save', '保存')}
        </Button>
      </div>
    </div>
  )
}

export function SettingsShell({
  tabs,
  saveBar,
}: SettingsShellProps) {
  const { t } = useTranslation('settings')
  // 订阅 store 里的 SaveBar 状态；显式 prop 优先（便于后续测试注入与特殊路由覆盖）
  const storeSaveBar = useSettingsShellStore((s) => s.saveBarState)
  const effectiveSaveBar = saveBar ?? storeSaveBar
  const effectiveTabs = React.useMemo<TabItem[]>(
    () => tabs ?? buildDefaultTabs(t),
    [tabs, t],
  )
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden">
      <header className="flex h-16 items-center justify-between border-b border-zinc-200 bg-white px-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          aria-label={t('layout.backHome', '返回首页')}
        >
          <ArrowLeft className="size-4" />
          <span className="text-base font-semibold text-foreground">VidMirror</span>
        </Link>
        <LangSwitcher />
      </header>

      <TabBar tabs={effectiveTabs} />

      <main className="flex-1 overflow-auto bg-zinc-50/60">
        <Outlet />
      </main>

      <SaveBar state={effectiveSaveBar} />
    </div>
  )
}

export default SettingsShell

