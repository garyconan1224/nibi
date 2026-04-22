# 🚀 后端连接超时 - 快速修复指南

## 症状
- 浏览器 F12 控制台报错：`GET http://127.0.0.1:8010/providers net::ERR_CONNECTION_TIMED_OUT`
- 页面加载缓慢或卡顿
- 监控面板显示"离线"

---

## ⚡ 30 秒快速修复

### 1️⃣ 打开终端
```bash
cd /Users/conan/Desktop/nibi
```

### 2️⃣ 启动后端（选一种）

**方式 A：一键启动脚本（推荐）**
```bash
./start_vidmirror.command
```
✅ 自动启动后端（8010）和前端（5174）

**方式 B：手动启动后端**
```bash
python3.11 -m uvicorn backend.app.main:app --reload --port 8010
```
等待输出：
```
INFO:     Uvicorn running on http://127.0.0.1:8010
INFO:     Application startup complete
```

### 3️⃣ 验证连接
新开终端，运行：
```bash
curl http://127.0.0.1:8010/health
```

预期返回：
```json
{"status":"healthy","version":"0.2.0","uptime_sec":2.34}
```

### 4️⃣ 刷新浏览器
- 打开 http://localhost:5174
- 按 `Ctrl+Shift+R`（硬刷新）或 `Cmd+Shift+R`（macOS）
- F12 → Console，不应再有 `ERR_CONNECTION_TIMED_OUT`

---

## 🔧 问题排查

### 症状 A：后端启动失败
```
ModuleNotFoundError: No module named 'uvicorn'
```

**解决：**
```bash
pip install -r requirements.txt
python3.11 -m uvicorn backend.app.main:app --port 8010
```

### 症状 B：端口 8010 被占用
```
OSError: [Errno 48] Address already in use
```

**解决：**
```bash
# 方式 1：杀死占用进程
lsof -i :8010  # 找出 PID
kill -9 <PID>

# 方式 2：改用其他端口
python3.11 -m uvicorn backend.app.main:app --port 8011

# 然后修改前端配置：
# frontend/.env: VITE_BACKEND_BASE_URL=http://127.0.0.1:8011
```

### 症状 C：仍然超时
```bash
# 检查进程是否真的在运行
ps aux | grep uvicorn | grep -v grep

# 检查端口监听
lsof -nP -iTCP:8010 -sTCP:LISTEN

# 测试网络连接
telnet 127.0.0.1 8010

# 查看后端日志是否有错误
# 如在 IDE 中运行，检查 IDE 的控制台输出
```

---

## 📊 技术详情

### 架构
```
Browser (Port 5174)
    ↓ (http://127.0.0.1:8010/providers)
Frontend Dev Server
    ↓ (跨域请求)
FastAPI Backend (Port 8010)
    ├─ GET /health           → 健康检查
    ├─ GET /providers        → 列表提供商
    ├─ POST /providers       → 新增提供商
    └─ GET /providers/{id}   → 提供商详情
```

### 关键配置
| 文件 | 配置项 | 值 |
|-----|--------|-----|
| `backend/app/main.py` | 监听端口 | 8010 |
| `frontend/.env` | VITE_BACKEND_BASE_URL | http://127.0.0.1:8010 |
| `backend/app/main.py` | CORS allow_origins | localhost:5173/5174 |

### 依赖检查
```bash
pip list | grep -E "fastapi|uvicorn|httpx"
# 应输出：
# fastapi             0.109.0 (或更高)
# uvicorn             0.27.0 (或更高)  
# httpx               0.25.0 (或更高)
```

---

## ✅ 验收清单

启动后端后，逐项验证：

- [ ] 端口 8010 有进程监听
  ```bash
  lsof -i :8010
  ```

- [ ] 健康检查返回 JSON
  ```bash
  curl http://127.0.0.1:8010/health
  ```

- [ ] /providers 端点可访问
  ```bash
  curl http://127.0.0.1:8010/providers
  ```

- [ ] 浏览器 F12 无 ERR_CONNECTION_TIMED_OUT

- [ ] "系统设置"→"模型供应商"页面正常加载

---

## 📞 仍需帮助？

1. **查看后端日志**
   - 在启动后端的终端查看 uvicorn 输出
   - 寻找 `ERROR` 或 `CRITICAL` 行

2. **检查防火墙**
   - macOS: 系统偏好设置 → 安全与隐私 → 防火墙
   - 将 Python 添加到允许列表

3. **重启环境**
   ```bash
   # 杀死所有相关进程
   killall -9 uvicorn node python3.11
   
   # 重新启动
   ./start_vidmirror.command
   ```

---

**最后更新：** 2026-04-22

