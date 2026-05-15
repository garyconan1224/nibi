# Nibi / VidMirror 主规范 v2（合并版，唯一标准）

> 生成日期：2026-05-16
> 角色：本仓库**唯一的真相源（Single Source of Truth）**。所有 Phase 推进、设计落地、AI 协作决策都以本文件为最终仲裁。
> 基底：以 `vidmirror-handoff/project/system_design_v1.1.md`（设计契约）为骨架，叠加 `users-conan-claude-plans-nibi-vidmirror-modular-kurzweil.md`（实施路线 / 模型分工 / 风险清单）。
> 状态：本文件采用「索引 + 仲裁」形式 — 不复制原始设计章节，只给指针、决议、优先级。两份原文档作为深度附件保留。

---

## 0. 优先级（冲突仲裁）

读到任何冲突，按下表自上而下决定：

| 序 | 来源 | 角色 | 文件 |
|---|---|---|---|
| 1 | **本文件（v2）** | 唯一标准 | `nibi-spec-v2.md` |
| 2 | **v1.1 设计文档** | 设计契约真相源（UI/数据/状态机/异常） | `vidmirror-handoff/project/system_design_v1.1.md` |
| 3 | **VidMirror.html 原型** | 视觉骨架（色板/字体/间距/shell） | `vidmirror-handoff/project/VidMirror.html` + `project/styles.css` + `project/components/*` |
| 4 | **总规划 v1** | Phase 路线图 / 模型分工 / 风险表 | `users-conan-claude-plans-nibi-vidmirror-modular-kurzweil.md` |
| 5 | `plan.md` | **已过时**，仅作历史参考 | 项目根 `plan.md` |
| 6 | `system_design_for_claude_design_v1.md` | **deprecated**，被 v1.1 取代 | 项目根 v1 设计文档 |

冲突原则（沿用总规划 §2）：**v1.1 文档 > VidMirror 视觉 > cozy-bentley / 总规划增量**；本 v2 仅在三者矛盾时显式仲裁。

---

## 1. 资料地图（按用途）

| 你要找什么 | 去哪个文件的哪一节 |
|---|---|
| 全局状态机（task / item / stage） | v1.1 §1.4 |
| 阶段名（download/probe/frames/asr/vlm/sum/store） | v1.1 §11.1 |
| 任务数据结构 / 任务卡片视觉 | v1.1 §2.2 / §2.3 |
| 前置配置三区结构 | v1.1 §4 |
| 视频结果页 + 三轨时间轴 | v1.1 §5.3 |
| 图片 / 音频 / 文字结果页 | v1.1 §7.4 / §10.3 / §8.4 |
| 复刻清单 / 风格报告 / 工作包导出 | v1.1 §9 |
| 异常处理表 | v1.1 §13 |
| 设计令牌（colors/typography/spacing） | v1.1 §16 + zip `styles.css` |
| Phase 0 → 1J 路线图 | 总规划 §7 |
| 模型 / 工具分工（Opus/Sonnet/Haiku/Codex/Cursor） | 总规划 §8 |
| Git 工作流 + 阶段交接模板 | 总规划 §9 / §10 |
| 风险与规避表 | 总规划 §12 |
| MVP 7 步自检 | 总规划末尾「验证方式」 |

---

## 2. 核心决议（已敲定，不再问）

源自总规划 §3 与已有对话：

- **设计基底**：v1.1，**不是** 项目根 v1。
- **VidMirror 原型**：视觉骨架直接套用；JSX/data.js 不进项目。
- **术语**：代码用 `workspace`，UI 文案用「任务」。
- **存储**：JSON 持续；任务数 > 30 / 首屏 > 0.5s / 跨任务搜字幕 / 标签库 7 维度索引 — 触发任一才切 SQLite。
- **Q1 API key**：明文存 `models.json` + `.env.example` 警告 + README 顶部警告；开源前 Phase 4 加密。
- **Q2 ASR 引擎**：fast-whisper 本地优先；groq 在设置里手动切换。首次启动未下模型时进度条停在 `asr` 步并提示。
- **Q3 分支策略**：复杂阶段（**1D / 1F / 1G**）开 `feat/<编号>-<短名>` 分支，squash merge；简单阶段（1A/1B/1C/1H/1I/1J + Phase 0）直接打 main。**多 agent 协作时**按 CLAUDE.md 用 `claude-official/<task>` 占座，仍遵循上述分支规则。
- **Streamlit**：Phase 1A 已从入口移除；Phase 1J 一次性删源文件。
- **暗色模式**：token 准备好但 Phase 1 不全量调通。
- **i18n**：暂只做中文，en 文件留空。

---

## 3. Phase 路线图（编号权威表）

**所有 Phase 编号以本表为准**。详细目标 / 必读 / 改动 / 完成标准见总规划 §7 对应小节。

