# VidMirror 一键启动指南 🚀

## 快速开始

### 方式 1：双击启动（推荐）

1. 打开 **Finder**，导航到项目目录：`/Users/conan/Desktop/nibi`
2. 找到 `start_vidmirror.command` 文件
3. **双击**文件即可自动启动前后端服务
4. Terminal 窗口会自动打开，显示实时日志

### 方式 2：终端启动

```bash
cd /Users/conan/Desktop/nibi
./start_vidmirror.command
```

---

## 📍 服务地址

启动后，访问以下地址：

| 服务 | 地址 | 说明 |
|------|------|------|
| 前端 | http://localhost:5174 | React + Vite 开发服务器 |
| 后端 | http://localhost:8010 | FastAPI 任务中心 |
| 健康检查 | http://localhost:8010/health | 后端健康状态 |

---

## ⚙️ 首次使用前的准备

确保已完成以下步骤：

### 1. 安装 Python 依赖

```bash
cd /Users/conan/Desktop/nibi
pip install -r requirements.txt
```

或使用特定 Python 版本：

```bash
python3.11 -m pip install -r requirements.txt
```

### 2. 安装前端依赖

```bash
cd /Users/conan/Desktop/nibi/frontend
npm install
# 或使用 pnpm（如果已安装）
pnpm install
```

### 3. 检查环境

脚本会自动检查以下要求：
- ✅ Python 3.11 或 Python 3
- ✅ Node.js 与 npm
- ✅ 项目目录结构
- ✅ 端口可用性

---

## 🛑 停止服务

### 方式 1：在 Terminal 窗口按 Ctrl+C

在对应的 Terminal 窗口中按 `Ctrl+C` 停止对应服务（后端或前端）

### 方式 2：同时停止所有服务

```bash
killall -9 uvicorn
killall -9 node
```

### 方式 3：使用 Activity Monitor

1. 打开 **Activity Monitor**（应用 → 实用工具）
2. 搜索 `python` 或 `node`
3. 选中进程，点击左上角 `✕` 按钮强制退出

---

## 🐛 常见问题

### Q1: 双击文件没有反应

**解决方案：**
- 检查文件权限：`ls -l start_vidmirror.command`
- 若显示无 `x` 权限，运行：`chmod +x start_vidmirror.command`

### Q2: "未找到 Python 3.11"

**解决方案：**
- 脚本会自动回退到 `python3`
- 若都未找到，需要安装：
  ```bash
  brew install python@3.11
  ```

### Q3: 端口 8010 或 5174 已被占用

**解决方案：**
- 脚本会警告但继续启动（如果旧进程仍在运行）
- 关闭冲突进程：
  ```bash
  lsof -i :8010  # 查看占用 8010 的进程
  lsof -i :5174  # 查看占用 5174 的进程
  ```

### Q4: npm install 失败

**解决方案：**
- 清理缓存：`npm cache clean --force`
- 重新安装：`cd frontend && npm install`
- 检查网络连接

---

## 📚 其他启动方式

### 手动启动（终端分离方式）

如需更细粒度的控制，可在三个独立终端中运行：

**终端 1：后端**
```bash
cd /Users/conan/Desktop/nibi
python3.11 -m uvicorn backend.app.main:app --reload --port 8010
```

**终端 2：前端**
```bash
cd /Users/conan/Desktop/nibi/frontend
npm run dev
```

**终端 3（可选）：Streamlit 旧前端**
```bash
cd /Users/conan/Desktop/nibi
streamlit run app.py
```

---

## 📋 脚本功能说明

`start_vidmirror.command` 自动执行以下操作：

1. ✅ 验证项目目录结构
2. ✅ 检查 Python 和 Node.js 环境
3. ✅ 检查必要端口可用性
4. ✅ 在独立 Terminal 窗口启动后端（uvicorn）
5. ✅ 延迟后启动前端（npm dev）
6. ✅ 显示服务地址和操作提示

---

## 🔧 自定义脚本

需要修改端口、Python 版本等，可编辑 `start_vidmirror.command`：

- **第 109 行**：修改后端端口（默认 8010）
- **第 115 行**：修改前端启动命令
- **第 112 行**：调整启动延迟时间

编辑后重新保存，双击启动。

---

## 💡 提示

- 脚本使用 `osascript` 和 macOS Terminal.app，确保兼容性最佳
- 推荐在项目根目录运行，以便路径自动解析正确
- 所有日志输出在 Terminal 窗口中实时显示，便于调试

---

**祝你使用愉快！** 🎉

