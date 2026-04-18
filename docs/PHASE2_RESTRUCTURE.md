# Phase-2 Restructure (GitHub Ready)

本阶段目标是在不破坏现有功能的前提下，把仓库演进为更适合开源协作的结构。

## 已完成

- 下载页 B 站重试与错误可观测增强（含完整错误展开）
- 分析页刷新节奏优化（约 0.45s 自动刷新）
- 新增英文结构骨架：`src/video_pipeline_studio/`
- 新增 GitHub 协作模板（Issue / PR）

## 目录策略

- 运行时仍使用当前稳定模块：`shared/` 与 `pages/`
- 新结构通过适配层逐步承接：
  - `src/video_pipeline_studio/core/config.py` -> `shared.config`
  - `src/video_pipeline_studio/core/analyzer.py` -> `shared.video_analyzer`
  - `src/video_pipeline_studio/core/knowledge_base.py` -> `shared.knowledge_base`
  - `src/video_pipeline_studio/core/projects.py` -> `shared.project_context` + `shared.project_store`
  - `src/video_pipeline_studio/core/settings.py` -> `shared.settings_store`
  - `src/video_pipeline_studio/core/api_keys.py` -> `shared.api_key_resolver`

## 本地开发路径

- **默认推荐**：本机 `pip install` + 双终端（`uvicorn` 后端 + `streamlit` 前端）。
- 日常开发与 QA 均按本地运行链路执行。

## 下一步（建议）

1. 将 `pages/*.py` 逐步重构为 `ui/` 可复用函数，再生成英文页面脚本。
2. 将 `shared/` 模块迁移到 `src/video_pipeline_studio/core/` 实现体，适配层反向兼容一段时间后删除。
3. 将历史子项目目录归档到 `1/`（当前已执行，保留 `1/legacy/README.md` 作为说明）。
4. 接入 CI 的 lint/test jobs（在 QA job 基础上增加静态检查）。
