# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# 多媒体内容分析系统 — AI 协作规则

> 这是项目级规则，会和 `~/.claude/CLAUDE.md` 全局规则一起生效。
> Claude Code 启动时会自动读取本文件。
> 项目根目录还有 `plan.md`（阶段计划）和 `system_design_for_claude_design_v1.md`（系统设计）。

---

## 项目背景

- **后端**：Python 3.11 + FastAPI + SQLAlchemy + SQLite
- **前端**：React 19 + TypeScript + Vite 6 + Tailwind 4
- **使用对象**：本地优先的桌面创作者工具（非 SaaS）
- **用户特征**：编程新手，需要每一步都解释清楚在做什么

---

## 当前主线与接力边界

- 当前主线是 **FastAPI 后端 + React/Vite 前端**。
- `app.py`、`pages/`、`src/vidmirror/ui/` 属于 Streamlit legacy compatibility path；除非用户明确要求维护旧入口，否则不要往这里加新产品功能。
- 新会话开始时先读 `AGENTS.md`、`docs/AI_HANDOFF.md`、`docs/OUTSTANDING_TASKS.md`，再判断任务边界。
- 本次仓库卫生之后的下一步只能进入**产品选择**：先让用户选下一条产品主线，不要直接写功能。

---

## 常用命令

### 一键启动（推荐日常用）
```bash
./start.sh
```
脚本会自动检测/安装 brew、Python 3.10+、ffmpeg、Node、pnpm，创建 `.venv`，装依赖，清端口，并行起后端 + 前端，日志写到 `.local/backend.log` 与 `.local/frontend.log`。

### 单独启动（调试时用）
```bash
# 后端（默认 8000，改端口看 .env 里的 BACKEND_PORT）
uvicorn backend.app.main:app --reload --port 8000

# 前端（默认 5173，改端口看 .env 里的 VITE_PORT）
cd frontend && pnpm dev
```

### 测试 / 检查
```bash
# 后端测试（CI 用同样命令）
pytest tests/backend -q
# 单文件 / 单用例
pytest tests/backend/test_xxx.py -q
pytest tests/backend/test_xxx.py::test_foo -q

# 前端
cd frontend && pnpm lint        # ESLint
cd frontend && pnpm test        # vitest
cd frontend && pnpm build       # tsc -b && vite build

# 启动前自检（端口、依赖、.env）
python3 scripts/preflight_check.py

# 端到端验收
python3 tests/e2e_qa.py
```

> 注：根目录暂无 `tests/backend/` 目录树（CI 跑的就是这条命令，本地若缺应先确认是否在某个 worktree/分支里）。新增后端测试时遵循「每个端点 1 个 happy path + 1 个错误路径」。

---

## 高层架构

### 后端（`backend/app/`）
- 入口 `backend/app/main.py`：模块顶层就 `load_dotenv` 根目录 `.env`（保证 router 模块导入时也能读到环境变量），挂 9 个 router：
  - `/providers`（providers.py，模型供应商配置）
  - `/pipeline`（pipeline.py，任务中心；含 SSE `…/events` 和 `…/ws`）
  - `/transcript`（transcript.py，字幕/转写）
  - `/rag`（rag.py，向量检索问答）
  - `/workspaces`（workspaces.py，工作区/项目）
  - `/admin`（admin.py）
  - `/api`（notes.py，bilinote 兼容接口）
  - 无前缀：`download_config.py`、`transcriber_config.py`
- `lifespan` 钩子在启动时把 `.env` 里的 `SILICONFLOW_API_KEY` 自动 seed 成一个 ProviderProfile（写进 `shared/settings_store`）。
- CORS 白名单通过 `_build_cors_origins()` 动态生成，优先级：`CORS_ALLOW_ORIGINS` > `VITE_PORT` 推导 > 5173 兜底。
- 任务执行：`backend/app/services/task_runner.py` 是基于 `ThreadPoolExecutor` 的后台执行器，task 记录写 `task_store`；同 project + 同 URL 的下载任务做幂等去重；状态变化通过 SSE / WebSocket 推给前端。

