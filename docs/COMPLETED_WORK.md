# 已完成工作记录

> **本文件作用**：变更日志风格，记录每个已完成 Phase / 子任务的**详细内容**——不只是 commit hash，包含影响范围、关键改动、为什么这么做。**便于后续修改时查阅"为什么当时这么写"**。
>
> **维护规则**：每完成一个子任务，在本文件**追加**一段（不删旧记录），格式见下方"记录模板"。
>
> Last updated: 2026-05-18 (Phase 3B 完成)

---

## 记录模板（复制后填写）

```markdown
## Phase XX – <子任务编号> <标题>

**完成日期**：YYYY-MM-DD
**模型 / 工具**：Opus 4.7 / 小米 2.5 Pro / ...
**分支**：feat/xxx
**Commit**：abc1234 / def5678 / ...

### 影响范围
- 后端 / 前端 / 文档 / 配置 / ...

### 关键改动
- 改了什么文件，做了什么
- 新增了什么接口 / 组件 / 数据结构

### 为什么这么做
- 当时面对的问题
- 考虑过的备选方案 + 为什么没选
- 隐藏假设 / 已知限制

### 留给后续的影响
- 后续修改这块时要注意什么
- 哪些依赖了它（grep 提示）
```

---

# 历史记录（倒序，最新在上）

---

## Phase 3B – 知识库 UI（跨工作空间 RAG 检索）

**完成日期**：2026-05-18
**模型 / 工具**：Opus 4.7（桌面 Claude Code）
**分支**：`feat/phase3b-knowledge-search`（待 merge 到 main）
**Commit**：`c606ba4` / `24089ed` / `adf5fb3` / `92b25a6` / `8388c71`（共 5 个）

### 影响范围
- 后端：新增 2 个 service（`workspace_knowledge.py` / `workspace_search_service.py`）+ 1 个 router（`search.py`）；扩 `workspaces.py` 加 `/search` 子路由；`main.py` 注册新 router
- 前端：新增 `services/search.ts` + `pages/SearchPage/SearchPage.tsx` + `pages/WorkspacePage/WorkspaceSearchBar.tsx`；改 `router.tsx`、`layouts/AppShell.tsx`、`pages/WorkspacePage/WorkspaceDetail.tsx`
- 测试：`tests/backend/test_workspace_knowledge.py` / `test_workspaces_search.py` / `test_global_search.py`，共 7 个新用例
- 缓存目录：`data/.local/embeddings/<workspace_id>.{faiss,meta.json}`

### 关键改动
- **数据桥（3B.1）**：把每个 `WorkspaceItem.results` 序列化为临时 JSON 文件，复用 `shared/knowledge_base.load_folder_as_knowledge(only_paths=...)` 喂给 FAISS，不改核心算法
- **缓存层（3B.1）**：以 items 内容 sha256 hash 作为缓存键；命中则反序列化 `VideoChunk` + `faiss.read_index`；不命中重建并写盘；`invalidate_workspace_index()` 用于 item 增删时主动失效
- **单空间检索（3B.2）**：`POST /workspaces/{wid}/search`，复用 `retrieve_with_sources` + `rag_qa_service` 的 LLM 调用模式
- **跨空间检索（3B.3）**：`POST /search`，`ThreadPoolExecutor(max_workers=4)` 并发各 workspace 取候选 → 合并入池 → `rerank_documents` 二次精排取 top_k（量纲统一）→ 综合回答；reranker 失败降级按原 score 排
- **前端检索页（3B.4）**：`/search` 路由 + 范围下拉（全部 / 单工作空间）+ ReactMarkdown 答案区 + 源卡片（含 score / 类型 badge / jump_url）；AppShell 侧栏 🔍 图标接到此页
- **内嵌检索条（3B.5）**：`WorkspaceDetail` 左主区顶部挂 `WorkspaceSearchBar`（窄版），结果内联可折叠
- **SearchSource 字段约定**（plan §Q4）：`workspace_id` / `workspace_name` / `item_id` / `item_type` / `item_title` / `chunk_excerpt` (≤200 字) / `score` / `jump_url`

### 为什么这么做
- **不改 `shared/knowledge_base.py` 核心**：里面 511 行算法是 Streamlit 旧入口 + RAG 旧接口共用的，改动影响面太大；现有 `only_paths` 参数已够用
- **临时 JSON 文件方案**：避免给 knowledge_base 增加「从 dict 列表加载」入口，绕开数据结构演化风险；缓存命中后不再需要这些临时文件
- **items_hash 缓存策略**：相比按 `updated_at` 失效更稳——用户手改 results 也能触发重建；空间换时间，hash 计算成本 ≪ embedding API 调用
- **rerank 跨空间合并 vs score 归一化**：reranker 二次精排比 min-max 规范化更可靠（不同空间向量分布差异大，min-max 容易失真）
- **前端不传 api_key**：后端 fallback 到 `settings.openai_api_key`，前端不沾敏感字段（plan §Q3）

