# Nibi 长期升级路线图（ROADMAP）

> **用途**：这是 2026-05-21 起的多媒体内容分析系统**长期升级路线图**，分 6 条 track 推进。
> **不是**：不是详细执行计划。详细计划在 `docs/plans/phase-XXX.md`（进入对应 phase 时由 AI 展开）。
> **遵循**：[CLAUDE.md](../CLAUDE.md) 工作流 + 全局规则 + 模型选择策略 + 长期记忆（`~/.claude/projects/-Users-conan-Desktop-nibi/memory/MEMORY.md`）。
>
> Last updated: 2026-05-27（ROADMAP.md 603 行瘦身 → ~140 行索引版，6 个 track 拆到 docs/roadmap/）

---

## 0. 启动协议（每次新会话第一件事）

```bash
cd /Users/conan/Desktop/nibi
git status --short --branch
git log --oneline -10
```

然后按顺序读：
1. `CLAUDE.md`（项目规则 + 模型策略 + git 行为）
2. `~/.claude/projects/-Users-conan-Desktop-nibi/memory/MEMORY.md`（深度记忆 + 用户反馈历史）
3. `docs/WORKFLOW.md`（工作流总图）
4. `docs/SPEC.md`（产品需求 8 模块）
5. **本文件**（决定下一步做哪个 track 哪个 phase）
6. `docs/AI_HANDOFF.md`（上次会话留下的开工笔记）
7. `docs/EXECUTION_PLAN.md`（短期 phase 进度对照）

**对账铁律**（违反过出过事故）：读完文档后**必须 `git log --oneline -20` 对账**，确认文档"下一步"与 git 实际状态一致。phase 文档不是事实来源，git log 才是。

---

## 1. 资源索引（哪里找什么）

> 详细资源索引见 [docs/roadmap/01-resources.md](roadmap/01-resources.md)

---

## 2. 6 条 track 总览

| Track | 主题 | 当前进度 | 目标 |
|---|---|---|---|
| **F** | 全流程（Flow）| 85%（H 系列 + IP.1~8 + F1.4/F1.6/F1.7 + F2 冒烟 8/10 + F4 URL 嗅探 + L 资料库聚合页）| 端到端打通，每个节点不掉链 |
| **V** | 视频（Video）| 60%（路径 1+2 已通，路径 3 待做）| 3 路径全通 + 字幕清洗 + 类型模板 |
| **A** | 音频（Audio）| 60%（N8 后端 + UI 部分）| 6 任务前端勾选 + 后端补全 + 编辑修正 |
| **T** | 文字（Text）| 70%（N10 已做大部分）| 多文对比 UI + 网页抓取扩展 |
| **I** | 图片（Image）| 70%（N9 + IP.8.1 Compare）| EXIF + 批量任务 + 风格 DNA |
| **R** | 复刻（Remix / AI 导演 [C]）| 10%（仅 Storyboard 展示）| shot 网格 / 生成预览 / .fcpxml / Style 报告 / A/B 对比 |

**总体节奏**：F → V → A → T → I → R（先打通整体路径，再逐个深化分支，最后 R 收官）

> 🔴 **当前阶段（2026-05-24 起）**：**Phase IR 首页输入层重构**（属 Track F 子项，但因横跨 Composer/Modal/Preflight 单独立项）。计划见 [`docs/plans/phase-r-input-refactor.md`](plans/phase-r-input-refactor.md)。IR 未完工前不要并行启动其他 track 的新 phase。

---

## 3. Track F：全流程（Flow）

> 详细内容见 [docs/roadmap/track-F-flow.md](roadmap/track-F-flow.md)

---

## 4. Track V：视频（Video）

> 详细内容见 [docs/roadmap/track-V-video.md](roadmap/track-V-video.md)

---

## 5. Track A：音频（Audio）

> 详细内容见 [docs/roadmap/track-A-audio.md](roadmap/track-A-audio.md)

---

## 6. Track T：文字（Text）

> 详细内容见 [docs/roadmap/track-T-text.md](roadmap/track-T-text.md)

---

## 7. Track I：图片（Image）

> 详细内容见 [docs/roadmap/track-I-image.md](roadmap/track-I-image.md)

---

