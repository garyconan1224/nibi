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

> 📌 **唯一标准（Single Source of Truth）**：`docs/nibi-spec-merged.md`
> 这是 2026-05-18 合并 v2 + v3 + 设计稿 + 现有代码 + 用户最新决议产出的 8 模块统一规范，是当前所有产品决议的最终仲裁。**Phase 推进、设计落地、AI 协作决策都以本文件为准**。
>
> **优先级（冲突仲裁，自上而下）**：
> 1. `docs/nibi-spec-merged.md`（**唯一标准**，产品需求级粒度）
> 2. `docs/PROJECT_EXECUTION_PLAN.md`（工程执行计划——Phase 打勾 + 当前在哪步）
> 3. `docs/design/`（**设计稿源文件**——19 个 jsx 组件 / VidMirror.html / styles.css / system_design_v1.1.md）
> 4. 当前代码（与 spec 偏差时优先反映到 spec 或新建差异 phase）
> 5. ~~`nibi-spec-v2.md`、`docs/archive/system_design_v3_final.md`、`plan.md`、`system_design_for_claude_design_v1.md`~~ ⚠️ **已 DEPRECATED**，仅历史归档，不参与仲裁
>
> **新会话启动必读顺序**：
> ① [`docs/WORKFLOW.md`](docs/WORKFLOW.md)（总流程图 + 当前阶段，**第一份要读的**）
> ② [`docs/nibi-spec-merged.md`](docs/nibi-spec-merged.md)（产品需求 8 模块）
> ③ [`docs/PROJECT_EXECUTION_PLAN.md`](docs/PROJECT_EXECUTION_PLAN.md)（找未打勾子任务）
> ④ [`AGENTS.md`](AGENTS.md)
> ⑤ [`docs/AI_HANDOFF.md`](docs/AI_HANDOFF.md)（上次会话留下的开工笔记）

> 🚀 **Phase 启动速查**（开工前对照 `nibi-spec-merged.md` 附录 C 的 N1~N11 路线 + 「模型选择策略」章）：
> - **当前阶段：[A] 现状同步**（参见 `docs/WORKFLOW.md` §4），收尾事项：重写 PROJECT_EXECUTION_PLAN / 重写 AI_HANDOFF / 归档旧 plans / push 52 commits 到 origin
> - **下一阶段：[B] N1~N11 落地差异**——按 spec 附录 C 路线，依次推进
> - **再下一阶段：[C] AI 导演**——N1~N11 完成之后才启动
> - **简单阶段**（N1 / N2 / N3 / N11 等纯前后端 CRUD）：⭐ 小米 2.5 Pro（终端，免费）/ Sonnet 4.6，不开 worktree
> - **复杂阶段**（N5 Preflight 抽屉子参数细化 / N6 任务级 LLM 对话 + RAG / N7 视频镜头分析）：Opus 4.7 + 新 worktree（`feat/phase<N>-<短名>` 分支）
> - **决策速查**：复杂/SSE/状态机/加密 → Opus；中等多文件 CRUD → Sonnet；git/测试/文档/模板 → 小米；单行 typo → Haiku / 小米

> ⚠️ **重要**：本文档与历史 `plan.md` / `nibi-spec-v2.md` 已不再一致——以本文档为准。
> - 当历史文件与现实代码冲突时，**以代码 + 合并 spec + WORKFLOW.md 为准**。
> - 旧 phase 编号（1A~3E / 4~10）已**完成或归档**，新工作走 N1~N11 路线。

1. 新会话开始时**先扫 `git status --short --branch` + `git log --oneline -5`** 确认现状，再读 `WORKFLOW.md` → `nibi-spec-merged.md` → `PROJECT_EXECUTION_PLAN.md`。
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

## 模型选择策略（四档决策树）

用户同时使用 **桌面 Claude Code**（按额度计费的 Opus / Sonnet / Haiku）和 **终端 Claude Code 接小米 2.5 Pro**（免费，可大量用）。按以下顺序判断，命中即停：

