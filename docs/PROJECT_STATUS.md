# Nibi 项目进度 · 计划合并视图（PROJECT STATUS）

> **这份文件是什么**：把「现在做到哪了 + 接下来做什么」合并成一份**唯一速查视图**，给 AI 开会话和你自己对齐用。
> **可视化版**：同目录 [`FEATURE_MAP.html`](FEATURE_MAP.html)（功能地图 · 7 模块主视图，浏览器直接开）+ [`status-dashboard.html`](status-dashboard.html)（旧看板）。本 md 是事实源，HTML 是视觉层。
> **和其他文档的关系**：长期 track 全景以 [`ROADMAP.md`](ROADMAP.md) 为准；逐 phase 打勾以 [`EXECUTION_PLAN.md`](EXECUTION_PLAN.md) 为准；Track K 走 `docs/plans/track-K-M*-kickoff.md` 开工卡体系（**不在 EXECUTION_PLAN**）；详细完工记录在 [`COMPLETED_WORK.md`](COMPLETED_WORK.md)。
> **铁律**：phase 文档不是事实来源，**git log + 实际代码才是**。
>
> Last reconciled: **2026-06-04**（Track K M1–M6 全合并；main HEAD `e62c7d9`）

---

## 1. 对账快照（2026-06-04）

| 项目 | 真实状态 | 说明 |
|---|---|---|
| Track K M1–M6 笔记知识库 | ✅ 全合并 | 网页/视频/小红书笔记 + 14 风格总结 + 工作空间知识库问答 + md/Obsidian 导出；小红书无 cookie 适配器 + 单 item 收敛 |
| 结果页 4 子页 + ln 学习笔记页 | ✅ 完成 | 视频/音频/图片/文字结果页(H4)；ln 页含**在线编辑 + AI 问答抽屉 + 多格式导出**(RP1-B 全套) |
| 1 链接 = 1 item | ✅ 成立 | 小红书多类型已收敛(M6) |
| N7b 路径 3（视频大模型直接） | 🔸 骨架就绪 | 待 `GEMINI_API_KEY` 联调 |
| R20 笔记多格式导出（综合笔记） | ✅ 完成 | pdf/docx/obsidian + md/srt/vtt/ass/zip（绑 av_synthesis ParsedNotes） |

---

## 2. 功能模块视图（7 段主流程 · 主视图）

> 重新编序（2026-06-04）：抛开历史批次编号（N/H/R/S/IP/RP/M…），按**用户使用流程**看。可视化见 [`FEATURE_MAP.html`](FEATURE_MAP.html)。

**① 投入 → ② 配置 → ③ 处理 → ④ 分析 → ⑤ 成稿·笔记 → ⑥ 知识库 →（⑦ 再创作·未来）** ＋ 基础设施

| # | 模块 | 状态 | 要点 |
|---|---|---|---|
| ① | 投入内容 | ✅ ~95% | 粘链接/上传一窗搞定；自动识别平台+类型；网页正文预览 |
| ② | 选择分析(Preflight) | ✅ 100% | 按类型勾分析任务 + 智能默认 + 级联锁定 |
| ③ | 处理过程 | ✅ ~90% | 下载/转写/截帧/OCR 流水线 + ProcessingPage + 并行提速；本地 ASR ⬜ |
| ④ | 四类内容分析 | ~80% | 视频(70,路径3待API)/音频(80)/图片(80,风格DNA⬜)/文字(90) |
| ⑤ | **统一笔记流程** | 🔸**当前主线** | 选「笔记」即可→下载后内容驱动分析→md/html 详细稿→选总结→编辑/问答/导出（复用 ln + handle_note_task 的 PROBE 插入点）=M7；合并=M8；混合=M9 |
| ⑥ | 知识库(汇聚) | ✅ ~85% | 工作空间=知识库 + 14 风格总结 + 跨笔记 RAG 问答 + md/Obsidian 导出；联网增强⬜ |
| ⑦ | 再创作/AI 导演 | ⬜ 10% | 仅 Storyboard 展示；改提示词生成新内容/接生成 API = [C] |
| ＋ | 基础设施 | ✅ | 设置/模型/性能档位/资料库/标签/收藏；加密开源[D]⬜ |

---

## 3. 当前主线 + 短期计划

**当前主线：Track K M7 · 统一「笔记」流程改造**（开工卡 [`track-K-M7-kickoff.md`](plans/track-K-M7-kickoff.md)，给 mimo 执行；素材 [`m7-test-fixtures.md`](plans/m7-test-fixtures.md)）

