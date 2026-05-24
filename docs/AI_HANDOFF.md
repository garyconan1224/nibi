# AI Handoff

Last updated: 2026-05-24（**当前阶段 = Phase R 输入层重构**，详见 `docs/plans/phase-r-input-refactor.md`）

---

## 🔴 当前下一步（2026-05-24 拍板，覆盖下面所有"下一步"段）

**Phase R — 首页输入层重构**（in_progress，分支 `feat/phase-r-input-refactor` 待 R0 创建）

- 计划文件：[`docs/plans/phase-r-input-refactor.md`](plans/phase-r-input-refactor.md)
- 起因：Composer.tsx 把 SPEC §3.1 的三层配置压成一层，首页全是死按钮
- 范围：Composer 瘦身 + AddMaterialModal 重写为「4 步合一」+ 单链接多类型循环入队 + ~~R3.1 添加素材二级界面 Remix 风格化~~ ✅ 已完成
- 拆分：R0~R6 可独立 commit 的子任务，含模型档位与升 Opus 触发条件
- 当前进度：R0 ✅ / R1 ✅ / R2 ✅ / R3 ✅ / R3.1 ✅ → **下一步 R4 PreflightDrawer 接管细粒度参数**
- **R 做完前不要启动 Track T / [C] / [D] / N7b / N8b**，下面历史的「下一步」段都不算数

---

## 启动必读

每次新会话先对账，不要直接相信本文件：

```bash
git status --short --branch
git log --oneline -10
git branch --show-current
```

然后按顺序读：

1. `AGENTS.md`
2. `docs/WORKFLOW.md`
3. `docs/SPEC.md`
4. `docs/EXECUTION_PLAN.md`
5. **`docs/ROADMAP.md`**（2026-05-21 新增——长期升级路线图，6 条 track 全景视图）
6. `docs/design/`（如需视觉对照）
7. 本文件「下一步」段

涉及用户流程图时，Claude Code 终端先读 `docs/flows/README.md` 和对应 `docs/flows/*.md`，必要时再看 PNG。

---

## 2026-05-20 一日完成清单

**H 系列设计稿 1:1 复刻**（merge 入 main）：
- H1 Workbench 工作台首页（5 子任务）
- H2 Taskboard 任务中心 9 Tab（4 子任务）
- H3 Processing 处理中（含 SSE 接线）
- H4 Results 4 子结果页（视/音/图/文 CSS 改造）
- H5 Storyboard 分镜页（D2 方案 A markdown 直展，shot 网格留 [C]）

**Integration Pass（IP.1~IP.8）**——把"死按钮死参数"全部接通：
- IP.1 Composer 高级参数透传到 Preflight
- IP.2 Composer 上传按钮接 AddMaterialModal
- IP.3 TaskboardHead 编辑背景接 BackgroundEditor
- IP.4 TagsTab 加编辑能力
- IP.5 Storyboard 触发入口（MaterialCard 菜单）
- IP.6 Composer 工作空间选择真传后端
- IP.7 **PreflightDrawer 真接 workspace 流程 + LLM 自动建空间**（修阻塞 bug）
- IP.8 Connection Audit：Compare Tab / 顶栏 system stats / 提示词风格 select / 资料库入口 / 快速抽字幕 / N4 复核

**清理与修复**：
- 后端 bug：TaskRunner.append_log 缺失（download 任务从此能跑）
- IP.8.6-fix：N4 默认勾选 4 处对齐设计稿
- H2.6：删除旧 WorkspaceDetail.tsx + WorkspaceSearchBar.tsx（-680 行）

**当前 main**：`f33db14 merge: feat/ip9-flow-gaps into main`

---

## 2026-05-21 调整方向

用户决议：**不去 [C] / [D]**，先把现有功能跟流程图对齐打磨。流程图文本镜像在 `docs/flows/*.md`，源 PNG 在 `docs/conversation-inputs/2026-05-18-spec-merge/`。新长期路线图 `docs/ROADMAP.md` 6 条 track 已落盘。

**IP.9 Flow Gaps 已完成**（5 个 commit 合入 main）：
- IP.9.1 Results 总览页（s05）+ 修跳转 bug + 路由重命名
- IP.9.2 N8b 音频前端 6 任务勾选 + 结果页对应区块
- IP.9.3 N7b 视频路径选择 UI（3 路径 + 视频类型模板）
- IP.9.fix align Tier A UI with pipeline payloads

