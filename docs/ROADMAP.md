# Nibi 长期升级路线图（ROADMAP）

> **用途**：这是 2026-05-21 起的多媒体内容分析系统**长期升级路线图**，分 6 条 track 推进。
> **不是**：不是详细执行计划。详细计划在 `docs/plans/phase-XXX.md`（进入对应 phase 时由 AI 展开）。
> **遵循**：[CLAUDE.md](../CLAUDE.md) 工作流 + 全局规则 + 模型选择策略 + 长期记忆（`~/.claude/projects/-Users-conan-Desktop-nibi/memory/MEMORY.md`）。
>
> Last updated: 2026-05-22（F2 冒烟 8/10 通过，3 Bug 已修）

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

### 1.1 用户需求源（流程图 5 张）

| 文件 | 内容 |
|---|---|
| `docs/conversation-inputs/2026-05-18-spec-merge/流程全.png` | 总流程图（输入 → 分析 → 结果 → 复刻）|
| `docs/conversation-inputs/2026-05-18-spec-merge/视频.png` | 视频分支（3 总结路径 + 字幕清洗 + 视频类型模板）|
| `docs/conversation-inputs/2026-05-18-spec-merge/音频.png` | 音频分支（6 任务勾选 + 人声/音乐双路）|
| `docs/conversation-inputs/2026-05-18-spec-merge/图片.png` | 图片分支（基本信息 + 任务勾选）|
| `docs/conversation-inputs/2026-05-18-spec-merge/文字.png` | 文字分支（3 种输入 + 4 并行任务）|
| `docs/conversation-inputs/2026-05-18-spec-merge/场景复刻.png` | 复刻路径（[C] AI 导演方向）|

**AI 阅读建议**：每次开始一个 track 前，先 `Read` 对应 PNG，再 cross-check 代码。

### 1.2 设计稿源（视觉真相）

| 路径 | 内容 |
|---|---|
| `docs/design/components/*.jsx` | 19 个屏 JSX（workbench/taskboard/processing/video_detail 等）|
| `docs/design/styles.css` | 通用样式 + s05 总览页样式 + storyboard 样式 |
| `docs/design/VidMirror.html` | Taskboard 部分 CSS 在此 |
| `docs/design/system_design_v1.1.md` | 设计契约（颜色语义 / 字体规范）|

### 1.3 现有代码索引

| 模块 | 后端位置 | 前端位置 |
|---|---|---|
| 视频分析 | `backend/app/services/pipeline_tasks.py::handle_analyze_task` + `shared/video_analyzer.py` | `frontend/src/pages/result/VideoResultPage.tsx` |
| 音频分析 | `pipeline_tasks.py::handle_audio_task` + `shared/audio_*.py` | `AudioResultPage.tsx` |
| 图片分析 | `pipeline_tasks.py::handle_image_task` + `shared/image_*.py` | `ImageResultPage.tsx` |
| 文字分析 | `pipeline_tasks.py::handle_text_task` + `shared/text_*.py` | `TextResultPage.tsx` |
| 分镜（复刻）| `shared/storyboard_generator.py` | `StoryboardPage/index.tsx` |
| 工作空间 | `backend/app/routes/workspaces.py`（25 endpoints）| `services/workspaces.ts` + `WorkspacePage/TaskboardPage/` |
| Pipeline 任务 | `backend/app/routes/pipeline.py` + `task_runner.py` | `store/taskStore.ts` + `hooks/usePipelineTasks.ts` |
| 设计 tokens | — | `frontend/src/styles/design-tokens.css` + `docs/DESIGN_SYSTEM.md` |

### 1.4 短期 phase 文档（细化时去那里）

`docs/plans/phase-XXX.md`——每个具体子任务的步骤、改动文件、验收。进入某 phase 时由 AI 展开。

### 1.5 历史归档（不参与决策）

- `docs/archive/` 旧 spec / plan，仅作历史参考
- `docs/COMPLETED_WORK.md` 已完成阶段记录

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

