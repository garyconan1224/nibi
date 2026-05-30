# 项目执行计划总索引

> **本文件作用**：项目级共享执行计划。任何 AI 工具（Claude / 小米 / Codex / Cursor）开新会话只要读这一份就能知道：① 整个项目要做什么、② 当前到哪一步、③ 下一步去读哪个详细计划文件、④ 如何对账避免重做。
>
> **维护规则见 CLAUDE.md「项目执行计划维护流程」一节**。
>
> Last updated: 2026-05-30（RP1-A 已完成，下一步 RP1-B）

---

## 使用方法（每个新会话开始时跑一遍）

1. 读本文件，找到第一个未打勾的子任务
2. 如果是 N1~N11 阶段，先读 `docs/SPEC.md` 索引，再读 `docs/spec/` 对应模块理解产品需求
3. 如果该子任务有对应的 `docs/plans/<file>.md` 详细计划：
   - 若 `status: pending` 且操作步骤段是 `TODO` → 停下问用户「要先展开这个 phase 的具体执行计划吗？」
   - 若 `status: ready` 或 `in_progress` 且已有操作步骤 → 按里面的步骤执行
4. 每完成一个子任务，在本文件勾上对应方框，并按"流程"更新 `docs/COMPLETED_WORK.md`

---

## 当前执行入口（2026-05-29 对账更新 · followup 已 merge）

> 真实状态以 git log 为准。R21.P3.S3 followup 已 merge（`6740a3a`）。下一步 = **音视频端到端闭环**，先修 S0 数据基线 bug（用户 2026-05-29 决议：先修当前问题 → 搭架构 → 按使用流程逐链路优化）。
> - 合并视图（先读）：[`docs/PROJECT_STATUS.md`](PROJECT_STATUS.md)
> - S0 详细计划：[`docs/plans/phase-e2e-bugfix-2026-05-29.md`](plans/phase-e2e-bugfix-2026-05-29.md)（`status: ready`，可直接执行）
> - S1-S6 详细计划：[`docs/plans/phase-handoff-mimo-2026-05-29.md`](plans/phase-handoff-mimo-2026-05-29.md)
> - ⚠️ **对账差异（执行前必看 PROJECT_STATUS §5）**：N8b librosa 6 维**已大部分实现**（勿从零做）/ R20 是在 export.py 上**加格式** / N7b 路径3 仍是 stub（卡 Gemini API）。

**P0 · 修复当前问题（S0 E2E bugfix，先做、必修）**
- [x] S0.1 删 `/subtitles` demo 兜底（🔴P1）→ 分支 `fix/e2e-p1-subtitles-no-demo`
- [x] S0.2 `get_audio_result` 的 has_real 认 transcript_segments（🔴P1）→ `fix/e2e-p1-audio-result-has-real`
- [x] S0.3 visual_only 前端禁 SRT 按钮（🟠P1+）→ `fix/e2e-p1-visual-only-srt-disabled`
- [x] S0.4 ResultsOverview React key 警告（🟡P2）→ `fix/e2e-p2-results-overview-key`（真凶：frames 的 key={f.idx} 在 idx 未定义时失效，已修复 + AppShell stats 防御 + vite proxy 加 /admin）
- [x] S0.5 visual_only 隐藏播放器（⚪P3）→ `fix/e2e-p3-visual-only-no-player`
- [x] S0.6 B站 yt-dlp 412 前置（⚪P3）→ `fix/e2e-p3-bilibili-format-precedence`
- [x] S0.7 VLM 进度每 5% 上报（⚪P3）→ `fix/e2e-p3-vlm-progress-granular`
- [ ] S0.8 Composer URL input（⚪P3，默认跳过）

