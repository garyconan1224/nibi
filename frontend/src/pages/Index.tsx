import { Outlet } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AppShell } from '@/layouts/AppShell'

const Index = () => (
  <AppShell>
    <Outlet />
    <Toaster position="top-right" richColors />
  </AppShell>
)

export default Index

