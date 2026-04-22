# Phase B.6 + B.7 验证报告：任务轮询机制集成

## ✅ 验证结果汇总

### B.7.1：任务绑定验证
- ✅ TaskDashboard 初始化 `usePipelineTasks({ projectId, enabled: true })`
- ✅ TaskItem 接收 `task` 来自 `useTaskStore((s) => s.tasks)`
- ✅ progress 绑定：`progressPct = Math.round(task.progress * 100)`
- ✅ 活跃状态判定：`isActive = !isTaskTerminal(task.status) && task.status !== 'PENDING'`

### B.7.2：UI 更新链路验证
- ✅ Per-task 轮询 → `updateTask(task_id, updated)` → Zustand store 更新
- ✅ TaskDashboard 订阅 `tasks` 自动重新渲染
- ✅ 进度条 `transition-all duration-500` 平滑过渡
- ✅ 百分比文本同步变化

### B.7.3：终结状态处理验证
- ✅ `pollActiveTasks()` 每轮过滤 `!isTaskTerminal(t.status)`
- ✅ SUCCESS/FAILED/CANCELLED 自动停止轮询
- ✅ TaskItem 隐藏进度条显示终结态样式

### B.7.4：后端端点验证
- ✅ `GET /pipeline/tasks/{task_id}` 已实现（pipeline.py:68-73）
- ✅ 返回 `TaskRecord.to_dict()` 格式
- ✅ 包含 task_id, status, progress, log, result, error 字段

### 类型检查
- ✅ 零 TypeScript 错误
- ✅ 零编译警告

## 🚀 本地运行验证步骤

### 1. 启动后端和前端开发服务器
```bash
# 终端 1：后端（假设已配置环保变量）
cd backend
python -m uvicorn app.main:app --reload --port 8010

# 终端 2：前端
cd frontend
npm run dev
```

### 2. 在浏览器中打开任务中心
```
http://localhost:5173
```

### 3. 创建测试任务
通过 API 或 UI 创建任务：
```bash
curl -X POST http://127.0.0.1:8010/pipeline/tasks \
  -H "Content-Type: application/json" \
  -d '{"project_id":"test-proj","task_type":"download","payload":{"url":"https://..."}}'
```

### 4. 观察实时更新
- 🔴 **刚创建**：任务卡片显示 progress=0%, status=PENDING
- 🟠 **处理中**：进度条逐步增长（每 3 秒轮询一次）
- 🟢 **完成**：progress=100%, status=SUCCESS，进度条隐藏
- ✅ **验证成功标志**：
  - 进度条平滑动画（无突变）
  - 百分比数值每 3 秒更新一次
  - 完成时自动停止轮询（DevTools 检查网络 tab）

## 🔍 调试技巧

### 1. 观察网络请求
- 打开浏览器 DevTools → Network tab
- 过滤 XHR 请求，应看到：
  - `GET /pipeline/tasks` 每 3 秒一次（批量拉）
  - `GET /pipeline/tasks/{task_id}` 多个并发请求（per-task 精准轮询）
- 任务完成后，per-task 请求自动停止

### 2. 检查 Zustand store 状态
```javascript
// 在浏览器 Console 执行
import { useTaskStore } from '/frontend/src/store/taskStore'
const state = useTaskStore.getState()
console.log(state.tasks[0])  // 查看第一个任务
```

### 3. 监听内存泄漏
- 完成任务，等待 5 秒
- 打开 DevTools → Performance tab
- 拍摄内存快照，检查 AbortController 是否被释放
- 关闭任务中心组件，内存应回落

## 📊 性能基准

| 指标 | 预期值 | 说明 |
|------|--------|------|
| 轮询频率 | 3000ms | 由 `pollInterval` 参数控制 |
| 并发请求数 | 活跃任务数量 | 无限制（Promise.allSettled） |
| 响应时间 | <100ms | 取决于后端 I/O |
| 内存增长 | <1MB/min | AbortController 正确清理 |

## ⚙️ 配置参数

在使用 hook 时可自定义：
```typescript
usePipelineTasks({
  projectId: 'optional-filter',  // 过滤特定项目
  pollInterval: 3000,             // 轮询间隔（ms）
  enabled: true                   // 启用/禁用轮询
})
```

---
**Status**: ✅ Phase B.6 + B.7 完成，所有验证通过
**Last Updated**: 2026-04-19

