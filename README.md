# Nibi / VidMirror

![v1.0.0-mvp](https://img.shields.io/badge/version-v1.0.0--mvp-blue)

> 本地优先的视频复刻分析工具：把一段视频拆成镜头 / 字幕 / 提示词，重新生成可改写的脚本与图像。

---

## 快速开始

```bash
# 1. 启动（自动检测/安装依赖）
./start.sh

# 2. 浏览器打开
open http://localhost:5173
```

启动脚本会自动：
- 检测/安装 brew、Python 3.10+、ffmpeg、Node、pnpm
- 创建 `.venv` 并安装依赖
- 并行启动 FastAPI 后端（8000）+ Vite 前端（5173）

---

## 目录结构

```
.
├── backend/            FastAPI 任务中心与 Provider/Pipeline/Transcript/RAG 路由
├── frontend/           React 19 + Vite 6 前端（唯一入口）
├── shared/             前后端共享：配置、Provider、工具（knowledge_base 等）
├── scripts/            运行前检查、清理脚本
├── tests/              后端与前端单测
├── docs/               文档；历史报告归档在 docs/history/
└── data/               projects / cookies / videos / json_data 等运行时数据
```

---

## 功能特性

- **视频下载**：支持 YouTube、Bilibili 等平台，自动提取字幕
- **智能分析**：多模态 AI 分析视频内容，生成镜头脚本
- **提示词生成**：自动提取可复用的图像生成提示词
- **工作包导出**：一键打包分析结果，便于分享与复用

---

## 开发指南

### 单独启动（调试时用）

```bash
# 后端（默认 8000，改端口看 .env 里的 BACKEND_PORT）
uvicorn backend.app.main:app --reload --port 8000

# 前端（默认 5173，改端口看 .env 里的 VITE_PORT）
cd frontend && pnpm dev
```

### 测试

```bash
# 后端测试
pytest tests/backend -q

# 前端
cd frontend && pnpm lint        # ESLint
cd frontend && pnpm test        # vitest
cd frontend && pnpm build       # tsc -b && vite build

# 启动前自检
python3 scripts/preflight_check.py

# 端到端验收
python3 tests/e2e_qa.py
```

### UI 与设计规范

本项目前端使用 **Remix 设计体系 (Bold AI-creative vibe)**。在修改 UI 或创建新页面时，请开发者及 AI 严格参考：
- **设计令牌与样式规范**：[docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md)
- **业务流程与运行时契约**：[CLAUDE.md](CLAUDE.md) 中的相关章节
- **视觉源文件与 CSS**：在 `docs/design/` 下，包含 JSX 组件原型以及 `styles.css`

### 任务日志流式接口

- `GET /pipeline/tasks/{task_id}/events`（Server-Sent Events）
- `WebSocket /pipeline/tasks/{task_id}/ws`

---

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `BACKEND_PORT` | `8000` | 后端端口 |
| `VITE_PORT` | `5173` | 前端端口 |
| `SILICONFLOW_API_KEY` | - | 硅基流动 API Key（用于模型调用） |

---

---

## 许可证

MIT
