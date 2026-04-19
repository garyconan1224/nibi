# 实现细节参考：Per-Task 轮询机制

## 📐 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│  TaskDashboard.tsx                                          │
│  ├─ usePipelineTasks({ projectId, enabled: true })         │
│  │  ├─ Hook 初始化                                         │
│  │  └─ 返回 { fetchTasks } 供手动刷新                       │
│  └─ useTaskStore((s) => s.tasks)                           │
│     └─ 订阅 tasks 数组变化，自动重新渲染                    │
│        └─ TaskItem × N                                      │
│           ├─ task.progress → 进度条 width                  │
│           └─ task.status → 样式 + 可见性                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  usePipelineTasks Hook（163 行）                           │
│                                                             │
│  Layer 1：Refs 同步（避免闭包陷阱）                        │
│  ├─ tasksRef ← 最新 tasks                                  │
│  ├─ intervalRef ← 批量轮询定时器                          │
│  └─ perTaskIntervalRef ← per-task 轮询定时器              │
│                                                             │
│  Layer 2：批量轮询 useEffect（原有逻辑，保持不变）         │
│  ├─ 每 3 秒调用 GET /pipeline/tasks                       │
│  ├─ 获取全量任务列表                                       │
│  └─ 调用 setTasks() 更新 store                            │
│                                                             │
│  Layer 3：Per-task 精准轮询 useEffect（新增）             │
│  ├─ 过滤活跃任务：!isTaskTerminal(t.status)              │
│  ├─ 创建 AbortController 数组                             │
│  ├─ 并发 GET /pipeline/tasks/{task_id}                   │
│  ├─ Promise.allSettled（容错）                            │
│  ├─ 调用 updateTask(id, updated)                         │
│  └─ cleanup：clearInterval + abort all                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Zustand Store (taskStore.ts)                              │
│  ├─ setTasks(tasks)       ← 批量轮询使用                  │
│  ├─ updateTask(id, {...}) ← per-task 轮询使用             │
│  └─ 触发订阅者重新渲染 TaskDashboard + TaskItem           │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 关键实现细节

### 1. 活跃任务过滤

```typescript
const activeTasks = tasksRef.current.filter(t => !isTaskTerminal(t.status))
```

**关键点**：
- 使用 `tasksRef` 而非直接 `tasks`（避免闭包陷阱）
- `isTaskTerminal()` 判定：`task.status ∈ {SUCCESS, FAILED, CANCELLED}`
- 全部任务完成时 `activeTasks.length === 0`，跳过本轮请求

### 2. AbortController 绑定

```typescript
const controllers = activeTasks.map(() => new AbortController())
inFlightControllers = controllers

// 每个请求独立绑定 signal
http.get(`/pipeline/tasks/${task.task_id}`, { signal: controllers[idx].signal })
```

**优势**：
- 组件卸载时 `ctrl.abort()` 取消所有飞行中请求
- 防止内存泄漏和竞态条件
- 错误处理：`err.name === 'CanceledError'` 时静默忽略

### 3. 响应格式兼容性

```typescript
const raw = resp.data
const updated: TaskRecord =
  raw && typeof raw === 'object' && 'task_id' in raw
    ? (raw as TaskRecord)
    : (raw as { data: TaskRecord }).data
```

**支持格式**：
- 格式 A：直接返回 `TaskRecord`
- 格式 B：返回 `{ data: TaskRecord }` 包装

### 4. Zustand 精准更新

```typescript
updateTask(updated.task_id, updated)  // 更新单个任务，不覆盖其他
```

**对比**：
- ❌ `setTasks([...tasks.map(...)])` — 每次都重建数组，触发不必要重新渲染
- ✅ `updateTask(id, {...})` — 仅修改指定任务，高效

---

## ⏱️ 时间线

| 阶段 | 事件 | 时间 |
|------|------|------|
| T=0s | 组件挂载 → `usePipelineTasks()` 初始化 | 同步 |
| T=0s | 立即执行 `fetchTasks()` → 拉全量任务 | 异步 |
| T=0.5s | 任务列表加载完成，TaskItem 渲染 | 同步 |
| T=3s | 批量轮询 + per-task 轮询同时启动 | 异步并发 |
| T=3.1s | 批量轮询完成，全量 tasks 更新 | 同步重渲 |
| T=3.2s | Per-task 请求完成，单个任务更新 | 同步重渲 |
| T=6s | 第二轮轮询开始... | 循环 |
| T=unmount | 清理定时器 + 取消飞行中请求 | 同步清理 |

---

## 🧩 API 契约

### 后端响应格式

```json
{
  "task_id": "task-001",
  "project_id": "proj-xxx",
  "task_type": "download",
  "status": "DOWNLOADING",
  "progress": 0.35,
  "payload": {...},
  "log": [{ts: "...", level: "info", message: "..."}, ...],
  "result": {},
  "error": "",
  "retry_of": "",
  "cancel_requested": false,
  "created_at": "2026-04-19T...",
  "updated_at": "2026-04-19T..."
}
```

### 前端消费

```typescript
// TaskItem 接收的 task 对象
progressPct = Math.round(task.progress * 100)  // [0, 100]
isActive = !isTaskTerminal(task.status) && task.status !== 'PENDING'
```

---

## 🚨 错误处理

```typescript
} catch (err: unknown) {
  if (err instanceof Error && err.name === 'CanceledError') return  // 主动取消
  console.error(`[useTaskPolling] 任务 ${task.task_id} 轮询失败:`, err)
}
```

**覆盖场景**：
- ✅ 网络超时 → 打印日志，继续下一轮
- ✅ 404 Not Found → 打印日志，继续下一轮
- ✅ 请求被 abort → 静默忽略（组件卸载）

---

**Version**: 1.0  
**Audience**: Backend + Frontend developers  
**Last Updated**: 2026-04-19

