# Phase B.6 + B.7 集成测试计划

## 📋 测试目标

验证 per-task 轮询机制在真实场景中的端到端工作流：
1. 任务列表轮询初始化 ✅
2. 活跃任务精准状态更新 ✅
3. 终结状态自动停止轮询 ✅
4. 内存清理和竞态条件防御 ✅

---

## 🧪 测试案例

### TC-B.7-001：基础轮询流程
**前置条件**：后端和前端都在运行

**步骤**：
```
1. 打开 TaskDashboard（任务中心）
2. 观察顶部 "轮询中" 指示灯（蓝色闪烁）
3. 创建新任务（status=PENDING）
4. 等待 3 秒，任务状态变为 DOWNLOADING
5. 验证任务卡片进度条从 0% 更新至 5-15%
```

**预期结果**：
- ✅ 进度条平滑动画
- ✅ 百分比数值逐步增加（每 3 秒一次）
- ✅ DevTools Network tab 显示 per-task 请求

### TC-B.7-002：多任务并发轮询
**前置条件**：已有 3 个活跃任务

**步骤**：
```
1. 观察 DevTools Network tab
2. 每 3 秒应看到 3 个并发的 GET /pipeline/tasks/{task_id}
3. 响应时间 <100ms
4. 无错误（HTTP 200）
5. 验证 3 个任务的 progress 字段都在更新
```

**预期结果**：
- ✅ 并发请求数 = 活跃任务数
- ✅ 无竞态条件（Zustand state 一致）
- ✅ UI 实时反映所有更新

### TC-B.7-003：任务完成时停止轮询
**前置条件**：活跃任务即将完成

**步骤**：
```
1. 监控任务 progress 逐步增加至 0.95
2. 后续响应设置 status=SUCCESS, progress=1.0
3. 观察任务卡片：进度条隐藏，status 标签变绿
4. 等待下一轮轮询周期（3 秒）
5. 验证该任务的 GET 请求不再出现
```

**预期结果**：
- ✅ 进度条流畅过渡至 100% 后隐藏
- ✅ status 标签更新为 "成功"
- ✅ 该任务的 per-task 请求自动停止

### TC-B.7-004：组件卸载时清理资源
**前置条件**：任务中心有活跃任务

**步骤**：
```
1. 打开任务中心（3 个活跃任务）
2. 打开浏览器 DevTools → Network tab
3. 切换到其他页面（卸载 TaskDashboard）
4. 观察所有待处理的 XHR 请求是否取消
5. 等待 10 秒，不应有新的 /pipeline/tasks 请求
```

**预期结果**：
- ✅ 未发送的请求显示 "cancelled"
- ✅ 不出现 "AbortError" 日志
- ✅ 内存占用回落

---

## 🛠️ 调试清单

### 网络层诊断
```javascript
// Console 监听所有请求
window._originalFetch = window.fetch
window.fetch = async (...args) => {
  console.log(`📡 [${new Date().toISOString().slice(11, 19)}] ${args[0]}`)
  return window._originalFetch(...args)
}
```

### Zustand store 监控
```javascript
import { useTaskStore } from '/frontend/src/store/taskStore'
const unsub = useTaskStore.subscribe(
  (state) => state.tasks,
  (tasks) => console.log('📊 Store tasks updated:', tasks.length, 'tasks')
)
// 清理：unsub()
```

### 进度条动画观察
```javascript
// 在 TaskItem 组件中添加日志
console.log(`Task ${task.task_id} progress: ${progressPct}%`)
```

---

## 🎯 成功标准

| 指标 | 目标 | 验证方法 |
|------|------|--------|
| 轮询延迟 | <100ms | DevTools Network tab |
| 并发度 | = 活跃任务数 | 计数 XHR 请求 |
| 动画流畅 | 60fps | 无卡顿感受 |
| 内存稳定 | <1MB 增长/min | Performance 监控 |
| 错误率 | 0% | Console 无红色日志 |

---

## 🚨 已知限制和改进空间

1. **轮询间隔固定为 3 秒**
   - 可以添加指数退避策略
   - 可以监听用户活动动态调整

2. **无重试机制**
   - 请求失败时直接输出错误
   - 可添加指数退避重试

3. **无网络状况自适应**
   - 在弱网环境可能超时
   - 可添加自动超时调整

---

**Test Plan Version**: 1.0  
**Last Updated**: 2026-04-19  
**Status**: Ready for execution

