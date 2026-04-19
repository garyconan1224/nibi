import { useEffect, useState } from 'react'
import http from '@/services/client'

export function useBackendHealth() {
  const [ok, setOk] = useState<boolean | null>(null)
  useEffect(() => {
    http.get('/health')
      .then(() => setOk(true))
      .catch(() => setOk(false))
  }, [])
  return ok
}