---

## 3. Track F：全流程（Flow）

> **目的**：确保从粘 URL 到看到结果的每一步都不掉链，体验顺畅。

### F1 流程缺口补齐（IP.9）

**索引**：`docs/plans/phase-ip9-flow-gaps.md`
**前置**：IP.8 已合并 ✅
**模型分配**：UI 层 ⭐ DS v4-pro；后端层 Sonnet / Opus
**分支**：`feat/ip9-flow-gaps`（已合并入 main）
**子任务**：
- [x] F1.1（IP.9.1）Results 总览页 s05 + 修跳转 bug — `9886826`
- [x] F1.2（IP.9.2）N8b 音频前端 6 任务勾选 *（与 A1 重叠）* — `cb27dd5`
- [x] F1.3（IP.9.3）N7b 视频路径选择 UI *（与 V1 重叠）* — `e618d1a`
- [x] F1.4（IP.9.4）路径 1 后端：字幕直接总结 *（V2 部分）* — `f17c04a` `aac4578` `9e8667e` `92fbdb9` `bf995d7`
- [ ] F1.5（IP.9.5）路径 3 后端：Gemini 集成 *（V3）*
- [x] F1.6（IP.9.6）字幕清洗（规则 + LLM）— `shared/transcript_cleaner.py`
- [x] **F1.7 URL 规整 + 真实前端冒烟**（2026-05-22 用户决议加入，F2 前置）— `170ec0b`
  - **背景**：F2 Bug3 的"冒烟通过"实际是 DS 用 `.venv/bin/python -c` 直调 `run_ytdlp_download` 跑的纯 BV 号，**没走前端 Composer → 后端 pipeline 真实链路**。真用户从浏览器复制的 URL 会带 `?spm_id_from=xxx&vd_source=yyy` 等追踪参数，`platforms.ts::detectPlatform()` 用 `new URL()` 要求 scheme，而后端 `task_runner` 的"同 project + 同 URL 幂等去重"会被追踪参数随机化破坏（同一个视频被识别成两个任务，重复下载）。
  - **改动文件**（< 5 个，DS v4-pro cover）：
    - 新增 `frontend/src/lib/url.ts`：`normalizeMediaUrl(raw)` 处理①纯 BV 号 → 拼完整 URL ②缺 scheme 补 `https://` ③去追踪参数白名单（`spm_id_from / vd_source / share_source / share_medium / bbid / ts / unique_k`）④去尾斜杠便于 dedup
    - 改 `frontend/src/pages/WorkbenchPage/Composer.tsx`：提交前调用 `normalizeMediaUrl()`，让 `detectPlatform` 和后端拿到的都是同一个干净 URL
    - 改 `frontend/src/pages/WorkbenchPage/platforms.ts`：`detectPlatform` 内部也先补 scheme 兜底
    - 改 `backend/app/routes/pipeline.py` 或 `task_runner.py`：后端再做一次幂等规整（前端可能被绕过，比如 curl 直调 / 测试脚本）
    - 新增 `tests/frontend/url.test.ts` 或 vitest 单测：5 个 case（纯 BV / 缺 scheme / 带追踪参数 / 已规整 / 不规范末尾斜杠）
    - 新增后端单测：同一视频带不同追踪参数应去重成一个任务
  - **真实冒烟（必跑）**：`./start.sh` 起前后端 → 浏览器打开 `/` → 粘完整带追踪参数的 B 站 URL（用户提供：`https://www.bilibili.com/video/BV1qA5j6jEJC/?spm_id_from=333.1007.tianma.6-2-20.click&vd_source=...`）→ Preflight → 提交 → 看 yt-dlp 日志 → 到 Results。**全链路通才算完工**，不准再用 `python -c` 直调代替。
  - **模型**：⭐ DS v4-pro（Claude Code + ccswitch）
  - **分支**：`feat/f1.7-url-normalize`（或直接 main 也行，<5 文件改动）
  - **完工验收**：用户粘的 4 种 URL 变体都能正常跑出结果，且任务去重正确

