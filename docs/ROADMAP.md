# Nibi 长期升级路线图（ROADMAP）

> **用途**：这是 2026-05-21 起的多媒体内容分析系统**长期升级路线图**，分 6 条 track 推进。
> **不是**：不是详细执行计划。详细计划在 `docs/plans/phase-XXX.md`（进入对应 phase 时由 AI 展开）。
> **遵循**：[CLAUDE.md](../CLAUDE.md) 工作流 + 全局规则 + 模型选择策略 + 长期记忆（`~/.claude/projects/-Users-conan-Desktop-nibi/memory/MEMORY.md`）。
>
> Last updated: 2026-05-21

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
| **F** | 全流程（Flow）| 70%（H 系列 + IP.1~8）| 端到端打通，每个节点不掉链 |
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
**模型分配**：UI 层 ⭐ 小米；后端层 Sonnet / Opus
**分支**：`feat/ip9-flow-gaps`（已合并入 main）
**子任务**：
- [x] F1.1（IP.9.1）Results 总览页 s05 + 修跳转 bug — `9886826`
- [x] F1.2（IP.9.2）N8b 音频前端 6 任务勾选 *（与 A1 重叠）* — `cb27dd5`
- [x] F1.3（IP.9.3）N7b 视频路径选择 UI *（与 V1 重叠）* — `e618d1a`
- [x] F1.4（IP.9.4）路径 1 后端：字幕直接总结 *（V2 部分）* — `f17c04a` `aac4578` `9e8667e`
- [ ] F1.5（IP.9.5）路径 3 后端：Gemini 集成 *（V3）*
- [ ] F1.6（IP.9.6）字幕清洗（规则 + LLM）

**完工验收**：粘 B 站 URL → 完整流程图每个节点都跑通 → Results 总览能正确分流
**当前状态**：Tier A（UI 层）已完成，Tier B（后端层）待实现

### F2 真端到端冒烟测试 + Bug 修

**前置**：F1 完成
**模型**：用户自己跑 + ⭐ 小米修小 bug
**目标**：列出 10 个真实 URL（含 B 站 / YouTube / 小红书 / 抖音 / 微信公众号），逐个走流程
- 记录每个失败点
- 开 `docs/plans/phase-f2-smoke.md` 补丁清单
- 修完再跑一次

### F3 错误体验优化

**前置**：F2 完成
**目标**：用户视角的错误处理
- 网络失败 / 配额超限 / 模型未配置 时的友好提示
- 任务卡住 > N 分钟自动检测并提示
- 历史失败任务一键重试
**模型**：⭐ 小米
**改动**：Processing / TaskCard / 错误 toast 文案统一

---

## 4. Track V：视频（Video）

> **流程图依据**：`视频.png`——3 路径 + 字幕清洗 + 视频类型模板 + 输出格式选择

### V1 视频路径选择 UI + 路径 1/3 后端

**索引**：`视频.png` + `system_design_v3_final.md` §视频 + 现有 `handle_analyze_task`
**模型**：UI ⭐ 小米；路径 1 Sonnet；路径 3 Opus
**分支**：`feat/ip9-flow-gaps`（UI 已合并入 main）
**子任务**：
- [x] V1.1 Preflight 加路径单选 + 视频类型模板 select（= F1.3）— `e618d1a`
- [x] V1.2 后端路径 1：字幕直接总结（= F1.4）— `f17c04a` `aac4578` `9e8667e`
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
- V2.1 `shared/transcript_cleaner.py`（规则去填充词 + LLM 润色）（= F1.6）
- V2.2 输出格式 UI（摘要 / 要点 / 金句 / 段落改写）单选
- V2.3 输出格式 → 后端不同提示词模板

### V3 视频类型模板库

**索引**：`视频.png`「教程/Vlog/访谈/影视点评/产品评测」分类
**模型**：Sonnet（写模板，需对内容理解）
**分支**：`feat/v3-video-templates`
**子任务**：
- V3.1 后端模板库（6+ 类型）：每个类型 system prompt + 输出 schema
- V3.2 设置页 → 模板编辑（用户可自定义）
- V3.3 默认模板由 LLM 检测内容自动选

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
**模型**：⭐ 小米
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

### A3 无人声切音乐模式（N8b 第 2 部分）

**索引**：`音频.png` 中"无人声 → 音乐分析"分支
**模型**：⭐ 小米
**分支**：`feat/a3-music-mode`
**子任务**：
- A3.1 VAD 完毕后检测「无人声占比 > 80%」→ 弹模态「切到音乐模式吗」
- A3.2 用户确认后跳过 ASR 直接走音乐分析
- A3.3 多段音乐 6 维度切分 UI

### A4 字幕导出 + .srt/.ass/.vtt 格式

**索引**：`音频.png` 中"字幕导出"分支
**模型**：⭐ 小米
**分支**：`feat/a4-subtitle-export`
**子任务**：
- A4.1 后端字幕生成支持多格式
- A4.2 前端导出按钮（在 AudioResultPage / VideoResultPage）

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
**模型**：⭐ 小米（前端展示 + 后端 PIL 一行）
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
| 3 | ⭐ **小米 2.5 Pro**（终端，免费）| 模板代码 / git / 单文件改 / CSS / 测试模板 / 文档 |
| 4 | **Haiku 4.5**（桌面）| 单行 typo / 小米暂时不可用时的兜底 |

⭐ **日常默认走小米**，能用就用。

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

> 这一节是给所有 AI 工具（Claude / 小米 / Codex / Cursor）的纪律。

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
F1 Tier B 后端（路径 1/3 + 字幕清洗）   ← 当前在这里
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
