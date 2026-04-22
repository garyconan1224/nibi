# 控制台日志对比：修复前后

## 📌 修复前 - 8010 端口错误（您提供的截图）

```javascript
// ❌ 错误日志（端口 8010）
GET http://127.0.0.1:8010/pipeline/tasks
↳ net::ERR_CONNECTION_TIMED_OUT

❌ [Health Check] 后端离线 (第 1 次失败) timeout of 15000ms exceeded
  useBackendHealth.ts:26

GET http://127.0.0.1:8010/health
↳ net::ERR_CONNECTION_TIMED_OUT

❌ [Health Check] 后端离线 (第 2 次失败) Network Error
  useBackendHealth.ts:26

❌ [Health Check] 后端离线 (第 3 次失败) Network Error
  useBackendHealth.ts:26

Failed to fetch pipeline tasks: AxiosError: timeout of 15000ms exceeded
  usePipelineTasks.ts:60
```

**问题分析**：
- 🔴 所有请求都指向 **8010 端口**（错误！）
- 🔴 连接超时 `net::ERR_CONNECTION_TIMED_OUT`
- 🔴 重试之间无间隔提示
- 🔴 未显示重试次数计数

---

## ✅ 修复后 - 8000 端口正确（预期日志）

### 场景 A: 后端正常运行

```javascript
// ✅ 成功日志（端口 8000）
GET http://127.0.0.1:8000/health
↳ Status: 200 OK
↳ Response: {
     status: "healthy",
     version: "0.3.0",
     uptime_sec: 234.56
   }

✅ [Health Check] 后端在线 {
  status: "healthy",
  version: "0.3.0",
  uptime_sec: 234.56
}  useBackendHealth.ts:17

GET http://127.0.0.1:8000/providers
↳ Status: 200 OK
↳ Response: [...]

GET http://127.0.0.1:8000/pipeline/tasks
↳ Status: 200 OK
↳ Response: {...}
```

**对比要点**：
- ✅ 所有请求使用 **8000 端口**
- ✅ 状态码为 `200 OK`
- ✅ 显示 `✅ [Health Check] 后端在线`
- ✅ 响应数据完整

---

### 场景 B: 后端离线，触发重试机制

```javascript
// 初始状态：用户刷新页面，后端未运行
❌ [Health Check] 后端离线 (第 1 次失败) Network Error
  useBackendHealth.ts:25

// 约 2 秒后，自动触发第一次重试
GET http://127.0.0.1:8000/health
↳ net::ERR_CONNECTION_REFUSED (或其他网络错误)

❌ [Health Check] 后端离线 (第 2 次失败) Network Error
  useBackendHealth.ts:25

// 约 2 秒后，自动触发第二次重试
GET http://127.0.0.1:8000/health
↳ net::ERR_CONNECTION_REFUSED

❌ [Health Check] 后端离线 (第 3 次失败) Network Error
  useBackendHealth.ts:25

// 达到最大重试次数（3 次），停止重试
// ok 状态变为 false（离线状态）
```

**重试时间轴**：
- T=0ms: 第 1 次失败
- T=2000ms: 第 2 次失败
- T=4000ms: 第 3 次失败  
- T=6000ms: 停止重试，状态为离线

---

### 场景 C: 后端离线后恢复（重试期间）

```javascript
// 后端离线，触发第 1 次重试
❌ [Health Check] 后端离线 (第 1 次失败) Network Error
  useBackendHealth.ts:25

// 用户在此时启动后端...
// 约 2 秒后，自动重试

GET http://127.0.0.1:8000/health  ← 这次成功！
↳ Status: 200 OK
↳ Response: {status: "healthy", ...}

✅ [Health Check] 后端在线 {
  status: "healthy",
  version: "0.3.0",
  uptime_sec: 2.34
}  useBackendHealth.ts:17

// useBackendHealth hook 返回 true
// UI 自动更新为"后端在线"状态
```

**关键改进**：
- ✅ 自动重试，无需用户干预
- ✅ 后端恢复后立即连接成功
- ✅ 无硬超时阻塞

---

## 🔍 Network Tab 对比

### 修复前（8010 端口）

```
Request URL: http://127.0.0.1:8010/pipeline/tasks
Status:      (failed) net::ERR_CONNECTION_TIMED_OUT
Type:        xhr
Size:        0 B
Time:        15s (超时等待)

Headers:
  Request Headers:
    GET /pipeline/tasks HTTP/1.1
    Host: 127.0.0.1:8010
    ...
  Response Headers:
    (无响应，连接失败)
```

### 修复后（8000 端口）

```
Request URL: http://127.0.0.1:8000/pipeline/tasks
Status:      200 OK
Type:        xhr
Size:        2.4 KB
Time:        124 ms ✅ (正常响应时间)

Headers:
  Request Headers:
    GET /pipeline/tasks HTTP/1.1
    Host: 127.0.0.1:8000
    ...
  Response Headers:
    HTTP/1.1 200 OK
    content-type: application/json
    content-length: 2456
    ...
```

---

## 📋 调试技巧

### 🎯 快速定位问题

在 Console 中执行：

```javascript
// 查看当前 API 基础 URL
console.log(
  'API Base URL:',
  import.meta.env.VITE_BACKEND_BASE_URL ?? 'http://127.0.0.1:8000'
)
// 预期输出: http://127.0.0.1:8000 (不是 8010)

// 检查所有未完成的网络请求
console.table(performance.getEntriesByType('resource'))
// 查看 duration 中是否有接近 15000ms 的请求（超时迹象）
```

### 🎯 监听重试事件

```javascript
// 在 Console 中输入，监听所有错误日志
const originalError = console.error
console.error = function(...args) {
  if (args[0]?.includes?.('[Health Check]')) {
    console.log('🔔 重试事件:', args)
  }
  originalError.apply(console, args)
}
```

---

## ✅ 验收标准

| 指标 | 修复前 | 修复后 |
|------|--------|--------|
| API 端口 | 8010 ❌ | 8000 ✅ |
| 请求超时 | 15000ms ❌ | <500ms ✅ |
| 重试次数 | 无 | 3 次 ✅ |
| 重试间隔 | 无 | 2 秒 ✅ |
| 错误提示 | "timeout exceeded" | "Network Error" (清晰) ✅ |
| 后端恢复响应 | 需手动刷新 | 自动重试连接 ✅ |