**N7b 路径 1 已完成**（2026-05-21，3 个 commit 合入 main）：
- `f17c04a` feat(N7b): 视频路径 1 字幕直接总结后端
- `aac4578` fix(N7b): ResultsOverview 正确返回路径 1 字幕总结结果
- `9e8667e` fix(N7b): transcript 数组契约修复 + 前端防御 + 测试
- transcript 数组契约已对齐（string → VideoResultTranscriptLine[]）

**N7b 路径 1 UI 收口**（2026-05-21）：
- PreflightDrawer 加摘要路径选择（tasks.summary.path = "subtitle"）
- VideoResultPage 路径 1 空态修复（字幕总结模式：summary + transcript 展示）
- VideoResult 类型扩展（summary_path / summary / video_template）
- 文档残留修复（待提交 → 9e8667e）

**N7b 路径 3 待实现**：视频模型直接分析（依赖 Gemini / GPT-4o / Qwen-VL API 集成决策）
**N8b 待实现**：音频 librosa 分析（6 维度切分）

具体执行索引去 `docs/ROADMAP.md` §3~§8 看对应 track，再去 plan md 看子任务步骤。

---

## 下一步（按 ROI 排序，明天接力会话直接选）

### ✅ Phase L 资料库聚合页（2026-05-22 已完成）

- L1~L4 全部合入 main（`826c311` / `249e2f0` / `d5e5a7e` / `cd41720`）
- 侧边栏「资料库」已从 `/search` 改为 `/library`
- 功能：chip 筛选（全部/视频/音频/图片/文字/工作空间） + 6 种排序 + grid/list 切换 + 状态持久化
- ItemCard → Results / WorkspaceCard → Taskboard 下钻正常
- 缩略图优先级链：平台封面 > 视频首帧 > 类型图标
- 批量删除 + 单项删除 + 选择模式（进入选择模式不自动全选，点卡片任意位置切换选中）
- 验证：后端 pytest / 前端 test / 前端 build / `/library` 浏览器结构化冒烟通过；full lint 仍被项目存量规则挡住

### ✅ F1.6 字幕清洗基础版（2026-05-22 已完成）

- `shared/transcript_cleaner.py`：规则去填充词 + 去重复行 + 合并短句 + LLM 润色（修错字/标点/专有名词）
- 已集成到 `_run_subtitle_summary()` 路径 1 流程：ASR → 清洗 → 总结
- 26 个单测全绿，163 个后端测试无回归
- Commit：`629fe60 fix(F1.6): allow subtitle path without API key`

### ✅ F2 路径 1 时间戳 + duration 修复（2026-05-22 已完成）

- `2700349` fix(F2): 路径 1 transcript 时间戳丢失——Whisper segments 保留并透传
- `b9eab81` fix(F2): align cleaned transcript text with segments
- `653c286` fix(F2): propagate subtitle path duration to result
  - `_run_subtitle_summary` 返回 `duration_sec`（从 segments 最大 end 推导）
  - `get_item_result` 透传到 `video.duration_sec` 和 `tracks_meta.total_sec`
  - 旧数据（无 duration_sec）fallback 到 0
- `7efd459` fix(test): e2e_qa.py 适配当前 FastAPI 架构（移除 Streamlit 遗留引用）
- `6502b3a` docs: AGENTS.md 补充项目指令 section header
- 169 个后端测试全绿，e2e_qa 12/12 全通过

### ✅ F2 Bug3 yt-dlp 格式降级重试（2026-05-22 已完成）

- `shared/video_download_ytdlp.py`：`run_ytdlp_download()` 增加格式降级链
  - 降级顺序：首选格式 → `bv*+ba/b`（B站 DASH）→ `bestvideo+bestaudio/best`（YouTube DASH）→ `worst`（兜底）
  - 每个格式尝试完整的 cookie/proxy/browser 组合后再降级
  - 所有格式失败时 `error_full` 包含完整降级链路信息
- `tests/backend/test_video_download_ytdlp.py`：6 个单测覆盖首选成功、fallback 成功、全失败保留错误、去重、非可重试错误触发降级
- **冒烟测试**：真实 B站 URL `BV1qA5j6jEJC` 下载成功
  - `best` 格式在 B站不可用（6 次 attempt 均 "format not available"）
  - B站 format-stripping 自动降级成功 → 产出 AV1 852×480 / 2.4 MB / 70.8s
  - 175 个后端测试全绿（+6 new），e2e_qa 12/12 全通过
- **Commit**：`53620b9` fix(F2): yt-dlp format fallback retry chain

### ✅ F1.7 URL 规整 + 真实前端冒烟（2026-05-22 已完成）

