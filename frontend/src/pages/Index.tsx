import { Outlet } from 'react-router-dom'
import { Toaster } from 'sonner'

const Index = () => {
  return (
    <>
      <Outlet />
      <Toaster position="top-right" richColors />
    </>
  )
}
export default Index

