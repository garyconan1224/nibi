# Nibi 项目进度 · 计划合并视图（PROJECT STATUS）

> **这份文件是什么**：把「现在做到哪了 + 接下来做什么」合并成一份**唯一速查视图**，给 AI 开会话和你自己对齐用。
> **可视化版**：同目录 [`status-dashboard.html`](status-dashboard.html)（浏览器直接打开，配色借鉴设计稿）。本 md 是事实源，HTML 是它的视觉层。
> **和其他文档的关系**：长期 track 全景仍以 [`ROADMAP.md`](ROADMAP.md) §2/§11 为准；逐 phase 打勾进度以 [`EXECUTION_PLAN.md`](EXECUTION_PLAN.md) 为准；本文件是两者的**对账后摘要**。
> **铁律**：phase 文档不是事实来源，**git log + 实际代码才是**。下表状态已用 `git log` + 代码核对过（2026-05-29）。
>
> Last reconciled: **2026-05-29**（基线 commit `cf49bdb`，分支 `chore/cleanup-abc-2026-05-29`）

---

## 1. 对账快照（2026-05-29）

读完启动文档后用 `git log --oneline -20` + 真实代码核对的结论：

| 项目 | 文档原说 | 实际代码 / git | 真实状态 |
|---|---|---|---|
| `phase-r21-p3-s3-followup` | 待 merge | 已 merge（`6740a3a`，commits `0cf1e76`/`ef633de`/`09563e7`） | ✅ **完成** |
| 当前分支 `chore/cleanup-abc-2026-05-29` | — | 40 个 `plans→archive` 改动**已暂存、未 commit**；无领先 main 的提交 | ⏳ **S1 清理做一半**（本次不动它） |
| S0 E2E bugfix（7 问题） | 待修 | demo fixture 兜底仍在（`backend/app/routes/export.py:487`） | ❌ **未开始** |
| N7b 路径 3（视频大模型直接） | 待做骨架 | `backend/app/services/pipeline_tasks.py:748` 直接 `raise ValueError("video_model 路径尚未实现")` | ❌ **仍是 stub**（卡 Gemini API） |
| N8b librosa 6 维度 | "后端待实现" | `pipeline_tasks.py:2412-2469` 已有完整 librosa 音乐分析 + "A3.3 多段音乐 6 维度切分" | ⚠️ **大部分已实现**（文档过时，见 §5） |
| R20 多格式导出 | 待做 | `export.py` 已有 md/srt/vtt/ass/zip，**无** pdf/docx/obsidian | 🔸 **部分**（缺 3 格式） |

---

## 2. 长期路线（P0 → P4）

> 按你 2026-05-29 的决议重排：**先修当前问题 → 搭好整体架构 → 按使用流程从头到尾逐链路（音频/视频/音视频/文字）优化 → 最后做结尾想法 + 性能 + 开源**。
> 与 ROADMAP §11 一致，只是把节奏按"使用流程从头走"重新组织。

### P0 · 修复当前问题（先解决目前的问题）
- **S0 E2E bugfix**：跑通三链路冒烟时发现的 7 个问题（2 个 P1 数据串扰 + 1 P2 + 4 P3）。
- 目的：保证"真实数据正确落到结果页"，后面搭新功能才不是建在 demo fixture 上。

### P1 · 搭好整体架构 + 整理仓库
- **仓库整理**：S1 plans 归档（已暂存待收尾）/ S2 Streamlit 旧入口冻结标记 / S3 未用 assets 清理。
- **架构骨架**：N7b 路径 3（Gemini）后端骨架 + 接口预留 + mock 单测（**无 API 也能搭**，API 到位后替换 mock 即可，无需新 phase）。
- **核实 N8b**：确认 librosa "6 维度"真实缺口（很可能已基本完成，避免重复造轮子，见 §5）。