### 前后端共享层（`shared/`）
- 这是 **FastAPI 后端 + React 前端 + Streamlit 旧前端 + 命令行脚本共用的代码**。改 `shared/` 里的东西会同时影响多个入口，先评估影响面。
- 关键模块：`settings_store.py`（providers/global settings 持久化）、`api_key_resolver.py`（多源 API Key 优先级）、`knowledge_base.py`（RAG 索引）、`video_analyzer.py`（视频分析编排）、`video_download_ytdlp.py`（yt-dlp 封装）、`storyboard_generator.py`、`web_enrich.py`。

### 前端（`frontend/src/`）
- 路由：`router.tsx` 用 React Router v7 Data Router，**所有页面级组件都走 `React.lazy` 代码分割**（动手加新页面时记得也包一层 `withSuspense`）。
- 状态：zustand，`store/` 下有 6 个 store：`configStore` / `modelStore` / `projectStore` / `providerStore` / `settingsShellStore` / `taskStore`。
- 服务层：`services/client.ts` 封装 axios；`services/events.ts` 处理 SSE；其它对应后端各 router。
- Vite 代理：`/api` 与 `/pipeline` 都被代理到后端（看 `vite.config.ts`），所以前端代码里写相对路径就行，不用拼 base URL。
- 构建：`vite.config.ts` 用 rolldown `codeSplitting.groups` 手动拆 vendor chunk（react / radix / markmap / markdown 等），改依赖时如果引入了大包，考虑加进对应 group。
- i18n：`locales/i18n.ts` + `i18next-parser.config.js`，文案改动后跑 `i18next-parser` 抽 key。

### 运行时数据（`data/`，默认不应新增入库）
- `cookies/`（B 站 cookies）、`videos/`（下载产物）、`json_data/`（分析结果）、`projects/` 和 `workspaces/`（工作区数据）。
- 不要把这里的新文件 commit 进 git，也不要假设它在新机器上存在。已有 tracked 工作区 JSON 如需清理，应单独确认范围。

### 端口与环境变量（关键约定）
- 单一来源 `.env`，前后端都读它：`BACKEND_PORT`（默认 8000）、`VITE_PORT`（默认 5173）。
- 前端编译时通过 `VITE_BACKEND_BASE_URL` 知道后端地址（`start.sh` 启前端前会注入）。
- README、`.env.example` 和 `start.sh` 应保持同一默认端口；如本机 `.env` 覆盖端口，**以 `.env` 实际值为准**。

### 双前端并存（legacy 兼容期）
- `frontend/`（React，推荐 / 默认入口）
- `app.py` + `pages/`（Streamlit，legacy 入口，**新功能不要往这边加**）

---

## 沟通规则（最重要）

1. **用中文回复**。
2. **改代码前先解释**："我打算改哪几个文件、为什么这么改"。
3. **改完后用 1-2 句总结**：刚才做了什么、产生了什么效果。
4. **遇到术语简单说明**。第一次提到"中间件"、"依赖注入"、"hook"等概念，要附一句白话解释。
5. **用户问"这是干什么的"时直接讲**，不要假设他都懂。

---

## 计划与边界

> 📌 **唯一标准（Single Source of Truth）**：`/Users/conan/Desktop/nibi/nibi-spec-v2.md`
> 这份文件（"Nibi / VidMirror 主规范 v2，合并版"）以 v1.1 设计契约为骨架、叠加总规划 v1 路线图，是 Phase 0 → 1J 的权威仲裁层。所有 Phase 编号、决议、模型分工、验收标准都以它为准。
>
> **优先级（冲突仲裁，自上而下）**：
> 1. `nibi-spec-v2.md`（唯一标准）
> 2. `vidmirror-handoff/project/system_design_v1.1.md`（v1.1 设计契约真相源）
> 3. `vidmirror-handoff/project/VidMirror.html` + `project/styles.css` + `project/components/*`（视觉骨架）
> 4. `users-conan-claude-plans-nibi-vidmirror-modular-kurzweil.md`（总规划 v1：Phase 路线 / 模型分工 / 风险表）
> 5. `docs/OUTSTANDING_TASKS.md`、`docs/AI_HANDOFF.md`（运行时进度快照）
> 6. `plan.md` + `system_design_for_claude_design_v1.md`（**已 deprecated**，仅作历史，不维护不改）
>
> **VidMirror handoff 原型路径（重要）**：zip 已解压到 `/Users/conan/Desktop/nibi/vidmirror-handoff/`，真正的项目目录是 `vidmirror-handoff/project/`，里面有：
> - `project/VidMirror.html`（837 行主原型）
> - `project/components/`（shell / topbar / sidebar / 12 个详情组件 JSX）
> - `project/styles.css` + `project/styles-preflight.css`
> - `project/system_design_v1.1.md`（v1.1 真本，比项目根 v1 更新）
>
> 总规划与本规则里凡是写「zip 内」「zip/components/...」「zip/styles.css」「v1.1 §X」的，统一对应到 `vidmirror-handoff/project/` 下对应文件。
>
> **新会话启动必读顺序**：① `nibi-spec-v2.md` → ② `AGENTS.md` → ③ `docs/AI_HANDOFF.md` → ④ `docs/OUTSTANDING_TASKS.md`。其他文件按需读。