**完工验收（F1 整体）**：粘 B 站 URL → 完整流程图每个节点都跑通 → Results 总览能正确分流 → URL 规整与去重正确
**当前状态**：Tier A（UI 层）已完成，Tier B 后端路径 1 + 字幕清洗 + URL 规整已完成，仅剩 F1.5 Gemini（待用户拍板 API key 来源）

### F2 真端到端冒烟测试 + Bug 修

**前置**：F1 完成
**模型**：用户自己跑 + ⭐ DS v4-pro 修小 bug
**状态**：✅ 8/10 URL 通过，3 Bug 已修（2026-05-22）
**索引**：`docs/plans/phase-f2-smoke.md`
**已修 Bug**：
- `00bc28c` Bug A：task_runner 所有任务硬编码 DOWNLOAD，改为按 task_type 映射
- `489cc76` Bug B：preflight 布尔型 transcribe+summarize 未触发 N7b 字幕路径
- `c366226` Bug C：本地文件 item 显示名覆盖实际文件名，analyze 找不到视频
**待补**：#6 小红书 / #7 抖音 / #8 微信公众号需用户提供真实 URL

### F3 错误体验优化 ✅

**前置**：F2 完成
**状态**：✅ 全部完成（2026-05-22，5 commits）
**子任务**：
- [x] F3.1 错误分类 + 友好文案映射 — `aff4c2a`
  - 新增 `frontend/src/lib/errorCategories.ts`：关键词匹配 4 类错误（network/quota/model_not_configured/unsupported）
  - ProcessingPage 失败态展示友好提示 + 操作建议 + 可折叠原始错误
- [x] F3.2 静默错误补 toast — `b3146c4`
  - Composer workspace 加载 / usePipelineTasks 列表拉取 / useTaskSse SSE 断连 / taskStore 取消失败 → 全部 toast
  - 轮询类错误用 ref 防刷屏
- [x] F3.3 失败/取消视觉区分 — `7a04b38`
  - RecentTasks：FAILED (pink) ≠ CANCELLED (ink-3 gray)
- [x] F3.4 重试流程修复 — `763a3f8`
  - taskStore.retryTask 补 toast.success / toast.error，不再向调用者 throw
  - ProcessingPage handleRetry 简化为直接调用
- [x] F3.5 任务卡住前端检测 — `622c4c7`
  - ProcessingPage 每 30s 检查 `updated_at`，超过 10 分钟无变化 → toast.warning

### F4 URL 内容类型嗅探

**前置**：F3 之前独立完成（用户决议提前做，2026-05-22）
**目标**：用户粘 URL 后自动识别内容类型（video/audio/image/text），不再强制手动选类型
**模型**：Opus 4.7（3 层策略 + 混合内容拆分逻辑复杂）
**分支**：`feat/f4-content-sniff`（已合并入 main）
**索引**：`docs/plans/phase-f4-content-sniff.md`

**子任务**：
- [x] F4.1 URL 内容类型嗅探端点 — `ff1d593`
  - 新增 `shared/url_sniffer.py`：策略 1 已知平台路径匹配 → 策略 2 HTTP Content-Type + `og:` 元标签 → 策略 3 fallback
  - 后端挂载为 `POST /workspaces/sniff-url`，前端 `services/workspaces.ts` 同步接入 `sniffUrl()`
  - 零 schema 改动，嗅探失败优雅降级为 video
- [x] F4.2 前端接入 URL 嗅探自动类型 — `e0719c3`
  - Composer 增加 debounce 500ms 嗅探 `useEffect`，结果传给 PreflightDrawer
  - PreflightDrawer 用 `sniffResult.primary_type` 替代硬编码 `'video'` 创建 item
  - 收口修复：视频分析路径 UI 改用 `resolvedType` 判可见性；URL 变化时立即清空旧 sniffResult 防污染
