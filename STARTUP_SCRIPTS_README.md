# 🚀 VidMirror 启动脚本完整指南

## 📦 已创建的文件清单

| 文件 | 类型 | 说明 |
|------|------|------|
| `start_vidmirror.command` | 启动脚本 | ⭐ **推荐使用** - 标准启动脚本，双击即可启动 |
| `start_vidmirror_advanced.command` | 启动脚本 | 高级脚本，自动检测 Terminal 或 iTerm2 |
| `INSTALL_DESKTOP_SHORTCUT.sh` | 安装脚本 | 将启动脚本添加到 macOS 桌面 |
| `QUICKSTART.md` | 文档 | ⚡ 快速开始指南（5 分钟快速上手） |
| `START_GUIDE.md` | 文档 | 📚 完整使用文档（详细说明和常见问题） |
| `STARTUP_SCRIPTS_README.md` | 文档 | 本文件 - 脚本清单和使用概览 |

---

## ⚡ 极速开始（3 步）

### 1️⃣ 首次安装依赖

```bash
cd /Users/conan/Desktop/nibi
pip install -r requirements.txt
cd frontend && npm install
```

### 2️⃣ 双击启动脚本

找到并双击：`start_vidmirror.command`

### 3️⃣ 打开浏览器

访问：`http://localhost:5174`

---

## 🎯 选择适合你的启动方式

### 最简单 (推荐新手)
```
双击 → start_vidmirror.command
```
✅ 自动打开 Terminal  
✅ 自动检测环境  
✅ 自动启动前后端  

### 最灵活 (推荐高级用户)
```bash
# 终端 1 - 后端
python3.11 -m uvicorn backend.app.main:app --reload --port 8010

# 终端 2 - 前端
cd frontend && npm run dev
```
✅ 更多控制  
✅ 实时看日志  
✅ 容易调试  

### 最优雅 (推荐 iTerm2 用户)
```bash
./start_vidmirror_advanced.command
```
✅ 自动选择最佳终端  
✅ 支持 iTerm2 标签  
✅ 专业工作流  

---

## 🌍 服务访问地址

| 服务 | 地址 | 说明 |
|------|------|------|
| **前端应用** | http://localhost:5174 | React + Vite 开发服务器 |
| **后端 API** | http://localhost:8010 | FastAPI 任务中心 |
| **后端健康检查** | http://localhost:8010/health | 服务状态验证 |
| **API 文档** | http://localhost:8010/docs | Swagger 交互式文档 |

---

## 🛠️ 安装到桌面（可选）

让启动脚本出现在 macOS 桌面上，方便快速访问：

```bash
bash INSTALL_DESKTOP_SHORTCUT.sh
```

选择方式：
- **方式 1（推荐）**：复制脚本到桌面
- **方式 2**：创建符号链接
- **方式 3**：打开项目目录手动拖拽

---

## 📖 文档速查表

| 需求 | 查看文档 |
|------|---------|
| 5 分钟快速开始 | `QUICKSTART.md` |
| 详细使用说明 | `START_GUIDE.md` |
| 环境检查清单 | `START_GUIDE.md` → 首次使用前的准备 |
| 常见问题排查 | `START_GUIDE.md` → 🐛 常见问题 |
| 脚本自定义修改 | `START_GUIDE.md` → 🔧 自定义脚本 |

---

## 🔍 文件权限检查

所有脚本已自动赋予执行权限。若要手动验证：

```bash
# 检查 start_vidmirror.command
ls -l start_vidmirror.command
# 输出应包含 'x'，如：-rwxr-xr-x

# 若缺少权限，手动赋予
chmod +x start_vidmirror.command
chmod +x start_vidmirror_advanced.command
chmod +x INSTALL_DESKTOP_SHORTCUT.sh
```

---

## 🐛 快速故障排查

### 问题：双击脚本没有反应
→ 查看 `START_GUIDE.md` → Q1

### 问题：找不到 Python 3.11
→ 查看 `START_GUIDE.md` → Q2

### 问题：端口被占用
→ 查看 `START_GUIDE.md` → Q3

### 问题：npm install 失败
→ 查看 `START_GUIDE.md` → Q4

---

## 💡 专业提示

1. **同时查看日志**：启动脚本会打开两个 Terminal 窗口，左右排列便于同时观看前后端日志

2. **快速重启**：
   ```bash
   killall -9 uvicorn node
   ./start_vidmirror.command
   ```

3. **后台运行**（不推荐，容易忽略错误）：
   ```bash
   nohup python3.11 -m uvicorn backend.app.main:app --reload --port 8010 > backend.log 2>&1 &
   cd frontend && npm run dev &
   ```

4. **监视端口状态**：
   ```bash
   watch -n 1 'lsof -i :8010; lsof -i :5174'
   ```

---

## ✅ 完成清单

- [x] 创建标准启动脚本 (`start_vidmirror.command`)
- [x] 创建高级启动脚本 (`start_vidmirror_advanced.command`)
- [x] 创建桌面安装脚本 (`INSTALL_DESKTOP_SHORTCUT.sh`)
- [x] 赋予所有脚本执行权限 (`chmod +x`)
- [x] 编写快速开始指南 (`QUICKSTART.md`)
- [x] 编写完整使用文档 (`START_GUIDE.md`)
- [x] 编写脚本清单说明 (`STARTUP_SCRIPTS_README.md`)

---

## 📞 需要帮助？

1. 查看 `QUICKSTART.md` - 最快的开始方式
2. 查看 `START_GUIDE.md` - 详细的文档和常见问题
3. 查看脚本内注释 - 每个脚本都有详细的中文注释

---

**现在就开始吧！** 🎉

双击 `start_vidmirror.command` 或运行：
```bash
./start_vidmirror.command
```