> ⚠️ **重要**：`plan.md` 描述的是 Phase 0 / 1A 阶段（任务系统初建），但**实际代码已远超那里**——已实现 providers、pipeline、transcript、RAG、workspaces、settings 多页面等。当前分支名（如 `feat/settings-phase2-m0`）和 `README.md` 里的「Phase-2 重构」才是真实状态。
>
> 因此：
> - **当 `plan.md` 与现实代码冲突时，以代码为准**，并告诉用户 plan.md 需要更新。
> - 不要按 plan.md 里"建任务系统骨架"那种早期任务去写新代码——很可能已经存在了。
> - 用户给的子任务编号（比如 settings-phase2-m0）是当前真实计划的来源，优先听用户的。

1. 新会话开始时**同时扫一眼 `plan.md` 和当前 git 分支名**，判断当前真实进度，再问用户这次会话的目标。
2. **一个会话只做一个明确的子任务**，做完就停。
3. 子任务完成后**主动提醒用户**：「子任务 X 完成，建议 git commit 后开新会话做下一个」。
4. **不要主动跨子任务工作**，即使你觉得"顺手就改了"——这破坏了用户的 git 颗粒度。
5. **不要主动写用户没要求的功能**。如果觉得需要，先问。

---

## Git 行为（强制）

1. **每个子任务完成后立即 commit**，不要堆积多个子任务到一个 commit。
2. **Commit 信息格式**：
   ```
   <type>(<phase>): <子任务编号> <一句话描述>
   ```
   - type 选一个：`feat` | `fix` | `refactor` | `docs` | `test` | `chore`
   - 例：`feat(phase1a): 1A.3 添加 POST /tasks 创建任务接口`
3. **修上一次 commit 的小问题用 `git commit --amend`**，不要新建一个 fixup commit。
4. **永远不在 main 分支直接改代码**。新 Phase 开始时先 `git checkout -b feature/phase-1a`。
5. **Phase 完成时只提醒打 tag，不自动打 tag**。让用户自己决定何时打。

---

## 代码风格

### 后端（Python）
- 严格遵循 PEP 8。
- 所有函数必须带类型注解（`def foo(x: int) -> str`）。
- public 函数必须带 docstring（一行也行，但要有）。
- 异常用自定义类 + 全局 exception handler，不要在路由里直接 try/except。

### 前端（TypeScript / React）
- 严格 TypeScript，**禁止使用 `any`**。
- 组件文件 PascalCase（`TaskCard.tsx`），hook 用 `useXxx`。
- 错误用 toast 提示用户，不用 `alert()`。

### 通用
- **单文件不超过 200 行**，超过就拆分。
- 不要写注释解释"代码在做什么"（让代码本身可读）。注释只用于解释"为什么这么做"。

---

## 风险与求证（重要）

下列情况**必须停下来问用户**，不要自己决定：

1. 需要安装新的依赖包（pip install / npm install 一个新东西）。
2. 修改 plan.md 里没有的子任务。
3. **实际代码与 plan.md 描述不符**（结构、字段、接口签名等）。
4. 涉及修改数据库 schema 的迁移。
5. 涉及加密、API key 存储、用户认证。
6. 跨 5 个以上文件的改动。

**求证模板**：
> 我在做 X.Y 时发现实际情况是 ABC，与 plan.md 里写的 DEF 不一致。
> 我想到两个方案：
> 1. 方案 A（修改 plan.md，按现实走）
> 2. 方案 B（保留 plan.md，把代码调整回去）
> 你想怎么处理？

---

## 模型升级触发条件

如果你（AI）感觉以下情况出现，主动建议用户升级到更强的模型：