- [x] F4.3 混合内容自动拆多 item — `d53d583` `6bd40c6`
  - `handleConfirm` 重构为循环模式：嗅探 `possible_types > 1` 时逐一创建 item → savePreflight → start pipeline
  - 每个 item 按自身 type 构建独立 tasks（video 含 summary 路径，其余由后端 bridge 兜底）
  - 共享背景信息 + 模型选择，部分失败 toast warning 显示 N/M 成功数
  - platform type `article` 自动映射为 `text`
  - fix `6bd40c6`：honor selected types and bind created items（补单测 `PreflightDrawer.test.tsx` 265 行）

**完工验收**：粘任意平台 URL → 自动识别类型 → 混合内容自动拆分 → 每种类型走对应 pipeline
**当前状态**：✅ 全部完成（4 commits）

### L 资料库聚合页 ✅

**前置**：F3 已完成
**目标**：统一的资料库汇总视图——跨 workspace 浏览所有已分析内容，按类型/工作空间筛选，多维度排序，点卡片下钻 Results
**模型**：⭐ DS v4-pro（4 子任务均 <5 文件）
**分支**：直接打 main
**索引**：`docs/plans/phase-l-library.md`

**子任务**：
- [x] L1 后端聚合端点 `GET /workspaces/library` — `826c311`
  - 摊平所有 workspace items + 反向带 workspace 信息
  - `duration_seconds` / `primary_task_status` 从 results overlay 推导
  - 默认过滤 `trashed=True` 的工作空间
- [x] L2 前端 LibraryPage 骨架 + ItemCard/WorkspaceCard 组件 + 路由 — `249e2f0`
  - 侧边栏「资料库」从 `/search` 改为 `/library`
  - 卡片视觉对齐设计稿（ex-grid / ex-card / ex-thumb / ex-meta）
  - ItemCard → `/workspaces/{ws}/items/{id}/overview`，WorkspaceCard → `/workspaces/{ws}`
- [x] L3 多选 chip 筛选 + workspace 视图切换 — `d5e5a7e`
  - [全部] [视频] [音频] [图片] [文字] [工作空间] 多选
  - 选中「工作空间」时渲染 WorkspaceCard 网格
- [x] L4 排序下拉 + grid/list 切换 + 状态 localStorage 持久化 — `cd41720`
  - 6 种排序：创建时间 / 完成时间 / 时长 / 状态
  - grid/list 视图切换 + zustand persist
- [x] 扩展：卡片缩略图（yt-dlp writethumbnail → cover_thumbnail 优先级链）
- [x] 扩展：批量删除 + 单项删除 + 选择模式 UI（勾选框仅在选择模式出现，点卡片任意位置切换选中）

**完工验收**：QA 通过——筛选/排序/视图切换/ItemCard 跳 Results/WorkspaceCard 跳 Taskboard/选择+删除
**当前状态**：✅ 全部完成（L1~L4 + 收口扩展）

---

## 4. Track V：视频（Video）

> **流程图依据**：`视频.png`——3 路径 + 字幕清洗 + 视频类型模板 + 输出格式选择

### V1 视频路径选择 UI + 路径 1/3 后端

**索引**：`视频.png` + `system_design_v3_final.md` §视频 + 现有 `handle_analyze_task`
**模型**：UI ⭐ DS v4-pro；路径 1 Sonnet；路径 3 Opus
**分支**：`feat/ip9-flow-gaps`（UI 已合并入 main）
**子任务**：
- [x] V1.1 Preflight 加路径单选 + 视频类型模板 select（= F1.3）— `e618d1a`
- [x] V1.2 后端路径 1：字幕直接总结（= F1.4）— `f17c04a` `aac4578` `9e8667e` `92fbdb9` `bf995d7`
- [ ] V1.3 后端路径 3：Gemini 1.5 Pro 视频输入集成（= F1.5）

**关键决策（待用户拍板）**：
- 路径 3 模型：Gemini 1.5 Pro（用户已决） / GPT-4o / Qwen-VL 后续扩
- Gemini API key 来源：用户 .env / Provider 配置页
- 视频类型模板提示词放哪：硬编码？文件？数据库？

