# 后端连接超时修复 - F12 验收验证清单

**修复版本**: fix: resolve backend connection timeout and improve network error UI feedback  
**验证日期**: 2026-04-22  
**验证工具**: Chrome/Firefox 开发者工具 (F12)

---

## 🎯 验证前准备

1. **启动后端服务**
   ```bash
   # 后端需运行在 8000 端口（不是 8010）
   cd /Users/conan/Desktop/nibi
   python app.py  # 或相应启动命令
   ```

2. **启动前端开发服务器**
   ```bash
   cd frontend
   npm run dev
   ```

3. **打开浏览器**
   - 访问 `http://localhost:5175`
   - 按 `F12` 打开开发者工具
   - 切换到对应的 Tab（Console/Network）

---

## 📊 验证维度 1: 控制台日志 (Console Tab)

### ✅ 检查项 1.1 - 后端在线日志
**预期日志**（修复后）：
```
✅ [Health Check] 后端在线 {status: "healthy", version: "0.3.0", uptime_sec: 123.45}
```

**验证步骤**：
1. 刷新页面（Cmd+R）
2. 打开 Console
3. 查找 `✅ [Health Check]` 日志
4. 确认端口为 8000，状态为 `healthy`

**失败指标** ❌：
- 无 `✅ [Health Check]` 日志
- 仍显示 `timeout of 15000ms exceeded`
- 日志显示端口 8010

---

### ✅ 检查项 1.2 - 重试机制验证
**场景**: 模拟后端暂时离线，然后恢复

**验证步骤**：
1. 后端运行中，刷新页面
2. 记录首次成功日志时间戳
3. **停止后端服务**（Ctrl+C）
4. 打开一个新标签页访问 `http://localhost:5175`
5. **观察控制台日志**，应看到：
   ```
   ❌ [Health Check] 后端离线 (第 1 次失败) Network Error useBackendHealth.ts:26
   ❌ [Health Check] 后端离线 (第 2 次失败) Network Error useBackendHealth.ts:26
   ❌ [Health Check] 后端离线 (第 3 次失败) Network Error useBackendHealth.ts:26
   ```
6. **立即重启后端服务**
7. **等待 2-4 秒**，应看到：
   ```
   ✅ [Health Check] 后端在线 {...}
   ```

**成功标志** ✅：
- 显示 "第 1/2/3 次失败" 消息
- 每次失败间隔约 2 秒
- 最多重试 3 次后停止
- 后端恢复后能正确连接

**失败指标** ❌：
- 无重试日志显示
- 重试次数不正确
- 不显示重试间隔信息

---

## 📊 验证维度 2: 网络请求 (Network Tab)

### ✅ 检查项 2.1 - API 端口统一检查
**验证步骤**：
1. 打开 Network Tab
2. 刷新页面（Cmd+R）
3. 在过滤框输入 `pipeline` 或 `health`
4. **逐一检查以下请求**：

| 请求路径 | 预期端口 | 状态码 | 耗时 |
|---------|---------|--------|------|
| `GET /health` | 8000 | 200 | <500ms |
| `GET /providers` | 8000 | 200 | <1s |
| `GET /pipeline/tasks` | 8000 | 200 | <1s |
| `EventSource /pipeline/tasks/{id}/events` | 8000 | 200 | 持续 |

**成功标志** ✅：
- 所有 URL 显示 `http://127.0.0.1:8000/...` （**不是 8010**）
- 状态码均为 `200 OK`
- 无 `net::ERR_CONNECTION_TIMED_OUT` 错误

**失败指标** ❌：
```
❌ http://127.0.0.1:8010/pipeline/tasks
❌ Status: (failed) net::ERR_CONNECTION_TIMED_OUT
❌ 显示红色 ✕ 符号
```

### ✅ 检查项 2.2 - EventSource (SSE) 连接检查
**验证步骤**：
1. 在首页点击"新建任务"并提交一个任务
2. Network Tab 中搜索 `events`
3. 找到类似 `/pipeline/tasks/xxxx-xxxx/events` 的请求
4. **检查以下内容**：
   - URL: `http://127.0.0.1:8000/pipeline/tasks/...` ✅
   - 类型: `EventSource` ✅
   - 状态: `200` 或 `(pending)` ✅
   - 响应流: 应显示多行日志数据 ✅

**失败指标** ❌：
- URL 包含 `8010`
- 状态显示 `(failed)`
- 无响应数据

---

## 📊 验证维度 3: UI 错误显示 (元素检查)

### ✅ 检查项 3.1 - 设置页面错误不重复
**验证步骤**：
1. 导航到 `http://localhost:5175/settings/models`
2. **断开网络**（Network throttling → Offline）
3. 点击右上角"刷新"按钮（RefreshCw 图标）
4. **观察错误显示**：
   - 应出现一条 **toast 消息**（右上角红色提示）
   - 应出现一条 **全局错误横幅**（页面上方）
   - **不应重复显示多个 "Network Error" 字样**

**成功标志** ✅：
```
┌─ Toast 消息 ─────────────────┐
│ ❌ 获取提供商失败              │
└──────────────────────────────┘

┌─ Error Banner ─────────────────────────────┐
│ 🔴 Failed to fetch providers: Network error  │
│                                    [✕ 关闭]   │
└────────────────────────────────────────────┘
```

**失败指标** ❌：
```
❌ Network ErrorNetwork Error  (文字重复)
❌ 同时显示 3 个以上错误提示
❌ 错误横幅与 toast 内容重复
```

### ✅ 检查项 3.2 - 恢复网络后错误清除
**验证步骤**：
1. 网络仍为 Offline 状态
2. 再次点击"刷新"按钮（会再次失败）
3. **恢复网络**（Network → Online）
4. 再次点击"刷新"
5. **观察结果**：
   - 错误横幅应消失 ✅
   - 错误 toast 应清除 ✅
   - 提供商列表应正常加载 ✅

---

## 📊 验证维度 4: 应用行为（E2E 验证）

### ✅ 检查项 4.1 - 首页任务流程
**验证步骤**：
1. 访问 `http://localhost:5175/home`
2. Console 中应显示 `✅ [Health Check] 后端在线`
3. 粘贴一个视频链接（YouTube/B站）
4. 点击"开始处理"
5. **观察**：
   - 任务应成功提交（不报 8010 超时）
   - Console 无 `net::ERR_CONNECTION_TIMED_OUT` 错误
   - 任务进度条正常显示

---

## 📋 验收签字

| 检查项 | 状态 | 备注 |
|--------|------|------|
| 1.1 - 后端在线日志 | ☐ | 显示 `✅ [Health Check] 后端在线` |
| 1.2 - 重试机制 | ☐ | 显示 "第 1/2/3 次失败" 及重试逻辑 |
| 2.1 - API 端口统一 | ☐ | 所有请求使用 8000 端口，无 8010 |
| 2.2 - SSE 连接 | ☐ | EventSource 连接正常，状态 200 |
| 3.1 - 错误不重复 | ☐ | 无 "Network ErrorNetwork Error" 现象 |
| 3.2 - 错误清除 | ☐ | 恢复网络后错误横幅消失 |
| 4.1 - 首页流程 | ☐ | 任务提交成功，无超时错误 |

**最终验收**: ☐ 全部通过 / ☐ 有待改进

