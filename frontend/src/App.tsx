import './App.css'
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom'
import Index from '@/pages/Index'
import { HomePage } from '@/pages/HomePage/Home'
import SettingPage from '@/pages/SettingPage/index'
import NotFoundPage from '@/pages/NotFoundPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />}>
          <Route index element={<Navigate to="/home" replace />} />
          <Route path="home" element={<HomePage />} />
          <Route path="settings" element={<SettingPage />}>
            <Route index element={<div className="flex h-full items-center justify-center"><span className="text-muted-foreground">Settings coming soon</span></div>} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
