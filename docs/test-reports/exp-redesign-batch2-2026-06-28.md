# Exp Redesign Batch2 验证报告

日期：2026-06-28
分支：`feat/exp-redesign-p1`
计划：`docs/plans/exp-redesign-batch2-remaining-pages-2026-06-28.md`

## 本轮新增提交

- `2793f0a` `feat(design): 处理页对齐设计稿 pg-processing`
  - `frontend/src/pages/result/ProcessingPage/index.tsx`
  - `frontend/src/pages/result/ProcessingPage/processing.css`
  - 补 `pg-processing` 顶部栏、复制链接/查看结果入口；将等待确认、成功 chip、失败态、主体 stepper、高级详情等行内视觉样式迁入 CSS；保留任务跟随、取消、重试、结果跳转和弹窗逻辑。
- `2f19b4a` `feat(design): 复刻详情对齐设计稿 pg-replica`
  - `frontend/src/pages/result/VideoResultPage.tsx`
  - `frontend/src/pages/result/result.css`
  - 基于现有 `VideoResultPage` 复刻向路径收敛顶部栏、主帧区、缩略图轨、批量工具、右侧提示词/版本面板和 fallback；保留复制提示词、批量复制、导出复刻包、收藏、标题编辑、版本栈和格式选择逻辑。

## 已有 Batch2 提交对账

- `61338c9` LibraryPage 三态：`pg-notes` / `pg-replicas` / `pg-resources`
- `d71a6c9` 收藏 + 分镜：`pg-favorites` / `pg-storyboard`
- `a86f305` 合集详情：`pg-collection`
- §3.9 视频笔记播放器改动已在 HEAD：字幕开关、原生 PiP、整工作台全屏、16:9 播放器、顶栏药丸按钮。

## 自动验证

- `pnpm -C frontend build`：通过
- `pnpm -C frontend test`：通过，20 个 test files / 157 个 tests
- `git diff --check`：处理页与复刻详情提交前均通过

## 浏览器验证

启动：`./dev.sh`

真实服务：

- 前端：`http://127.0.0.1:5177`
- 后端：`http://127.0.0.1:8000`
- 后端健康：`/health` 返回 healthy

Playwright 打开以下路由并截图，均未捕获 console error / page error：

- `/library` → `frontend/test-results/batch2-resources-2026-06-28.png`
- `/notes` → `frontend/test-results/batch2-notes-2026-06-28.png`
- `/replicas` → `frontend/test-results/batch2-replicas-2026-06-28.png`
- `/favorites` → `frontend/test-results/batch2-favorites-2026-06-28.png`
- `/storyboard` → `frontend/test-results/batch2-storyboard-2026-06-28.png`
- `/workspaces/48c80091-48c4-409b-9a2b-4c7faadc117e` → `frontend/test-results/batch2-collection-2026-06-28.png`
- `/processing/image-ddc52192da86` → `frontend/test-results/batch2-processing-2026-06-28.png`
- `/workspaces/48c80091-48c4-409b-9a2b-4c7faadc117e/items/ec3a78d3-70ff-4d73-8ae5-b3b78da6f29d/video_detail` → `frontend/test-results/batch2-replica-detail-2026-06-28.png`
- `/workspaces/__inbox__/items/ed255215-e2e4-4c75-b577-1afe02bf41a8/note` → `frontend/test-results/batch2-video-note-2026-06-28.png`

抽查截图：

- `batch2-processing-2026-06-28.png`：顶部栏、来源信息、状态 chip、stepper、高级详情入口可见。
- `batch2-replica-detail-2026-06-28.png`：主帧、缩略图轨、三轨、右侧提示词面板、复制/字幕/复刻入口可见。
- `batch2-video-note-2026-06-28.png`：播放器、字幕开关、导出、AI 工具、转录列表和右侧笔记可见。

## 跳过 / 待确认

- `pg-knowledge`：当前无对应业务路由。按计划跳过，需用户确认是否新建独立知识库页。
- `pg-storyboard-detail`：当前 `/storyboard` 未带 `?workspace=...&item=...` 时展示选择素材提示；本轮未新增路由或伪造数据。

## 风险说明

- 未改后端、数据库、鉴权、pipeline 状态机或请求 payload contract。
- 截图产物位于 `frontend/test-results/`，按现有 gitignore 不纳入 commit。