**P1 · 搭架构 + 整理仓库**
- [x] S1 plans 老 done 归档 + 死链修复
- [x] S2 Streamlit 入口冻结标记（Streamlit 不存在，改为修正 CLAUDE.md §1）
- [x] S3 未用 assets 清理（删 icons.svg + 修正 CLAUDE.md §1 Streamlit 描述）
- [x] S4 N7b 路径3 Gemini 后端骨架 + mock 单测（无 API；**开工前先确认接口形态**）
- [x] 核实 N8b librosa 6 维真实缺口 — S5 已核实（后端+UI 早在 A3.3 实现）+ 修 music_segments 映射 bug（`bdd3fb3`）
- [x] S6 R20 笔记 pdf/docx/obsidian 导出（**装 reportlab/python-docx 前停下问用户**）

- [x] **L5 Library Remix Polish**（已完成并合入 main）—— `/library` 资料库聚合页对齐 Remix 设计稿。

---

## 进度总览（打勾 = 已合并入 main）

### 已完成阶段（Phase 0 ~ 3C）

> 以下阶段已全部完成并合并入 main。详细记录见 [`docs/COMPLETED_WORK.md`](COMPLETED_WORK.md)。

- [x] **Phase 0** — 设计令牌 + AppShell
- [x] **Phase 1** — MVP 主干（v1.0.0-mvp）
  - [x] 1A 任务列表 API 补字段
  - [x] 1B 任务列表前端
  - [x] 1C 设置 → 模型管理
  - [x] 1D 任务详情骨架 + 输入层
  - [x] 1E 前置配置面板
  - [x] 1F Pipeline + SSE 进度条
  - [x] 1G 视频结果页 + 三轨时间轴
  - [x] 1H 图片结果页
  - [x] 1I 工作包 zip 导出
  - [x] 1J 老代码清理 + Phase 1 收口
  - [x] Phase X 主干竖切（TEXT/IMAGE/VIDEO/AUDIO）
- [x] **Phase 2** — 内容能力扩展
  - [x] 2A LLM 对话侧栏 + 收藏夹
  - [x] 2B 音频结果页
  - [x] 2C.1 文本输入层（PDF/DOCX/网页）
  - [x] 2C.2 文本结果页 + 提示词版本栈
  - [x] 2D SQLite 切换评估（结论：暂不切）
- [x] **Phase 3A~3C** — 知识库 + 工作空间整顿
  - [x] 3A 视频工作台清理
  - [x] 3B 知识库 UI（跨工作空间 RAG 检索）
  - [x] 3C 标签库 7 维度

### N1~N11「合并 spec 落地差异」（当前主线）

> 来源：`docs/SPEC.md` 附录 C.2。每个 Phase 的具体子任务在进入时再展开（pending → ready → done）。

- [x] **N1** 任务系统差异：trashed/analyzed 状态 / 软删除垃圾桶 / 删 WorkspaceRecord 上层 project_id — `4-6h` P0
- [x] **N1b** 磁盘布局 `data/projects/<project_id>/...` → `data/workspaces/<workspace_id>/...` + 老数据搬家 — `6-10h` P1（从 N1 拆出）
- [x] **N2** 侧边栏从 8 砍到 4 + Taskboard 子标签 5→4（隐藏「导出」入口）— `2-3h` P0
- [x] **N3** 设置页重组 9→7（合并分析默认偏好 / 模型与渠道 / 新增任务垃圾桶）— `6-8h` P0
- [x] **N4** 添加素材模态升级（4 步合一 + 自动识别类型 + 智能默认勾选 + 背景信息折叠）— `4-5h` P1
- [x] **N5** Preflight 抽屉细化（按素材类型展开所有子参数）— `4-6h` P1
- [x] **N6** 任务级 LLM 对话上下文素材多选 chip + RAG 兜底 — `6-8h` P1
- [x] **N7** 视频分支补全：PySceneDetect AI 镜头分析（路径 1 & 3 拆出 N7b）— `8-10h` P2
- [x] **N7b 路径 1** 视频字幕直接总结 — `4h` P2（`f17c04a` `aac4578` `9e8667e` `92fbdb9` `bf995d7`）。音频提取 → Whisper 转写 → 6 种模板 LLM 总结，transcript 数组契约已对齐 + UI 收口。
- [ ] **N7b 路径 3** 视频模型直接分析（Gemini）— 骨架 + 真实联调代码**已就绪**（ACTIVE 轮询 / JSON 容错 / 中文文件名，381 单测绿，`2b5ac3d`）；**搁置待付费 Gemini API**（free tier 视频配额墙，代码到位即可端到端通）。
- [x] **N8** 音频分支补全：VAD（silero）/ pyannote 说话人 / 音乐分析（librosa + Suno/Udio）— `8-10h` P2
- [x] **N8b** 音频前端交互：无人声切音乐模式弹窗 / 说话人标签人工修正 UI / 多段音乐 6 维度切分 — `6-8h` P3 *后端+UI 已实现（A3.3），本次修 music_segments 映射 bug 收尾*
- [x] **N9** 图片分支补全：PaddleOCR / 4 联想方向 / 多图对比 — `6-8h` P2
- [x] **N10** 文字分支补全：marker/docling PDF / 改写翻译并排对照 / 多文对比 — `6-8h` P2
- [x] **N11** 砍掉的 UI 清理（仅入口隐藏，代码留备份）— `1-2h` P3

