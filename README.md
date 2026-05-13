# VidMirror — AI 视频创作工作台

[![QA E2E](https://github.com/garyconan1224/vidmirror/actions/workflows/qa-e2e.yml/badge.svg)](https://github.com/garyconan1224/vidmirror/actions/workflows/qa-e2e.yml)
[![Lint](https://github.com/garyconan1224/vidmirror/actions/workflows/lint.yml/badge.svg)](https://github.com/garyconan1224/vidmirror/actions/workflows/lint.yml)
[![Backend Tests](https://github.com/garyconan1224/vidmirror/actions/workflows/backend-tests.yml/badge.svg)](https://github.com/garyconan1224/vidmirror/actions/workflows/backend-tests.yml)

> ⚠️ **Deprecation Notice**：Streamlit 旧前端（`app.py` / `pages/`）计划于 **v0.4** 移除，v0.3 为最后一个兼容版本。新部署请直接使用 `frontend/` 下的 React 前端。详见 [`docs/DEPRECATION.md`](./docs/DEPRECATION.md)。

统一的视频下载 → 分析 → 创作工作台。React 19 / Vite 6 为默认前端；Streamlit 旧前端在兼容期内并行保留（见 [docs/history/](./docs/history/) 以及下方「Streamlit 弃用计划」）。

**VidMirror** 是一个一体化的 AI 视频创作平台，集成了视频下载、智能分析、多模态理解与自动化脚本生成。

## 目录结构（顶层）

```
.
├── backend/            FastAPI 任务中心与 Provider/Pipeline/Transcript/RAG 路由
├── frontend/           React 19 + Vite 6 前端（推荐使用入口）
├── shared/             前后端共享：配置、Provider、工具（knowledge_base 等）
├── src/vidmirror/      Phase-2 英文骨架（core / ui / utils）
├── pages/              Streamlit 多页面入口（兼容期）
├── app.py              Streamlit 入口（兼容期）
├── scripts/            运行前检查、清理脚本
├── tests/              后端与前端单测（backend/ frontend/ ui/ 等）
├── docs/               文档；历史报告归档在 docs/history/
└── data/               projects / cookies / videos / json_data 等运行时数据
```

## Bilibili 下载排障（常见）

- 先升级：`pip install -U yt-dlp`
- 登录后导出 `bilibili_cookies.txt` 放到 `data/cookies/`（推荐）
- 兼容旧路径：`1/YouTubeDownloader/`
- 海外网络可在下载页填写代理；默认留空可避免本地无效代理导致失败
- 页面失败卡片支持展开「完整错误信息」用于定位 HTTP 状态码

## 本地运行（推荐）

日常开发请用 **本机 Python + 两个/三个终端**。下载 / 分析 / 自动分镜依赖 **FastAPI 任务中心**，须先起后端再起前端：

```bash
pip install -r requirements.txt
# 终端 1：任务中心（SSE/WebSocket）
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000

# 终端 2：React 前端（默认入口）
cd frontend && pnpm install && pnpm dev

# 终端 3（可选，兼容期）：Streamlit 旧前端
streamlit run app.py
```

可选环境变量：`VIDMIRROR_BACKEND_URL` / `BACKEND_URL`（默认 `http://127.0.0.1:8000`，与后端端口一致即可）。自 v0.3 起仅支持 `VIDMIRROR_BACKEND_URL`。

任务日志流式接口（便于调试或外部脚本订阅）：

- `GET /pipeline/tasks/{task_id}/events`（Server-Sent Events）
- `WebSocket /pipeline/tasks/{task_id}/ws`

## 启动前检查

```bash
python3 scripts/preflight_check.py
```

## QA 验收

- 验收脚本：`tests/e2e_qa.py`
- 使用说明：`tests/README_QA.md`
- CI 工作流：`.github/workflows/qa-e2e.yml`

```bash
python3 tests/e2e_qa.py
```

## Phase-2 重构状态

- 已引入英文结构骨架：`src/vidmirror/`
- 当前运行逻辑保持兼容，详见：`docs/PHASE2_RESTRUCTURE.md`
- 历史来源目录说明：`1/legacy/README.md`

## 历史报告与迁移记录

Phase-B / 重构 / 校验类文档已归档至 [`docs/history/`](./docs/history/)，包含：

- `PHASE_B_*.md`（任务中心分阶段落地计划与验收）
- `REFACTOR_PLAN.md` / `REFACTOR_SUMMARY.md`（三位一体模型独立选择重构）
- `VERIFICATION_CHECKLIST.md` / `*_POLLING_VERIFICATION.md`（人工验收清单）
- `PROJECT_SCAN_REPORT.md`（早期全仓扫描，结论见 `docs/OUTSTANDING_TASKS.md`）

当前仍在推进的待办清单见 [`docs/OUTSTANDING_TASKS.md`](./docs/OUTSTANDING_TASKS.md)。

## 徽章链接说明

上方徽章指向当前私有仓库 `garyconan1224/vidmirror`，推送后即可显示对应 GitHub Actions 状态。