### V2 字幕清洗 + 输出格式选择

**索引**：`视频.png` 中独立的"字幕清洗"节点 + "选择输出格式"节点
**模型**：Sonnet
**分支**：`feat/v2-subtitle-polish`
**子任务**：
- [x] V2.1 `shared/transcript_cleaner.py`（规则去填充词 + LLM 润色）（= F1.6）
- [x] V2.2 输出格式 UI（摘要 / 要点 / 金句 / 段落改写）单选
- [x] V2.3 输出格式 → 后端不同提示词模板

### V3 视频类型模板库

**索引**：`视频.png`「教程/Vlog/访谈/影视点评/产品评测」分类
**模型**：Sonnet（写模板，需对内容理解）
**分支**：`feat/v3-video-templates`
**子任务**：
- [x] V3.1 后端模板库（6+ 类型）：每个类型 system prompt + 输出 schema（隐式完成，已在 pipeline_tasks.py:54）
- [x] V3.2 设置页 → 模板编辑（用户可自定义）
- [x] V3.3 默认模板由 LLM 检测内容自动选（`c040c70`）

### V4 视频结果页升级

**索引**：`docs/design/components/video_detail.jsx`（419 行）+ 现状 `VideoResultPage.tsx`
**模型**：Sonnet
**分支**：`feat/v4-video-detail`
**子任务**：
- V4.1 三轨时间轴交互升级（点击跳帧 / 拖拽 / 缩放）
- V4.2 帧画面 + 提示词 + 字幕三方联动
- V4.3 关键金句标注 / 收藏

---

## 5. Track A：音频（Audio）

> **流程图依据**：`音频.png`——6 任务勾选 + 人声/音乐双路 + 字幕修正

### A1 音频前端 6 任务勾选（= F1.2 = IP.9.2）

**索引**：`音频.png` + `pipeline_tasks.py::handle_audio_task`
**模型**：⭐ DS v4-pro
**分支**：`feat/ip9-flow-gaps`（已合并入 main）
**子任务**：
- [x] A1.1 Preflight audio 分支补 6 个 checkbox — `cb27dd5`
- [x] A1.2 AudioResultPage 按勾选展示对应区块 — `cb27dd5`
- [x] A1.3 后端 bridge 透传所有 6 个字段（部分 N8 未做的留 TODO）— `d9d3836`

### A2 说话人编辑修正 UI（N8b 核心）

**索引**：`音频.png` 中"说话人识别"节点 + N8b plan
**模型**：Sonnet（多说话人轨交互复杂）
**分支**：`feat/a2-speaker-edit`
**子任务**：
- A2.1 音频结果页加说话人轨道 + 标签编辑
- A2.2 后端补 PATCH speaker label endpoint
- A2.3 编辑后产物（speaker mapping）持久化

### A3 无人声切音乐模式（N8b 第 2 部分）✅

**索引**：`音频.png` 中"无人声 → 音乐分析"分支
**模型**：⭐ DS v4-pro
**分支**：main（直接做）
**完成**：2026-05-23，commit `(pending)`
**子任务**：
- [x] A3.1 VAD 完毕后检测「无人声占比 > 80%」→ 弹模态「切到音乐模式吗」
- [x] A3.2 用户确认后跳过 ASR 直接走音乐分析
- [x] A3.3 多段音乐 6 维度切分 UI
- 注：LLM 逐段 enrich（风格/情绪/乐器/氛围）留作 A3.3b 后续；本次仅 librosa 声学分段

### A4 字幕导出 + .srt/.ass/.vtt 格式 ✅

**索引**：`音频.png` 中"字幕导出"分支
**模型**：⭐ DS v4-pro
**分支**：`feat/a4-subtitle-export`
**子任务**：
- [x] A4.1 后端字幕生成支持多格式（`2559164`）
- [x] A4.2 前端导出按钮（在 AudioResultPage / VideoResultPage）（`acfb00b`）
- [x] A4 收口修复：overlay 优先读取、display transcript 归一化、demo fixture fallback、测试补齐（`e830889` `9d061dc` `0f4e98f` `476a354`）

