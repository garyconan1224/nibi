# 资源索引（哪里找什么）

> 来源：原 `docs/ROADMAP.md` §1（拆分于 2026-05-26）。

---

## 1. 用户需求源（流程图文本镜像 + 源图）

| 优先读 | 源图 | 内容 |
|---|---|---|
| `docs/flows/overview.md` | `docs/conversation-inputs/2026-05-18-spec-merge/流程全.png` | 总流程图（输入 -> 分析 -> 结果 -> 复刻）|
| `docs/flows/video.md` | `docs/conversation-inputs/2026-05-18-spec-merge/视频.png` | 视频分支（3 总结路径 + 字幕清洗 + 视频类型模板）|
| `docs/flows/audio.md` | `docs/conversation-inputs/2026-05-18-spec-merge/音频.png` | 音频分支（6 任务勾选 + 人声/音乐双路）|
| `docs/flows/image.md` | `docs/conversation-inputs/2026-05-18-spec-merge/图片.png` | 图片分支（基本信息 + 任务勾选）|
| `docs/flows/text.md` | `docs/conversation-inputs/2026-05-18-spec-merge/文字.png` | 文字分支（3 种输入 + 4 并行任务）|
| `docs/flows/remix.md` | `docs/conversation-inputs/2026-05-18-spec-merge/场景复刻.png` | 复刻路径（[C] AI 导演方向）|

**AI 阅读建议**：每次开始一个 track 前，先读 `docs/flows/*.md` 对应文本镜像，再 cross-check 代码。只有文本镜像缺失、hash 过期、需求冲突，或必须判断视觉布局/颜色/层级时，才读取对应 PNG；读取前先裁剪到相关区域。

---

## 2. 设计稿源（视觉真相）

| 路径 | 内容 |
|---|---|
| `docs/design/components/*.jsx` | 19 个屏 JSX（workbench/taskboard/processing/video_detail 等）|
| `docs/design/styles.css` | 通用样式 + s05 总览页样式 + storyboard 样式 |
| `docs/design/VidMirror.html` | Taskboard 部分 CSS 在此 |
| `docs/design/system_design_v1.1.md` | 设计契约（颜色语义 / 字体规范）|

---

## 3. 现有代码索引

| 模块 | 后端位置 | 前端位置 |
|---|---|---|
| 视频分析 | `backend/app/services/pipeline_tasks.py::handle_analyze_task` + `shared/video_analyzer.py` | `frontend/src/pages/result/VideoResultPage.tsx` |
| 音频分析 | `pipeline_tasks.py::handle_audio_task` + `shared/audio_*.py` | `AudioResultPage.tsx` |
| 图片分析 | `pipeline_tasks.py::handle_image_task` + `shared/image_*.py` | `ImageResultPage.tsx` |
| 文字分析 | `pipeline_tasks.py::handle_text_task` + `shared/text_*.py` | `TextResultPage.tsx` |
| 分镜（复刻）| `shared/storyboard_generator.py` | `StoryboardPage/index.tsx` |
| 工作空间 | `backend/app/routes/workspaces.py`（25 endpoints）| `services/workspaces.ts` + `WorkspacePage/TaskboardPage/` |
| Pipeline 任务 | `backend/app/routes/pipeline.py` + `task_runner.py` | `store/taskStore.ts` + `hooks/usePipelineTasks.ts` |
| 设计 tokens | — | `frontend/src/styles/design-tokens.css` + `docs/DESIGN_SYSTEM.md` |

---

## 4. 短期 phase 文档（细化时去那里）

`docs/plans/phase-XXX.md`——每个具体子任务的步骤、改动文件、验收。进入某 phase 时由 AI 展开。

---

## 5. 历史归档（不参与决策）

- `docs/archive/` 旧 spec / plan，仅作历史参考
- `docs/COMPLETED_WORK.md` 已完成阶段记录