### 档 1 — Opus 4.7（桌面，付费）：复杂阶段 + 升级触发
任一命中即用：
- Phase 1D / 1F / 1G（跨后端+前端+状态机的复杂阶段）
- 跨文件改动 ≥ 5
- schema 迁移 + 老数据兼容
- 加密 / 鉴权 / API key
- SSE / WebSocket / 状态机一致性
- 三轨时间轴 / RAG 检索逻辑设计
- AI 自己说"不太确定哪个方案对"

### 档 2 — Sonnet 4.6（桌面，付费）：中等复杂多文件
- 多文件 CRUD（3–5 个文件）
- 组件级前端开发（新建 React 组件 + 接 API）
- 需要严谨业务理解但不烧脑的任务
- Phase 1B / 1C / 1E 的前端部分

### 档 3 — 小米 2.5 Pro（终端，⭐免费优先）：简单任务默认
**这一档是日常默认**。能用就用，不要因为"小米可能不够强"而升级到 Sonnet 浪费付费额度。
- git 操作（add / commit / merge / branch / push / 清理 worktree）
- 跑终端命令验证（pytest happy path、pnpm build、curl 测接口、启动 dev server）
- 文档改写（README / docs/*.md / 注释润色 / CLAUDE.md 维护）
- 模板代码（pytest happy path、CRUD 路由骨架、Pydantic schema）
- CSS token 翻译、Tailwind 配置调整
- 重复性改写（i18n key 抽取、批量 import 修改）
- 单文件简单查询 / 解释代码
- 查文档（fastapi / vite / tailwind 用法）

小米的工具能力：Bash / Read / Write / Edit / Grep / Glob 全套都能用，可独立完成 git 提交、跑测试、改文件。

**小米不擅长 → 升档 1 Opus**：跨 5+ 文件架构、复杂状态机推理、加密鉴权细节、RAG / SSE 一致性。

### 档 4 — Haiku 4.5（桌面，付费）：极简兜底
- 单行修改 / typo
- 短得不值得切到终端的任务（< 2 分钟）
- 小米终端暂时不可用时

> 当小米可用且任务在小米能力范围内时，**优先小米**而非 Haiku（小米免费 + 能力上限更高）。

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

## 工具串行交接（不再多 agent 并发）

> **协作模式**：用户**单 agent 串行**工作 —— 一次只在一个 AI 工具里做一个子任务，做完 commit + merge 进 main 之后再换另一个工具继续。**不再多个 AI 同时改同一个项目**，所以历史上的「多 agent 防撞规则」整体作废。

### 每次会话开始的启动检查（精简版）

```bash
git status --short --branch       # 必须 clean（或只有本次任务相关改动）
git log --oneline -5              # 看 main 上次留到哪
git branch --show-current         # 确认当前分支
```

**三种情况必须停下来问用户**：
1. 工作区有未提交改动，且看上去**不属于本次说好的子任务**（很可能是上次换工具时漏 commit 的工作）。
2. main 最近 commit 与你认知的"上次留下的状态"对不上（可能你正在覆盖别的工具刚做的工作）。
3. 当前分支不是预期分支（比如想做 1F 却在某个旧 worktree 分支上）。

### 分支生命周期（简化）

1. **开工**：复杂阶段（`nibi-spec-v2.md` §3 标"是"的）开 `feat/<编号>-<短名>` 或 `claude-official/<task>` 都行，由用户选；简单阶段直接打 main。
2. **收工**：commit 后通知用户 merge，**不自行 merge 到 main**（破坏性操作仍需用户授权）。
3. **完工后**：用户决定何时把旧分支删掉（参考 main 上已合并的分支即可安全 `git branch -d`）。

### 不要做的事

- ❌ 不要 cherry-pick / rebase 旧 worktree 上的 commit，除非用户明确指令（很可能是历史遗留实验，不一定有价值）。
- ❌ 不要主动 push 占座 —— 串行模式不需要。
- ❌ 不要在没看清 diff 的情况下删未合并分支（即便它"看起来是旧的"）。
- ❌ 不要因为分支名带 `claude-official/` 或 `codex/` 就推断它属于不同 agent —— 这是历史命名残留，不再有职责区分。

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
