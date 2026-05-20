import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import Index from '@/pages/Index'

// 按路由做代码分割：每个页面组件通过动态 import 拆成独立 chunk
const SettingPage = lazy(() => import('@/pages/SettingPage/index'))
const ProvidersAndModelsPage = lazy(
  () => import('@/pages/SettingPage/ProvidersAndModelsPage'),
)
const AnalysisDefaultsPage = lazy(
  () => import('@/pages/SettingPage/AnalysisDefaultsPage'),
)
const NetworkSettingsPage = lazy(
  () => import('@/pages/SettingPage/NetworkSettingsPage'),
)
const DownloadSettingsPage = lazy(
  () => import('@/pages/SettingPage/DownloadSettingsPage'),
)
const DeployMonitorPage = lazy(() => import('@/pages/SettingPage/DeployMonitorPage'))
const AboutPage = lazy(() => import('@/pages/SettingPage/AboutPage'))
const TrashPage = lazy(() => import('@/pages/SettingPage/TrashPage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))
const WorkspaceList = lazy(() => import('@/pages/WorkspacePage/WorkspaceList'))
const TaskboardPage = lazy(() => import('@/pages/WorkspacePage/TaskboardPage'))
const VideoResultPage = lazy(() => import('@/pages/result/VideoResultPage'))
const ImageResultPage = lazy(() => import('@/pages/result/ImageResultPage'))
const AudioResultPage = lazy(() => import('@/pages/result/AudioResultPage'))
const TextResultPage = lazy(() => import('@/pages/result/TextResultPage'))
const FavoritesPage = lazy(() => import('@/pages/FavoritesPage/FavoritesPage'))
const SearchPage = lazy(() => import('@/pages/SearchPage/SearchPage'))
const WorkbenchPage = lazy(() => import('@/pages/WorkbenchPage/index'))

// 懒加载 fallback：保持极简，避免把额外依赖拉进主 chunk
const RouteFallback = () => (
  <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
    Loading…
  </div>
)

const withSuspense = (node: ReactNode) => (
  <Suspense fallback={<RouteFallback />}>{node}</Suspense>
)

// React Router v7 Data Router 定义；URL 与原 BrowserRouter + Routes + Route 完全一致。
export const router = createBrowserRouter([
  {
    path: '/',
    element: <Index />,
    children: [
      { index: true, element: withSuspense(<WorkbenchPage />) },
      { path: 'workspaces', element: withSuspense(<WorkspaceList />) },
      { path: 'favorites', element: withSuspense(<FavoritesPage />) },
      { path: 'search', element: withSuspense(<SearchPage />) },
      { path: 'workspaces/:id', element: withSuspense(<TaskboardPage />) },
      {
        path: 'workspaces/:workspaceId/items/:itemId/result',
        element: withSuspense(<VideoResultPage />),
      },
      {
        path: 'workspaces/:workspaceId/items/:itemId/image_result',
        element: withSuspense(<ImageResultPage />),
      },
      {
        path: 'workspaces/:workspaceId/items/:itemId/audio_result',
        element: withSuspense(<AudioResultPage />),
      },
      {
        path: 'workspaces/:workspaceId/items/:itemId/text_result',
        element: withSuspense(<TextResultPage />),
      },
      {
        path: 'settings',
        element: withSuspense(<SettingPage />),
        children: [
          { index: true, element: <Navigate to="/settings/providers-models" replace /> },
          // N3 合并页
          { path: 'providers-models', element: withSuspense(<ProvidersAndModelsPage />) },
          { path: 'analysis-defaults', element: withSuspense(<AnalysisDefaultsPage />) },
          // 保留的独立页
          { path: 'network', element: withSuspense(<NetworkSettingsPage />) },
          { path: 'download', element: withSuspense(<DownloadSettingsPage />) },
          { path: 'monitor', element: withSuspense(<DeployMonitorPage />) },
          { path: 'trash', element: withSuspense(<TrashPage />) },
          { path: 'about', element: withSuspense(<AboutPage />) },
          // 旧路由重定向（向后兼容）
          { path: 'providers', element: <Navigate to="/settings/providers-models" replace /> },
          { path: 'models', element: <Navigate to="/settings/providers-models" replace /> },
          { path: 'screenshot', element: <Navigate to="/settings/analysis-defaults" replace /> },
          { path: 'transcriber', element: <Navigate to="/settings/analysis-defaults" replace /> },
          { path: 'prompt-formats', element: <Navigate to="/settings/analysis-defaults" replace /> },
          { path: '*', element: withSuspense(<NotFoundPage />) },
        ],
      },
      { path: '*', element: withSuspense(<NotFoundPage />) },
    ],
  },
])

