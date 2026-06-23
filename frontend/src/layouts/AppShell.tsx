import { type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Home,
  Sparkles,
  Film,
  Library,
  BookOpen,
  Star,
  Wand2,
  Search,
  Settings,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useSystemStats } from '@/hooks/useSystemStats'
import { FloatingTaskQueue } from '@/components/FloatingTaskQueue'
import ThemeSwitcher from '@/components/ThemeSwitcher'

interface NavItem {
  id: string
  path: string
  icon: LucideIcon
  label: string
  badge?: string
  placeholder?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { id: 'home',        path: '/',            icon: Home,         label: '新建笔记' },
  { id: 'library',     path: '/library',     icon: Library,      label: '合集',     badge: 'Beta' },
  { id: 'knowledge',   path: '#',            icon: BookOpen,     label: '知识库',   placeholder: true },
  { id: 'storyboard',  path: '/storyboard',  icon: Film,         label: '分镜' },
  { id: 'favorites',   path: '/favorites',   icon: Star,         label: '收藏夹' },
  { id: 'director',    path: '#',            icon: Wand2,        label: 'AI 导演',  placeholder: true, badge: 'Phase C' },
]

const BOTTOM_ITEMS: NavItem[] = [
  { id: 'search',   path: '/search',   icon: Search,   label: '搜索' },
  { id: 'settings', path: '/settings', icon: Settings, label: '设置' },
]

interface SidebarBtnProps {
  icon: LucideIcon
  label: string
  active: boolean
  badge?: string
  placeholder?: boolean
  onClick: () => void
}

function SidebarBtn({ icon: Icon, label, active, badge, placeholder, onClick }: SidebarBtnProps) {
  return (
    <button
      title={label}
      onClick={placeholder ? () => toast('该功能即将上线') : onClick}
      className={cn(
        'relative flex w-full items-center gap-3 rounded-[12px] px-3 py-2 text-sm transition-all duration-150',
        placeholder
          ? 'cursor-default text-muted-foreground/50'
          : active
            ? 'bg-accent text-foreground shadow-sm'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      <Icon size={18} className="shrink-0" />
      <span className="truncate">{label}</span>
      {badge && (
        <span
          className={cn(
            'ml-auto shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium leading-tight',
            badge === 'Beta'
              ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400'
              : 'bg-muted text-muted-foreground',
          )}
        >
          {badge}
        </span>
      )}
      {active && !placeholder && (
        <span className="absolute -left-2 top-2 bottom-2 w-[3px] rounded-full bg-foreground" />
      )}
    </button>
  )
}

export interface AppShellProps {
  children: ReactNode
}

/** 字节数转可读格式 */
function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)}G`
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)}M`
  return `${(bytes / 1024).toFixed(0)}K`
}

/** 后端地址（与 .env 默认一致） */
const BACKEND_ADDR = `127.0.0.1:${import.meta.env.VITE_BACKEND_PORT ?? '8000'}`

export function AppShell({ children }: AppShellProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { stats, online } = useSystemStats()

  const isActive = (item: NavItem) => {
    if (item.id === 'home') return location.pathname === '/'
    return location.pathname.startsWith(item.path)
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden print:block print:h-auto print:overflow-visible">
      {/* ── Sidebar ── */}
      <nav
        aria-label="主导航"
        className="flex w-[216px] shrink-0 flex-col items-stretch gap-1 border-r border-border bg-background px-2 py-4 print:hidden"
      >
        {/* Logo slot */}
        <button
          className="mb-3 flex items-center gap-2.5 rounded-[14px] px-3 py-2 text-sm font-semibold transition-colors hover:bg-violet-50 dark:hover:bg-violet-900/20"
          onClick={() => navigate('/')}
          title="Nibi"
          aria-label="返回工作台"
        >
          <span className="flex size-8 items-center justify-center rounded-[10px] bg-violet-100 text-violet-600 shadow-sm dark:bg-violet-900/30 dark:text-violet-400">
            <Sparkles size={16} />
          </span>
          <span className="text-foreground">Nibi</span>
        </button>

        {/* Main nav */}
        {NAV_ITEMS.map((item) => (
          <SidebarBtn
            key={item.id}
            icon={item.icon}
            label={item.label}
            active={isActive(item)}
            badge={item.badge}
            placeholder={item.placeholder}
            onClick={() => navigate(item.path)}
          />
        ))}

        {/* Separator */}
        <div className="mx-2 my-2 h-px bg-border" />

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
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden print:overflow-visible print:h-auto">
        {/* ── Top bar ── */}
        <div
          className="flex items-center gap-3 border-b px-5 py-2.5 print:hidden"
          style={{ borderColor: 'var(--line)', background: 'var(--bg)' }}
        >
          <div className="flex-1" />
          <ThemeSwitcher />
          {/* 后端状态 chip */}
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"
            style={{
              background: 'var(--bg-sunken)',
              borderColor: 'var(--line)',
              color: 'var(--ink-2)',
            }}
          >
            <span
              className="inline-block size-1.5 rounded-full"
              style={{ background: online ? 'var(--accent-green)' : 'var(--accent-pink)' }}
            />
            后端 {BACKEND_ADDR} · {online ? 'online' : 'offline'}
          </span>
          {/* 系统指标 chip */}
          {stats?.cpu && stats?.memory && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"
              style={{
                background: 'var(--bg-sunken)',
                borderColor: 'var(--line)',
                color: 'var(--ink-2)',
              }}
            >
              CPU {stats.cpu.percent.toFixed(0)}% · MEM{' '}
              {formatBytes(stats.memory.used)}/{formatBytes(stats.memory.total)}
            </span>
          )}
        </div>
        {children}
      </div>

      {/* Global floating task queue — fixed position, outside layout flow */}
      <FloatingTaskQueue />
    </div>
  )
}

export default AppShell
