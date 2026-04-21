import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip.tsx'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

const SettingLayout = () => {
  const location = useLocation()

  const menuItems = [
    { label: '提供商管理', path: '/settings/providers' },
    { label: '模型管理', path: '/settings/models' },
    { label: '网络设置', path: '/settings/network' },
    { label: '关于', path: '/settings/about' },
  ]

  const isActive = (path: string) => location.pathname === path

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col">
      {/* 顶部 Header */}
      <header className="flex h-16 items-center justify-between border-b border-neutral-200 bg-white px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl bg-slate-200">
            <span className="text-sm font-bold">VM</span>
          </div>
          <div className="text-2xl font-bold text-gray-800">VidMirror</div>
        </div>
        <div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link to={'/'}>
                  <ArrowLeft className="text-muted-foreground hover:text-primary cursor-pointer h-5 w-5" />
                </Link>
              </TooltipTrigger>
              <TooltipContent>
                <span>返回首页</span>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* 左侧菜单 */}
        <aside className="flex w-[250px] flex-col border-r border-neutral-200 bg-white overflow-auto">
          <nav className="flex-1 p-4">
            <div className="space-y-2">
              {menuItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`block px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive(item.path)
                      ? 'bg-slate-100 text-slate-900'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>
        </aside>

        {/* 右侧详情区域 */}
        <main className="flex-1 overflow-auto bg-slate-50">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
export default SettingLayout