- 跨模块影响超过 5 个文件
- 涉及数据库 schema 变更 + 老数据兼容
- 出现"我不太确定哪个方案对"的犹豫

**反过来——如果当前任务很简单（几行 CRUD、UI 微调），主动建议降级到 Haiku 省 token**。

---

## 测试要求

- 每个 API 端点必须有至少 1 个 pytest 测试：
  - happy path 测一次
  - 一个常见错误情况（404 / 422）测一次
- 前端组件不强制写单测，但**关键交互必须手动跑一遍并截图给用户**：
  - 删除/重置等不可逆操作
  - 表单校验
  - 异步状态切换（loading / 成功 / 失败）

---

## 多 Agent 协作 — 防撞规则（强制）

> 本项目同时存在 **Claude 官方**（claude.ai/code）、**Claude 小米**（小米 AI 助手内嵌）、**Codex**（OpenAI coding agent）三个 AI 执行端。
> 三者各有独立 worktree，互相看不见对方的变更，因此必须靠下面这套规则避免平行实现同一需求。

### 身份与职责

| Agent | 分支前缀 | 职责 |
|-------|---------|------|
| Claude 官方 | `claude-official/<task>` | **业务功能构建**：后端接口、前端页面、测试、文档 |
| Claude 小米 | `claude-xiaomi/<task>` | **业务功能构建**（与官方相同职责，错开任务不重叠） |
| Codex | `codex/qa-<task>` 或 `codex/review-<task>` | **只做检查**：运行测试、比较分支、审查 diff、给下一步建议。**不写新业务功能** |

### 每次会话必须先跑的启动检查

```bash
git fetch --all --prune
git status --short --branch
git worktree list
git branch -a
git log --oneline HEAD..main
```

### 四种情况必须停下来问用户

1. **同主题 worktree 存在**：`git worktree list` 里出现其他 agent 路径下的同主题分支（如 `claude/phase1d-*` 和 `codex/phase1d-*` 同时存在）。
2. **同主题远端分支存在**：`git branch -a` 出现 `remotes/origin/<other-agent>/<same-task>`。
3. **main 分支有不认识的未合并 commit**：`git log HEAD..main` 非空，且那些 commit 来自另一个 agent。
4. **工作区有不属于当前任务的未提交改动**：`git status` 显示与当前子任务无关的文件被修改。

停下来后用这个模板报告：
> 我在启动检查时发现 [描述冲突]。
> 候选方案：A（以 X 为主线，放弃 Y）/ B（以 Y 为主线，放弃 X）/ C（人工挑选合并）。
> 请你决定后我再继续。

### 分支生命周期

1. **开工时**：`git checkout -b claude-official/<task>`，随即 `git push -u origin <branch>`「占座」，让其他 agent 能看见。
2. **收工时**：commit 后通知用户 merge，**不自行 merge 到 main**。
3. **废弃时**：stash 备份，等用户决定是否保留，不直接删除。

### 不要做的事（多 agent 专项）

- ❌ 不要把另一个 agent 的 worktree 分支当作 main 来 rebase。
- ❌ 不要 apply 或 cherry-pick 另一个 agent 的 stash / commit，除非用户明确指令。
- ❌ 不要在检测到同主题 worktree 时继续实现功能——先报告，等用户决定谁是主线。
- ❌ 不要在同一会话里同时扮演多个 agent 的角色。

---

## 不要做的事

- ❌ 不要主动重构无关代码（哪怕你觉得它写得丑）。
- ❌ 不要改 `.env` 或 `.env.example` 内容（除非新增字段并明确告诉用户）。
- ❌ 不要执行危险命令：`rm -rf`、`git reset --hard`、`git push --force`、`git clean -fd`。
- ❌ 不要安装/卸载全局软件。
- ❌ 不要把 API key、密码写进代码或 commit 进 git。
- ❌ 不要在不告知用户的情况下修改 git 历史（rebase、amend 主线 commit 等）。

---

## 当用户卡住时

如果用户说"跑不起来"、"报错了"、"看不懂"等：

1. **先让他贴完整报错信息**，不要凭直觉猜。
2. **再让他描述他做了哪一步**（运行了什么命令、改了哪个文件）。
3. **再给方案**。如果是新手常见错误（比如忘了 activate venv、端口占用、CORS），用一句话点破。
4. **修复后总结**："这个错的根因是 X，下次看到 Y 现象就是这个问题"。
