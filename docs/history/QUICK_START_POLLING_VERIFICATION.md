# 🚀 快速验证指南：Per-Task 轮询机制

## ⚡ 30 秒快速启动

```bash
# 终端 1：后端（假设在 /backend）
python -m uvicorn app.main:app --reload --port 8010

# 终端 2：前端（假设在 /frontend）
npm run dev
```

**浏览器打开**：http://localhost:5173 → 进入任务中心

---

## 🧪 3 分钟验证清单

### ✅ 检查 1：UI 状态绑定
```
打开浏览器 DevTools → Console → 执行：
const state = window.__ZUSTAND_DEVTOOLS__ || 
  (window.localStorage.getItem('zustand-store-name') || 'TaskStore')
console.log('Tasks:', useTaskStore.getState().tasks)
```
**预期**：输出任务数组，任务对象包含 `progress`, `status` 字段

### ✅ 检查 2：网络轮询
```
打开 DevTools → Network tab → 过滤 XHR/Fetch
创建测试任务（任意方式）
观察网络请求：
  - GET /pipeline/tasks （每 3 秒一次）
  - GET /pipeline/tasks/task-xxx （多个并发请求）
```
**预期**：
- 每 3 秒左右看到一批新请求
- 活跃任务数 = GET /pipeline/tasks/task-xxx 的个数
- 响应状态 200
- 任务完成后这类请求自动停止

### ✅ 检查 3：进度条动画
```
观察任务卡片中的进度条：
  [████░░░░░░] 45%
```
**预期**：
- 进度条平滑增长（无突变）
- 百分比每 3 秒更新一次
- 到 100% 后自动隐藏
- 完成时状态标签变绿 "成功"

---

## 🔧 关键代码片段

### 后端端点
```python
@router.get("/tasks/{task_id}")
def get_task(task_id: str):
    rec = _store.get(task_id)
    return rec.to_dict() if rec else HTTPException(404)
```

### 前端轮询
```typescript
useEffect(() => {
  const activeTasks = tasksRef.current.filter(t => !isTaskTerminal(t.status))
  if (activeTasks.length === 0) return
  
  // 并发请求所有活跃任务
  await Promise.allSettled(
    activeTasks.map(task =>
      http.get(`/pipeline/tasks/${task.task_id}`)
        .then(res => updateTask(task.task_id, res.data))
    )
  )
}, [pollInterval])
```

---

## 🐛 常见问题速查表

| 问题 | 症状 | 解决方案 |
|------|------|--------|
| 进度不更新 | 卡片显示 0%，不变化 | 检查后端是否返回 progress 字段 |
| 网络请求过多 | 每秒多次请求 | 确认 pollInterval=3000，检查是否有多个 hook 实例 |
| 完成后继续请求 | 终结任务仍有 GET | 检查 isTaskTerminal() 逻辑，确保包含所有终结态 |
| 内存泄漏 | 一直打开任务中心，内存上升 | 检查 cleanup 函数中是否执行 ctrl.abort() |
| 报错 404 | Network 显示红色状态 | 确认后端实现了 `/pipeline/tasks/{task_id}` 端点 |

---

## 📊 性能基准

```
轮询间隔：3000ms（可配）
并发请求数：= 活跃任务数
每次响应时间：< 100ms
内存增长：< 1MB/分钟
```

---

## 📚 详细文档

- 完整验证报告：`PHASE_B_POLLING_VERIFICATION.md`
- 集成测试计划：`PHASE_B_INTEGRATION_TEST_PLAN.md`
- 最终交接文档：`PHASE_B_6_7_FINAL_SUMMARY.md`

---

**Version**: 1.0  
**Status**: ✅ Ready  
**Date**: 2026-04-19