### P2 · 按使用流程从头到尾 · 逐链路优化
> 主体阶段。沿"输入链接 → 任务 → 结果页"走完每条链路，逐媒体类型深化。你点名的 4 条链路：
- **音频链路（A）**：补 N8b 实测缺口 + 编辑修正体验。
- **视频链路（V）**：路径 1/2 已通；路径 3（N7b）等 Gemini API 落地。
- **音视频链路（AV）**：av_synthesis 综合笔记已通 → **R20 笔记多格式导出**（pdf/docx/obsidian）。
- **文字链路（T）**：T1-T3 多文对比 UI + 网页抓取扩展。
- （并行次要）**图片链路（I）**：I2-I3 EXIF / 批量任务 / 风格 DNA。*你这次没点名图片，默认排在 4 条主链路之后，可随时提到前面。*

### P3 · 体验 + 性能优化
- **R22** pipeline 并行调度（截帧 + 转写同时跑，issue 6）。
- **R23** 设置面板性能档位（CPU/GPU/内存 → 并发槽位，issue 9，依赖 R22）。
- **F3** 错误体验优化（失败态、重试、空态打磨）。

### P4 · 结尾想法 + 开源
- **[C] AI 导演（复刻）大集成**：shot 网格 / 生成预览 / .fcpxml / Style 报告 / A-B 对比。需先补设计稿，**后续用 Claude Design 更新**。
- **[D] 安全 + 开源准备**：README / license / 安全检查 / CI / `.git` 历史瘦身（278M）/ 统一首次 `git push`。

---

## 3. 短期计划（接下来 1-2 周可执行）

聚焦 **P0 + P1**。按"不卡外部依赖优先"排序（你的决议：先解决目前的问题，再搭架构）：

| # | 任务 | 阶段 | 优先级 | 卡点 | 建议模型 | 详细计划 |
|---|---|---|---|---|---|---|
| 1 | S0.1 删 `/subtitles` demo 兜底 | P0 | 🔴 P1 | 无 | mimo/Sonnet | [e2e-bugfix](plans/phase-e2e-bugfix-2026-05-29.md) |
| 2 | S0.2 audio_result `has_real` 认 transcript_segments | P0 | 🔴 P1 | 无 | mimo/Sonnet | 同上 |
| 3 | S0.3 visual_only 前端禁 SRT 按钮 | P0 | 🟠 P1+ | 无 | mimo/Sonnet | 同上 |
| 4 | S0.4 ResultsOverview React key 警告 | P0 | 🟡 P2 | 无 | mimo | 同上 |
| 5 | S0.5-S0.8（隐藏播放器/412 重试/VLM 进度/URL input） | P0 | ⚪ P3 | 无 | mimo | 同上（可选） |
| 6 | S1-S3 仓库清理（含收尾已暂存的 plans 归档） | P1 | 🟡 | 无 | mimo | [handoff-mimo](plans/phase-handoff-mimo-2026-05-29.md) |
| 7 | N7b 路径 3 Gemini 后端骨架 + mock 单测 | P1 | 🟠 | 无 API（做骨架不卡） | Opus | 同上 S4 |
| 8 | 核实 N8b librosa 6 维度真实缺口 | P1 | 🟡 | 无 | Sonnet | 见 §5 |
| 9 | R20 笔记 pdf/docx/obsidian 导出 | P2 | 🟠 | 需装 reportlab/python-docx（停下问你）| Sonnet | 同上 S6 |

**推荐执行顺序**：先 S0 两个 P1（数据串扰，必修）→ S0.3 → 仓库清理收尾 → N7b 骨架 / 核实 N8b（可并行）→ R20 导出。
**纪律**：一个会话一个子任务，做完 commit + 提醒开新会话。N7b 骨架前先和你确认 Gemini 接口形态；R20 装依赖前先停下问你。

---

## 4. 进度总表

> track 级百分比来源：ROADMAP §2（2026-05-27 维护）；闭环缺口级状态为本次代码核对（2026-05-29）。

