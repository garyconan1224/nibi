import { useEffect, useRef, useState } from 'react'
import { useTaskStore } from '@/store/taskStore'
import { isTaskTerminal } from '@/types/task'

/**
 * 全局 ETA：所有活跃任务的剩余时间之和，单调递减。
 * 收到 SSE / 轮询新进度时用 EMA 平滑速率，避免批量更新导致 ETA 来回跳。
 */
export function useGlobalEta(): number {
  const tasks = useTaskStore((s) => s.tasks)
  const [eta, setEta] = useState(-1)
  const lastProgressRef = useRef<Map<string, number>>(new Map())
  const progressRateRef = useRef<Map<string, number>>(new Map())
  const lastTickRef = useRef(Date.now())
  const lastEtaRef = useRef(-1)
  const hasInitializedRef = useRef(false)

  // 计算各活跃任务的 ETA 之和（EMA 平滑 + 单调递减）
  useEffect(() => {
    const active = tasks.filter(
      (t) => !isTaskTerminal(t.status) && t.progress > 0 && t.progress < 1,
    )

    let hasFreshUpdate = false
    let totalEta = 0
    const now = Date.now()

    for (const t of active) {
      const prev = lastProgressRef.current.get(t.task_id)
      const elapsed = now - lastTickRef.current

      // EMA 平滑速率：新样本权重 0.3，旧速率权重 0.7
      if (prev !== undefined && elapsed > 0) {
        const dp = t.progress - prev
        if (dp > 0) {
          hasFreshUpdate = true
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
      lastEtaRef.current = -1
      hasInitializedRef.current = false
      setEta(-1)
    } else if (newEta > 0) {
      // 有有效估算：如果是新的进度更新，允许 ETA 重置；否则只能单调递减
      const clamped = hasInitializedRef.current && !hasFreshUpdate
        ? Math.min(newEta, lastEtaRef.current >= 0 ? lastEtaRef.current : newEta)
        : newEta
      lastEtaRef.current = clamped
      hasInitializedRef.current = true
      setEta(clamped)
    }
    // newEta === 0 且仍有活跃任务（速率样本未建立）：保持当前 eta，不锁死
  }, [tasks])

  // 定时器：每秒更新剩余时间，结合真实消逝时间重估，不至于在静默期直落到 0
  useEffect(() => {
    const timer = setInterval(() => {
      setEta((prev) => {
        if (prev < 0) return prev
        const now = Date.now()
        const active = tasks.filter((t) => !isTaskTerminal(t.status) && t.progress > 0 && t.progress < 1)
        if (active.length === 0) return prev

        let totalEta = 0
        for (const t of active) {
          const rate = progressRateRef.current.get(t.task_id)
          if (rate && rate > 0) {
            // 当前进度的理想剩余时间
            const baseRemaining = (1 - t.progress) / rate
            // 距离上次收到该任务进度的流逝时间
            const prevProgress = lastProgressRef.current.get(t.task_id)
            let stallPenalty = 0
            if (prevProgress === t.progress) {
              const elapsedSinceTick = (now - lastTickRef.current) / 1000
              // 如果进度一直没变，实际的 rate 就在下降，期望的剩余时间应该增加
              // 为了平滑，我们简单地将流逝时间加回 baseRemaining
              stallPenalty = Math.max(0, elapsedSinceTick)
            }
            totalEta += (baseRemaining + stallPenalty)
          }
        }
        
        const idealEta = Math.round(totalEta)
        // 使用阻尼系数逼近 idealEta，而不是单纯 -1
        if (idealEta > prev) {
           return Math.round(prev * 0.9 + idealEta * 0.1) // 缓慢上升
        }
        return Math.max(1, prev - 1) // 正常下降，但不低于 1s（只要还有活跃任务）
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [tasks])

  return eta
}
