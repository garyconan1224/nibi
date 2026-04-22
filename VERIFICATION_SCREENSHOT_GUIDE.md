# F12 验证截图指南 - 分步操作与预期结果

## 📸 验证流程 1: 控制台健康检查日志

### 步骤 1.1: 启动服务并观察初始日志

**操作**：
```bash
# 终端 1: 启动后端 (8000 端口)
cd /Users/conan/Desktop/nibi
python app.py  # 或 fastapi run app.py

# 终端 2: 启动前端
cd frontend
npm run dev
```

**验证**：
1. 打开浏览器 → `http://localhost:5175`
2. 按 `F12` 打开开发者工具
3. 切换到 **Console** Tab
4. **清空日志** (右上角垃圾桶图标)
5. **刷新页面** (Cmd+R / Ctrl+R)

**预期截图**：
```
✅ [Health Check] 后端在线 {
  "status": "healthy",
  "version": "0.3.0",
  "uptime_sec": 45.67
}

日志来源: useBackendHealth.ts:17
时间戳: VM123:1 (蓝色)
```

**截图建议**：
- 📷 Capture: Console Tab 显示 `✅ [Health Check] 后端在线`
- 📹 GIF: 显示日志加载的完整过程（0.5 秒内完成）

---

### 步骤 1.2: 触发重试机制（后端离线模拟）

**操作**：
1. 打开新的浏览器标签页
2. **停止后端服务** (终端 1 按 Ctrl+C)
3. 访问 `http://localhost:5175` (新标签页)
4. 观察 Console 日志变化

**预期日志序列**：
```
T=0s    ❌ [Health Check] 后端离线 (第 1 次失败) Network Error
        源文件: useBackendHealth.ts:25

T≈2s   ❌ [Health Check] 后端离线 (第 2 次失败) Network Error
        源文件: useBackendHealth.ts:25

T≈4s   ❌ [Health Check] 后端离线 (第 3 次失败) Network Error
        源文件: useBackendHealth.ts:25

(不再重试)
```

**截图建议**：
- 📷 连续截图 3 张（每 2 秒一张），显示重试计数递增
- 🎯 突出显示 "(第 N 次失败)" 部分

---

### 步骤 1.3: 后端恢复，观察自动连接

**操作**：
1. Console 中仍显示"第 3 次失败"
2. **重启后端服务** (终端 1: `python app.py`)
3. **等待 2-4 秒**，观察 Console 自动更新

**预期日志**：
```
T≈6s   GET http://127.0.0.1:8000/health  (自动重试)
       ↳ Status: 200 OK

✅ [Health Check] 后端在线 {
  "status": "healthy",
  "version": "0.3.0",
  "uptime_sec": 2.34
}
```

**截图建议**：
- 📷 显示从 "第 3 次失败" → "✅ 后端在线" 的过渡状态

---

## 📸 验证流程 2: Network Tab - 端口统一检查

### 步骤 2.1: 检查 API 请求端口

**操作**：
1. 打开 Network Tab
2. 刷新页面 (Cmd+R)
3. 在搜索框输入 `health` 或 `pipeline`
4. 逐一检查每个请求

**预期结果**：

```
请求 1: GET http://127.0.0.1:8000/health
        ├─ Status: 200
        ├─ Type: xhr
        └─ Time: 45 ms

请求 2: GET http://127.0.0.1:8000/providers
        ├─ Status: 200
        ├─ Type: xhr
        └─ Time: 123 ms

请求 3: GET http://127.0.0.1:8000/pipeline/tasks
        ├─ Status: 200
        ├─ Type: xhr
        └─ Time: 89 ms
```

**关键点** ✅：
- ✅ **所有 URL 都是 8000 端口**（非 8010）
- ✅ **Status 都是 200 OK**（非红色 ❌）
- ✅ **Time 都在 1 秒以内**（非 15s 超时）

**截图建议**：
- 📷 Network Tab 全览（显示多个请求）
- 🔍 放大单个请求，确认 URL 中的 `:8000` 部分清晰可见

---

### 步骤 2.2: SSE (EventSource) 连接验证

**操作**：
1. 在首页提交一个视频处理任务
2. Network Tab 中筛选 `events` 或 `EventSource`
3. 点击该请求查看详情

**预期请求**：
```
请求 URL: GET http://127.0.0.1:8000/pipeline/tasks/550e8400-e29b-41d4-a716-446655440000/events
Status:   200 (pending / streaming)
Type:     EventSource
Headers:
  ├─ Accept: text/event-stream
  ├─ Cache-Control: no-cache
  └─ Connection: keep-alive
Response: (流式数据)
  event: log
  data: {"timestamp": "...", "message": "Processing started..."}
  
  event: log
  data: {"timestamp": "...", "message": "Frame extracted..."}
```