### 4.1 Track 级（6 条线）

| Track | 主题 | 进度 | 语义色 | 目标 |
|---|---|---|---|---|
| **F** | 全流程 Flow | 85% | 粉 | 端到端打通，每个节点不掉链 |
| **V** | 视频 Video | 60% | 紫 | 3 路径全通 + 字幕清洗 + 类型模板 |
| **A** | 音频 Audio | 60%* | 绿 | 6 任务前端勾选 + 后端补全 + 编辑修正（*实测可能更高，见 §5） |
| **T** | 文字 Text | 70% | 中性 | 多文对比 UI + 网页抓取扩展 |
| **I** | 图片 Image | 70% | 蓝 | EXIF + 批量任务 + 风格 DNA |
| **R** | 复刻 Remix / AI 导演 | 10% | 深红 | shot 网格 / 生成预览 / .fcpxml / Style 报告 / A-B 对比 |

### 4.2 音视频闭环缺口级（当前阶段重点）

| 缺口 | 链路 | 状态 | 说明 |
|---|---|---|---|
| 视频路径 1（字幕直接总结） | V | ✅ 完成 | N7b 路径 1，2026-05-21 |
| 视频路径 2（截帧 + VLM） | V | ✅ 完成 | av_synthesis 视觉分析 |
| 视频路径 3（视频大模型直接） | V | ❌ stub | 卡 Gemini API，做骨架 |
| 音频 librosa 音乐分析 + 6 维切分 | A | ⚠️ 大部分已实现 | 待核实真实缺口 |
| 说话人分离 | A | ✅ 完成 | 依赖 HF_TOKEN |
| av_synthesis 图文综合笔记 | AV | ✅ 完成 | R19 |
| 笔记导出 md/srt/vtt/ass/zip | AV | ✅ 完成 | export.py |
| 笔记导出 pdf/docx/obsidian | AV | 🔸 待做 | R20 |
| S0 E2E 数据串扰修复 | F | ❌ 未开始 | P1，先做 |

---

## 5. 文档 ↔ 代码差异（需修正项）

本次代码核对发现 plan 文档与实际代码不符，按铁律先记录、待后续修正对应文档：

1. **N8b "后端待实现" 与实际不符**：`pipeline_tasks.py:2412-2469` 已有完整 librosa 音乐分析（BPM/key/duration）+ LLM 生成 Suno 提示词 + "A3.3 多段音乐 6 维度切分"（`segment_audio` / `analyze_music_segments`）。这是 A3「无人声切音乐模式」2026-05-23 做的。
   → **行动**：进 N8b 前先核实"6 任务"中具体哪几项还缺（UI 勾选有 `music_analysis` / `subtitle_export` / `transcribe_summary`），不要按"从零做"估工时。

2. **R20 是"加格式"而非"从零做"**：`export.py` 已能导出 md/srt/vtt/ass + zip 打包。R20 只需在现有 export 基础上加 pdf/docx/obsidian 三种格式（需新依赖 reportlab/python-docx，**装前停下问用户**）。

3. **demo fixture 兜底仍在线上路径**：`export.py:51/487-492`、`workspaces.py` 多处 `build_demo_*_result` 兜底。S0.1 的目的就是收窄它，避免真实数据缺失时静默回退到 demo，造成"数据串扰"错觉。

---

## 6. 维护说明

- 本文件是**对账后摘要**，不替代 ROADMAP / EXECUTION_PLAN，三者关系见顶部。
- 每完成一个短期任务：在 §3 表对应行划掉，§4 缺口表更新状态，并按 CLAUDE.md §5 同步 EXECUTION_PLAN + COMPLETED_WORK。
- 每次新会话开工前，先 `git log --oneline -20` 重新对账 §1，发现文档与 git 不符**先更文档再动手**。
- HTML 看板（`status-dashboard.html`）是手工同步的视觉层，本 md 改了之后按需重生成。
