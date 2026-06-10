import { useEffect, useRef, useState } from 'react'
import { useTaskStore } from '@/store/taskStore'
import { isTaskTerminal } from '@/types/task'

/** 进度样本：进度值 + 时间戳（ms） */
interface ProgressSample {
  p: number
  t: number
}

/**
 * 全局 ETA：所有活跃任务的剩余时间之和，单调递减。
 *
 * 两个关键改进（相对旧版 EMA）：
 * 1. **滚动窗口速率**：每个任务保留最近 5 个进度样本，用窗口首尾算速率。
 *    阶段切换时旧样本自动淘汰，速率能快速跟上新阶段的真实速度。
 * 2. **停顿快速修正**：停顿时 idealEta 用 0.3 权重上升（旧版 0.1），
 *    让 ETA 在进度卡住时更快修正到合理值。
 */
const WINDOW_SIZE = 5 // 每个任务保留的样本数

export function useGlobalEta(): number {
  const tasks = useTaskStore((s) => s.tasks)
  const [eta, setEta] = useState(-1)
  // 每个 task 的滚动窗口
  const samplesRef = useRef<Map<string, ProgressSample[]>>(new Map())
  // 每个 task 上次实际进度变化的时间
  const lastProgressTimeRef = useRef<Map<string, number>>(new Map())
  // 缓存的速率（窗口不足 2 个样本时沿用上一次）
  const cachedRateRef = useRef<Map<string, number>>(new Map())
  const lastEtaRef = useRef(-1)
  const hasInitializedRef = useRef(false)

  /** 用滚动窗口算速率；样本不足时返回缓存值 */
  function calcRate(taskId: string): number {
    const samples = samplesRef.current.get(taskId)
    if (!samples || samples.length < 2) {
      return cachedRateRef.current.get(taskId) ?? 0
    }
    const oldest = samples[0]
    const newest = samples[samples.length - 1]
    const dt = (newest.t - oldest.t) / 1000 // 秒
    if (dt <= 0) return cachedRateRef.current.get(taskId) ?? 0
    const rate = (newest.p - oldest.p) / dt
    // 保留正速率供后续窗口不足时沿用
    if (rate > 0) cachedRateRef.current.set(taskId, rate)
    return rate
  }

  // 计算各活跃任务的 ETA 之和
  useEffect(() => {
    const active = tasks.filter(
      (t) => !isTaskTerminal(t.status) && t.progress > 0 && t.progress < 1,
    )

    let hasFreshUpdate = false
    let totalEta = 0
    const now = Date.now()

    for (const t of active) {
      const samples = samplesRef.current.get(t.task_id) ?? []
      const lastSample = samples.length > 0 ? samples[samples.length - 1] : undefined

      // 进度实际变化 → 推入新样本
      if (!lastSample || t.progress !== lastSample.p) {
        const newSamples = [...samples, { p: t.progress, t: now }]
        // 只保留最近 WINDOW_SIZE 个
        if (newSamples.length > WINDOW_SIZE) {
          newSamples.splice(0, newSamples.length - WINDOW_SIZE)
        }
        samplesRef.current.set(t.task_id, newSamples)
        lastProgressTimeRef.current.set(t.task_id, now)
        if (lastSample && t.progress > lastSample.p) {
          hasFreshUpdate = true
        }
      }
      // 进度未变化：不更新，让定时器通过 (now - lastProgressTime) 算停顿补偿

      const rate = calcRate(t.task_id)
      if (rate > 0) {
        totalEta += (1 - t.progress) / rate
      }
    }

    const newEta = Math.max(0, Math.round(totalEta))
    if (active.length === 0) {
      lastEtaRef.current = -1
      hasInitializedRef.current = false
      setEta(-1)
    } else if (newEta > 0) {
      const clamped = hasInitializedRef.current && !hasFreshUpdate
        ? Math.min(newEta, lastEtaRef.current >= 0 ? lastEtaRef.current : newEta)
        : newEta
      lastEtaRef.current = clamped
      hasInitializedRef.current = true
      setEta(clamped)
    }
  }, [tasks])

  // 定时器：每秒更新，停顿时快速修正
  useEffect(() => {
    const timer = setInterval(() => {
      setEta((prev) => {
        if (prev < 0) return prev
        const now = Date.now()
        const active = tasks.filter(
          (t) => !isTaskTerminal(t.status) && t.progress > 0 && t.progress < 1,
        )
        if (active.length === 0) return prev

        let totalEta = 0
        for (const t of active) {
          const rate = calcRate(t.task_id)
          if (rate > 0) {
            const baseRemaining = (1 - t.progress) / rate
            const lastProgressTime = lastProgressTimeRef.current.get(t.task_id) ?? now
            const elapsedSinceProgress = (now - lastProgressTime) / 1000
            // 停顿越久，补偿越大
            const stallPenalty = Math.max(0, elapsedSinceProgress)
            totalEta += baseRemaining + stallPenalty
          }
        }

        const idealEta = Math.round(totalEta)
        if (idealEta > prev) {
          // 停顿/减速：快速上升修正（权重 0.3，旧版 0.1）
          return Math.round(prev * 0.7 + idealEta * 0.3)
        }
        // 正常推进：每秒减 1，不低于 1s
        return Math.max(1, prev - 1)
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [tasks])

  return eta
}
