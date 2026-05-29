# CLAUDE.md

> 本文件是 AI 协作的**入口铁律**。详细规则已拆到 [`docs/rules/`](docs/rules/README.md)，AI 用到时按需 `rg` / 片段读取。
> 与全局 `~/.claude/CLAUDE.md` 一起生效。

---

## 1. 项目背景

- **后端**：Python 3.11 + FastAPI + SQLAlchemy + SQLite
- **前端**：React 19 + TypeScript + Vite 6 + Tailwind 4
- **使用对象**：本地优先的桌面创作者工具（非 SaaS）
- **用户特征**：编程新手，**需要每一步都解释清楚在做什么**

**当前主线**：FastAPI 后端 + React/Vite 前端。Streamlit 旧入口已于 Phase 1J 移除，当前纯 FastAPI 后端 + React/Vite 前端。
**当前阶段**：F1（IP.9 流程缺口补齐）。H1~H5 + IP.1~IP.8 已合 main。具体 track 看 `docs/ROADMAP.md`。

---

## 2. 沟通规则（最重要）

1. **用中文回复**。
2. **改代码前先解释**："我打算改哪几个文件、为什么这么改"。
3. **改完后用 1-2 句总结**：刚才做了什么、产生了什么效果。
4. **遇到术语简单说明**。第一次提到"中间件"、"依赖注入"、"hook" 等，附一句白话解释。
5. **用户问"这是干什么的"时直接讲**，不要假设他都懂。

---

## 3. 启动必读顺序（每次新会话第一件事）

```bash
cd /Users/conan/Desktop/nibi
git status --short --branch
git log --oneline -20            # 对账铁律：phase 文档不是事实来源，git log 才是
```

按号码读，**不要整文件 Read 大文件**（细则见 [`docs/rules/context-budget.md`](docs/rules/context-budget.md)）：

1. `CLAUDE.md`（本文件）
2. `~/.claude/projects/-Users-conan-Desktop-nibi/memory/MEMORY.md`（深度记忆索引 + 用户反馈历史）
3. `docs/WORKFLOW.md`（主工作流总图）
4. `docs/SPEC.md`（产品需求入口索引；细节按模块读 `docs/spec/*.md`）
5. **`docs/ROADMAP.md`（长期升级路线图——§2 6-track 全景表 + §11 推荐顺序是"下一步做什么"的决策依据）**
6. `docs/AI_HANDOFF.md`（上次会话留下的开工笔记）
7. `docs/EXECUTION_PLAN.md`（短期 phase 进度对照——配合 git log 对账用）
8. `docs/OUTSTANDING_TASKS.md`（散落 TODO 速查）
9. `AGENTS.md`（如适用，给其他 AI 工具的协议）

> ⚠️ **不要只看 AI_HANDOFF.md 拍脑袋给"下一步建议"**——它是局部视角。任何"做什么 / 选哪个路线"的判断必须先打开 ROADMAP.md §2 + §11。

### 启动强制对账（铁律，违反过一次就出过事故）

读完启动必读后，**必须立刻跑 `git log --oneline -20`**，把 `AI_HANDOFF.md` / `OUTSTANDING_TASKS.md` 里写的「下一步 Phase X」与 git 实际合并状态对照一次：

- 若 git 显示某 phase 已有 commit 合入 main，而文档仍把它列为「下一步 / 待办」——**先停下来更新这两份文档，再向用户确认真正的下一步**，绝不能直接按文档动手。
- 若 git log 与文档一致，再开工。
- **phase 文档不是事实来源，git log 才是。** 这条规则的存在原因：2026-05-17 曾发生 AI 让用户重做已合并的 Phase 2C.1 的事故。

---

## 4. 风险求证（必须停下来问用户的 6 种情况）

下列情况**绝不能自己决定**：

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

### 不要做的事（红线）

- ❌ 不要主动重构无关代码（哪怕你觉得它写得丑）。
- ❌ 不要改 `.env` 或 `.env.example` 内容（除非新增字段并明确告诉用户）。
- ❌ 不要执行危险命令：`rm -rf`、`git reset --hard`、`git push --force`、`git clean -fd`。
- ❌ 不要安装/卸载全局软件。
- ❌ 不要把 API key、密码写进代码或 commit 进 git。
- ❌ 不要在不告知用户的情况下修改 git 历史（rebase、amend 主线 commit 等）。
- ❌ 不要主动 `git push origin`（开源前暂缓所有 push，详见 [`docs/rules/git-workflow.md`](docs/rules/git-workflow.md) §push）。
- ❌ 不要在 `docs/archive/`、`docs/conversation-inputs/` 目录搜索/读取（归档，已废弃）。

---

## 5. 项目执行计划维护流程（任何 AI 工具开新会话都要遵守）

1. 读完 `docs/EXECUTION_PLAN.md`，找第一个未打勾（`- [ ]`）的子任务。
2. 打开对应 `docs/plans/<file>.md` 详细计划：
   - 若 `status: pending` 且操作步骤段是 `TODO: 进入此阶段时再展开` → **停下问用户「要先展开这个 phase 的具体执行计划吗？」**，**不要自作主张展开**。
   - 若 `status: ready` 或 `in_progress` 且已有操作步骤 → 按里面的步骤执行。