| Phase | 名称 | 估时 | 分支 | Worktree | 模型 | 状态（2026-05-16） |
|---|---|---|---|---|---|---|
| 0 | 设计令牌 + AppShell | 2h | main | 否 | Sonnet | ✅ |
| 1A | 任务列表 API 补字段 | 1h | main | 否 | Sonnet | ✅ |
| 1B | 任务列表前端 | 3h | main | 否 | Sonnet | ✅ |
| 1C | 设置 → 模型管理 | 2h | main | 否 | Sonnet | ✅ |
| 1D | 任务详情骨架 + 输入层 | 3h | claude-official/phase1d-* | 是 | Opus | ✅ |
| 1E | 前置配置面板 | 2h | claude-official/phase1e-* | 是 | Sonnet+Opus | ✅（已合并） |
| **1F** | **Pipeline + SSE 进度条** | **3h** | **`claude-official/phase1f-pipeline-sse`** | **是（必须新开）** | **Opus 4.7** | **🟡 下一步** |
| 1G | 视频结果页 + 三轨时间轴 | 5h | claude-official/phase1g-video-result | 是 | Opus | ⏳ |
| 1H | 图片结果页 | 2h | main | 否 | Sonnet/Haiku | ⏳ |
| 1I | 工作包 zip 导出 | 2h | main | 否 | Sonnet | ⏳ |
| 1J | 老代码清理 + Phase 1 收口 | 1h | main | 否 | Haiku | ⏳ 收尾后 tag `v1.0.0-mvp` |

**强制顺序**：1F 必须在 1G 之前完成（1G 的三轨进度依赖 1F 的 SSE）。其余顺序按编号执行。

**分支命名**：复杂阶段开 `feat/<编号>-<短名>` 或 `claude-official/<task>` 都可，由用户选；不再要求立即 push 占座（单 agent 串行不需要）。

**Worktree 规则**：复杂阶段（1D/1F/1G）建议新开 worktree，便于回滚和并行试验；不在主 worktree `/Users/conan/Desktop/nibi` 直接改代码（主 worktree 只用于 merge/同步）。简单阶段（1A/1B/1C/1H/1I/1J/Phase 0）可直接在 main 上工作。

---

## 4. 工具串行交接（不再多 agent 并发）

详见 [CLAUDE.md](CLAUDE.md) 「工具串行交接」一节。要点：

- 一次只在一个 AI 工具里做一个子任务；做完 commit + merge 进 main 后再换工具。
- 开工先跑精简启动检查：`git status` / `git log -5` / `git branch --show-current`。
- 三种情况停下问用户：脏工作区 + 不属本任务 / main 最近 commit 与认知对不上 / 当前分支不是预期分支。
- 收工不自行 merge；用户决定何时清理旧分支。
- 历史上的「Claude 官方 / 小米 / Codex 三角色分工 + 占座 push」**整体作废**，仅作历史遗留分支命名理解之用。

---

## 5. MVP 验收（7 步，全 Phase 1 完成时跑）

来自总规划末尾，等价于本仓库 v1.0.0-mvp 出货前的强制检查：

1. 后端 `pytest tests/backend -q` 全绿
2. 前端 `cd frontend && pnpm tsc --noEmit` 0 错误
3. 启动后浏览器看到 VidMirror 风格 shell（侧栏 + topbar）
4. 任务列表 → 粘 B 站链接 → 自动建任务 + 跳详情 + 进度条 7 步走完
5. 视频结果页：播放时三轨同步滚动，点轨道能跳时间
6. 任务详情 → 「导出工作包」→ 拿到 .zip，解压有 `frames/` + `prompts.json` + `subtitles.srt` + `README`
7. 设置 → 模型管理 → 添加 OpenAI 兼容模型 + 测试连通成功

7 条对应 Phase 0/1A-B/0/1D-F/1G/1I/1C，倒推可定位卡住的阶段。

---

## 6. 升级 / 降级触发（模型选择）

继承总规划 §8：

- **升 Opus 4.7**：跨文件 ≥ 5 / schema 迁移 + 老数据兼容 / 加密鉴权 API key / AI 自己说"不太确定哪个方案对"。
- **降 Haiku 或小米 2.5 Pro**：单文件 < 50 行小改 / CSS 微调 / 文档与 README 改写 / 模板代码 / 单测 happy path。

---

## 7. 风险快表（最高优先级）

完整 13 条见总规划 §12。本表只列 Phase 1 期间最易踩的：

| 风险 | 规避 |
|---|---|
| AI 在 v1.1 文档与 VidMirror 原型之间摇摆 | 严格按本文件 §0 优先级，每阶段开始引用具体行 |
| 一次改太多导致难 review | 单 commit > 100 行立即暂停 |
| 老 HomePage 组件被 import 没察觉 | Phase 1J 用 ripgrep 全仓搜引用 |
| 进度条 SSE 在反代下断开 | Phase 1F 加 30s 心跳 + 自动重连 |
| 三轨时间轴 1G 卡住 | 1G 单独开分支 + 预留 5h + 用 Opus |
| API key 明文 | 开源前必跑 Phase 4 加密；README 加显眼警告 |

---

## 8. 版本与演进

- **v2.0（本文件）**：合并 v1.1 设计 + 总规划 v1 路线，建立单一仲裁层。
- **v2.x（未来）**：每次有重大决议或 Phase 状态变化在第 3 节表更新「状态」列；不删旧版块。
- **退役**：项目根 `system_design_for_claude_design_v1.md` 与 `plan.md` 仅作历史阅读，不维护、不修改、不删除。

---

*v2 完成。任何与本文件冲突的指令或旧文档片段，应先在本文件追加版本块或仲裁条目，再去改代码。*
