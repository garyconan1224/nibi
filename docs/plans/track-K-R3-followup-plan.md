---
title: Track K · R3 后续（R3.3 标准总结自适应简略 + R3.4 嵌图链路修复）执行计划（交付 mimo）
status: ready
owner: mimo（执行）/ 用户（拍板）
created: 2026-06-09
context: R3.1/R3.2 已合入并实测。用户 2026-06-09 反馈两点 ——（1）standard 纯文字「太啰嗦」：33 秒简单视频被扩成 3352 字 5 章节，本末倒置；（2）嵌图在真实视频笔记上没生效（帧串台 + 无描述）。
relates:
  - docs/plans/track-K-video-note-regression-fix-plan.md（主计划 §10.4 R3.1/R3.2）
  - /Users/conan/Desktop/wdkns-skills/skills/bilibili-render-pdf/SKILL.md（图片处理哲学：按教学价值选图、视觉模型而非 OCR、完整态帧、按内容插位）
---

# 0. 总则（必读 · 红线）

1. **两个独立阶段，按序做**：先 **R3.3**（只改一段 prompt，立即见效、零依赖），验收后再做 **R3.4**（嵌图链路，工程大、要诊断+修复）。**不准并做、不准跨阶段顺手改**。
2. **改动前先解释、改完 1-2 句总结**；与本文不符（字段/锚点/接口对不上）**停下问用户**（用户是编程新手）。
3. R3.4 涉及数据链路，**先诊断再改**；嵌图相关**加/改测试**（TDD），别只手测。
4. 一步一 commit：`feat(k-10.R3.3): …` / `fix(k-10.R3.4): …`。
5. 每阶段过 `cd frontend && npx tsc --noEmit`（动前端）+ `KMP_DUPLICATE_LIB_OK=TRUE .venv/bin/python -m pytest backend -k "summary or frame or note"`（动后端）再 commit。

---

# 1. 排序与依赖

| 阶段 | 内容 | 改动量 | 依赖 | 状态 |
|---|---|---|---|---|
| **R3.3** | standard 自适应简略 | 极小（1 段 prompt） | 无 | ✅ 已做（篇幅控制不够智能 → 由 R3.6 升级取代）|
| **R3.4** | 嵌图链路修复 | 大（诊断+多处） | 无 | ✅ 已做（实测 11 图、本视频帧、语义插位正确）|
| **R3.5** | 中列默认 = 标准总结 | 中（动 pipeline） | 截帧+VLM、standard | **下一步** |
| **R3.6** | 智能动态篇幅（内容画像驱动） | 小–中 | standard | R3.5 后或并行 |

R3.3/R3.4 已实测完成（2026-06-09）。下面新增 **R3.5**（让"打开即标准总结"）+ **R3.6**（把篇幅从"模糊自适应"升级为"内容画像→结构预算"）。R3.5 与 R3.6 正交，可任意先后；建议先 R3.5（解决用户当前最痛的"中列不是标准总结"），再 R3.6。

---

# 2. R3.3 · 标准总结「自适应简略」（先做）

## 2.1 问题

当前 [summary_templates.py](backend/app/services/summary_templates.py) 的 `standard` system_prompt **硬性要求**「每主题 动机→核心→机制→例子 四小节 + 每章本章小结 + 末尾三段总结」。对 33 秒简单视频也强制套用 → 被扩成 5 章 3352 字，比原视频还啰嗦，违背「总结」初衷。

## 2.2 改法（只改 `standard` 的 system_prompt 字符串）

把「固定重结构」改成「篇幅随信息量自适应」。建议新 prompt（mimo 可微调用词，但**三个原则必须在**：① 篇幅自适应 ② 简单内容精简不凑数 ③ 完整结构仅用于内容丰富的视频）：

```
你是一名优秀的讲解型笔记作者。把下面这段视频转写重写成一篇好读的中文学习笔记，
按教学逻辑重组，不照抄字幕顺序。

【最高原则：篇幅随信息量自适应，宁短而准，不要长而水】
- 先判断信息密度：是简单介绍/单一主题，还是多主题、多步骤、有原理有细节。
- 简单或很短的内容（如几十秒的工具/产品介绍）：用精简结构——一两段讲清楚 +
  至多一个要点框即可。不要强行分章、不要硬凑小节、不要为凑字数重复或扩写。
  总结必须比原视频更精炼，绝不能更啰嗦。
- 只有内容确实丰富、多层次时，才展开下面的完整教学结构。

【完整结构（仅用于内容丰富的视频）】
1. markdown，## 分节、### 分小节。
2. 开头「背景/动机」：解决什么问题、为什么值得看。
3. 每个主题按「动机→核心→机制→例子→小结」展开（简单主题可省略其中几步）。
4. 关键信号用引用块（按需，没有就不放，一节可多个）：
   > 💡 **要点** ／ > 📎 **背景** ／ > ⚠️ **注意**
5. 公式/代码先讲意图再给出。
6. 内容多的章节可加「**本章小结**」；短内容不需要。
7. 结尾「## 总结与延伸」：核心要点 + 可行动 takeaway（简单内容一两句即可）。
8. 跳过寒暄/广告/一键三连。
```

