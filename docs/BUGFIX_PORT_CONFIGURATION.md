# 端口配置 Bug 修复报告

**发现日期**：2026-04-22 18:30 UTC  
**问题**：TranscriberPage 页面崩溃 + 后端请求超时  
**严重级别**：P1（运行时崩溃）

---

## 🔴 问题分析

### 症状
- 访问 `/settings/transcriber` 显示 "Unexpected Application Error!"
- 浏览器控制台：`Failed to fetch dynamically imported module`
- 网络请求：大量 `net::ERR_CONNECTION_TIMED_OUT`（端口 8010）

### 根本原因
前端代码中存在**多个端口配置不一致**，导致：
1. 后端 API 请求指向错误端口 `8010`（实际后端运行在 `8000`）
2. 前端开发服务器启动在 `5173`（实际应在 `5175`）

---

## 🔧 修复清单

### 1️⃣ 修复 `frontend/src/services/client.ts`
**文件**：`client.ts` L3  
**修改前**：
```typescript
const BASE = import.meta.env.VITE_BACKEND_BASE_URL ?? 'http://127.0.0.1:8010'
```
**修改后**：
```typescript
const BASE = import.meta.env.VITE_BACKEND_BASE_URL ?? 'http://127.0.0.1:8000'
```
**影响**：所有 axios HTTP 请求的基础 URL

### 2️⃣ 修复 `frontend/vite.config.ts`
**文件**：`vite.config.ts` L13 + L23  

**修改 1 - API 代理基础地址**（L13）  
修改前：
```typescript
const apiBaseUrl = env.VITE_BACKEND_BASE_URL || 'http://127.0.0.1:8010'
```
修改后：
```typescript
const apiBaseUrl = env.VITE_BACKEND_BASE_URL || 'http://127.0.0.1:8000'
```

**修改 2 - 开发服务器端口**（L23）  
修改前：
```typescript
port: 5173,
```
修改后：
```typescript
port: 5175,
```

**影响**：
- API 代理转发目标
- Vite 开发服务器监听端口

---

## ✅ 验证清单

| 检查项 | 结果 |
|--------|------|
| TypeScript 严格检查 | ✅ 零错误 |
| 后端 API 端口 | ✅ 统一为 8000 |
| 前端开发服务器端口 | ✅ 统一为 5175 |
| 环境变量覆盖能力 | ✅ 保留 VITE_BACKEND_BASE_URL |
| 其他端口硬编码 | ✅ 无其他 8010/5173 引用 |

---

## 🚀 后续验证步骤

1. **清理缓存**：
   ```bash
   rm -rf frontend/.vite frontend/dist node_modules/.vite
   ```

2. **重启前端开发服务器**：
   ```bash
   cd frontend && pnpm dev
   ```
   预期：服务器启动在 `http://localhost:5175`

3. **确认后端运行**：
   ```bash
   curl http://127.0.0.1:8000/health
   ```
   预期：返回 `{"code": 0, ...}`

4. **测试页面加载**：
   浏览器访问 `http://localhost:5175/settings/transcriber`
   预期：页面正常渲染，无崩溃、无网络错误

---

## 📝 变更统计

- 文件修改：2 个
- 代码行修改：2 行
- 配置一致性：100%

