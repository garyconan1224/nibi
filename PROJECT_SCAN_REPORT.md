# 📋 项目现状扫描报告

**扫描日期**: 2026-04-21  
**项目**: VidMirror（AI 视频创作工作台）  
**当前分支**: main（HEAD=`b3ce74f`）  
**最新 tag**: v1.4.0-store-actions（落后 3 个 commit）

---

## 【前端文件清单】

所有路径相对 `frontend/src/`。仅列出 TS/TSX，忽略空的 `.gitkeep`。

| 文件路径 | 行数 | 状态 | 一句话说明 |
|---|---|---|---|
| `main.tsx` | 13 | 已实现 | React 入口，挂载 `<App />` 并包一层 `ThemeProvider` |
| `App.tsx` | 30 | 已实现 | 路由定义：`/home` + `/settings/{providers,models,about}` |
| `App.css` | — | 已实现 | 样式文件 |
| `index.css` | — | 已实现 | 全局 CSS / Tailwind 入口 |
| `lib/utils.ts` | 7 | 已实现 | `cn()` className 合并小工具 |
| `lib/markmap.ts` | 37 | 已实现 | markmap 思维导图工具函数 |
| `constant/note.ts` | 37 | 已实现 | 笔记相关常量 |
| `types/task.ts` | 147 | 已实现 | `TaskStatus` 枚举 / `TaskRecord` 接口 / `isTaskTerminal` 等工具 |
| `services/client.ts` | 22 | 已实现 | axios 实例（BASE=`127.0.0.1:8010`），响应拦截 BiliNote 风格包装 |
| `services/pipeline.ts` | 46 | 已实现 | `createPipelineTask` / `cancelPipelineTask` |
| `services/upload.ts` | 64 | 已实现 | `uploadLocalFile`（`/api/upload`，multipart） |
| `hooks/useBackendHealth.ts` | 19 | 已实现 | 一次性 GET `/health` 检测 |
| `hooks/usePipelineTasks.ts` | 164 | **已实现（完整）** | 双轮询：全量 `/pipeline/tasks` + 对非终态任务的 per-task 精准轮询，带 AbortController |
| `hooks/__tests__/usePipelineTasks.demo.ts` | 112 | ⚠️ 有内容但位置异常 | "demo"/测试代码被放在 `src/` 内，可能被打进生产 bundle |
| `store/taskStore.ts` | 106 | **已实现（完整）** | Zustand + persist：tasks、currentTaskId、isPolling；含空响应防御与 `cancelTask` |
| `store/configStore.ts` | 71 | 已实现 | 前端配置 store（含 `resetConfig`，见 commit `6ab173d`） |
| `store/modelStore.ts` | 46 | 已实现 | 模型列表 store |
| `store/providerStore.ts` | 179 | 已实现 | Provider CRUD（addProvider/updateProvider/removeProvider，见 `118a9a3`） |
| `layouts/HomeLayout.tsx` | 177 | **已实现（完整）** | 三栏布局（ResizablePanel）：左=品牌+NoteForm，中=TaskDashboard，右=MarkdownViewer，带折叠/后端健康指示 |
| `layouts/SettingLayout.tsx` | 73 | 已实现 | 设置页二级布局 |
| `pages/Index.tsx` | 13 | 已实现 | `<Outlet />` + `<Toaster>` 根容器 |
| `pages/NotFoundPage.tsx` | 13 | 已实现 | 简单 404 页 |
| `pages/HomePage/Home.tsx` | 8 | 已实现（壳） | 只是 `return <HomeLayout />`，无其他逻辑 |
| `pages/HomePage/NoteForm.tsx` | 786 | 已实现 | 最大单文件，URL/本地上传/步骤/模型/视觉理解等表单集合 |
| `pages/HomePage/TaskDashboard.tsx` | 194 | **已实现（完整）** | 调用 `usePipelineTasks`；项目过滤、搜索、滚动位置保持、手动刷新；按 `created_at` 倒序 |
| `pages/HomePage/TaskItem.tsx` | 181 | **已实现（完整）** | 单任务卡片；进度条/状态徽标/取消按钮/展开日志（活跃任务走 SSE `TaskLogViewer`，已完成走静态 `task.log`） |
| `pages/HomePage/MarkdownViewer.tsx` | 531 | **已实现，但疑似 bug**（见末尾） | 5 个 Tab（笔记/思维导图/字幕/分析/元信息）+ 错误友好映射 + 复制/导出 MD/PDF |
| `pages/HomePage/MarkmapComponent.tsx` | 104 | 已实现 | markmap 思维导图渲染 |
| `pages/HomePage/ProcessingStepper.tsx` | 154 | 已实现 | 五阶段步骤条 |
| `pages/HomePage/TaskLogViewer.tsx` | 164 | 已实现 | SSE 实时日志订阅 |
| `pages/SettingPage/index.tsx` | 8 | 已实现（壳） | `return <SettingLayout />` |
| `pages/SettingPage/AboutPage.tsx` | 37 | 已实现 | 关于页 |
| `pages/SettingPage/ModelManagementPage.tsx` | 228 | 已实现 | 模型管理 |
| `pages/SettingPage/ProvidersManagementPage.tsx` | 482 | 已实现 | Provider 管理（CRUD+测试连接） |
| `components/ThemeSwitcher.tsx` | 68 | 已实现 | next-themes 切换器 |
| `components/ui/*.tsx` | — | 已实现 | shadcn/ui 的 19 个基础组件（button/card/dialog/tabs/... 全套） |

