import { useEffect, useRef, useState } from 'react'
import { useTaskStore } from '@/store/taskStore'
import { isTaskTerminal } from '@/types/task'

/**
 * 全局 ETA：所有活跃任务的剩余时间之和，每秒递减。
 * 收到 SSE / 轮询新进度时 reset。
 */
export function useGlobalEta(): number {
  const tasks = useTaskStore((s) => s.tasks)
  const [eta, setEta] = useState(0)
  const lastProgressRef = useRef<Map<string, number>>(new Map())
  const progressRateRef = useRef<Map<string, number>>(new Map())
  const lastTickRef = useRef(Date.now())

  // 计算各活跃任务的 ETA 之和
  useEffect(() => {
    const active = tasks.filter(
      (t) => !isTaskTerminal(t.status) && t.progress > 0 && t.progress < 1,
    )

    let totalEta = 0
    const now = Date.now()

    for (const t of active) {
      const prev = lastProgressRef.current.get(t.task_id)
      const elapsed = now - lastTickRef.current

      // 估算速率：用最近的 progress 变化 / 经过时间
      if (prev !== undefined && elapsed > 0) {
        const dp = t.progress - prev
        if (dp > 0) {
          const rate = dp / (elapsed / 1000) // progress/sec
          progressRateRef.current.set(t.task_id, rate)
        }
      }

      const rate = progressRateRef.current.get(t.task_id)
      if (rate && rate > 0) {
        const remaining = (1 - t.progress) / rate
        totalEta += remaining
      }

      lastProgressRef.current.set(t.task_id, t.progress)
    }

    lastTickRef.current = now
    setEta(Math.max(0, Math.round(totalEta)))
  }, [tasks])

  // 每秒递减
  useEffect(() => {
    const timer = setInterval(() => {
      setEta((prev) => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  return eta
}
