---
title: Track K · 视频笔记「入口收敛 + 回归修复」计划（交付 mimo v2.5 pro 执行）
status: ready
owner: mimo（执行）/ 用户（拍板）
created: 2026-06-08
strategy: 用户 2026-06-08 已定 —— **不重写、不新建项目**；在现有项目（后端 1.7w 行 / 前端 3.5w 行 / 884 提交）做**彻底删除式收敛**：保留所有底层能力，删掉多余创建入口与旧路径，只留「生成笔记 → note task → NoteShell」一套。再对齐 B 站流程修回归。
relates:
  - docs/plans/track-K-note-flow-blueprint.md（蓝图：内容处理 §2 + 视频 UI §3.5 + 差距清单附录 D）
  - 标杆：B 站视频（错误最少，作流程基准）+ ln 学习笔记页（播放/截帧/时间码能用，作能力来源）
---

# 0. 给 mimo 的总则（必读 · 红线）

1. **战略是「删除式收敛」，不是重写**。底层能力（下载器/ASR/VLM/note_assembler/NoteShell/导出/知识库）**全部保留**；删的只是「多余创建入口 + 旧的并行路径」。
2. **区分「能力」与「入口/路径」**——这是本计划最重要的判断：
   - ❌ 删：手动分析模式、音视频综合、课程笔记入口、独立 analyze 两段式链、旧结果页的笔记入口。
   - ✅ 留：`analyze`（截帧 VLM）作为 note task 的 **step**、ln 的能力组件（LNVideoPanel/HtmlView/MdView）、所有下载器/适配器、note_assembler、导出。
3. **删除安全协议**（每次删之前）：先 `grep -rn "<符号>" frontend/src backend` 看所有引用 → 改/删引用 → 再删定义 → `npx tsc --noEmit` + `pytest`（KMP_DUPLICATE_LIB_OK=TRUE .venv）→ 一步一 commit。
4. **改动前先解释、改完 1-2 句总结**；与本文不符、或要删的东西仍被别处使用，**停下问用户**（用户是编程新手）。
5. 工作区已有改动**保留**：① 6 个在途修复（video.url / LLM 注入 / b23 短链 / 图片渲染等）② 小红书视频分流（[pipeline_tasks.py:1273](backend/app/services/pipeline_tasks.py:1273)）。

---

# 1. 目标终态（一句话）

**加任何链接/文件 → 只有「生成笔记」一个入口 → 一个 note task（download→transcribe→analyze→note）→ NoteShell 展示**。视频笔记达到 ln 水平：单任务、标题对、能播放、能截帧入 md、能时间码跳转。

---

# 2. 现状·乱在哪（已核对代码）

- **创建端两套**：① noteMode「生成笔记」零配置（[AddMaterialModal.tsx:886](frontend/src/components/workspace/AddMaterialModal.tsx:886)）→ note task；② 手动选类型+勾分析（含音视频综合）→ analyze 两段式。
- **后端两套路径**：① [generate_note](backend/app/routes/workspaces.py:1726) → note task（一体化）；② [start_item_pipeline](backend/app/routes/workspaces.py:1611) → [_bridge_to_pipeline_payload](backend/app/routes/workspaces.py:1608) 视频→analyze + [_on_download_success](backend/app/routes/workspaces.py:207) 自动再建 analyze task（**「两个任务」根源**，注册见 [task_runner.py:153](backend/app/services/task_runner.py:153)）。
- **路由层已收敛**：[resolveItemRoute.ts](frontend/src/lib/resolveItemRoute.ts) 笔记向已统一 → NoteShell（这部分对了，保留）。

---

# 3. 分阶段执行（每阶段独立 commit，做完验证再下一步）

## 阶段 A · 前端入口收敛（只留「生成笔记」）

**目标**：AddMaterialModal 去掉手动分析模式，加链接/文件后默认且唯一走「生成笔记」。

删除目标（先 grep 全部引用再动）：
- `av_combined` scope 卡片 [AddMaterialModal.tsx:52](frontend/src/components/workspace/AddMaterialModal.tsx:52)
- `av_synthesis` feature [featuresToSteps.ts:142](frontend/src/lib/featuresToSteps.ts:142)、:68、:74、:158 + AddMaterialModal 的综合笔记联动（:534、:614、:1019、:1062、:1073）
- 手动分析区块：分析任务勾选（[:989-1268](frontend/src/components/workspace/AddMaterialModal.tsx:989)）、识别背景（:1270）等"非 noteMode"分支
- 让 `noteMode` 恒为 true（[:260](frontend/src/components/workspace/AddMaterialModal.tsx:260)）或直接删掉模式切换、只保留 [:886](frontend/src/components/workspace/AddMaterialModal.tsx:886) 起的生成笔记 UI

**验证**：加链接只看到「生成笔记」；搜不到 `av_synthesis`/`av_combined` 残留；`npx tsc --noEmit` 通过；`AddMaterialModal.test.tsx`/`preflightTasks.test.ts` 跟着更新。

## 阶段 B · 后端路径收敛（修「两个任务」）

**目标**：笔记只走 note task，**不再产生第二个 analyze 任务**。

步骤：
1. **git 二分定位**：`git log --oneline -40` 找"以前改成 1 个任务"的 commit；二分确认是哪次改动让视频又变两个（嫌疑：R4.1/R4.2 路由收口前后）。
2. **运行时定位 `/tmp/test.mp3`**：在 [`create_task`](backend/app/services/task_runner.py)（runner 创建任务入口）临时加 `print(task_type, payload, traceback.format_stack())`，跑一次 B 站视频，看那个 audio 任务是谁建的、source 路径哪来的。
3. **断掉旧链**：确认 [_on_download_success](backend/app/routes/workspaces.py:207) 自动建 analyze（:241）、[_bridge_to_pipeline_payload](backend/app/routes/workspaces.py:1608) 视频→analyze 是否还被笔记流程触发；笔记流程统一走 note task，**移除/隔离**这些对笔记的多余触发。⚠️ `analyze` 作为 note task 的 step 要留；删的是"独立 analyze task"。