---

## 【后端端点清单】

所有路径相对 `backend/app/`。主入口 `main.py` 注册了 5 个 router + 1 个根 `/health`。

### main.py 注册的 router（顺序）
1. `providers_router`（`/providers`）
2. `pipeline_router`（`/pipeline`）
3. `transcript_router`（`/transcript`）
4. `rag_router`（`/rag`）
5. `notes_router`（`/api`，BiliNote 兼容层）
6. 根级 `GET /health`

### 端点总表

| 方法 + 路径 | 所在文件 | 实现状态 |
|---|---|---|
| `GET /health` | `main.py` | 已实现 |
| `GET /providers` | `routes/providers.py` | 已实现（列出全部） |
| `POST /providers` | `routes/providers.py` | 已实现（新增） |
| `GET /providers/{id}` | `routes/providers.py` | 已实现（含 api_key） |
| `PUT /providers/{id}` | `routes/providers.py` | 已实现（更新） |
| `POST /providers/test` | `routes/providers.py` | 已实现（测试连接） |
| `GET /providers/{id}/models` | `routes/providers.py` | 已实现（上游 `{base_url}/models`） |
| `GET /pipeline/tasks` | `routes/pipeline.py` | 已实现（支持 `project_id` 过滤） |
| `POST /pipeline/tasks` | `routes/pipeline.py` | 已实现（创建任务，note 类型注入 steps） |
| `GET /pipeline/tasks/{task_id}` | `routes/pipeline.py` | 已实现 |
| `DELETE /pipeline/tasks/{task_id}` | `routes/pipeline.py` | 已实现（仅终态可删） |
| `POST /pipeline/tasks/purge` | `routes/pipeline.py` | 已实现（清理 `append_log` bug 历史记录） |
| `POST /pipeline/tasks/{id}/cancel` | `routes/pipeline.py` | 已实现 |
| `POST /pipeline/tasks/{id}/retry` | `routes/pipeline.py` | 已实现 |
| `GET /pipeline/tasks/{id}/events` | `routes/pipeline.py` | 已实现（SSE，`time.sleep(0.2)` 同步流） |
| `WS /pipeline/tasks/{id}/ws` | `routes/pipeline.py` | 已实现（WebSocket 等价于 SSE） |
| `POST /transcript/extract` | `routes/transcript.py` | 已实现（subtitle / fast-whisper / groq 三路） |
| `POST /rag/ask` | `routes/rag.py` | 已实现（RAG 问答） |
| `POST /api/generate_note` | `routes/notes.py` | 已实现（BiliNote 兼容） |
| `GET /api/task_status/{task_id}` | `routes/notes.py` | 已实现 |
| `POST /api/delete_task` | `routes/notes.py` | 已实现 |
| `POST /api/upload` | `routes/notes.py` | 已实现（本地文件上传） |
| `GET /api/image_proxy` | `routes/notes.py` | 已实现（B 站防盗链代理，前端 `MarkdownViewer` 使用） |
| `GET /api/provider/list` | `routes/notes.py` | 已实现（BiliNote 风格 provider 列表） |
| `GET /api/model/list` | `routes/notes.py` | 已实现（扁平化模型列表） |

