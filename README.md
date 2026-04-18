# Video Pipeline Studio

[![QA E2E](https://github.com/<OWNER>/<REPO>/actions/workflows/qa-e2e.yml/badge.svg)](https://github.com/<OWNER>/<REPO>/actions/workflows/qa-e2e.yml)
[![Lint](https://github.com/<OWNER>/<REPO>/actions/workflows/lint.yml/badge.svg)](https://github.com/<OWNER>/<REPO>/actions/workflows/lint.yml)
[![Backend Tests](https://github.com/<OWNER>/<REPO>/actions/workflows/backend-tests.yml/badge.svg)](https://github.com/<OWNER>/<REPO>/actions/workflows/backend-tests.yml)

统一的视频下载 -> 分析 -> 创作工作台（Streamlit 多页面）。

该项目原代号已移除，当前统一名称为 **Video Pipeline Studio**。

## Bilibili 下载排障（常见）

- 先升级：`pip install -U yt-dlp`
- 登录后导出 `bilibili_cookies.txt` 放到 `data/cookies/`（推荐）
- 兼容旧路径：`1/YouTubeDownloader/`
- 海外网络可在下载页填写代理；默认留空可避免本地无效代理导致失败
- 页面失败卡片支持展开「完整错误信息」用于定位 HTTP 状态码

## 本地运行（推荐）

日常开发请用 **本机 Python + 两个终端**。下载 / 分析 / 自动分镜依赖 **FastAPI 任务中心**，须先起后端再起 Streamlit：

```bash
pip install -r requirements.txt
# 终端 1：任务中心（SSE/WebSocket）
uvicorn backend.app.main:app --host 127.0.0.1 --port 8010
# 终端 2：前端
streamlit run app.py
```

可选环境变量：`VPS_BACKEND_URL` / `BACKEND_URL`（默认 `http://127.0.0.1:8010`，与后端端口一致即可）。

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

- 已引入英文结构骨架：`src/video_pipeline_studio/`
- 当前运行逻辑保持兼容，详见：`docs/PHASE2_RESTRUCTURE.md`
- 历史来源目录说明：`1/legacy/README.md`

## 徽章链接说明

当前仓库在本地环境，无法自动识别 GitHub 远程地址。将上方徽章中的 `<OWNER>/<REPO>` 替换为你的实际仓库路径后即可显示真实状态。