用户决议（2026-06-04）：**选「笔记」即可，不前期判类型；下载后内容驱动分析；统一出 md/html 详细稿；再选总结**。消除"URL 猜类型"根因（B站 opus 等误判自然解决）。跑通后 M8 两两合并、M9 全混合。

| 阶段 | 内容 | 状态 |
|---|---|---|
| **M7** 统一笔记流程 | 选笔记即可→下载后内容驱动分析→md/html→选总结→三能力；不前期判类型（消除 opus 等误判） | 🔸 进行中（M7-1 勘验起步） |
| **M8** 两两合并 | 图文 / 视频+文案 | ⬜ 待 M7 |
| **M9** 全混合 | 图+视频+文字 一篇笔记 | ⬜ 待 M8 |

**其余 backlog**：PDF/Word 笔记导出（轻量 builder）/ 问答联网增强 / 视频路径3(待 API) / 图片风格 DNA / 本地 ASR / F3 错误体验 / [C] AI 导演 / [D] 开源。

---

## 4. 长期路线（P0 → P4）

> 2026-05-29 决议：**先修问题 → 搭架构 → 按使用流程逐链路优化 → 结尾想法+性能+开源**。

- ✅ **P0** 修复当前问题（S0 E2E bugfix）
- ✅ **P1** 搭架构 + 整理仓库（S1-S3）
- 🔵 **P2** 按流程逐链路优化（进行中）：音频✅ / 视频🔸(路径3待API) / 音视频✅ / 文字✅(已扩成 Track K 笔记知识库) / 图片🔸(风格DNA后置)
- ⬜ **P3** 体验+性能：R22-R25 提速✅；F3 错误体验⬜
- ⬜ **P4** 结尾想法+开源：[C] AI 导演（需补设计稿）/ [D] 安全+开源

---

## 5. 能力维度进度（ROADMAP 6 轨 · 辅助视角）

> 与上面 7 模块是同一批功能的两种切法；track 全景细节见 [`ROADMAP.md`](ROADMAP.md) §2/§11。

| Track | 主题 | 进度 |
|---|---|---|
| F 全流程 | ~85% | 端到端打通 |
| V 视频 | ~70% | 路径1+2通；路径3骨架(待API) |
| A 音频 | ~80% | N8b 全链路 + 说话人 |
| T 文字 | 90% | 多文对比+网页/微信抓取+模板库 |
| I 图片 | 80% | EXIF+批量；风格DNA待做 |
| R 复刻/导演 | 10% | 仅 Storyboard |

---

## 6. 文档 ↔ 代码差异（已处理）

1. **"笔记三能力"非新功能 → ln 页已实现**：在线编辑/AI 问答抽屉/多格式导出在 RP1-B 全做完（`ChatDrawer` / patch / 导出）。M7 是**复用下沉**到纯文/图/音页，不重造。
2. **Track K 不在 EXECUTION_PLAN → 走 kickoff 卡**：M1–M6 + M7 在 `docs/plans/track-K-M*-kickoff.md`；这些卡的 `status:` frontmatter 不可信，以 git log 为准。
3. **PDF/Word 笔记导出 = 写轻量 builder（非新依赖）**：`av_synthesis/pdf_builder.py`+`docx_builder.py` 已存在但绑死 ParsedNotes；需 `build_simple_pdf/docx(md,title)`；`python-docx` 已装，`reportlab` 待确认。
4. **N8b "后端待实现" → 已确认全链路打通**：6 维音乐分析后端+UI 早在 A3.3 实现，S5 修了 `music_segments` 映射断裂。
5. **R20 "从零做" → 实为加格式**：在已有 `export.py` 上加 pdf/docx/obsidian。
6. **`tsc --noEmit` ≠ `npm run build`**：发布前须跑 `npm run build`（走 project references）。

---

## 7. 维护说明

- 本文件是**对账后摘要**，不替代 ROADMAP / EXECUTION_PLAN / COMPLETED_WORK。
- 每完成一个子任务：更新 §1/§3 状态，并按 CLAUDE.md §5 同步 EXECUTION_PLAN/COMPLETED_WORK（Track K 同步对应 kickoff 卡 frontmatter）。
- 进度大变后按需重生成 `FEATURE_MAP.html`（7 模块主视图）。
- 每次新会话开工前，先 `git log --oneline -20` 重新对账，文档与 git 不符**先更文档再动手**。