---

## 6. Track T：文字（Text）

> **流程图依据**：`文字.png`——3 种输入 + 4 并行任务（摘要 / 联想 / 改写 / 翻译 / 多文对比）

### T1 文字结果页升级

**索引**：`docs/design/components/text_detail.jsx`（422 行）+ 现状 `TextResultPage.tsx`
**模型**：Sonnet
**分支**：`feat/t1-text-detail`
**子任务**：
- T1.1 原文 / 改写 / 翻译 三栏对照（设计稿期待）
- T1.2 金句/关键词高亮（点击锚定原文位置）
- T1.3 多文对比 UI 补齐（IP.8.1 Compare Tab 已通后端）

### T2 网页抓取扩展

**索引**：`文字.png` 中"网页 URL 抓取"分支 + `shared/web_enrich.py`
**模型**：Sonnet
**分支**：`feat/t2-web-extract`
**子任务**：
- T2.1 通用网页抓取（非微信公众号也能跑）
- T2.2 抓取后预览模态（确认正文后再入库）
- T2.3 支持 markdown / 富文本 / PDF 链接

### T3 文字任务模板库

**索引**：现状 N10 各任务提示词
**模型**：Sonnet
**分支**：`feat/t3-text-templates`
**子任务**：
- T3.1 提示词模板设置页（与 V3 视频模板可统一管理）
- T3.2 「联想」4 方向可用户扩展

---

## 7. Track I：图片（Image）

> **流程图依据**：`图片.png`——基本信息 + 任务勾选 + 联想

### I1 EXIF 提取 + 基本信息卡

**索引**：`图片.png` 中"基本信息（分辨率 / 拍摄设备 / EXIF）"
**模型**：⭐ DS v4-pro（前端展示 + 后端 PIL 一行）

**分支**：`feat/i1-image-exif`
**子任务**：
- I1.1 后端 image handler 输出 EXIF 字典
- I1.2 ImageResultPage 加基本信息卡（设计稿 image_detail.jsx 已有 layout）

### I2 批量任务执行

**索引**：`图片.png` 多图勾选区
**模型**：Sonnet
**分支**：`feat/i2-image-batch`
**子任务**：
- I2.1 ImageResultPage 多图勾选 + 批量打标 / 联想 / 重写提示词
- I2.2 批量结果对比导出

### I3 图片风格 DNA 报告（与 R3 重叠）

**索引**：N9 现有 4 联想方向 + `场景复刻.png`
**模型**：Sonnet
**分支**：`feat/i3-image-style-dna`
**子任务**：
- I3.1 单图 → 风格特征向量（颜色 / 构图 / 主体 / 氛围）
- I3.2 多图聚类 → 风格簇报告
- I3.3 输入"风格目标" → 找相似图

---

## 8. Track R：复刻（Remix / AI 导演 [C]）

> **流程图依据**：`场景复刻.png` + `docs/design/components/director.jsx`

### R1 Storyboard shot 网格升级

**索引**：当前 StoryboardPage（markdown 直展）→ 设计稿 storyboard.jsx 的 sb-grid + sb-shot
**模型**：Opus（后端 schema 升级 + 前端复杂状态）
**分支**：`feat/r1-storyboard-shots`
**子任务**：
- R1.1 后端 storyboard_generator 输出结构化 JSON（per shot：编号 / 时长 / 视觉 / 字幕 / 参考帧 id）
- R1.2 StoryboardPage 用结构化数据渲染 shot 网格
- R1.3 兼容旧 markdown 数据（fallback markdown 直展）

### R2 生成预览 / .fcpxml 导出

