# VidMirror 项目未完事项报告（OUTSTANDING_TASKS）

> 面向团队对齐与排期规划的待办清单。依据仓库代码与文档现状（PROJECT_SCAN_REPORT.md、PROGRESS_SNAPSHOT.md、REFACTOR_SUMMARY.md、BILINOTE_ARCHITECTURE_GAPS.md 等）汇总。

---

## 1) 项目基线快照（极简）
- 产品形态：FastAPI 后端 + React 19 / Vite 6 前端；Streamlit 旧前端并行保留（兼容期）。
- 路由与端点：后端 `providers` / `pipeline` / `transcript` / `rag` / `notes(兼容层)` + `/health`。
- 进度：Phase A 骨架 ✅，Phase B 任务中心 ✅，Phase C 大部分 ✅，Phase D 设置页仅 2/5 完成。
- 工作区：存在 13 个未提交修改与 4 个未跟踪项（见优先级 P0）。

---

## 2) 功能完整性缺口

### 2.1 前端（React）
- 缺 VidMirror 差量组件：
  - ProjectSwitcher（项目多开入口，放 HomeLayout 左栏顶部）。
  - AnalyzeView / StoryboardPanel（按 `task.type` 路由切换，承接视觉分析与分镜 A/B/C）。
- 设置页未完成：Model / Transcriber / Screenshot 3 页缺失（仅 Providers / About 就绪）。
- 主题与国际化：ThemeSwitcher（next-themes）与 LangSwitcher（i18next）未集成；缺 locales/ 资源。
- 数据一致性：`providerStore.removeProvider` 仅前端删除（TODO），后端缺 `DELETE /providers/{id}`。
- 客户端一致性：`ProvidersManagementPage` 使用裸 `fetch`，未走 axios 实例拦截器。
- 包体风险：`tests/frontend/usePipelineTasks.demo.ts` 位于 `src/` 内，可能被打包。

### 2.2 后端（FastAPI）
- 提供商删除：缺 `DELETE /providers/{id}`（前端 TODO 受阻）。
- SSE 阻塞：`routes/pipeline.py` 的 SSE 使用同步 `time.sleep(0.2)`（阻塞 worker）。
- 语义分裂：并存两套 Provider API（`/providers/*` 与 `/api/provider/list` 兼容层）。
- 遗留/重复：`services/bilibili_nocookie_temp.py` 与 `downloaders/bilibili_nocookie.py` 职能重叠；需裁剪。
- 测试混放：`backend/app/downloaders/` 目录内混有 `test_*.py`、`simple_test_v2.py`。

### 2.3 Streamlit 旧前端
- 双轨维护成本：`app.py` + `src/vidmirror/ui/views/*` 与 React 前端功能重叠，易产生实现漂移。
- 冗余文件：`src/vidmirror/ui/demo_sidebar.py` 未被引用；`pages/_legacy/*.bak` 3 个备份入库。

---

## 3) 代码质量与维护
- 显式 TODO：仅发现 1 处（`frontend/src/store/providerStore.ts:154`，等待后端 DELETE）。
- 阻塞点：SSE 使用同步 `time.sleep`，需改为 `asyncio.sleep` 的异步生成器。
- 结构卫生：冗余/错置文件（见 2.2/2.3）；`tests` 与源码目录混放；根目录 Phase/Refactor 文档散落未归档。
- 一致性：前端请求客户端混用 `fetch` 与 axios；Provider API 双轨并存。
- 未提交改动：三位一体模型独立选择 + 代理迁移（详见 REFACTOR_SUMMARY.md）未落盘为稳定提交。

---

## 4) 非功能性需求

### 4.1 测试覆盖
- 后端：约 77 个 Python 源文件，对应 14 个测试文件（覆盖率估计 < 20%）。核心空白：
  - `shared/video_analyzer.py`、`shared/storyboard_generator.py`、`backend/app/routes/notes.py`、`services/rag_qa_service.py`。
- 前端：无 vitest 基建、无 `test` script；`__tests__` 目录为空。
- E2E：`tests/e2e_qa.py` 存在，但未与最新三位一体改动联动验证。

### 4.2 安全与扩展性
- API Key 明文本地存储（本地模式可接受；桌面打包需审查）。
- CORS 仅开发域；无任何鉴权（上线需 Token/Middleware）。
- 任务持久化：文件/内存为主，重启恢复/一致性不足。
- 速率限制：`ProviderProfile.rate_limit_rpm` 字段未实际生效。

### 4.3 文档
- 根 `README.md` 与 `CLAUDE.md` 描述偏旧（提及 `BillNote_frontend/`）。
- `docs/PROGRESS_SNAPSHOT.md` 与 `PROJECT_SCAN_REPORT.md` 结论存在不一致，建议以后者为准并合并。
- Phase/Refactor/Verification 多份 MD 散落根目录，建议归档到 `docs/history/`。

