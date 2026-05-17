import { type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Library,
  Settings,
  Search,
  Sparkles,
  Star,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  id: string
  path: string
  icon: LucideIcon
  label: string
}

const NAV_ITEMS: NavItem[] = [
  { id: 'workspaces', path: '/workspaces', icon: Library, label: '工作区' },
  { id: 'favorites', path: '/favorites', icon: Star, label: '收藏夹' },
]

const BOTTOM_ITEMS: NavItem[] = [
  { id: 'settings', path: '/settings', icon: Settings, label: '设置' },
]

interface SidebarBtnProps {
  icon: LucideIcon
  label: string
  active: boolean
  onClick: () => void
}

function SidebarBtn({ icon: Icon, label, active, onClick }: SidebarBtnProps) {
  return (
    <button
      title={label}
      onClick={onClick}
      className={cn(
        'relative flex size-10 items-center justify-center rounded-lg transition-colors',
        active
          ? 'bg-accent text-foreground shadow-sm'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      <Icon size={18} />
      {active && (
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
            onClick={() => navigate(item.path)}
          />
        ))}

        <div className="my-1 h-px w-6 bg-border" />

        {/* Search (non-routed placeholder) */}
        <SidebarBtn
          icon={Search}
          label="搜索（即将开放）"
          active={false}
          onClick={() => {}}
        />

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