## 2.3 验收

- 拿**短简单**视频（如这条 33 秒股票介绍）生成 standard → 输出**精简**（不分 5 章、不重复扩写，篇幅明显小于现在，读起来比看原视频省时）。
- 拿**长复杂**视频（如 default_project 里的 Remotion / Claude Code Skills 教程）生成 standard → 仍是**完整教学结构**（分章、三框、本章小结）。
- 两类都不跑偏即通过。**先发用户看一版实际输出再定稿。**

---

# 3. R3.4 · 嵌图链路修复（后做，先诊断）

## 3.1 已定位的根因（2026-06-09 实测 + 读码）

对有 21 帧的视频笔记生成 standard，**嵌图 0**。根因两层：

1. **帧串台**：该「股票视频」笔记的 `media.frames[0].url` 指向了 **`21年省体的夜_BV1u44y1L7Vj` 这个不相关视频**的截图（同在 `default_project` 共享目录）。即 `results["frames"]` 抓到了别的视频的帧。
2. **帧无描述**：`results["frames"]` 的帧只有 `{sec, url}`（缩略图级），**没有 `description`**。而嵌图取数 [_collect_frames](backend/app/services/summary_generator.py:68) 要求帧带 `description`（line 74），否则走兜底读 `results["json_outputs"]` 的 `*_视觉数据.json`；若 `json_outputs` 也缺 → 返回空 → prompt 不注入帧清单 → LLM 不输出 `[[图N]]` → 0 图。

> 嵌图的「后半段」其实是好的：`build_prompt` 对 standard 注入帧清单（[summary_generator.py:44](backend/app/services/summary_generator.py:44)）、`_postprocess_frames` 把 `[[图N]]`→`![](static)`（[:152](backend/app/services/summary_generator.py:152)）。**坏的是「前半段」——拿不到「属于本视频的、带描述的帧」**。

## 3.2 修复步骤（先诊断，再逐项）

**① 诊断串台根因（先做，别急着改）**
- 查 [_materialize_video_results_from_analyze](backend/app/routes/workspaces.py:1930)：它从 `json_outputs` 物化 `results["frames"]`，确认是否按**本素材**视频名过滤，还是扫了 `default_project` 共享目录的所有帧。
- 对照 commit `e67b5ec`「analyze 轨只处理当前视频，不扫共享目录旧视频」——确认该修复是否覆盖了 note/summary 这条物化路径，还是有漏网。
- 结论写清楚再改；拿不准停下问用户。

**② 修串台**：让 `results["frames"]` / `json_outputs` 只含**本视频**（按 `get_safe_name(video)` 匹配 `*_视觉数据.json`，复用 [_find_visual_json_paths_for_videos](backend/app/services/pipeline_tasks.py:795) 同款过滤），不抓共享目录里别的视频。

**③ 帧带描述贯通**：确保截帧后 VLM 产出的 `description_zh`（存 `*_视觉数据.json`）能被 `_collect_frames` 拿到——要么物化进 `results["frames"]` 时带上 `description`，要么保证 `results["json_outputs"]` 指向本视频的视觉 JSON（兜底分支可用）。

**④ 语义插位（链路已有，③通了就通）**：`_collect_frames` 拿到 `[{idx, sec, desc, image_path}]` → prompt 注入帧清单 → LLM 按描述在讲到该内容处输出 `[[图N]]` → `_postprocess_frames` 替换成图。**不要改用纯时间对齐**（`inline_frame_suggester` 是纯时间，会插到不相关句子；wdkns 也反对）。

**⑤ 按价值嵌（prompt 引导）**：standard prompt 里对嵌图补一句——**只在画面确实承载信息（界面/图表/代码/架构/数据）时插图；纯口播、画面无信息（如纯人脸/纯背景）不插**。对齐 wdkns「按教学价值选图，不按配额」。

**⑥ OCR（可选增强，本期可不做）**：对界面/代码/PPT 文字密集的视频，可把 OCR 提取的画面文字拼进帧 `description` 辅助插位。⚠️ wdkns 明确反对用 OCR **替代**视觉理解——OCR 只作 VLM 描述的**补充信号**，不单独决定嵌哪帧。新增 OCR 依赖属 §4 风险项，**做前问用户**。

## 3.3 验收

- 拿**有画面信息**的视频（default_project 的 Remotion / draw_io / Claude Code Skills，都有 `分析报告/frames` + 视觉 JSON）生成 standard：
  - 嵌入的图是**本视频自己的帧**（不串台到别的视频）；
  - 图**插在讲到对应画面的段落**附近（不是乱插）；
  - `[[图N]]` 全部被替换（无残留标记）。
