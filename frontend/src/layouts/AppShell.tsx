import { type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Home,
  Layers,
  Sparkles,
  Clapperboard,
  Film,
  Library,
  Wand2,
  LayoutGrid,
  Search,
  Settings,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  id: string
  path: string
  icon: LucideIcon
  label: string
  disabled?: boolean
  tooltipExtra?: string
}

const NAV_ITEMS: NavItem[] = [
  { id: 'home',        path: '/',            icon: Home,         label: '工作台' },
  { id: 'taskboard',   path: '/taskboard',   icon: Layers,       label: '任务中心',  disabled: true },
  { id: 'processing',  path: '/processing',  icon: Sparkles,     label: '处理中',    disabled: true },
  { id: 'results',     path: '/results',     icon: Clapperboard, label: '结果',      disabled: true },
  { id: 'storyboard',  path: '/storyboard',  icon: Film,         label: '分镜' },
  { id: 'library',     path: '/library',     icon: Library,      label: '资料库',    disabled: true },
  { id: 'director',    path: '/director',    icon: Wand2,        label: 'AI 导演',   disabled: true, tooltipExtra: ' · Phase [C]' },
  { id: 'overview',    path: '/overview',    icon: LayoutGrid,   label: '12 屏概览', disabled: true },
]

const BOTTOM_ITEMS: NavItem[] = [
  { id: 'search',   path: '/search',   icon: Search,   label: '搜索' },
  { id: 'settings', path: '/settings', icon: Settings, label: '设置' },
]

interface SidebarBtnProps {
  icon: LucideIcon
  label: string
  active: boolean
  disabled?: boolean
  tooltipExtra?: string
  onClick: () => void
}

function SidebarBtn({ icon: Icon, label, active, disabled, tooltipExtra, onClick }: SidebarBtnProps) {
  return (
    <button
      title={label + (tooltipExtra ?? '')}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={cn(
        'relative flex size-11 items-center justify-center rounded-[14px] transition-all duration-150',
        disabled
          ? 'cursor-not-allowed text-muted-foreground/30'
          : active
            ? 'bg-accent text-foreground shadow-sm'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      <Icon size={20} />
      {active && !disabled && (
        <span className="absolute -left-3 top-2.5 bottom-2.5 w-[3px] rounded-full bg-foreground" />
      )}
    </button>
  )
}

export interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const location = useLocation()
  const navigate = useNavigate()

  const isActive = (item: NavItem) => {
    if (item.id === 'home') return location.pathname === '/'
    return location.pathname.startsWith(item.path)
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* ── Sidebar ── */}
      <nav
        aria-label="主导航"
        className="flex w-[72px] shrink-0 flex-col items-center gap-1.5 border-r border-border bg-background py-4"
      >
        {/* Logo slot */}
        <button
          className="mb-2 flex size-11 items-center justify-center rounded-[14px] bg-violet-100 text-violet-600 shadow-sm transition-colors hover:bg-violet-200 dark:bg-violet-900/30 dark:text-violet-400 dark:hover:bg-violet-900/50"
          onClick={() => navigate('/')}
          title="VidMirror"
          aria-label="返回工作台"
        >
          <Sparkles size={18} />
        </button>

        {/* Main nav */}
        {NAV_ITEMS.map((item) => (
          <SidebarBtn
            key={item.id}
            icon={item.icon}
            label={item.label}
            active={isActive(item)}
            disabled={item.disabled}
            tooltipExtra={item.tooltipExtra}
            onClick={() => navigate(item.path)}
          />
        ))}

        {/* Separator */}
        <div className="mx-auto my-2 h-px w-6 bg-border" />

        {/* Bottom nav (search, settings) */}
        {BOTTOM_ITEMS.map((item) => (
          <SidebarBtn
            key={item.id}
            icon={item.icon}
            label={item.label}
            active={isActive(item)}
            onClick={() => navigate(item.path)}
          />
        ))}

        {/* Spacer */}
        <div className="flex-1" />
      </nav>

      {/* ── Main content ── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  )
}

export default AppShell