### H 系列「首页 / 设计稿 1:1 复刻」（用户决议 2026-05-19）

- [x] **H1** 工作台（Workbench）1:1 复刻，`/` 路由切换为新首页 — `12-18h` P2
  - [x] H1.1 设计 tokens + `DESIGN_SYSTEM.md`（小米）— 2-3h
  - [x] H1.2 WorkbenchPage 静态骨架（Sonnet 4.6）— 4-6h
  - [x] H1.3 Composer 接后端（小米）— 3-4h
  - [x] H1.4 平台检测 + 混合内容弹窗 + Preflight 接入（小米）— 2-3h
  - [x] H1.5 路由切换 + 侧边栏图标系统（小米）— 1-2h
- [x] **H2** Taskboard 任务中心 1:1 复刻（重做 /workspaces/:id）— `15-20h` P2
  - [x] H2.1 骨架 + 头部 + 9 Tab nav（Sonnet 4.6）
  - [x] H2.2 Materials Tab 素材网格（Sonnet 4.6）
  - [x] H2.3 Queue + Favorites + Versions 整合（小米）
  - [x] H2.4 Tags + Chat + Export Tab（Sonnet 4.6）
  - [ ] H2.5+ Style + A/B 对比（押后到 [C] 一起做）
  - [x] H2.6 删除旧 WorkspaceDetail.tsx + WorkspaceSearchBar.tsx（-680 行）

详细执行计划：[docs/plans/archive/phase-h2-taskboard.md](plans/archive/phase-h2-taskboard.md)
- [x] **H3** Processing 处理中页面 1:1 复刻 — `4-6h` P2（方案 A 新路由）
  - [x] H3.1 ProcessingPage 骨架 + SSE 接线（⭐ 小米）

- [x] **H4** Results 结果页 1:1 复刻（4 子页）— `10-14h` P2
  - [x] H4.1 VideoResultPage 改造（⭐ 小米）— 3-4h
  - [x] H4.2 AudioResultPage 改造（⭐ 小米）— 3-4h
  - [x] H4.3 ImageResultPage 改造（⭐ 小米）— 2-3h
  - [x] H4.4 TextResultPage 改造（⭐ 小米）— 2-3h

- [x] **H5** Storyboard 分镜页 1:1 复刻 — 实际 ~4h（spike 后大幅简化）
  - [x] H5.1 后端 spike + D1/D2/D3 决议（Opus 4.7）
  - [x] H5.2 StoryboardPage 方案 A markdown 直展（Opus 4.7）
  - [ ] ~~H5.3 生成按钮~~ → 押后到 [C]（按钮已禁用 + PHASE C pill）

详细执行计划：[docs/plans/archive/phase-h3-processing.md](plans/archive/phase-h3-processing.md) / [phase-h4-results.md](plans/archive/phase-h4-results.md) / [phase-h5-storyboard.md](plans/archive/phase-h5-storyboard.md)