- 前端 `frontend/src/lib/url.ts`：`normalizeMediaUrl()` 处理纯 BV 号/缺 scheme/追踪参数/尾斜杠
- 后端 `_normalize_media_url()` + `_normalize_url_for_dedup()` 兜底
- `platforms.ts::detectPlatform()` scheme 容错
- 冒烟验证：后端 curl 确认追踪参数被剥离；前端平台检测 Bilibili 正确
- 新增 15 个单测（前端 6 + 后端 9），全量 183 通过
- **Commit**：`170ec0b` feat(F1.7): URL 规整——前后端双端清洗追踪参数 + 去重标准化

### ✅ F2 真端到端冒烟测试（2026-05-22 已完成 8/10）

**结果**：8/10 URL 通过，3 个 Bug 已修。详细记录在 `docs/plans/phase-f2-smoke.md`。

**已修 Bug**：
- `00bc28c` Bug A：task_runner 硬编码 DOWNLOAD → 按 task_type 映射初始状态
- `489cc76` Bug B：preflight 布尔型标志未触发 N7b 路径 → 兜底 `summary_path="subtitle"`
- `c366226` Bug C：本地文件显示名覆盖实际文件名 → local source 始终用 source_value 取文件名

**URL 验证结果**：
| # | 平台 | 状态 |
|---|------|------|
| 1-3 | B站 x3 | ✅ 全链路通 |
| 4 | YouTube | ✅ 代理已配，N7b 通 |
| 5 | YouTube Shorts | ✅ VLM 路径（空 preflight 默认 VLM 非 N7b，已知行为） |
| 6-8 | 小红书/抖音/微信 | ⏳ 缺真实 URL |
| 9 | 本地 .mp4 | ✅ N7b 路径1，转录+总结正确 |
| 10 | 本地 .mp3 | ✅ 音频管道通，VAD 对歌曲误判（known limitation） |

### ✅ V2.2/V2.3 视频输出格式选择 + 提示词模板（2026-05-23 已完成）

- V2.2 输出格式 UI：PreflightDrawer 路径 1 增加 4 种格式 radio（摘要/要点/金句/段落改写）
- V2.3 后端 4 套 prompt 模板：`_OUTPUT_FORMAT_PROMPTS` dict，`_build_video_summary_prompt` 按 `output_format` 切换
- `output_format` 通过 preflight → `_augment_video_analyze_payload` → `_run_subtitle_summary` 全链路透传
- 旧数据兼容：未传 `output_format` 默认 `summary`（原摘要逻辑）
- 新增 5 个测试，全量 239 后端 test + 15 前端 test + build 通过

### ✅ V3.2 视频模板设置页 CRUD（2026-05-23 已完成）

- `shared/template_store.py`：JSON 持久化层，CRUD + duplicate
- `backend/app/routes/templates.py`：5 个端点（GET/POST/PUT/DELETE/duplicate）
- `backend/app/services/pipeline_tasks.py`：`list_video_templates()` 合并内置 + 用户自定义
- `frontend/src/pages/SettingPage/VideoTemplatesPage.tsx`：列表 + 新建/编辑模态 + 内置保护
- `frontend/src/store/templateStore.ts`：zustand 缓存，PreflightDrawer 自动拉取
- 路由 `/settings/video-templates` + SettingsShell Tab 已注册
- 测试：20 个 V3.2 后端测试覆盖 CRUD happy/error/空白输入路径，全量 259 passed / 2 skipped
- `_build_video_summary_prompt` 已改用 `list_video_templates()` 动态模板

### ✅ V3.3 LLM 自动检测视频模板（2026-05-23 已完成）

- `backend/app/services/pipeline_tasks.py`：新增 `_detect_video_template(title, transcript_preview)`，用默认 LLM 单轮分类，失败兜底 `其它`
- `_run_subtitle_summary`：`video_template="auto"` 时先检测，再把 `detected_template` 写入 task result
- `PreflightDrawer`：路径 1 默认提交 `video_template="auto"`，不点下拉即可触发自动检测
- `VideoResultPage`：有检测结果时显示「自动识别：xxx」
- 测试：后端全量 265 passed / 2 skipped；前端 build + vitest 通过；full lint 仍被 47 个存量 error 挡住
- 已知后续增强：同一 item 重新执行时暂不缓存检测结果，会重新调用一次 LLM

### 🥇 下一步：Track A 音频深化

按 `docs/ROADMAP.md` §11，V2 + V3 完成后继续做 **A2 + A3 + A4（音频深化）**；`[C] AI 导演` 与 `[D] 开源准备` 仍排在后面，暂不启动。

### ✅ A4 字幕导出（2026-05-23 已完成）