**方案涉及路径取舍，定位后把改法发用户确认再动。**

**验证**：一个视频 = **一个任务**，无 /tmp/test.mp3；步骤走全 download→transcribe→analyze→note。

## 阶段 C · 旧结果页 / ln / av 入口下线

**目标**：所有"笔记"链接都进 NoteShell；删课程笔记、av-synthesis 等旧入口。

- 删入口（grep 引用后改）：视频结果页跳 `/ln` 的「课程笔记」按钮、`/av-synthesis` 入口、旧四类结果页（Video/Audio/Image/TextResultPage）的"看笔记"入口。
- ⚠️ **保留**：ln 的能力组件 `LNVideoPanel`/`HtmlView`/`MdView`/`LNTranscriptPanel`（NoteShell 复用，见阶段 E）；`replica` 复刻向路由（[resolveItemRoute.ts:17](frontend/src/lib/resolveItemRoute.ts:17)，复刻是另一功能，用户说先不动）。
- 区分 `av_synthesis`：前端「综合笔记 feature」删；后端 `backend/app/services/av_synthesis/`（md/pdf/docx/obsidian 渲染导出）**先确认是否被 NoteShell 导出复用**，被用就留、没用再删（grep `av_synthesis` 后端引用）。

**验证**：点任意素材/链接都落到 `/note`；旧入口按钮消失；tsc + pytest 通过。

## 阶段 D · 视频笔记对齐 B站流程 + 修回归

**基准**：所有视频（含小红书）走 B 站同款 note task 流程（错误最少）。

- **标题**（小红书是 ID）：note task 完成后用 `metadata.title`/`video_title` 回写 `item.name`（仅当 name 仍是 URL/ID 占位）。B 站靠 yt-dlp 文件名已对，小红书适配器已返回真实标题（[pipeline_tasks.py:1287](backend/app/services/pipeline_tasks.py:1287)）。
- **播放**（播不了）：note 端点 video 分支 [workspaces.py:3109](backend/app/routes/workspaces.py:3109) 现在扫 `videos/` 目录；改成**优先用 `results.video_file`** → `to_static_url()`（[:78](backend/app/routes/workspaces.py:78)），扫目录作 fallback。同步 result 端点（[:3253](backend/app/routes/workspaces.py:3253)）。⚠️ 回归测 B 站现有视频别改坏。
- **步骤显示太少**：前端进度页按任务**实际 steps** 渲染（`frontend/src/pages/result/ProcessingPage/` + [featuresToSteps.ts](frontend/src/lib/featuresToSteps.ts)），transcribe/analyze 都要显示。
- 小红书视频分流（已改 [pipeline_tasks.py:1273](backend/app/services/pipeline_tasks.py:1273)）保留。

**验证**：B 站 + 小红书视频都：单任务、标题对、能播放、步骤完整、出转写+截帧内容。

## 阶段 E · NoteShell 补齐 ln 能力 + 蓝图 UI（§3.5）

对照蓝图 [§3.5 视频笔记](docs/plans/track-K-note-flow-blueprint.md) + 附录 D：

- **截帧入 md**（没了）：NoteShell 的 Markdown 编辑器挂载时 `nStore.getState().setCmView(view)`（对齐 ln 的 [MdView](frontend/src/pages/results/LearningNotesPage/MdView.tsx)），卸载清空。截图按钮已在 LNVideoPanel，注册后即可插入。NoteShell 编辑器现注释"不依赖 n"（[index.tsx](frontend/src/pages/result/NoteShell/index.tsx)）→ 改为注册。
- **正文时间码点击跳转**：NoteShell 阅读态用 ReactMarkdown，无时间码跳转；ln 的 [HtmlView](frontend/src/pages/results/LearningNotesPage/HtmlView.tsx:166) 有（replaceTsInString+onSeek）。接入等价能力，连到 NoteMediaCompanion 的 seek。
- **UI 布局**对照蓝图 §3.5：视频播放 + 实时字幕（并列、播放时字幕滚动）+ 标准总结/富文本切换 + 截帧 + md 时间码跳画面 + 右侧操作区（源md/换总结/AI问答/导出）。

**验证**：逐条对照蓝图 §3.5 + 附录 D 验证表。

---

# 4. 总验证清单（全做完后，B站 + 小红书各跑一遍）

- [ ] 加链接只有「生成笔记」一个入口
- [ ] **一个视频 = 一个任务**（无 /tmp/test.mp3）
- [ ] 步骤完整走 download→transcribe→analyze→note
- [ ] 标题是真实标题
- [ ] 视频**能播放**
- [ ] **截图插入**能写进 md
- [ ] 字幕/转录轴点击跳播放器；正文时间码点击跳画面
- [ ] 小红书图文、B站 opus **图文笔记没被改坏**
- [ ] `npx tsc --noEmit` + `pytest` 全绿

---

# 5. 风险 / 待用户确认

1. **阶段 B 路径取舍**：删独立 analyze 链的具体改法，mimo 定位后发用户确认。
2. `av_synthesis` 后端导出是否被 NoteShell 复用——grep 确认再决定删留。
3. 删除跨多文件，**严格走删除安全协议**（grep 引用 → tsc/pytest → 分步 commit），任何"删了怕影响别处"的，停下问用户。
4. `replica` 复刻向、④图片/图文独立类型 = 本轮**不动**。