详细执行计划：[docs/plans/archive/phase-h1-workbench.md](plans/archive/phase-h1-workbench.md)

### 结果页内容补齐 · RP1（2026-05-30 启动，三子 phase 串行）

> 详细计划：[docs/plans/result-pages-redesign-v1.md](plans/result-pages-redesign-v1.md)
> 2026-05-30 用户澄清产品边界：**复刻 = 帧→反推提示词（理解型，本期做）**；**AI 导演 = 改提示词→生成新内容（生成型，仍延后）**。两者不再混为一谈。

- [x] **RP1-A 音频结果页打磨** — 字幕在线编辑+跳转 / 说话人改名 / 总结模板入口 / 音乐分析三 sub-tab "全家桶"（素材库·报告·拆解）— 12-16h，P0 → `8c3e987` `3143a3f` `fbd8e53` `2729e70`（2026-05-30）
- [x] **RP1-A 主题修复 + 页面整合** — next-themes 统一 class+data-theme / 挂 ThemeSwitcher / dark accent tokens / 删 ItemTagsPanel 重复 / 返回总览 / 打开详情按钮 — 3-4h，P1（2026-05-30）
- [ ] **RP1-B 音视频学习笔记页（ln）重做** — 双栏布局 / 字幕跟随 / HTML-MD 双向同步 / 在线编辑 / 截图插光标处 / TOC 时间戳 / 多格式导出 / 页内 AI 问答抽屉 — 25-35h，P1
  - [x] B-1 学习笔记页双栏 + 视频播放器（接通视频源 + ln.md 路径 + 设计稿样式对齐）→ `8a5c57b`（2026-05-30）
  - [x] B-2 字幕轨跟随 + 点击 seek → `73733b5`（2026-05-30）
- [ ] **RP1-C 视频复刻页增强** — 主帧大视图 + 缩略图轨道 / 批量复刻包导出 / 提示词在线编辑+版本 / 与笔记页联动切换 — 12-18h，P2

### 延后阶段（RP1 之后）

- [ ] **[C] AI 导演模块** — 基于复刻结果的下一步：按需求改提示词生成新内容（A/B 对比 / 风格 DNA 报告 / 接入可灵 / 即梦 / MJ / Suno 等生成 API）。需先补完整设计稿。
- [ ] **[D] 安全 + 开源准备** — v1.0.0 发布。含加密改造 / CI / push 策略解除 / 仓库整理。

---

## 当前下一步

**N1~N11 主线全部完成**。用户 2026-05-19 决议：先做 H 系列首页复刻，N7b/N8b 后做，[C]/[D] 最后。

**Integration Pass（IP）已完成**（2026-05-20）：UI ↔ 后端对接补齐，6 个子任务全部合入 main。
- [x] IP.1 Composer 高级参数透传到 Preflight
- [x] IP.2 Composer 上传按钮接 AddMaterialModal
- [x] IP.3 TaskboardHead 编辑背景接 BackgroundEditor
- [x] IP.4 TagsTab 加编辑能力
- [x] IP.5 Storyboard 触发入口
- [x] IP.6 Composer 工作空间选择真传后端
- [x] IP.7 PreflightDrawer 真接 workspace 流程 + 自动建空间（修 URL 任务跑不通）
- 后端 bug 修复：TaskRunner.append_log 缺失（download 任务从此不再 FAILED）

**IP.9 Flow Gaps 补齐**（2026-05-21）：Results 总览 + N7b/N8b UI + payload 对齐，5 个 commit 合入 main。
- [x] IP.9.1 Results 总览页（s05）+ 修跳转 bug + 路由重命名
- [x] IP.9.2 N8b 音频前端 6 任务勾选 + 结果页对应区块
- [x] IP.9.3 N7b 视频路径选择 UI（3 路径 + 视频类型模板）
- [x] IP.9.fix align Tier A UI with pipeline payloads