### 后端服务层

| 文件 | 行数 | 说明 |
|---|---|---|
| `services/pipeline_tasks.py` | 371 | 核心：`register_pipeline_handlers`，处理 download/analyze/note 等 task_type |
| `services/task_runner.py` | 117 | 任务调度器（create/cancel/retry） |
| `services/task_store.py` | 90 | 任务持久化 |
| `services/transcript_service.py` | 106 | 字幕/ASR 统一入口 |
| `services/asr_fast_whisper.py` | 29 | fast-whisper 封装 |
| `services/asr_groq.py` | 35 | Groq whisper 封装 |
| `services/subtitle_fetcher.py` | 44 | 字幕抓取 |
| `services/rag_qa_service.py` | 79 | RAG 问答实现 |
| `services/bilibili_nocookie_temp.py` | 498 | ⚠️ 文件名带 `_temp`，疑似遗留 |

---

## 【Streamlit 层清单】

| 文件路径 | 行数 | 状态 | 说明 |
|---|---|---|---|
| `app.py`（仓库根） | 99 | 已实现 | Streamlit 入口：侧边栏 + 按 `VIEW_KEY` 条件渲染 download/analyze/create |
| `src/vidmirror/ui/__init__.py` | 1 | 空壳 | 占位 |
| `src/vidmirror/ui/session_keys.py` | 37 | 已实现 | 所有 session_state 键常量 |
| `src/vidmirror/ui/sidebar.py` | 179 | 已实现 | logo / project 切换 / nav tabs / 历史任务面板 |
| `src/vidmirror/ui/demo_sidebar.py` | 140 | ⚠️ "demo" | 看名字是演示用，可能过时/冗余 |
| `src/vidmirror/ui/markmap_view.py` | 47 | 已实现 | Streamlit 侧的 markmap 渲染 |
| `src/vidmirror/ui/views/__init__.py` | 22 | 已实现 | 导出三个 render 函数 |
| `src/vidmirror/ui/views/download.py` | 408 | 已实现 | 下载视图 |
| `src/vidmirror/ui/views/analyze.py` | 351 | 已实现 | 分析视图 |
| `src/vidmirror/ui/views/create.py` | 491 | 已实现 | 创作视图 |
| `src/vidmirror/ui/settings/__init__.py` | 2 | 空壳 | 仅导出 |
| `src/vidmirror/ui/settings/about.py` | 28 | 已实现 | 关于 |
| `src/vidmirror/ui/settings/downloader_settings.py` | 12 | 极简壳 | 仅 12 行 |
| `src/vidmirror/ui/settings/model_settings.py` | 255 | 已实现 | 模型设置 |
| `src/vidmirror/ui/settings/text_backend_settings.py` | 34 | 已实现 | 文本后端设置 |

> Streamlit 与 React 前端**并存**：`start.sh` / `启动工作台.command` 应该在同时启动两者。

---

## 【Git 状态】

### 最新 10 条 commit
```
b3ce74f (HEAD -> main) feat(form): URL 输入框按平台显示前缀徽章（B/YT/Link）
a56947f feat(viewer): 非终态显示 ProcessingStepper + Skeleton
aab681f feat(markmap): 补齐最小高度/占位文案/destroy 清理
66e4260 (tag: v1.4.0-store-actions) feat: wip changes - settings/task/viewer updates
6ab173d feat(store): configStore 补 resetConfig action
118a9a3 feat(store): providerStore 补齐 addProvider/updateProvider/removeProvider
9b18684 (tag: v1.3.1-upload-fix) fix: 统一步骤选择逻辑，修复上传区域不显示
3ee9768 (fix/upload-visibility) fix: 删除冗余 radio 执行模式，统一步骤选择逻辑，修复上传区显示 bug
5a1502e (tag: v1.3.0-local-upload) merge: 本地文件上传区域
d6bcfbc (refactor/local-upload) feat(noteform): 勾选分析但不下载时显示本地文件上传区
```

### 未提交改动
```
?? tests/backend/test_pipeline_tasks.py     ← 未跟踪的新测试文件
```
工作区**干净**，仅有这一个未跟踪文件。