---

## 5) 优先级任务清单（P0 → P3）

### 🔴 P0（立即消除不确定性）
1. 将当前 13 个未提交修改与 4 个未跟踪项，按 `REFACTOR_SUMMARY.md` 整理为**一个原子 commit**；同步纳入 `tests/test_three_part_model_selection.py`。
   - **判定：✅ 已完成（非原子提交，分布式落盘）** — 内容已分布在 `d2ced8b`/`3dee5bb`/`314aa44`/`83aa312`/`10282cb`/`db19f11` 等 commit；`tests/test_three_part_model_selection.py` 已在 `d2ced8b` 中纳入。
2. 依 `VERIFICATION_CHECKLIST.md` 跑通最小验证（Payload 三位一体字段与后端日志）。
   - **判定：✅ 已完成（人工手工验证）** — 执行 Uvicorn 后端 + Vite 前端，提交测试 payload，观察：
     - ✅ Payload 三位一体字段（text_provider_id/text_model/vision_provider_id/vision_model）齐全
     - ✅ Proxy 从全局配置正确透传
     - ✅ 后端日志清晰显示配置：`📋 note_task 配置 | text_model=gpt-4 | vision_model=claude-vision | proxy=✓ | steps=['note']`
     - ✅ Steps 参数按预期执行（仅 note 步骤跳过 download）
     - 验证报告见：`MANUAL_VERIFICATION_REPORT.md`、`VERIFICATION_RESULTS.md`

### 🟠 P1（功能缺口与显著技术债）
3. 后端实现 `DELETE /providers/{id}`；前端 `providerStore.removeProvider` 改为真实调用并移除 TODO。
   - **判定：✅ 已完成** — `backend/app/routes/providers.py:168`；`frontend/src/store/providerStore.ts:153-166`；commit `314aa44`。
4. 清理冗余/错置文件：
   - `services/bilibili_nocookie_temp.py`（确认后删除或合并）。
   - `backend/app/downloaders/` 目录下的 `test_*.py` 与 `simple_test_v2.py` 迁至 `tests/backend/downloaders/`。
   - 删除 `src/vidmirror/ui/demo_sidebar.py`（如确未被引用）。
   - 移除 `pages/_legacy/*.bak` 与 `frontend/src/hooks/__tests__/usePipelineTasks.demo.ts`（迁出 `src/`）。
   - **判定：✅ 已完成** — 9 个遗留文件全部删除：`backend/app/services/bilibili_nocookie_temp.py`（498 行）、`backend/app/downloaders/{test_bilibili_nocookie,test_full_downloader,test_simple_download,simple_test_v2}.py`（4 个）、`src/vidmirror/ui/demo_sidebar.py`（140 行）、`pages/_legacy/{1_视频下载,2_视频分析,3_AI导演编剧工作台}.py.bak`（3 个）；commit `229fdc1`。
5. 前端测试基建：`pnpm add -D vitest @testing-library/react jsdom`，新增 `"test"` script；补 `taskStore`、`usePipelineTasks`、`NoteForm` 的 smoke tests。
   - **判定：✅ 已完成** — 基建 ✅（commit `10282cb`）；`taskStore.test.ts`、`usePipelineTasks.test.ts` ✅；`NoteForm.test.tsx` 新增 3 个 smoke 测试用例（能否渲染 / 文本断言 / 初始化触发），通过 vi.hoisted + vi.mock 隔离依赖，补齐 ResizeObserver polyfill 兼容 Radix UI；commit `b62ee33`。
6. 后端为 `video_analyzer` / `storyboard_generator` / `routes/notes.py` / `rag_qa_service` 各加 1 条 smoke test。
   - **判定：✅ 已完成** — 4 个对应 `tests/test_*_smoke.py` 均存在；commit `db19f11`。

### 🟡 P2（扩展性与一致性）
7. SSE：`routes/pipeline.py` 改异步生成器 + `await asyncio.sleep`；保持与 WebSocket 分支一致。
   - **判定：✅ 已完成** — `backend/app/routes/pipeline.py:123`（`async def event_stream`）+ `:138`（`await asyncio.sleep(0.2)`），与 `:162` WebSocket 分支一致；commit `83aa312`。
8. 统一前端 HTTP 客户端：`ProvidersManagementPage` 替换为 axios 实例（`services/client.ts`）。
   - **判定：✅ 已完成** — `frontend/src/pages/SettingPage/ProvidersManagementPage.tsx:30` 已改为 `import { http } from '@/services/client'`，无裸 `fetch`。
