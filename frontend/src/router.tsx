import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import Index from '@/pages/Index'

// 按路由做代码分割：每个页面组件通过动态 import 拆成独立 chunk
const HomePage = lazy(() =>
  import('@/pages/HomePage/Home').then((m) => ({ default: m.HomePage })),
)
const SettingPage = lazy(() => import('@/pages/SettingPage/index'))
const ProvidersManagementPage = lazy(
  () => import('@/pages/SettingPage/ProvidersManagementPage'),
)
const ModelManagementPage = lazy(
  () => import('@/pages/SettingPage/ModelManagementPage'),
)
const NetworkSettingsPage = lazy(
  () => import('@/pages/SettingPage/NetworkSettingsPage'),
)
const DownloadSettingsPage = lazy(
  () => import('@/pages/SettingPage/DownloadSettingsPage'),
)
const TranscriberPage = lazy(() => import('@/pages/SettingPage/TranscriberPage'))
const PromptFormatPage = lazy(() => import('@/pages/SettingPage/PromptFormatPage'))
const ScreenshotPage = lazy(() => import('@/pages/SettingPage/ScreenshotPage'))
const DeployMonitorPage = lazy(() => import('@/pages/SettingPage/DeployMonitorPage'))
const AboutPage = lazy(() => import('@/pages/SettingPage/AboutPage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))
const WorkspaceList = lazy(() => import('@/pages/WorkspacePage/WorkspaceList'))
const WorkspaceDetail = lazy(() => import('@/pages/WorkspacePage/WorkspaceDetail'))
const VideoResultPage = lazy(() => import('@/pages/result/VideoResultPage'))
const ImageResultPage = lazy(() => import('@/pages/result/ImageResultPage'))
const AudioResultPage = lazy(() => import('@/pages/result/AudioResultPage'))
const FavoritesPage = lazy(() => import('@/pages/FavoritesPage/FavoritesPage'))

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
      { index: true, element: <Navigate to="/home" replace /> },
      { path: 'home', element: withSuspense(<HomePage />) },
      { path: 'workspaces', element: withSuspense(<WorkspaceList />) },
      { path: 'favorites', element: withSuspense(<FavoritesPage />) },
      { path: 'workspaces/:id', element: withSuspense(<WorkspaceDetail />) },
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
        path: 'settings',
        element: withSuspense(<SettingPage />),
        children: [
          { index: true, element: <Navigate to="/settings/providers" replace /> },
          { path: 'providers', element: withSuspense(<ProvidersManagementPage />) },
          { path: 'models', element: withSuspense(<ModelManagementPage />) },
          { path: 'network', element: withSuspense(<NetworkSettingsPage />) },
          { path: 'download', element: withSuspense(<DownloadSettingsPage />) },
          { path: 'transcriber', element: withSuspense(<TranscriberPage />) },
          { path: 'prompt-formats', element: withSuspense(<PromptFormatPage />) },
          { path: 'screenshot', element: withSuspense(<ScreenshotPage />) },
          { path: 'monitor', element: withSuspense(<DeployMonitorPage />) },
          { path: 'about', element: withSuspense(<AboutPage />) },
          { path: '*', element: withSuspense(<NotFoundPage />) },
        ],
      },
      { path: '*', element: withSuspense(<NotFoundPage />) },
    ],
  },
])

