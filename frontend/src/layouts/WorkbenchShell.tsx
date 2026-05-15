import * as React from 'react'
import { Link } from 'react-router-dom'
import { SlidersHorizontal, ListChecks, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LangSwitcher } from '@/components/LangSwitcher'
import ThemeSwitcher from '@/components/ThemeSwitcher'
import ProjectSwitcher from '@/components/ProjectSwitcher'
import { useBackendHealth } from '@/hooks/useBackendHealth'
import { cn } from '@/lib/utils'

/**
 * 作业台通用布局（与 SettingsShell 对齐的视觉语言）。
 *
 * - 顶部 Header：品牌区（小号 logo + 产品名 + 副标题）、项目切换、任务徽章按钮、
 *   主题/语言/设置入口；
 * - 主内容区由 `children` 渲染，负责首页"作业台"纵列内容。
 *
 * 保持与 `SettingsShell` 一致的 Header 高度（h-16）、border 规范与 max-width
 * 用于视觉一致性；不在本 shell 承担 SaveBar（首页没有保存态）。
 */
export interface WorkbenchShellProps {
  /** Header 右侧任务按钮是否显示活跃徽章 */
  activeTaskCount?: number
  /** 点击任务按钮回调 */
  onOpenTasks?: () => void
  /** 主内容 */
  children: React.ReactNode
}

function HealthDot({ health }: { health: boolean | null }) {
  const label =
    health === null ? '检测后端中' : health ? '后端在线' : '后端离线'
  const color =
    health === null
      ? 'bg-zinc-300'
      : health
        ? 'bg-emerald-500'
        : 'bg-rose-500'
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
      title={label}
      aria-label={label}
    >
      <span className={cn('size-1.5 rounded-full', color)} />
      {label}
    </span>
  )
}

export function WorkbenchShell({
  activeTaskCount = 0,
  onOpenTasks,
  children,
}: WorkbenchShellProps) {
  const health = useBackendHealth()

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border bg-background px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex size-8 items-center justify-center rounded-md bg-violet-100 text-violet-600">
            <Sparkles className="size-4" />
          </span>
          <div className="min-w-0">
            <div className="text-base font-semibold leading-none tracking-tight text-foreground">
              VidMirror
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              视频作业台
            </div>
          </div>
          <div className="ml-4 hidden md:block">
            <HealthDot health={health} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden w-56 md:block">
            <ProjectSwitcher />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={onOpenTasks}
            className="relative"
            aria-label="打开任务中心"
          >
            <ListChecks className="size-4" />
            <span>任务</span>
            {activeTaskCount > 0 ? (
              <span className="ml-1 inline-flex min-w-4 items-center justify-center rounded-full bg-violet-500 px-1 text-[10px] font-medium leading-4 text-white">
                {activeTaskCount > 99 ? '99+' : activeTaskCount}
              </span>
            ) : null}
          </Button>

          <ThemeSwitcher />
          <LangSwitcher />

          <Link
            to="/settings"
            aria-label="打开设置"
            className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <SlidersHorizontal className="size-4" />
          </Link>
        </div>
      </header>

      <main className="flex-1 overflow-auto bg-muted/40">{children}</main>
    </div>
  )
}

export default WorkbenchShell

