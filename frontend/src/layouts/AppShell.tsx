import { type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Library,
  Settings,
  Search,
  Sparkles,
  Clapperboard,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  id: string
  path: string
  icon: LucideIcon
  label: string
  disabled?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { id: 'workspaces', path: '/workspaces', icon: Library, label: '任务中心' },
  { id: 'search', path: '/search', icon: Search, label: '资料库' },
  { id: 'director', path: '/director', icon: Clapperboard, label: 'AI 导演', disabled: true },
]

const BOTTOM_ITEMS: NavItem[] = [
  { id: 'settings', path: '/settings', icon: Settings, label: '设置' },
]

interface SidebarBtnProps {
  icon: LucideIcon
  label: string
  active: boolean
  disabled?: boolean
  onClick: () => void
}

function SidebarBtn({ icon: Icon, label, active, disabled, onClick }: SidebarBtnProps) {
  return (
    <button
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'relative flex size-10 items-center justify-center rounded-lg transition-colors',
        disabled
          ? 'cursor-not-allowed text-muted-foreground/40'
          : active
            ? 'bg-accent text-foreground shadow-sm'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      <Icon size={18} />
      {active && !disabled && (
        <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-foreground" />
      )}
    </button>
  )
}

export interface AppShellProps {
  children: ReactNode
}

/**
 * 全局 AppShell — VidMirror 风格窄侧边栏 + 右侧内容区。
 *
 * 侧边栏宽 48px，纯图标，用 title tooltip 显示文案。
 * 内容区交给各页面的 Shell（WorkbenchShell / SettingsShell）渲染顶栏。
 */
export function AppShell({ children }: AppShellProps) {
  const location = useLocation()
  const navigate = useNavigate()

  const isActive = (path: string) => location.pathname.startsWith(path)

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* ── Sidebar ── */}
      <nav
        aria-label="主导航"
        className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-border bg-background py-3"
      >
        {/* Logo slot */}
        <button
          className="mb-2 flex size-8 items-center justify-center rounded-md bg-violet-100 text-violet-600 transition-colors hover:bg-violet-200 dark:bg-violet-900/30 dark:text-violet-400 dark:hover:bg-violet-900/50"
          onClick={() => navigate('/workspaces')}
          title="VidMirror"
          aria-label="返回工作区"
        >
          <Sparkles size={15} />
        </button>

        {/* Main nav */}
        {NAV_ITEMS.map((item) => (
          <SidebarBtn
            key={item.id}
            icon={item.icon}
            label={item.label}
            active={isActive(item.path)}
            disabled={item.disabled}
            onClick={() => navigate(item.path)}
          />
        ))}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Bottom nav */}
        {BOTTOM_ITEMS.map((item) => (
          <SidebarBtn
            key={item.id}
            icon={item.icon}
            label={item.label}
            active={isActive(item.path)}
            onClick={() => navigate(item.path)}
          />
        ))}
      </nav>

      {/* ── Main content ── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  )
}

export default AppShell