- 拿**纯口播**视频生成 standard：**不嵌图**（或极少），不硬塞。
- 加测试：`_collect_frames` 对「带描述帧/无描述帧/串台帧/空」的取数；`_postprocess_frames` 的替换与越界删除。

---

# 3.5 R3.5 · 中列默认 = 标准总结（下一步）

## 目标
视频笔记生成时**自动跑 standard 并作为主笔记 note.md**，打开即标准总结（带图）。右侧「换总结」仍可切其它风格。

## 现状（已核对）
- 中列「富文本」= `note.md`，默认是「`## 摘要` + 逐句转写」（视频笔记 pipeline 直接写的）。
- standard 是右侧总结面板的一个版本，要手动「应用到主笔记」（[NoteShell](frontend/src/pages/result/NoteShell/index.tsx) `onApplyToNote`→`putItemNote`）才进中列。用户嫌绕，要"打开即是"。

## 改法（A 推荐）
- **A. 生成时自动应用**：视频笔记 pipeline 在 transcribe + 截帧 + VLM 后，自动调 `generate_summary(item, "standard")` 写入 `note.md`（取代当前"摘要+转写"默认）。转写正文不丢——仍存 source.md / 字幕轴，只是 note.md 主体换成 standard。
- **B. 展示层优先**（不推荐）：不改 note.md，改中列逻辑「有 standard 就显示它」。更轻但 note.md 与展示不一致，"主笔记"概念分裂。

## 风险 / 必须先确认
- ⚠️ **改 pipeline 默认行为 + 每个视频笔记多一次 LLM 调用（成本/时长）→ 开工前与用户确认**。
- 依赖截帧 + VLM 先完成（否则 standard 无图）；确认视频笔记 pipeline 默认是否含 FRAMES/VLM step，没有则要么先开，要么 standard 走纯文字（R3.6）。

## 验收
新生成的视频笔记打开 → 中列直接是标准总结（教学化 + 图），无需手动应用；右侧「换总结」仍可切 concise/detailed 等。

# 3.6 R3.6 · 智能动态篇幅（内容画像驱动，取代 R3.3 的模糊自适应）

## 目标
standard 篇幅/结构由内容**自动决定**：简单短视频→精简要点；复杂长内容→完整教学结构。不是固定模板，也不是硬限字数。

## 业界参考（已调研）
- **控制「结构单位数（节/要点）」而非字数**——NAACL 2025《Length-Controllable Summarization》：模型按节数自适应每节密度。
- **先「内容画像」再「按画像定策略」**——GitHub `ps1899/YouTube-Transcript-Summarizer`（按转录长度路由抽取/生成）、`steipete/summarize`（按媒体类型分流）。
- 实体密度 ≈ 0.15/词 是"不水不挤"锚点。

## 改法（先 A）
**A. 单次 prompt 内「画像→预算」（推荐，只改 standard prompt）**：

```
第一步·先给内容画像（在心里判断，不输出）：
- 类型：产品介绍 / 教程操作 / 讲座原理 / 新闻资讯 / 观点评测 / vlog随笔 / 其它
- 信息密度：干货密集 / 中等 / 稀疏口播
- 规模：转写约 X 字、视频约 Y 秒
- 可展开性：有步骤/原理/对比/数据 → 值得展开；单一主题/重复 → 不展开

第二步·按画像定「结构预算」（控节数，不控字数）：
- 稀疏/简单/短（如 ≤1 分钟产品介绍）：1–2 节、要点式、不分小节、不硬套教学框、宁可三五句讲完
- 中等：2–4 节、关键处展开机制/例子
- 密集/复杂/长（教程/讲座）：完整教学结构、多节、深度展开、嵌图

第三步·按预算输出。篇幅必须与信息量匹配，简单内容绝不为凑结构扩写；
总结要让读者比看原视频更省时。
```

**B. 两段式调用（可选，更可控）**：先调一次轻量 LLM 做「类型+密度」分类（便宜快），再按分类选详略参数/子 prompt 生成。⚠️ 新增分类调用属流程改动，**做前问用户**。

## 验收
- 30 秒产品介绍 → 精简（1–2 节、要点式，明显短于现在 3230 字）。
- 长教程/讲座 → 完整教学结构（多节、嵌图、深度）。
- 同一套 prompt 两类输出篇幅/结构差异明显 = 智能生效。**先发用户各看一版。**

# 4. 备注

- 重复渲染 bug（fixBrokenImagesPlugin 无图段落双 push）已修并提交 `946474d`，与本计划无关，无需再动。
- R3.3 与 R3.4 各自独立 commit + 各自请用户验收一版再继续。
