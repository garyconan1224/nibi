import { useEffect, useState } from 'react'
import http from '@/services/client'

export function useBackendHealth() {
  const [ok, setOk] = useState<boolean | null>(null)
  useEffect(() => {
    http.get('/health')
      .then((res) => {
        console.log('✅ [Health Check] 后端在线', res.data)
        setOk(true)
      })
      .catch((err) => {
        console.error('❌ [Health Check] 后端离线', err.message)
        setOk(false)
      })
  }, [])
  return ok
}