**Phase R 输入层重构**（2026-05-24 启动）：Composer 瘦身 + AddMaterialModal 4 步合一 + 单链接多类型循环入队。详细计划：[docs/plans/archive/phase-r-input-refactor.md](plans/archive/phase-r-input-refactor.md)
- [x] R0 准备分支 `feat/phase-r-input-refactor`
- [x] R1 Composer 瘦身（删 6 块死 UI）
- [x] R2 AddMaterialModal 重写为 4 步合一统一入口
- [x] R3 featuresToSteps 翻译层 + 单 URL 多类型循环入队
- [x] R3.1 AddMaterialModal Remix 风格化（点击添加素材后的二级界面）
- [x] R4 PreflightDrawer 接管细粒度参数
- [x] R5 端到端冒烟 6 条链接（含误判修复：createNoteTask material_type 分派 / note analyze 传 capture_params / 小红书 yt-dlp 缩略图兜底）
- [x] R6 合并 main + 文档同步
- [x] R7 输入流统一收尾：单 URL 多类型默认全勾 / stage 模式统一解析出口 / Hero 文案精简
- [x] R8 PreflightDrawer Remix 1:1 复刻：media tabs / 任务卡片 / 级联锁定 / R8 tasks payload 落地
- [x] R10 平台 URL 音频抽取 hotfix + FloatingTaskQueue v2：yt-dlp bestaudio / 取消 / 重试 / FAILED 本地隐藏 / 批量操作
- [x] R11 设计稿同步 canonicalize：设计 tokens / processing / library / taskboard / detail 组件源文件同步落盘
- [x] R12 ProcessingPage 1:1 复刻：真实标题/封面/stats、step-stream 日志、系统资源卡、任务侧栏卡（`feat/phase-r12-processing-page-replica` 已完成，待用户授权本地 merge）
- [x] **R13** ProcessingPage 元数据贯通 + 体验修复（`feat/phase-r13-processing-metadata-followup`）
  - [x] R13.1 download SUCCESS 时把 yt-dlp metadata 复制到 analyze.payload
  - [x] R13.2 ProcessingPage 兜底读 payload.video_title 以支持 analyze 阶段
  - [x] R13.3 标题加平台前缀（bilibili · 视频名 格式）
  - [x] R13.4 download 完成后回写自动建空间名为「平台 · 视频标题」
  - [x] R13.5 取消 ProcessingPage 自动跳转，改为按钮触发
- [x] **R13.6** yt-dlp metadata 覆盖到 audio/note handler（`feat/phase-r13.6-metadata-coverage-hotfix`）
  - [x] R13.6.1 抽出共享工具 `_apply_ytdlp_metadata_to_task` + workspace 改名工具
  - [x] R13.6.2 handle_audio_task 调用共享工具回写 metadata
  - [x] R13.6.3 handle_note_task download 步骤调用共享工具回写 metadata
  - [x] R13.6.4 全套验证 + 文档同步（单测 327 pass / build OK）

---

**H 系列 + IP 系列全部完工**（2026-05-20，一日产出 ~30 个 commit）：
- H1~H5 设计稿 1:1 复刻 ✅
- IP.1~IP.8 Connection Audit（死按钮死参数清零 + 所有现存后端接到 UI）✅
- 阻塞 bug 修复：TaskRunner.append_log / PreflightDrawer 绕过桥接 ✅
- 清理：H2.6 删旧 WorkspaceDetail（-680 行）✅

**R14~R21 系列全部完工并合入 main**（2026-05-25 ~ 2026-05-29，以 git log 为准对账）：
- R14 多类型 dedup UX / R15 early-metadata / R16 ProcessingPage 音频适配 ✅
- R17 chip 重构（引入 av_synthesis 综合笔记 chip）✅
- R18 / R18.1 PreflightDrawer Remix 复刻 + 本地 ASR + 失败弹窗 ✅
- R19 / R19d av_synthesis 图文笔记 pipeline + Markdown 导出 + export endpoint ✅
- R21.A1~A6 状态同步 6 bug + B1~B3 行为收口（2026-05-27 用户 11 条反馈中的 9 条已修）✅
- R21.P2 / P2.v3 模型选择挪到主界面 + capability 过滤 ✅
- R21.P3.S1 / S2 / S3 添加素材拆参数 / 多版本总结 SummariesTab / 对比 + 学习视频补图 ✅

