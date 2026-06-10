import { useEffect, useRef, useState } from 'react'
import { useTaskStore } from '@/store/taskStore'
import { isTaskTerminal } from '@/types/task'

/**
 * 全局 ETA：所有活跃任务的剩余时间之和，单调递减。
 * 收到 SSE / 轮询新进度时用 EMA 平滑速率，避免批量更新导致 ETA 来回跳。
 */
export function useGlobalEta(): number {
  const tasks = useTaskStore((s) => s.tasks)
  const [eta, setEta] = useState(0)
  const lastProgressRef = useRef<Map<string, number>>(new Map())
  const progressRateRef = useRef<Map<string, number>>(new Map())
  const lastTickRef = useRef(Date.now())
  const lastEtaRef = useRef(0)
  const hasInitializedRef = useRef(false)

  // 计算各活跃任务的 ETA 之和（EMA 平滑 + 单调递减）
  useEffect(() => {
    const active = tasks.filter(
      (t) => !isTaskTerminal(t.status) && t.progress > 0 && t.progress < 1,
    )

    let totalEta = 0
    const now = Date.now()

    for (const t of active) {
      const prev = lastProgressRef.current.get(t.task_id)
      const elapsed = now - lastTickRef.current

      // EMA 平滑速率：新样本权重 0.3，旧速率权重 0.7
      if (prev !== undefined && elapsed > 0) {
        const dp = t.progress - prev
        if (dp > 0) {
          const instantRate = dp / (elapsed / 1000) // progress/sec
          const oldRate = progressRateRef.current.get(t.task_id) || 0
          const emaRate = oldRate > 0
            ? oldRate * 0.7 + instantRate * 0.3
            : instantRate
          progressRateRef.current.set(t.task_id, emaRate)
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

    // 单调递减：新 ETA 只能 ≤ 当前值（防来回跳）
    const newEta = Math.max(0, Math.round(totalEta))
    if (active.length === 0) {
      // 没有活跃任务：清零
      lastEtaRef.current = 0
      hasInitializedRef.current = false
      setEta(0)
    } else if (newEta > 0) {
      // 有有效估算：首次（未初始化）直接采用，之后才单调递减。
      const clamped = hasInitializedRef.current
        ? Math.min(newEta, lastEtaRef.current)
        : newEta
      lastEtaRef.current = clamped
      hasInitializedRef.current = true
      setEta(clamped)
    }
    // newEta === 0 且仍有活跃任务（速率样本未建立）：保持当前 eta，不锁死
  }, [tasks])

  // 每秒递减
  useEffect(() => {
    const timer = setInterval(() => {
      setEta((prev) => {
        const next = Math.max(0, prev - 1)
        lastEtaRef.current = next
        return next
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  return eta
}