**索引**：设计稿 storyboard.jsx 的「生成预览」「导出 .fcpxml」按钮
**模型**：Opus（外部 API + 文件格式）
**分支**：`feat/r2-storyboard-export`
**子任务**：
- R2.1 .fcpxml 导出（Final Cut XML 格式，可参考开源库）
- R2.2 生成预览（用 ffmpeg 把分镜拼成低分辨率预览视频）
- R2.3 拍板：要不要接图像生成（Midjourney / Flux）补缺失参考帧

### R3 Style 报告（= H2.5）

**索引**：设计稿 director.jsx + N9 联想能力扩展
**模型**：Opus
**分支**：`feat/r3-style-report`
**子任务**：
- R3.1 单素材风格 DNA：色调 / 构图 / 节奏 / 调性
- R3.2 多素材聚类 → 风格趋势报告
- R3.3 Taskboard Style Report Tab 启用

### R4 A/B Compare（视频版 + AI 导演）

**索引**：设计稿 cmp-* 类（IP.8.1 已通图/文对比，视频/音频缺）
**模型**：Sonnet
**分支**：`feat/r4-video-compare`
**子任务**：
- R4.1 后端 video_compare / audio_compare endpoint
- R4.2 Compare Tab 支持视频/音频类型

### R5 AI 导演对话面板（设计稿 s12）

**索引**：设计稿 director.jsx 完整
**模型**：Opus
**分支**：`feat/r5-director-panel`
**子任务**：
- R5.1 完整对话页（不依附 Taskboard）
- R5.2 上下文：可同时挂多个工作空间 + 多素材
- R5.3 一键生成分镜 / 切片 / 翻译 / 重写

---

## 9. 模型 / 分支 / 命名约定速查

> 完整规则见 [CLAUDE.md](../CLAUDE.md)，本节是速查

### 模型分配（四档决策树）

| 档 | 模型 | 适合 |
|---|---|---|
| 1 | **Opus 4.7**（桌面）| 跨 5+ 文件 / 状态机 / 加密 / 外部 API 集成 |
| 2 | **Sonnet 4.6**（桌面）| 多文件 CRUD / 组件级前端 / 后端 handler 改写 |
| 3 | ⭐ **DS v4-pro**（Claude Code + ccswitch，比 Claude 便宜）| 模板代码 / git / 单文件改 / CSS / 测试模板 / 文档 |
| 4 | **DS v4-flash / Haiku 4.5**（ccswitch Haiku 角色 / 桌面）| 单行 typo / 极简兜底；优先 v4-flash |

⭐ **日常默认走 DS v4-pro**，能用就用。⚠️ 不要让 v4-flash 当默认——它对应 Haiku 档，能力弱，多文件 CRUD 会翻车。

> **2026-05-22 通道变更**：小米 2.5 Pro 套餐用完，改用 ccswitch 中转 DeepSeek API。ccswitch 是透明代理，在 Claude Code 里选 Sonnet/Opus 角色 → 路由到 `deepseek-v4-pro`；选 Haiku 角色 → 路由到 `deepseek-v4-flash`。

### 分支命名

```
feat/<track-id>-<short-name>   # 主线 feature
fix/<bug-short-name>           # bug 修复
chore/<cleanup-name>           # 清理 / 文档
```

例：`feat/v1-video-paths`、`feat/a2-speaker-edit`、`fix/task-runner-append-log`

### Phase 完成流程

1. 工作完成 → commit
2. 通知用户 merge（不自行 merge，破坏性操作仍需授权）
3. 用户授权 → merge `--no-ff` 进 main
4. 更新 `docs/EXECUTION_PLAN.md`（打勾）+ `docs/COMPLETED_WORK.md`（追加记录）+ 本文件相关行

### Push 策略

⚠️ **暂缓所有 `git push origin`**，等 [D] 开源准备时统一推。本地 main 越来越领先 origin/main 是预期状态。

---

## 10. AI 协作规则（再次强化）

> 这一节是给所有 AI 工具（桌面 Claude / 终端 DS / Codex / Cursor 等）的纪律。

### 10.1 沟通

