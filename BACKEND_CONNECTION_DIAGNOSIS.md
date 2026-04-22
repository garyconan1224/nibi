# 后端连接超时问题诊断与解决方案

## 🔍 问题根源分析

### 错误信息
```
GET http://127.0.0.1:8010/providers net::ERR_CONNECTION_TIMED_OUT
```

### 根本原因排查清单
1. **后端服务未启动** ← 最可能原因
2. **端口 8010 被占用或未正确监听**
3. **防火墙/系统安全软件拦截**
4. **前端 BASE URL 配置错误**
5. **CORS 跨域策略阻止**

---

## 📋 标准排查流程

### 步骤 1：检查后端进程状态
```bash
# 查看 8010 端口是否有进程监听
lsof -nP -iTCP:8010 -sTCP:LISTEN

# 查看所有 uvicorn 进程
pgrep -fl "uvicorn"

# 查看所有 Python 进程
ps aux | grep -i python | grep -v grep
```

**预期输出示例：**
```
COMMAND              PID   USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
python3.11         12345  conan    3u  IPv4 0x1234567    0t0  TCP 127.0.0.1:8010 (LISTEN)
```

**未出现上述输出 → 后端未启动**

---

### 步骤 2：验证健康检查端点
```bash
# 测试后端是否响应
curl -v --max-time 5 http://127.0.0.1:8010/health
```

**成功响应：**
```json
{
  "status": "healthy",
  "version": "0.2.0",
  "uptime_sec": 45.23
}
```

**ERR_CONNECTION_TIMED_OUT → 后端未运行或端口未监听**

---

### 步骤 3：测试 /providers 端点
```bash
curl -v --max-time 5 http://127.0.0.1:8010/providers

# 预期返回 JSON 列表（即使为空也是 200）
# 例：[]
```

---

## 🚀 解决方案

### 方案 A：启动后端服务

#### 方式 1：使用启动脚本（推荐）
```bash
cd /Users/conan/Desktop/nibi
./start_vidmirror.command
```

#### 方式 2：手动启动（用于调试）
```bash
cd /Users/conan/Desktop/nibi

# 确保依赖已安装
pip install -r requirements.txt

# 启动后端（port=8010）
python3.11 -m uvicorn backend.app.main:app --reload --port 8010
```

#### 方式 3：在 PyCharm/VSCode 中启动
- 打开 IDE，定位 `backend/app/main.py`
- 右键 → Run 'main.py'
- 确保传入参数：`--port 8010`

---

### 方案 B：验证端口配置

**关键配置文件：**
- `.env`（根目录）：`BACKEND_PORT=8010`
- `frontend/.env`：`VITE_BACKEND_BASE_URL=http://127.0.0.1:8010`
- `backend/app/main.py`：硬编码端口为 8010

**前端发起的请求路径：**
```
frontend/src/services/client.ts:
  const BASE = import.meta.env.VITE_BACKEND_BASE_URL ?? 'http://127.0.0.1:8000'
  
  → 调用 GET /providers (经由 http://127.0.0.1:8010/providers)
```

---

### 方案 C：监控状态恢复条件

#### 状态从"离线"变为"在线"的技术条件：

| 条件 | 验证方式 | 依赖 |
|------|--------|------|
| 1. 后端进程存活 | `lsof -i :8010` | 成功运行 uvicorn |
| 2. 端口 8010 监听 | curl /health 返回 200 | FastAPI app 绑定成功 |
| 3. /providers 端点响应 | curl /providers | load_settings() 可执行 |
| 4. 前端发现成功 | F12 → Network 无 ERR_CONNECTION_TIMED_OUT | 连接建立 + 响应 < 15s |

#### 恢复检查清单：
- [ ] `lsof -i :8010` 有输出且显示 LISTEN
- [ ] `curl http://127.0.0.1:8010/health` 返回 JSON
- [ ] `curl http://127.0.0.1:8010/providers` 返回 JSON 数组
- [ ] 浏览器 F12 → Console：无 ERR_CONNECTION_TIMED_OUT
- [ ] 页面"系统设置"→"模型供应商"正常加载提供商列表

---

## ⚙️ 环境配置说明

### 后端启动参数解析
```python
# backend/app/main.py
python3.11 -m uvicorn backend.app.main:app --reload --port 8010
```
- `backend.app.main:app` = 模块路径:FastAPI 实例
- `--reload` = 代码变更自动重启
- `--port 8010` = 绑定端口

### CORS 配置状态
```python
# backend/app/main.py (lines 76-89)
CORSMiddleware:
  allow_origins=[
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
  ]
```
✅ 已正确配置，允许前端跨域访问

---

## 📞 常见问题

**Q: 端口 8010 被占用怎么办？**
```bash
# 找出占用进程
lsof -i :8010

# 杀死进程（谨慎操作）
kill -9 <PID>

# 改用其他端口（修改启动命令）
python3.11 -m uvicorn backend.app.main:app --port 8011
# 同时更新 frontend/.env：VITE_BACKEND_BASE_URL=http://127.0.0.1:8011
```

**Q: Python 依赖缺失？**
```bash
pip install -r requirements.txt
pip list | grep -i uvicorn fastapi
```

**Q: 防火墙拦截？**
- macOS：系统偏好设置 → 安全与隐私 → 防火墙选项
- 添加 `python` 到白名单

---

## 📊 快速诊断脚本

```bash
#!/bin/bash
echo "【1】检查进程..."
pgrep -fl "uvicorn" || echo "❌ uvicorn 未运行"

echo -e "\n【2】检查端口..."
lsof -nP -iTCP:8010 -sTCP:LISTEN || echo "❌ 端口 8010 无监听"

echo -e "\n【3】测试健康检查..."
curl -s http://127.0.0.1:8010/health | jq . || echo "❌ /health 无响应"

echo -e "\n【4】测试 /providers 端点..."
curl -s http://127.0.0.1:8010/providers | jq . || echo "❌ /providers 无响应"
```

---

**最后更新：** 2026-04-22  
**文档版本：** v1.0