### 留给后续的影响
- **缓存失效未自动接入 item CRUD**：目前 `invalidate_workspace_index` 仅暴露 API，未在 `workspaces.py` 的 add_item / remove_item / update_item 钩子里调用。下次 item 变更时 hash 自然失效会触发重建，但有一次 stale window。如果未来希望立刻生效，需要在 add/remove/update item 后调一次（注意 add_prompt_version 不影响 results 不用调）
- **embeddings 占位字段**：`LongKnowledge.embeddings` 在缓存命中时填 `np.zeros((ntotal, dim))`——目前下游只用 `index` 做 ANN 搜索 + `chunks` 文本不会读这个数组，安全；如果将来改用 `embeddings` 字段，需要持久化真实向量
- **未做并发限流**：跨空间检索一次 API 调用 = workspace 数 × embedding 调用，3+ 个空间触发 SiliconFlow 限流时需要降并发或加退避
- **i18n**：3B 全程用硬编码中文文案（与现有 AppShell / WorkspaceList 风格一致），未抽 i18n key；后续若做英文版需要补 locale
- **测试覆盖**：所有外部 API（create_embeddings / rerank_documents / LLM）都 mock；真实端到端验证需要跑 `./start.sh` + 至少 2 个含 results 的 workspace

---

## Phase 3A – 视频工作台清理 + LICENSE

**完成日期**：2026-05-17
**模型 / 工具**：小米 2.5 Pro（终端 Claude Code）
**分支**：main
**Commit**：`9bb0e42` / `0840702` / `1df97bb` / `368010b` / `a1cb6f9` / `948c115`（共 6 个）

### 影响范围
- 前端：删除整个 `frontend/src/pages/HomePage/` 目录、`frontend/src/layouts/{HomeLayout,WorkbenchShell}.tsx`、`frontend/src/__tests__/NoteForm.test.tsx`、4 个 locale JSON 里 HomePage 相关文案
- 路由：`router.tsx` 删 `/home`，默认跳转改 `/workspaces`
- 后端：`backend/app/main.py` 卸载 `notes.py` 路由（旧 BiliNote 兼容接口，前端零引用）
- UI：`AppShell.tsx` 移除侧栏"工作台"导航项 + logo 跳转改 `/workspaces` + 删未使用的 `Home` 图标 import
- 仓库根目录：新增 `LICENSE`（MIT，作者 conan，年份 2026）

### 关键改动
- 净减 3499 行代码（22 个文件删除 + 3 个文件修改）
- 路由 fallback：访问 `/home` → 404Page
- BiliNote 兼容路由（`/api/*`）整体下线

### 为什么这么做
- 项目曾有两套并存入口：旧 `/home`（BiliNote 单页作业台）和新 `/workspaces`（v1.1 设计契约的主线）
- 新主线已完全覆盖旧入口能力（视频也能进工作空间）
- 后续 Phase 3B（知识库 UI）和 3C（标签库）需要在统一数据模型上建索引，必须先清理双轨数据
- 备选方案：保留旧入口仅隐藏 nav——拒绝，因为代码长期负担

### 留给后续的影响
- **WorkbenchShell** 已删除。如果后续有页面需要类似"顶栏 Header + 主区"的 wrapper，应直接用 `AppShell` 或新建轻量 Layout
- **`/api/*` 路由**已下线。如果未来要做"外部工具调本项目能力"（Phase 9 的 API 模式），需要新设计 RESTful 路由
- **`Home` 图标 import** 已从 `AppShell.tsx` 移除。如果新增侧栏项需要 home 形状图标，从 lucide-react 重新 import
- grep 提示：`grep -rn "/home" frontend/src/` 应零命中（已验证）

---

## Phase 2D – SQLite 切换评估

**完成日期**：2026-05-17
**模型 / 工具**：小米 2.5 Pro
**分支**：main
**Commit**：`a946fa2`

### 影响范围
- 仅文档：新增 `docs/PHASE_2D_SQLITE_EVALUATION.md`（122 行）
- 无代码改动

### 关键改动
- 实测各 store 体量：task_store 3.4 MB / settings 5.9 KB / chat 1.9 KB / workspace 2.7 KB
- 基准测试：task_store 全量读取 13.6 ms，序列化 30 ms
- 逐项评估 spec v2 §54 行的 4 个 SQLite 触发条件
- 给出复审条件：task_store > 10MB / 首屏 > 300ms / 跨任务联合查询 / 多进程部署 / 事务需求