3. 每完成一个子任务，**同时**更新三处：
   - ① `docs/EXECUTION_PLAN.md` 把对应方框从 `- [ ]` 改成 `- [x]`
   - ② 该 phase md 的 frontmatter：`status: done` + 填 `commits` / `completed_date` / `actual_hours`
   - ③ `docs/COMPLETED_WORK.md` 追加一段（按文件顶部"记录模板"格式）
4. **不要跳着做**：当前 phase 所有子任务全部打勾后，再进下一个 phase。如果用户明确要求跳，照办，但要在 COMPLETED_WORK.md 注明"跳过原因"。
5. **一个会话只做一个明确的子任务**，做完就停 + 提醒用户 commit + 建议开新会话做下一个。
6. **不要主动跨子任务工作**，即使你觉得"顺手就改了"——这破坏了用户的 git 颗粒度。

---

## 6. 唯一标准与冲突仲裁

> 📌 **Single Source of Truth**：`docs/SPEC.md` + `docs/spec/`
> 2026-05-18 合并 v2 + v3 + 设计稿 + 现有代码 + 用户最新决议产出的 8 模块统一规范，**Phase 推进、设计落地、AI 协作决策都以本文件为准**。

**优先级（冲突仲裁，自上而下）**：

1. `docs/SPEC.md` + `docs/spec/`（**唯一标准**，产品需求级粒度）
2. `docs/EXECUTION_PLAN.md`（工程执行计划——Phase 打勾 + 当前在哪步）
3. `docs/design/`（**设计稿源文件** 2026-05-25 同步；25 个 jsx + system_design_v1.1.md + check 截图）；token 速查走 [`docs/DESIGN_TOKENS.md`](docs/DESIGN_TOKENS.md)
4. 当前代码（与 spec 偏差时优先反映到 spec 或新建差异 phase）
5. ~~`docs/archive/*`、`docs/conversation-inputs/*`~~ ⚠️ **已 DEPRECATED**，仅历史归档，**不参与仲裁、不在此搜索**

**设计稿路径**：`docs/design/`（2026-05-25 与 `/Users/conan/Downloads/vidmirror (Remix)` 同步）。**所有 UI 改动以此为唯一真相源**，旧 `vidmirror-handoff/` 路径已废弃。AI 写 UI 前必须先读 [`docs/DESIGN_TOKENS.md`](docs/DESIGN_TOKENS.md) 和 [`docs/rules/code-style.md`](docs/rules/code-style.md) §UI。

---

## 7. 规则索引（详细规则按需查阅）

下面这张表是 AI 工作时的"查询手册"。**不要预读，用到时才读对应片段**。

| 主题 | 详细规则文件 | 何时打开 |
|---|---|---|
| 上下文预算 / 读文件策略 / skill / agent / `/clear` 接力 | [`docs/rules/context-budget.md`](docs/rules/context-budget.md) | 准备读大文件、开 agent、被 compact 之后 |
| Git 行为 / commit 颗粒度 / 分支策略 / push 暂缓 / 工具串行交接 | [`docs/rules/git-workflow.md`](docs/rules/git-workflow.md) | 准备 commit、merge、新开会话前 |
| Python / TypeScript 代码风格、UI 设计规范、测试要求 | [`docs/rules/code-style.md`](docs/rules/code-style.md) | 写代码 / 改 UI / 加测试前 |
| 业务规格契约：状态机、级联依赖、阈值、可跳过策略、清理策略 | [`docs/rules/business-contract.md`](docs/rules/business-contract.md) | 改 pipeline、前置配置、状态流转、阈值时 |
| 模型选择四档决策树（Opus / Sonnet / xiaomi mimo 2.5pro / 桌面 Haiku） | [`docs/rules/model-strategy.md`](docs/rules/model-strategy.md) | 判断当前任务该用哪档模型时（一般用户决定，AI 仅在被问时查） |
| 项目架构 / 后端 router / 前端路由 / 共享层 / 端口 / CodeGraph MCP / 常用命令 | [`docs/rules/project-map.md`](docs/rules/project-map.md) | 新人入门、改路由、找模块入口 |
| **mimo 执行加速协议（CC 终端默认执行者必读）** | [`docs/rules/mimo-onboarding.md`](docs/rules/mimo-onboarding.md) | **mimo 每次新会话先读**：启动 60s 协议、低 token 读取、codegraph 用法、不确定 fallback、红线 |

> 💡 **AI 使用方法**：每个文件顶部都有目录章节锚点。AI 应用 `rg -n "^#" docs/rules/<file>.md` 查目录，再 `sed -n` 读对应段落。**禁止整文件读取大文件（ROADMAP.md / 设计稿等）；SPEC 先读 `docs/SPEC.md` 索引，再读相关 `docs/spec/*.md` 模块。**

---

## 8. AI 自检清单（每次回复前快速过一遍）

- [ ] 用户是新手编程小白 → 回复有没有解释术语？
- [ ] 改代码前有没有先说"我打算改什么、为什么"？
- [ ] 改完有没有 1-2 句总结？
- [ ] 本次改动涉及 §4 的 6 种情况吗？涉及就停下来问。
- [ ] 是不是"一个会话一个子任务"？还是想顺手多做？
- [ ] 准备读的大文件有没有用 `rg` 先定位再读片段？
- [ ] 准备 commit 时分支对吗？commit 信息格式对吗？
- [ ] 没有按 §4 红线做任何危险操作？
