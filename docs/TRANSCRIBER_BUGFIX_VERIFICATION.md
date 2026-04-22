# TranscriberPage 崩溃问题修复 — 验证指南

**修复提交**：`fix(frontend): 修复端口配置不一致问题`  
**修复时间**：2026-04-22 18:35 UTC  

---

## 🔍 问题回顾

### 症状
```
❌ 访问 http://localhost:5175/settings/transcriber
→ "Unexpected Application Error!"
→ 浏览器控制台：Failed to fetch dynamically imported module
→ 网络请求超时：net::ERR_CONNECTION_TIMED_OUT (8010)
```

### 根本原因
前端配置指向错误的后端端口 `8010`（实际 `8000`）+ 开发服务器端口 `5173`（应为 `5175`）

---

## ✅ 修复清单

| 文件 | 修改项 | 修改前 | 修改后 |
|------|--------|--------|--------|
| `frontend/src/services/client.ts` | 后端 API 基础 URL | `8010` | `8000` |
| `frontend/vite.config.ts` | API 代理地址 | `8010` | `8000` |
| `frontend/vite.config.ts` | 开发服务器端口 | `5173` | `5175` |

---

## 🧪 验证步骤

### 1. 确认后端运行（端口 8000）
```bash
# 后端应运行在 8000 端口
curl http://127.0.0.1:8000/health
# 预期响应：{"code": 0, "message": "ok", ...}
```

### 2. 清理 Vite 缓存
```bash
cd frontend
rm -rf .vite dist node_modules/.vite
```

### 3. 启动前端开发服务器（端口 5175）
```bash
cd frontend
pnpm dev
# 预期输出：
# ➜ Local: http://localhost:5175
# ➜ press h to show help
```

### 4. 验证 TranscriberPage 渲染
**方式 1：浏览器测试**
```
访问：http://localhost:5175/settings/transcriber
预期：
✅ 页面正常加载（无红色错误 border）
✅ 5 个引擎卡片可见（fast-whisper、bcut、kuaishou、groq、mlx-whisper）
✅ initial_prompt Textarea 字段可见
✅ 选中在线引擎时，ToS 提示警告出现
```

**方式 2：网络检查**
```
打开浏览器 DevTools → Network 标签
预期：
✅ TranscriberPage.tsx chunk 加载成功（200 状态码）
✅ /transcriber_config API 请求指向 http://localhost:5175（代理转发到 8000）
❌ 不应出现 8010 的请求
```

### 5. 功能端到端测试
```
1. 点击选择 "Groq（在线）" 引擎卡片
   预期：Alert 警告提示出现 ✅
2. 在 initial_prompt 中输入文本
   预期：脏数据指示器显示 ✅
3. 点击 SaveBar 的 Save 按钮
   预期：请求发送到 POST /transcriber_config (8000)
         响应成功，toast 显示成功提示 ✅
```

---

## 📋 环境一致性检查

| 组件 | 端口 | 检查命令 |
|------|------|---------|
| 后端 FastAPI | `8000` | `curl -s http://127.0.0.1:8000/health \| jq .` |
| 前端 Vite Dev | `5175` | 浏览器访问 `http://localhost:5175` |
| API 基础 URL | `8000` | `client.ts` L3 ✅ |
| API 代理地址 | `8000` | `vite.config.ts` L13 ✅ |

---

## 🚀 后续步骤

修复验证完成后：
1. ✅ 在浏览器中确认 `/settings/transcriber` 页面正常
2. 继续原计划的 M3 Download 或 M6 回归测试
3. 若仍有问题，检查浏览器控制台是否有其他报错