### 所有 tag（共 22 个）
```
v0.1.0-baseline-nibi        v0.6.0-pre-noteform          v1.0.0-dynamic-models
v0.1.5-phase1a              v0.7.0-phase-b-noteform      v1.1.0-note-pipeline
v0.2.0-vidmirror-phase1     v0.8.0-phase-b-complete      v1.2.0-pipeline-steps
v0.2.5-phase2               v0.9.0-phase-d-polish        v1.2.1-tests
v0.2.8-phase3               v0.9.1-phase-d-polish        v1.3.0-local-upload
v0.3.0-vidmirror            v1.3.1-upload-fix            v1.4.0-store-actions
v0.4.0-frontend-scaffold    
v0.5.0-ui-replica           
v0.5.1-phase-b-complete     
v0.5.2-phase-c-connected
```

当前 `HEAD`（`b3ce74f`）**领先最新 tag `v1.4.0-store-actions` 3 个 commit**。

---

## 【发现的问题】

### 1. ⚠️ **`MarkdownViewer.tsx:326` react-to-print API 不兼容问题**

**现象**：PDF 导出按钮可能静默失效  
**原因**：见下文 react-to-print 版本检查结果

### 2. ⚠️ **`frontend/src/hooks/__tests__/usePipelineTasks.demo.ts` 位置不当**

测试/demo 代码放在 `src/` 内，Vite 默认会扫描整个 `src/`，可能被打进生产 bundle。

**建议**：迁移至仓库根 `tests/frontend/` 或前端 `__tests__` 配合 `tsconfig.exclude`。

### 3. ⚠️ **`backend/app/downloaders/` 里有 4 个 `test_*.py` 和源代码混放**

```
bilibili_nocookie.py           ← 源代码
simple_test_v2.py              ← 看名字是测试/脚本
test_bilibili_nocookie.py      ← 测试
test_full_downloader.py        ← 测试
test_simple_download.py        ← 测试
```

pytest 可能会误收集 `simple_test_v2.py`（文件名含 `test`）。

**建议**：测试应归到顶层 `tests/` 目录。

### 4. ⚠️ **`backend/app/services/bilibili_nocookie_temp.py`（498 行）**

文件名带 `_temp` 尾缀，疑似历史遗留。已有 `downloaders/bilibili_nocookie.py`（441 行）。

**建议**：确认是否重复/可删。

### 5. ⚠️ **`src/vidmirror/ui/demo_sidebar.py`（140 行）**

`app.py` 实际引用的是 `sidebar.py`，这个 `demo_sidebar.py` 未见引用。

**建议**：确认是否废弃演示文件，可删除。

### 6. ⚠️ **`backend/app/routes/pipeline.py:123-138` SSE 用的是同步 `time.sleep(0.2)`**

在 FastAPI 异步事件循环里 `time.sleep` 会阻塞 worker 线程。高并发时会影响其他请求。

**建议**：改为异步生成器 + `asyncio.sleep`（WebSocket 路径已正确使用 `await asyncio.sleep`）。

### 7. ⚠️ **根目录有 9 个散落的 Markdown 文档**

- `PHASE_B_*.md`（阶段性交接文档）
- `REFACTOR_PLAN.md`
- `IMPLEMENTATION_DETAILS.md`
- `TEAM_HANDOFF_MEMO.md`
- `QUICK_START_*.md`
- `README_PHASE_B6_B7.md`
- `README.md`

**建议**：大部分应归档进 `docs/`。

### 8. ℹ️ **`.gitkeep` 残留**

多个目录（`constant/` / `hooks/` / `layouts/` 等）在已有真实文件后仍保留 `.gitkeep`。

**影响**：无害但冗余。

### 9. ℹ️ **前端有两套 provider 端点来源**

- `/providers/*`（原生，`routes/providers.py`）
- `/api/provider/list` + `/api/model/list`（BiliNote 兼容，`routes/notes.py`）

两套并存，前端 store 需确认究竟调用哪一套。

**风险**：易产生语义不一致。

### 10. ℹ️ **未跟踪的测试文件 `tests/backend/test_pipeline_tasks.py`**

这是尚未 `git add` 的本地新文件，可能是正在进行的开发工作。

---

## 【附录：react-to-print 版本检查结果】

（见下一章节）