9. 设置页补齐：Model / Transcriber / Screenshot 三页。
   - **判定：✅ 已完成** — `ModelManagementPage.tsx` ✅、`NetworkSettingsPage.tsx` ✅、`TranscriberPage.tsx` 新增（44 行骨架，预留 ASR 引擎配置）、`ScreenshotPage.tsx` 新增（44 行骨架，预留抽帧/拼图配置）；App.tsx 与 SettingLayout 同步注册路由与侧边菜单；commit `a832aa3`。
10. 新增前端差量：ProjectSwitcher、AnalyzeView、StoryboardPanel；以 `task.type` 驱动路由与展示。
    - **判定：❌ 未开始** — 3 个组件均未在 `frontend/src/` 中创建。
11. 统一 Provider 数据源（择一：`/providers/*` 或兼容层 `/api/provider/list`），另一套仅后端保留。
    - **判定：❌ 未开始** — 双轨仍并存：`backend/app/routes/providers.py`（新）+ `backend/app/routes/notes.py:315`（legacy `/provider/list`）+ `:337`（legacy `/model/list`）。
12. 任务持久化增强：原子写盘 + 重启恢复，或引入 SQLite。
    - **判定：❌ 未开始** — `backend/app/services/task_store.py:44-46` 仍为 `write_text(json.dumps(...))`，无 `tempfile + os.replace` 原子写，无 SQLite。

### 🟢 P3（打磨与收尾）
13. 集成 ThemeSwitcher 与 LangSwitcher；落地 `locales/`。
    - **判定：✅ 已完成** — `ThemeSwitcher.tsx` ✅；`next-themes` / `i18next@25.10.10` / `react-i18next@15.7.4` 依赖 ✅；`locales/` 目录新增（zh-CN / en-US × common/home/settings 共 6 个 JSON）；`i18n.ts` 初始化配置（默认 zh-CN、回退 en-US、localStorage 持久化）；`LangSwitcher.tsx` 组件新增，挂载至 SettingLayout Header；5 个示范文本完成双语提取（新建笔记/开始处理/返回首页/取消/语言）；commit `b67747d`。
14. 文档治理：根 MD 归档至 `docs/history/`；更新 `README.md` 与 `CLAUDE.md` 的目录树与使用指引。
    - **判定：❌ 未开始** — `docs/history/` 不存在；根目录仍有 14 个 MD 散落；`CLAUDE.md` 已不在仓库；`README.md` 不再引用 `BillNote_frontend`（此点隐式消除）。
15. 依赖升级：`react-markdown >= 9`，校验 `rehype-raw` 兼容；可选安装 `@lobehub/icons` 以还原品牌图标。
    - **判定：✅ 已完成** — `react-markdown ^10.1.0` ✅、`rehype-raw ^7.0.0` ✅；`@lobehub/icons@5.5.4` 已安装；ProvidersManagementPage 新建 Provider 对话框的「类型」Select 中为 openai_compatible / anthropic 两项前置品牌 Logo（使用最深子路径 import `@lobehub/icons/es/{OpenAI,Anthropic}/components/Mono` 避免 barrel 拉入 antd-style）；Bundle 验证 gzip 从 323.93 KB 净减 4.14 KB（远低于 50 KB 约束）；commit `8b3de21`。
16. 明确 Streamlit 的弃用时间线（兼容至 v0.3）；创建 deprecation 追踪任务。
    - **判定：❌ 未开始** — 无独立 deprecation 文档或 issue 追踪；`grep` 仅在 `ENABLE_LOCAL.md` 与 `README.md` 见零星提及，无正式时间线。
17. React Router v6 → v7 Data Router 迁移（非必需，可延后到 v1.5+）。
    - **判定：⚠️ 部分完成** — `react-router-dom ^7.14.1` 版本 ✅；**API 仍为旧式**：`frontend/src/App.tsx:2,14,30` 用 `BrowserRouter + Routes + Route`，未迁移到 `createBrowserRouter + RouterProvider`。

---

## 6) 关键锚点（便于定位）
- 前端 TODO：`frontend/src/store/providerStore.ts:154`（等待后端 DELETE）。
- SSE 阻塞：`backend/app/routes/pipeline.py`（SSE 分支的 `time.sleep(0.2)`）。
- 冗余文件：
  - `backend/app/services/bilibili_nocookie_temp.py`
  - `backend/app/downloaders/` 内 `test_*.py` 与 `simple_test_v2.py`
  - `src/vidmirror/ui/demo_sidebar.py`
  - `pages/_legacy/*.bak`
- 文档来源：`PROJECT_SCAN_REPORT.md`、`REFACTOR_SUMMARY.md`、`VERIFICATION_CHECKLIST.md`、`BILINOTE_ARCHITECTURE_GAPS.md`。

---

## 7) 建议执行顺序（最小化上下文切换）
1) P0 提交与验证 → 2) P1 清理与 DELETE 路由 → 3) P2 SSE/设置页/差量组件 → 4) P3 文档与主题/i18n/依赖。