### 为什么这么做
- spec v2 §3 表里 2D 是 Phase 2 收尾的"仅评估，不一定迁移"动作
- 当前用 JSON store 工作良好（首屏 13.6ms 远低于 500ms 阈值）
- 备选：直接迁 SQLite——拒绝，过度工程

### 留给后续的影响
- Phase 5（存储/性能升级）启动条件已明确写入本评估报告 §6
- 如果未来要做多进程部署（gunicorn workers > 1），**必须**先切 SQLite（JSON store 无并发写保护）

---

## Phase 2 – 内容能力扩展（2A / 2B / 2C.1 / 2C.2 总览）

**完成日期**：2026-05-15 至 2026-05-17
**模型 / 工具**：Opus 4.7（2A / 2C.1）+ Sonnet 4.6（2B / 2C.2）

### 关键交付
- **2A**：LLM 对话侧栏（workspace-aware 流式 SSE，接 SiliconFlow chat_completion_stream）+ 收藏夹管理页（含 5 个端点 pytest）
- **2B**：音频结果页（精简版 VideoResultPage，去三轨保留 transcript + ReactMarkdown 渲染 summary）
- **2C.1**：文本输入层（pypdf / python-docx / readability-lxml 三件套，pipeline 注册 text 任务，workspaces 上传扩展 PDF/DOCX/HTML）
- **2C.2**：文本结果页 + 提示词版本栈（PromptVersionStack 组件复用到 image/video/text 三页）

### 留给后续的影响
- 4 种结果页（video/image/audio/text）的产物路径不统一（在各自的 `_materialize` 端点里），**Phase 3B.1 数据桥**需要逐种类型 grep 确认产物位置
- 提示词版本栈数据存在 `workspace.items[].prompt_versions[]` 字段——Phase 3C 标签库可能复用相同字段位置

---

## Phase X – 主干竖切（TEXT / IMAGE / VIDEO / AUDIO）

**完成日期**：2026-05 上旬
**模型 / 工具**：Opus 4.7
**分支**：feat/phasex-*

### 关键交付
- 起源：2C.2 浏览器验收时发现"demo 结果页能开，但真实分析根本没通"
- X.1 状态桥：item ↔ task 状态联动
- X.3 工作空间详情页接入任务 SSE 进度
- X.4 image pipeline handler 全链路
- X.5 video download→analyze 任务链 + 产物回写
- X.7 video_result 把 analyze json_outputs 转成 frames
- X.A AUDIO 管线全链路

### 留给后续的影响
- 工作空间 item 的状态机已稳定（pending → running → done / failed），Phase 3B 检索时应只索引 `status: done` 的 item
- 主 worktree 启动服务的"路径漂移"问题：之前后端在某个 worktree 下被启动时，`backend_tasks.json` 写到了那个 worktree 的 `.local/`——**永远从 `/Users/conan/Desktop/nibi` 主目录起服务**

---

## Phase 1 – MVP 主干（1A → 1J）

**完成日期**：2026-04 至 2026-05 上旬
**模型 / 工具**：组合（Opus / Sonnet / 小米 / Haiku 分档使用）
**Tag**：未打（用户决定 tag = 开源时刻，延后到所有功能差不多时统一打）

### 关键交付
- 1A 任务列表 API 补字段
- 1B 任务列表前端
- 1C 设置 → 模型管理（providers / models 双层）
- 1D 任务详情骨架 + 输入层（含本地文件上传）
- 1E 前置配置面板
- 1F Pipeline + SSE 进度条
- 1G 视频结果页 + 三轨时间轴（5h，最复杂阶段之一）
- 1H 图片结果页
- 1I 工作包 zip 导出
- 1J 老代码清理 + Phase 1 收口

### 留给后续的影响
- 三轨时间轴（TripleTrack）的关键帧渲染依赖 `/static` 静态文件挂载，路径来自 `_materialize` 的 `keyframe image_path`
- 工作空间 export zip 支持 4 种类型（video/image/audio/text），新增类型时需扩展 export 逻辑

---

## Phase 0 – 设计令牌 + AppShell

**完成日期**：2026-03
**模型 / 工具**：小米 2.5 Pro / Sonnet

### 关键交付
- VidMirror 设计令牌翻译成 Tailwind 4 + CSS 变量
- 全局 AppShell（侧栏 + topbar）
- 暗色模式 token 准备（但未全量调通，Phase 3E 收尾）

### 留给后续的影响
- 侧栏导航项数组在 `frontend/src/layouts/AppShell.tsx` `NAV_ITEMS`——新增页面需要在此加项
- 设计令牌的真相源仍是 `vidmirror-handoff/project/styles.css`，改色或字体应回去比对