**当前 HEAD**：分支 `fix/r21-p3-s3-followup`，R21.P3.S3 followup（preflight 顶层 intent 链路修复 + av_combined 补图入口）已 `status: done`，**待 merge 进 main**。

**当前下一步方向（用户 2026-05-29 决议）**：先把**音频 + 视频两条线从输入链接 → 任务 → 落地页完整端到端打通**，确保音视频闭环到位，再做文字 / 图片深化。性能优化（R22/R23）、AI 导演 [C]、开源 [D] 往后排。

短期任务池（按依赖排序）：
1. 🥇 **followup 分支 merge 进 main**（5min）—— R21.P3.S3 收尾收口
2. 🥇 **音视频端到端冒烟回归**（用户跑，~30min）—— 粘真实 B站/油管 URL，走完 download→ASR→frames→VLM→落地页，记录断点
3. 🥈 **N7b 路径3 视频大模型直接分析后端**（8-12h，Opus）—— UI 已就绪，**卡在 API 选型**（Gemini / GPT-4o / Qwen-VL，待用户拍板）
4. 🥈 **N8b 音频 librosa 6 维度切分后端**（6-8h，Sonnet）—— UI 已就绪
5. 🥉 **R20 笔记 PDF / Word / Obsidian 导出**（R19 押后项）

延后（音视频闭环后再做）：
- **T 文字深化 / I 图片深化**（EXIF / 批量 / 风格 DNA）
- **R22** 并行调度（issue 6）/ **R23** 性能档位（issue 9）—— 体验优化
- **[C] AI 导演模块**（需先补设计稿，后续用 Claude Design 更新）
- **[D] 安全 + 开源准备**

---

## Tag / 开源策略

用户决定：**不按 SemVer 节奏自动打 tag**。Tag 等到「功能都差不多」时统一打，**那时就是开源时刻**。在那之前每个 Phase 完成只 commit，不 tag。

- [x] **R14** 多类型去重 UX（`feat/phase-r14-multi-type-dedup-ux`）
- [x] **R15** Library + Remix 体验打磨（`feat/phase-l5-library-remix-polish`）
- [x] **R16** ProcessingPage 音频流程打磨
  - [x] R16.1 音频封面兜底 + music badge
  - [x] R16.2 音频任务跳过 FRAMES/VLM 步骤
  - [x] R16.3 ProcessingPage 长任务列表可滚动
- [x] **R17** AddMaterial 弹窗：分析范围与任务勾选/细调联动（`feat/phase-r17-add-material-scope-features`）
  - [x] R17.1 `featuresToSteps.ts` 新增 `FEATURES_BY_SCOPE` 映射
  - [x] R17.2 AddMaterialModal chips 按 scope 过滤 + 切 scope 清状态 + submit 防御过滤
  - [x] R17.3 `preflightTasks.ts` `applyCascades` 增 scope 参数 + visual_only/av_combined 级联
  - [x] R17.4 PreflightDrawer 透传 scope
  - [x] R17.5 新增单测 5 个（AddMaterialModal ×3 + preflightTasks ×2）
