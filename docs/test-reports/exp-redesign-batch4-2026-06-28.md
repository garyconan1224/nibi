# Exp Redesign Batch4 验证报告

日期：2026-06-28
分支：`feat/exp-redesign-p1`
计划：`docs/plans/exp-redesign-batch4-composer-pip-library-2026-06-28.md`

## 1. 本轮范围

本批次按计划处理 Composer / AddMaterialModal、NoteShell PiP 与工具入口、库页合集筛选、复刻结果页，以及全局顶部状态栏迁移：

- Composer 内“归入合集”改为 AddMaterialModal 内的 `② 合集归属` 区块，支持选择现有合集和弹窗内新建合集。
- `/notes` 与 `/replicas` 库页纳入空合集展示，Hero 增加“新建合集”入口，移除右侧小统计块。
- NoteShell 将 AI 入口合并到工具菜单，保留顶栏“新建总结”，移除独立 source.md 弹窗按钮，PiP 控制改为简化悬浮条。
- 应用顶部状态栏迁入左侧栏底部，主内容区不再额外占用顶部状态条高度。
- `/replicas/.../video_detail` 复刻结果页对齐 `pg-replica`：聚焦主帧、缩略图轨和右侧提示词/版本面板，移除学习笔记专属入口。

## 2. 代码改动

主要文件：

- `frontend/src/components/workspace/AddMaterialModal.tsx`
- `frontend/src/pages/WorkbenchPage/Composer.tsx`
- `frontend/src/pages/LibraryPage/index.tsx`
- `frontend/src/layouts/AppShell.tsx`
- `frontend/src/pages/result/NoteShell/index.tsx`
- `frontend/src/pages/result/VideoResultPage.tsx`
- `frontend/src/styles/nibi-components.css`
- `frontend/src/__tests__/AddMaterialModal.test.tsx`

说明：本轮未改后端、数据库、鉴权、任务 pipeline 或请求 payload contract；合集选择仍沿用现有 `workspaceIds[0]` 提交路径。

## 3. 自动验证

已通过：

- `pnpm -C frontend build`：通过
- `pnpm -C frontend test`：通过，20 个 test files / 158 个 tests
- `git diff --check`：通过

未通过：

- `pnpm -C frontend lint`：未通过

lint 说明：

- 当前仓库存在较多既有 lint debt，例如测试 store、MarkdownToc、SummariesTab、MusicBreakdown、UI primitives、PreflightConfigPanel、TaskChatPanel 等文件。
- 本轮触达文件也命中 React Compiler 规则对既有 effect/ref 模式的提示，例如 `AddMaterialModal.tsx`、`NoteShell/index.tsx`、`VideoResultPage.tsx` 的 `set-state-in-effect` / `preserve-manual-memoization` / `refs` 检查。
- 本批次未扩大范围重构这些旧模式，避免把设计对齐任务变成全仓 lint 整治。

## 4. 浏览器验证

使用本地 Vite dev server 和 Playwright 截图验证，截图产物位于：

- `frontend/test-results/exp-redesign-batch4/composer-modal-workspace.png`
- `frontend/test-results/exp-redesign-batch4/notes-library.png`
- `frontend/test-results/exp-redesign-batch4/replicas-library.png`
- `frontend/test-results/exp-redesign-batch4/replica-result.png`
- `frontend/test-results/exp-redesign-batch4/note-shell-ai-pip.png`

抽查结果：

- `composer-modal-workspace.png`：AddMaterialModal 已出现 `② 合集归属`，选择合集 popover 可见。
- `notes-library.png` / `replicas-library.png`：Hero 保留主操作并新增“新建合集”，合集筛选可进入空合集/合集集合态。
- `replica-result.png`：复刻页主帧、缩略图轨、右侧提示词/版本面板可见；学习笔记专属 mini player / 三轨区未出现在复刻布局里。
- `note-shell-ai-pip.png`：左侧栏底部状态区可见；NoteShell 顶栏保留“新建总结”；AI 工具菜单中有“问 AI”；PiP 使用简化播放/进度/截图控制。

限制：

- mock 路由中 `/static/mock-video.mp4` 返回 404，截图验证仍覆盖 PiP 容器与控制条渲染；真实素材播放不由该 mock 文件决定。
- 未做真实后端新建合集的长链路写入验收，本轮浏览器验证覆盖的是前端交互和现有 API 调用路径。

## 5. 结论

Batch4 计划内前端改造已落地，构建、单测、diff whitespace 检查均通过；核心页面已完成浏览器截图验证。当前不能给出“全仓 lint 通过”结论，原因是仓库已有 lint debt 与 React Compiler 新规则触发，需单独安排 lint 整治批次。