- 后端：`GET /workspaces/{workspace_id}/items/{item_id}/subtitles?format=srt|vtt|ass`
- 格式：`.srt` / `.vtt` / `.ass`，支持 `segments` / `transcript_segments` / display `transcript(t_sec)` 三类结果结构
- 数据源：优先读 task overlay，其次读 `item.results`；demo result 页有占位字幕时，导出端点也保持一致 fallback
- 前端：AudioResultPage / VideoResultPage 增加「字幕」下拉导出按钮
- 额外修复：`auto-create` 去掉同步 LLM 命名，避免 15s 前端超时
- 验证：后端全量 268 passed / 2 skipped；前端 build + vitest 通过；full lint 仍被 47 个存量 error 挡住

### ✅ A3 无人声切音乐模式（2026-05-23 已完成）

- 后端：`AWAITING_CONFIRM` 状态 + `POST /pipeline/tasks/{id}/confirm-music` 端点 + 任务重提交机制
- VAD 分叉：speech_ratio < 20% + 未勾音乐分析 → 弹窗；已勾 → 直接音乐分析；music_mode_confirmed 重跑 → 跳过 ASR
- A3.3：`segment_audio()` + `analyze_music_segments()`（librosa onset + RMS 能量分段）+ 前端分段卡片网格（6 维度）
- 前端：`MusicModeConfirmModal`（Radix Dialog）+ ProcessingPage 接入 + AudioResultPage banner + 默认 music tab
- LLM 逐段 enrich（风格/情绪/乐器/氛围）留作 A3.3b 后续
- 测试：11 个 A3 单测通过；全量 279 passed / 2 skipped

单 agent 串行建议：
1. **Track T 文字深化**：先做 T1 文字结果页升级。用户已拍板两条硬要求：
   - 点击金句 / 要点必须精确跳到左侧原文位置；金句需 substring 校验，要点需 `source_excerpt` 锚点，不能做近似跳转。
   - 「改写 · 翻译」tab 内做逐段对照：左原文段落，右当前改写 / 译文，按段落序号稳定对齐。

### 🥈 补 #6~#8 URL + 收口 F2

用户提供小红书、抖音、微信公众号各一个真实 URL，跑完 F2 剩余 3 个，然后：
1. 更新 `phase-f2-smoke.md` 完工标准全打勾
2. ROADMAP §3 F2 打 `[x]`
3. 决策下一步：F3 错误体验优化 或 A1/V1/I1 并行

### 🥉 路线选择（待定）

**路线 A：[C] AI 导演**（4-7 天，Opus 体力活）
- 需先补完整 director 设计（当前 system_design v1.1 缺交互细节）
- 拍板生成模型 API 选型（Midjourney / Flux / SD / Sora）
- 内容：Style 报告 + Storyboard shot 网格升级 + 生成预览 + .fcpxml 导出 + A/B Compare 视频版

**路线 B：[D] 开源准备**（2-3 天）
- 加密 / CI / push 策略解除 / 仓库整理
- 让项目能被外人 clone 跑起来
- 是 v1.0.0 发布的前置

### 🥉 独立小活（任意穿插，不影响冒烟路线）

- **N7b 路径 3** 视频模型直接分析（8-12h，依赖 Gemini / GPT-4o / Qwen-VL API 集成决策）
- **N8b** 音频前端交互（6-8h，无人声切音乐弹窗 / 说话人修正 / 6 维度切分）

---

## 决策与约定速查

- **Push 策略**：暂缓所有 `git push origin`，等做到 `[D]` 阶段统一推。本地 main 越来越领先 origin/main 是预期状态
- **Phase merge 默认**：完工默认 merge 进 main，开新 phase 默认上一个已 merge
- **Tag 策略**：不按 SemVer 自动打，等"功能都差不多"统一打（那时就是开源时刻）
- **模型分配**：
  - 简单/模板/git/CSS → ⭐ DS v4-pro（Claude Code + ccswitch，便宜优先；v4-flash 太弱别当默认）
  - 中等多文件 React → Sonnet 4.6
  - 跨 5+ 文件 / 状态机 / 加密 → Opus 4.7
- **设计稿源**：`docs/design/components/*.jsx` + `styles.css` + `VidMirror.html`（Taskboard CSS 大部分在 HTML 不在 styles.css）

---

## 已知风险 / TODO

- N7b / N8b 仍延后，独立可做
- StoryboardPage 当前是 markdown 直展，shot-by-shot 网格留给 [C]
- 「导出 .fcpxml」/「生成预览」按钮显式禁用 + PHASE C pill
- 视频对比（image_compare / text_compare 已通，但视频/音频对比后端无接口）
- 设计稿「12 屏概览」/ AI 导演侧栏 仍禁用，等 [C]