- [x] **R18** 主 chip 重构（visual=1 / audio=2 / av+⭐综合）+ PreflightDrawer 细调（9 种总结模板 + 字幕精修 + 截帧细调挪位）— `docs/plans/archive/phase-r18-preflight-drawer-templates.md`，owner: xiaomi mimo v2.5-pro，~8h
- [ ] **R18.1** 本地 ASR（fast-whisper + mlx-whisper 兜底）+ 任务失败弹窗 + 模型下载进度 — `docs/plans/archive/phase-r18.1-local-asr-and-failure-popup.md`，owner: xiaomi mimo v2.5-pro，~8h
- [x] **R19** 综合笔记 av_synthesis pipeline + Markdown 导出（骨架 C，无 OCR）— `326eb12` `fdbf4a7`，owner: xiaomi mimo v2.5-pro
- [x] **R20** 综合笔记多格式导出：PDF / Word / Obsidian Vault — `feat/phase-r20-notes-export` merge `f0e15f5`
- [ ] **R21** R19 上线后流程状态同步 bug 修 + 进度/资料库行为收口 — `docs/plans/archive/phase-r21-status-sync-bugfix.md`，owner: xiaomi mimo v2.5-pro，~10h
  - A 类 bug：步骤全 DONE / 任务面板重复 3 行 / SSE↔轮询不同步 / 截帧进度卡 30% / "查看结果" 点不动
  - B 类行为：未完成入口 disabled / 步骤日志补业务细节 / 右上角全局倒计时
  - [x] R21.P2 模型选择 + 截帧模式从细调挪到「添加素材」主界面 — `98e5f9d`
  - [x] R21.P2.v3 模型记忆即时存 + capability 过滤 + 砍细调 — `79eb2f5`
  - [x] **R21.P3.S1** AddMaterialModal 重构 —— 拆「采集参数」/ 视频用途模式 / 链接预填背景 — `docs/plans/archive/phase-r21-p3-s1-add-material-restructure.md`，~6-9h
  - [x] **R21.P3.S2** 结果页「总结」tab + item_summaries 表 + 多版本 CRUD — `docs/plans/archive/phase-r21-p3-s2-summaries-tab-and-table.md`，~8-12h，依赖 S1
  - [x] **R21.P3.S3** 总结对比模式 + 视频学习模式按需补图交互 — `docs/plans/archive/phase-r21-p3-s3-compare-and-learning-mode.md`，~6-10h，依赖 S2
  - [x] **R21.P3.S3 收尾** intent 链路修复 + av_combined 补图入口 — `docs/plans/archive/phase-r21-p3-s3-followup.md`，`0cf1e76` `ef633de`
- [x] **T2.2** 网页抓取预览模态 — link_preview 可选返回 readability 正文 + AddMaterialModal 正文预览区 — `feat/phase-t2.2-fetch-preview`，`0e90622` `8c708d2`
- [x] **T2.3** 微信公众号适配 — text_loader 检测 mp.weixin.qq.com 域名，xpath 直抽 #js_content 正文，回落 readability — `feat/phase-t2.3-wechat`，`ff71ff3` `37fbb8a`
- [x] **I1** 图片 EXIF 提取 + 基本信息卡 — handle_image_task 用 Pillow 提 EXIF（设备/镜头/光圈/快门/ISO/时间/GPS，IFDRational 转 str 保证序列化），ImageResultPage 按设计稿加基本信息+EXIF 卡 — `feat/phase-i1-exif`，`b32405f` `176e010`
- [x] **I2.1** 资料库批量分析（仅图片）— LibraryPage 选择模式工具栏加「批量分析」按钮，循环调 startItemPipeline，仅图片类型，非图片 toast 提示，复用浮动队列/结果页，零后端改动 — `feat/phase-i2-image-batch`，`5a3650b`
- [ ] **R22**（押后）Pipeline 并行调度：截帧 + 转写同时跑 — `docs/plans/phase-r22-parallel-pipeline.md`，~6-10h，依赖 R21
- [ ] **R23**（押后）设置面板：性能档位（CPU/GPU/内存→并发槽位）— `docs/plans/phase-r23-perf-tier-settings.md`，~4-6h，依赖 R22

---

## 归档说明

旧 Phase 3D~10 计划（`docs/plans/phase-3d-style-report.md` ~ `phase-10-extensibility.md`）已被合并 spec 取代，frontmatter 已标 `status: archived`。这些文件保留作历史参考，不再参与执行。
