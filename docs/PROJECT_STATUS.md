# Nibi 项目进度 · 计划合并视图（PROJECT STATUS）

> **这份文件是什么**：把「现在做到哪了 + 接下来做什么」合并成一份**唯一速查视图**，给 AI 开会话和你自己对齐用。
> **可视化版**：同目录 [`status-dashboard.html`](status-dashboard.html)（浏览器直接打开）。本 md 是事实源，HTML 是视觉层（手工同步，进度变化后按需重生成）。
> **和其他文档的关系**：长期 track 全景以 [`ROADMAP.md`](ROADMAP.md) §2/§11 为准；逐 phase 打勾以 [`EXECUTION_PLAN.md`](EXECUTION_PLAN.md) 为准；详细完工记录在 [`COMPLETED_WORK.md`](COMPLETED_WORK.md)；本文件是它们的**对账后摘要**。
> **铁律**：phase 文档不是事实来源，**git log + 实际代码才是**。
>
> Last reconciled: **2026-05-29**（handoff S0–S6 全部完成，音视频闭环成型；main HEAD `cb4a904`）

---

## 1. 对账快照（2026-05-29）

| 项目 | 真实状态 | 说明 |
|---|---|---|
| S0 E2E bugfix（7 问题） | ✅ 完成 | S0.1-S0.7 已 merge；S0.8 按计划跳过（仅测试便利） |
| 仓库清理 S1-S3 | ✅ 完成 | plans 归档+死链修复 / Streamlit（早已删，转为修 CLAUDE.md §1）/ 删 icons.svg |
| N7b 路径 3（视频大模型直接） | 🔸 骨架就绪 | S4 Gemini 骨架+mock 单测完成，**待 `GEMINI_API_KEY` 联调** |
| N8b librosa 6 维度 | ✅ 全链路打通 | 后端+UI 早有（A3.3），S5 修了 `music_segments` 映射断裂 |
| R20 笔记多格式导出 | ✅ 完成 | S6：pdf（playwright chromium）/docx（python-docx）/obsidian，+ md/srt/vtt/ass/zip |
| 前端 build baseline | ✅ 修复 | LibraryItem 补 `related_task_ids`，`npm run build` 转绿 |

---

## 2. 长期路线（P0 → P4）

> 按你 2026-05-29 决议：**先修当前问题 → 搭好整体架构 → 按使用流程逐链路（音频/视频/音视频/文字）优化 → 最后结尾想法 + 性能 + 开源**。

### ✅ P0 · 修复当前问题
- S0 E2E bugfix（数据串扰 P1 + P2 + P3）已全部完成。

### ✅ P1 · 搭好整体架构 + 整理仓库
- 仓库清理 S1-S3 完成；N7b 路径3 Gemini 骨架就绪；N8b 已核实并打通。

### 🔵 P2 · 按使用流程从头到尾 · 逐链路优化（进行中）
- ✅ **音频 A**：N8b 6 维音乐分析全链路打通。
- 🔸 **视频 V**：路径 1（字幕）+ 路径 2（截帧 VLM）已通；路径 3 骨架就绪，**待 Gemini API 联调**。
- ✅ **音视频 AV**：av_synthesis 综合笔记 + R20 多格式导出。
- ⬜ **文字 T**：T1-T3 多文对比 UI + 网页抓取扩展 ← **下一步**。
- ⬜（次要）**图片 I**：I2-I3 EXIF / 批量任务 / 风格 DNA。

### ⬜ P3 · 体验 + 性能优化
- R22 pipeline 并行调度 / R23 性能档位 / F3 错误体验。

### ⬜ P4 · 结尾想法 + 开源
- [C] AI 导演（复刻）大集成（需补设计稿，Claude Design 更新）/ [D] 安全 + 开源准备。

---

## 3. 短期计划

**handoff-mimo 的 S0–S6 执行清单已全部完成** ✅（详见 COMPLETED_WORK）：

