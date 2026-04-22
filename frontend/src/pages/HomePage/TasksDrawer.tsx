import { useEffect, type FC } from 'react'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import TaskDashboard from './TaskDashboard'

/**
 * TasksDrawer
 *
 * 右侧抽屉，用于替代原有中栏常驻"任务中心"。
 * - open/onClose 受控；
 * - ESC 关闭 + 半透明遮罩点击关闭；
 * - 内嵌现有 TaskDashboard，零业务逻辑变动。
 */
export interface TasksDrawerProps {
  open: boolean
  onClose: () => void
}

const TasksDrawer: FC<TasksDrawerProps> = ({ open, onClose }) => {
  const { t } = useTranslation(['homePage'])

  // ESC 关闭
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  return (
    <>
      {/* 遮罩：透明到半透明渐显 */}
      <div
        aria-hidden
        onClick={onClose}
        className={cn(
          'fixed inset-0 z-40 bg-black/30 transition-opacity',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />

      {/* 抽屉主体 */}
      <aside
        role="dialog"
        aria-label={t('homePage:dashboard.title', '任务中心')}
        aria-hidden={!open}
        className={cn(
          'fixed right-0 top-0 z-50 flex h-full w-[360px] max-w-[90vw] flex-col border-l border-border bg-background shadow-xl transition-transform duration-200 ease-out',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">
              {t('homePage:dashboard.title')}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭任务中心"
            className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </header>
        <div className="flex-1 overflow-hidden">
          <TaskDashboard />
        </div>
      </aside>
    </>
  )
}

export default TasksDrawer