- 用中文回复
- 改代码前先解释「我打算改哪几个文件、为什么」
- 改完用 1-2 句总结
- 第一次出现的术语附一句白话

### 10.2 不瞎猜（重要规则）

任何不明确的地方**必须停下来问用户**，包括但不限于：
- 字段命名（前后端是否对齐）
- 文件位置（grep 找不到的）
- 依赖（要不要 install 新包）
- 数据库 schema 改动
- 加密 / API key 存储
- 跨 5+ 文件改动
- 命名是否对得上设计稿
- 流程中某个分支语义

不止在做计划时问，**任何执行时碰到不清楚的都问**。

### 10.3 验证

- 代码级（pytest / pnpm build / lint）**自己跑完报结果再 commit**
- UI 动态流程才请用户帮看
- commit message 末尾"已发现"区记录无法本会话修的隐患

### 10.4 边界

- ❌ 不主动重构无关代码
- ❌ 不改 .env（除非新增字段并明示）
- ❌ 不执行 `rm -rf` / `git reset --hard` / `git push --force` / `git clean -fd`
- ❌ 不安装全局软件
- ❌ 不把 API key / 密码写进 commit

### 10.5 颗粒度

- 每个子任务完成立即 commit，不堆积
- 一个会话只做一个明确的子任务，做完就停
- 完成后**主动提醒用户**：「子任务 X 完成，建议 commit 后开新会话做下一个」

---

## 11. 推荐执行顺序

```
F1 流程缺口补齐 (IP.9 Tier A UI)        ← 已完成 (f33db14)
  ↓
F1 Tier B 后端（路径 1 + 字幕清洗已完成；路径 3 Gemini 待用户拍板）
  ↓
F1.7 URL 规整 + 真实前端冒烟          ← 已完成 (170ec0b)
  ↓
F2 端到端冒烟 + bug 修
  ↓
A1 + V1 + I1（音视图三个 UI 层一起做完，前端可并行）*N7b/N8b UI 已就绪*
  ↓
F3 错误体验优化
  ↓
V2 + V3（视频深化）
  ↓
A2 + A3 + A4（音频深化）
  ↓
T1 + T2 + T3（文字深化）
  ↓
I2 + I3（图片深化 + 风格 DNA）
  ↓
R1~R5（复刻 / AI 导演 大集成）
  ↓
[D] 开源准备
```

---

## 12. 用户问答记录区

> AI 执行过程中需要用户决策的问题，记在这里。问完用户回答后立刻把答案补到本文件对应章节，避免后续会话重复问。

### 已问已答

- **V1 路径 3 视频大模型**：先接 Gemini 1.5 Pro（2026-05-21 用户决议）
- **V2 字幕清洗策略**：规则 + LLM 混合（2026-05-21 用户决议）

### 待问（执行 R1 / R2 时问）

- R1.1 storyboard JSON schema 字段命名（per shot 是 `num/dur/title/desc/vo` 还是别的）
- R2.1 .fcpxml 选用哪个开源库（pyfcpxml? 自己手写？）
- R2.3 要不要接图像生成补缺失参考帧（成本 + 版权风险）
- R3 风格 DNA 算法：纯 LLM 评估 vs 视觉特征向量 + LLM 解读

---

## 13. 维护规则

- 每个 phase 完成后，在本文件对应章节加 `✅ <commit hash>` 标记
- 新增 phase（如发现流程图新缺口）：在对应 track 末尾追加，按字母-数字编号（V5 / A5 / 等）
- 每月 review 一次：把已完工 track 标 "MOSTLY DONE"，下一阶段聚焦未完成 track
- 用户调整方向：在 §11 顶部加注「2026-XX-XX 用户调整：XXX」，不删除旧文，保留历史

---

**End of ROADMAP. F1 Tier A UI 已完成（IP.9，5 个 commit 合入 main）。下一步：F1 Tier B 后端（路径 1/3 + 字幕清洗）或 F2 端到端冒烟测试。**