## 8. Track R：复刻（Remix / AI 导演 [C]）

> 详细内容见 [docs/roadmap/track-R-remix.md](roadmap/track-R-remix.md)

---

## 9. 模型 / 分支 / 命名约定速查

> 完整规则见以下文档：
> - 模型选择：[docs/rules/model-strategy.md](rules/model-strategy.md)
> - Git 行为：[docs/rules/git-workflow.md](rules/git-workflow.md)
> - 项目架构：[docs/rules/project-map.md](rules/project-map.md)

**快速参考**：
- **日常默认**：deepseek v4-pro（Claude Code + ccswitch，便宜优先）
- **分支命名**：`feat/<track-id>-<short-name>` / `fix/<bug-short-name>` / `chore/<cleanup-name>`
- **Push 策略**：暂缓所有 `git push origin`，等 [D] 开源准备时统一推

---

## 10. AI 协作规则（再次强化）

> 完整规则见 [docs/rules/](rules/) 目录，本节是速查

**核心纪律**：
- 沟通：用中文回复，改代码前先解释，改完用 1-2 句总结
- 不瞎猜：任何不明确的地方**必须停下来问用户**
- 验证：代码级（pytest / pnpm build / lint）**自己跑完报结果再 commit**
- 边界：不主动重构无关代码，不改 .env，不执行危险命令
- 颗粒度：每个子任务完成立即 commit，一个会话只做一个子任务

---

## 11. 推荐执行顺序

> ✅ **2026-05-29 对账更新**：Phase IR 输入层重构（R0~R13.6）+ R14~R21 全系列已合入 main（以 git log 为准）。
> - **当前阶段 = 音频 + 视频端到端闭环打通**（用户 2026-05-29 决议）：从输入链接 → 任务 → 落地页全链路无断点，再做文字 / 图片深化。
> - 闭环缺口：N7b 路径3 视频大模型后端（卡 API 选型 Gemini/GPT-4o/Qwen-VL）/ N8b librosa 后端 / R20 笔记多格式导出。
> - **命名提醒**：§8「Track R 复刻 / AI 导演 [C]」与文件名 `phase-r-input-refactor` 的 R(Refactor) 不是一回事，勿混淆。

```
IR 首页输入层重构 (R0~R13.6)            ← 已完成
  ↓
R14~R21 系列（dedup/元数据/av_synthesis/状态同步/添加素材/总结页/学习补图）← 已完成
  ↓
F2 端到端冒烟 + 状态同步 bug 修         ← 已完成 (R21.A/B)
  ↓
🔴 音视频端到端闭环（输入→任务→落地页）  ← 当前阶段 (2026-05-29)
   ├─ N7b 路径3 视频大模型后端（卡 API 选型）
   ├─ N8b librosa 6 维度音频后端
   └─ R20 笔记 PDF/Word/Obsidian 导出
  ↓
T1~T3 文字深化（多文对比 / 网页抓取扩展）
  ↓
I2~I3 图片深化（EXIF / 批量任务 / 风格 DNA）
  ↓
R22 并行调度 + R23 性能档位（体验优化，对应 5/27 反馈 issue 6/9）
  ↓
F3 错误体验优化
  ↓
[C] R1~R5 复刻 · AI 导演大集成（需先补设计稿，后续 Claude Design 更新）
  ↓
[D] 安全 + 开源准备
```

---

## 12. 用户问答记录区

> 详细内容见 [docs/roadmap/questions.md](roadmap/questions.md)

---

## 13. 维护规则

- 每个 phase 完成后，在本文件对应章节加 `✅ <commit hash>` 标记
- 新增 phase（如发现流程图新缺口）：在对应 track 末尾追加，按字母-数字编号（V5 / A5 / 等）
- 每月 review 一次：把已完工 track 标 "MOSTLY DONE"，下一阶段聚焦未完成 track
- 用户调整方向：在 §11 顶部加注「2026-XX-XX 用户调整：XXX」，不删除旧文，保留历史

---

**End of ROADMAP. F1 Tier A UI 已完成（IP.9，5 个 commit 合入 main）。下一步：F1 Tier B 后端（路径 1/3 + 字幕清洗）或 F2 端到端冒烟测试。**