| # | 任务 | 状态 |
|---|---|---|
| S0.1-S0.7 | E2E bugfix（数据串扰 + 体验） | ✅ |
| S1-S3 | 仓库清理 | ✅ |
| S4 | N7b 路径3 Gemini 骨架 | ✅（待 API 联调） |
| S5 | 核实 N8b + 修 music_segments 映射 | ✅ |
| S6 | R20 笔记多格式导出 | ✅ |

**下一步（P2 文字链路 T，计划待展开）**：
- T1-T3：多文对比 UI / 网页抓取扩展。**开工前需先定方向 + 调研选型**（无现成 phase 计划，像 S4/S6 一样先确认）。
- 备选并行：图片 I（I2-I3）；视频路径 3 真功能（卡 `GEMINI_API_KEY`，给 key 后填实现）。

---

## 4. 进度总表

### 4.1 Track 级（6 条线）

| Track | 主题 | 进度 | 目标 |
|---|---|---|---|
| **F** | 全流程 Flow | ~88% | 端到端打通（S0 数据串扰已修） |
| **V** | 视频 Video | ~70% | 路径 1+2 通；路径 3 骨架（待 API） |
| **A** | 音频 Audio | ~80% | N8b 全链路；剩编辑修正体验 |
| **T** | 文字 Text | 70% | 多文对比 UI + 网页抓取扩展（下一步） |
| **I** | 图片 Image | 70% | EXIF + 批量 + 风格 DNA |
| **R** | 复刻 Remix / AI 导演 | 10% | shot 网格 / 生成预览 / .fcpxml / Style 报告 |

### 4.2 音视频闭环缺口级

| 缺口 | 链路 | 状态 |
|---|---|---|
| 视频路径 1（字幕直接总结） | V | ✅ 完成 |
| 视频路径 2（截帧 + VLM） | V | ✅ 完成 |
| 视频路径 3（视频大模型直接） | V | 🔸 骨架就绪，待 Gemini API |
| 音频 librosa 6 维切分 | A | ✅ 全链路（S5 修映射） |
| 说话人分离 | A | ✅ 完成 |
| av_synthesis 图文综合笔记 | AV | ✅ 完成 |
| 笔记导出 md/srt/vtt/ass/zip | AV | ✅ 完成 |
| 笔记导出 pdf/docx/obsidian | AV | ✅ 完成（S6 R20） |
| S0 E2E 数据串扰修复 | F | ✅ 完成 |

---

## 5. 文档 ↔ 代码差异（已处理）

1. **N8b "后端待实现" → 已确认全链路打通**：6 维（genre/mood/instruments/atmosphere + 声学）后端+UI 早在 A3.3 实现，S5 修了 `result→UI` 的 `music_segments` 映射断裂。handoff §7「新增 onset/tempo/style」是未核实的错误计划，已标作废。
2. **R20 "从零做" → 实为加格式**：在已有 `export.py`（md/srt/zip）上加 pdf/docx/obsidian（S6 完成）。
3. **demo fixture 兜底 → S0.1 已收窄**：避免真实数据缺失时静默回退 demo。
4. **CLAUDE.md §1 Streamlit 描述过时 → 已修**：Streamlit 入口早在 Phase 1J 删除，S2 改为修正 CLAUDE.md。
5. **`tsc --noEmit` ≠ `npm run build`**：build hotfix 暴露——日常 `tsc --noEmit` 不走 project references，发布前须跑 `npm run build`。

---

## 6. 维护说明

- 本文件是**对账后摘要**，不替代 ROADMAP / EXECUTION_PLAN / COMPLETED_WORK。
- 每完成一个子任务：更新 §3/§4 状态，并按 CLAUDE.md §5 同步 EXECUTION_PLAN + COMPLETED_WORK。
- 每次新会话开工前，先 `git log --oneline -20` 重新对账，发现文档与 git 不符**先更文档再动手**。
- `status-dashboard.html` 是手工同步的视觉层，进度大变后按需重生成。
