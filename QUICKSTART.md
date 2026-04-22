# VidMirror 快速启动 ⚡

## 一键启动（推荐）

### 步骤 1：安装依赖（仅首次）

```bash
# 后端依赖
pip install -r requirements.txt

# 前端依赖
cd frontend && npm install
```

### 步骤 2：启动服务

**选项 A：双击启动（最简单）**
- 打开 Finder，找到 `start_vidmirror.command`
- 双击文件，自动打开 Terminal 窗口并启动所有服务

**选项 B：终端启动**
```bash
./start_vidmirror.command
```

**选项 C：手动启动（更多控制）**

终端 1（后端）：
```bash
python3.11 -m uvicorn backend.app.main:app --reload --port 8010
```

终端 2（前端）：
```bash
cd frontend && npm run dev
```

---

## 📍 访问地址

| 应用 | 地址 |
|------|------|
| 前端 | http://localhost:5174 |
| 后端 | http://localhost:8010 |

---

## 🛑 停止服务

- **单个服务**：在对应终端按 `Ctrl+C`
- **所有服务**：
  ```bash
  killall -9 uvicorn node
  ```

---

## 🌟 功能说明

| 脚本 | 说明 |
|------|------|
| `start_vidmirror.command` | 标准启动脚本，使用 Terminal.app |
| `start_vidmirror_advanced.command` | 高级脚本，自动检测 Terminal 或 iTerm2 |
| `INSTALL_DESKTOP_SHORTCUT.sh` | 可选：将启动脚本添加到桌面 |

---

## 📚 详细文档

完整使用说明请查看：**`START_GUIDE.md`**

问题排查：**`START_GUIDE.md` → 🐛 常见问题**

---

## 💡 快速命令参考

```bash
# 查看后端日志
tail -f backend.log

# 查看占用的端口
lsof -i :8010
lsof -i :5174

# 杀死特定进程
pkill -f "uvicorn"
pkill -f "npm run dev"

# 清理缓存
npm cache clean --force
```

---

**祝你开发愉快！** 🎉

