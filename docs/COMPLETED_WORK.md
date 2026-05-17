# 已完成工作记录

> **本文件作用**：变更日志风格，记录每个已完成 Phase / 子任务的**详细内容**——不只是 commit hash，包含影响范围、关键改动、为什么这么做。**便于后续修改时查阅"为什么当时这么写"**。
>
> **维护规则**：每完成一个子任务，在本文件**追加**一段（不删旧记录），格式见下方"记录模板"。
>
> Last updated: 2026-05-18

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