**截图建议**：
- 📷 Request Headers 显示 `text/event-stream` 和 `:8000` 端口
- 📹 实时 Response 流（显示多条日志行）

---

## 📸 验证流程 3: UI 错误处理 - 设置页面

### 步骤 3.1: 模拟网络错误，观察 Toast + Banner

**操作**：
1. 导航到 `http://localhost:5175/settings/models`
2. 打开 DevTools (F12)，切换到 Network 面板
3. 点击 **Network throttling** 的下拉 → 选择 **Offline**
4. 点击页面右上角 **Refresh** 按钮（RefreshCw 图标）
5. **观察 UI**：是否出现错误提示

**预期 UI 状态**：

```
┌─────────────────────────────────────────┐
│ 📍 Error Toast (右上角, 消失)           │
│ ❌ Failed to fetch providers: Network... │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 🔴 Error Banner (页面上方，置顶)        │
│ Failed to fetch providers: Network error │
│                              [✕ Dismiss] │
└─────────────────────────────────────────┘

[页面内容] (灰显或禁用)
  - 模型列表加载失败
  - 刷新按钮仍可点击
```

**关键检查点** ✅：
- ✅ **Toast 出现 1 次**（不是多次重复）
- ✅ **Error Banner 出现 1 次**（不是多次重复）
- ✅ **无 "Network ErrorNetwork Error" 双重显示**（这是修复前的 bug）
- ✅ **两者内容协调一致**（都是同一个错误）

**错误表现** ❌（修复前样子）：
```
❌ Network ErrorNetwork Error
❌ Network ErrorNetwork Error  ← 重复显示！
(UI 凌乱，多个错误提示堆叠)
```

**截图建议**：
- 📷 完整页面视图，显示 Toast + Banner + 页面内容
- 🔍 放大 Toast 区域，确认无文字重复

---

### 步骤 3.2: 恢复网络后，观察错误清除

**操作**：
1. 错误仍显示（Offline 状态）
2. 点击 **Network throttling** → 选择 **Online**
3. 再次点击 Refresh 按钮
4. **观察页面更新**

**预期过程**：
```
T=0s    [Offline 状态] Error Banner + Toast 显示

T=0.5s  [切换 Online]
        Error Banner 仍显示（网络请求正在进行中）
        
T=1-2s  [请求完成，数据加载成功]
        Error Banner 消失 ✅
        Toast 消失 ✅
        模型列表正常显示 ✅
```

**截图建议**：
- 📹 GIF/视频：从 Offline → Online → 数据加载的全过程
- 📷 最后一帧：干净的 UI，无错误提示，正常显示数据

---

## 📋 快速检查清单

完成每个步骤后，勾选对应项：

### Console 日志检查
- [ ] 初始刷新显示 `✅ [Health Check] 后端在线`
- [ ] 后端离线时显示 "第 1/2/3 次失败"
- [ ] 重试间隔约 2 秒
- [ ] 后端恢复后自动显示 `✅ [Health Check] 后端在线`
- [ ] 无 "timeout of 15000ms exceeded" 错误

### Network Tab 检查
- [ ] `/health` 请求使用 `8000` 端口，状态 200
- [ ] `/providers` 请求使用 `8000` 端口，状态 200
- [ ] `/pipeline/tasks` 请求使用 `8000` 端口，状态 200
- [ ] EventSource 连接 URL 包含 `8000` 端口
- [ ] 所有请求均在 2 秒内完成（无超时）

### UI 交互检查
- [ ] 设置页面错误提示**不重复显示**
- [ ] Toast 和 Error Banner **不堆叠显示多个**
- [ ] 恢复网络后错误提示自动消失
- [ ] 首页提交任务成功（无 8010 超时错误）

---

## 🎯 常见问题排查

**Q: 为什么仍看到 8010 端口的请求？**
- A: 需要**清空浏览器缓存** (DevTools → Application → Clear site data)
- A: 确认运行的是最新代码（git pull + npm install）

**Q: 重试次数不显示，直接显示离线？**
- A: 检查 `useBackendHealth.ts` 第 25 行，确认有日志打印
- A: 查看 .env 或环境变量是否正确配置

**Q: 后端恢复后仍显示离线状态？**
- A: 健康检查达到最大重试 (3 次) 后停止，需要手动刷新页面
- A: 或等待下一次定时检查周期（通常 30-60 秒）

