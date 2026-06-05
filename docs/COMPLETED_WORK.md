# 已完成工作记录

> **本文件作用**：变更日志风格，记录每个已完成 Phase / 子任务的**详细内容**——不只是 commit hash，包含影响范围、关键改动、为什么这么做。**便于后续修改时查阅"为什么当时这么写"**。
>
> **维护规则**：每完成一个子任务，在本文件**追加**一段（不删旧记录），格式见下方"记录模板"。
>
> Last updated: 2026-06-05（Track K · R2 对照视图收口）

---

## Phase R13.6 — yt-dlp metadata 覆盖到 audio/note handler

**完成日期**：2026-05-26
**模型 / 工具**：DS v4-pro via ccswitch
**分支**：feat/phase-r13.6-metadata-coverage-hotfix
**提交**：
- R13.6.1：`9099a31` feat(phase-r13.6): 抽出 _apply_ytdlp_metadata_to_task + 共享 workspace 改名工具
- R13.6.2：`111f9f8` feat(phase-r13.6): handle_audio_task 回写 yt-dlp metadata
- R13.6.3：`2870cce` feat(phase-r13.6): handle_note_task download 步骤回写 yt-dlp metadata

### 问题
R13 只覆盖了 download → analyze 路径（_on_download_success 回调），但 audio/note handler 各自独立调用 yt-dlp，metadata 没有回写 task.result。用户实测：同 URL 多类型全勾后，audio 任务在 vlm 阶段显示 `bilibili · www.bilibili.com`（hostname fallback）。

### 影响范围
- **后端 pipeline_tasks.py**：新增 `_apply_ytdlp_metadata_to_task(record, runner, dl_result)` 共享工具；handle_audio_task、handle_note_task 调用 yt-dlp 后各加一行调用
- **后端 workspaces.py**：新增 `_maybe_rename_workspace_from_video_title(record, meta)` 共享工具；`_on_download_success` 内联逻辑改为调共享函数
- **测试**：新增 3 个测试文件（test_apply_ytdlp_metadata.py / test_audio_task_metadata.py / test_note_task_metadata.py）共 5 个用例

### 关键改动
- `_apply_ytdlp_metadata_to_task`：提取 dl_result 的 title/duration/uploader/thumbnail_url → 映射为 video_* key → 写入 runner.store + 触发 workspace 改名
- `_maybe_rename_workspace_from_video_title`：独立扫描 workspace items，找到引用 task_id 的自动生成 workspace 后改名
- audio handler L2032：yt-dlp bestaudio 返回后立即回写 metadata
- note handler L895：download 步骤 yt-dlp 返回后立即回写 metadata
- text/image handler 暂不处理（text 走 fetch_text 无 yt-dlp；image 无标题概念）

### 验证
- `.venv/bin/python -m pytest tests/backend -q`：327 passed / 2 skipped
- `cd frontend && pnpm build`：passed
- 原有 R13.4 测试、R13.1 测试全部通过（向后兼容）

---

## Phase R13 — ProcessingPage 元数据贯通 + 体验修复

**完成日期**：2026-05-25
**模型 / 工具**：DS v4-pro via ccswitch
**分支**：feat/phase-r13-processing-metadata-followup
**Commit**：5388b3d / dbe603a / d22212f / 95d4f7e / 62b9924 → merge e117f6e

### 影响范围
- **后端 pipeline_tasks.py**：_run_download_step 在 yt-dlp 后抽取 video_title/duration/uploader/thumbnail_url 写入 result
- **后端 workspaces.py**：_on_download_success R13.1 把 metadata copy 到 analyze.payload；R13.4 改 workspace name
- **前端 ProcessingPage**：R13.2 Hero 兜底读 payload.video_title；R13.3 标题加平台前缀；R13.5 取消自动跳转

### 关键改动
- R13.1：download SUCCESS → enqueue analyze 时把 video_* field copy 到 analyze payload
- R13.2：ProcessingPage title 优先 result.video_title，回退 payload.video_title（analyze 阶段用）
- R13.3：前端 `platformPrefixFromUrl()` + 后端 `_platform_prefix_from_url()` 双端覆盖 6 个平台
- R13.4：download 完成后扫描 workspace items，把自动生成名改写为「平台 · 视频标题」
- R13.5：取消 SSE.task_done → 自动跳转，改为"已完成，查看结果"按钮手动触发

### 为什么这么做
- analyze task 是 download 的派生任务，yt-dlp metadata 只在 download result 里，analyze handler 拿不到 → R13.1 通过 payload 桥接
- ProcessingPage 通过 SSE 展示进度，analyze 阶段需要 payload 里的 metadata 才能显示标题 → R13.2
- 用户期望看到「bilibili · 视频名」而非「www.bilibili.com」→ R13.3/R13.4

### 留给后续的影响
- 仅覆盖 video(URL)→download→analyze 路径，audio/note handler 未处理 → R13.6 补齐

---

## Phase R12 – ProcessingPage 1:1 复刻设计稿

**完成日期**：2026-05-25
**模型 / 工具**：Claude Opus 4.7 + DS v4-pro + Codex QA
**分支**：feat/phase-r12-processing-page-replica
**Commit**：7bee6d3 / d6edc1e / 3801eb3 / 4922c80 / f88de4a / 634f3c5 / R12 QA cleanup

### 影响范围
- 后端：新增 `/system/stats`，返回 CPU/RAM/GPU/VRAM 实时数据；`main.py` 注册 system router。
- 共享工具：`video_download_ytdlp.py` 抽取平台标题、时长、up 主和缩略图，写入 task result。
- 前端：`ProcessingPage` Hero 读取真实标题/封面/stats；`StepProgress` 增加 desc 和 ok/warn/err 三色日志；右侧栏新增 `SystemResourceCard` 和 `TasksCard`。
- 测试：新增 `tests/backend/test_system_stats.py` 覆盖系统资源端点。

### 关键改动
- `/processing/<task_id>` 不再只展示任务 ID / URL，优先展示 yt-dlp 元数据和可用统计。
- step-stream 以固定 7 步顺序呈现，每步附带说明和按级别着色的日志行。
- 系统资源卡以 3 秒轮询 `/system/stats`，无 NVIDIA GPU 时兼容显示 CPU only。
- 任务侧栏复用 `taskStore`，显示当前/活跃任务并支持点击切换路由。
- QA 收口清掉分支里混入的非 R12 global SSE/R9 残留，并修复 `ProcessingPage/index.tsx` touched-file React hooks lint 问题。

### 验证
- `.venv/bin/python -m pytest tests/backend -q`：320 passed, 2 skipped
- `cd frontend && pnpm test --run`：9 files / 47 tests passed
- `cd frontend && pnpm build`：passed
- `cd frontend && pnpm exec eslint src/pages/result/ProcessingPage/index.tsx src/pages/result/ProcessingPage/StepProgress.tsx src/pages/result/ProcessingPage/SystemResourceCard.tsx src/pages/result/ProcessingPage/TasksCard.tsx`：passed
- `cd frontend && pnpm lint`：47 errors / 1 warning，仍为项目存量 lint 基线；R12 touched files targeted eslint 已通过

### 留给后续的影响
- 预览帧卡仍按计划延后到 N7b，等视频后端回写 `current_frame` 后再接。
- R12 当前只在 feature branch 完成；本地 merge 到 `main` 需用户授权，且仍不 push origin。

---

## Phase R10 – 平台 URL 音频抽取 hotfix + 悬浮队列 v2

**完成日期**：2026-05-25
**模型 / 工具**：DS v4-pro + Codex QA
**分支**：feat/phase-r10-hotfix-and-queue-v2
**Commit**：62b4f27 / ee204d6 / R10 completion

### 影响范围
- 后端：`pipeline_tasks.py` 的 audio URL 分支对平台 URL 改走 yt-dlp bestaudio。
- 共享工具：`video_download_ytdlp.py` 新增 `is_platform_url()`。
- 前端：新增 `FloatingTaskQueue` v2 组件和动画样式，并在 `AppShell` 全局挂载。
- Store：`taskStore` 新增 `removeTask` 和 `hiddenTaskIds`，保证 FAILED 本地隐藏不会被轮询重新同步回来。
- 测试：新增 `test_audio_task_platform_url.py`、`FloatingTaskQueue.test.tsx`，扩展 `taskStore.test.ts`。

### 关键改动
- B 站 / YouTube / 抖音等平台 URL 的 audio 任务不再用 urllib 直 GET 页面地址，避免 412 / 403 / 反爬拦截。
- FloatingTaskQueue v2 支持 mini ring、聚合进度、stage 显示、当前任务高亮、单项取消、失败重试、FAILED 本地隐藏、footer 批量暂停/重试。
- 「查看全部」指向现有 `/workspaces` 路由，避免跳到未注册 `/taskboard`。

### 验证
- `.venv/bin/python -m pytest tests/backend -q`：318 passed, 2 skipped
- `cd frontend && pnpm test --run`：9 files / 47 tests passed
- `cd frontend && pnpm build`：passed
- `pnpm exec eslint ...R10 touched files...`：passed
- `pnpm lint`：49 个存量错误 / 2 个 warning，不属于 R10 新增

---

## Phase A4 – 字幕导出（.srt / .vtt / .ass）

**完成日期**：2026-05-23
**模型 / 工具**：DS v4-pro + Codex QA
**分支**：main
**Commit**：2559164 / acfb00b / e830889 / 9d061dc / 0f4e98f / 476a354

### 影响范围
- 后端：`backend/app/routes/export.py` 新增独立字幕导出端点
- 后端：`shared/audio_analyzer.py` 新增 `.vtt` / `.ass` 导出函数，复用已有 `.srt`
- 前端：`AudioResultPage.tsx` / `VideoResultPage.tsx` 增加字幕导出按钮
- 前端：`frontend/src/services/workspaces.ts` 新增 `downloadSubtitles()`
- 测试：`tests/backend/test_export_api.py` 补字幕端点格式与错误路径覆盖

### 关键改动
- `GET /workspaces/{workspace_id}/items/{item_id}/subtitles?format=srt|vtt|ass` 返回独立字幕文件下载。
- 字幕来源按 `segments` → `transcript_segments` → `transcript` 降级，并兼容 display transcript 的 `t_sec` 字段。
- 端点优先读取 task overlay，避免任务结果已生成但尚未写回 `item.results` 时导出 404。
- demo result 页展示占位字幕时，导出端点同步提供 demo 字幕，避免页面可见但无法导出的不一致。

### 留给后续的影响
- A4 只做导出，不做字幕内容编辑；说话人标签人工修正仍在 A2。
- `.playwright-mcp/` 是本地浏览器验证产物，已加入 `.gitignore`，不进入版本库。

---

## Phase V3.3 – LLM 自动检测视频模板

**完成日期**：2026-05-23
**模型 / 工具**：DS v4-pro (ccswitch)
**分支**：main
**Commit**：c040c70

### 影响范围
- 后端：`pipeline_tasks.py`（新增 `_detect_video_template` + `_run_subtitle_summary` auto 分支）
- 前端：`preflightTasks.ts`（类型 + 默认值 + 选项列表）、`PreflightDrawer.tsx`（默认值）、`VideoResultPage.tsx`（显示自动识别标签）、`templateStore.ts`（getOptions 加 auto）
- 类型：`services/workspaces.ts` VideoResult 接口新增 `detected_template` 字段
- 测试：新增 6 条用例子测（白名单/未知词/异常/无模型/自定义模板/端到端）

### 关键改动
- `_detect_video_template(title, transcript_preview)`：用默认 LLM 单轮分类，prompt 含内置 6 类 + 用户自定义模板名。返回白名单内名称或 "其它"。temperature=0.1 / max_tokens=20 以最小成本完成。
- `_run_subtitle_summary` auto 分支：video_template="auto" 时先调 detect，检测失败/无 API key 兜底 "其它"，不阻塞主流程。
- 前端 `VIDEO_TEMPLATE_OPTIONS` 第一位加 "auto"，默认值从 "其它" 改为 "auto"。
- `VideoResultPage` 当 `detected_template` 存在时显示 "自动识别：教程" 而非仅 "教程"。

### 为什么这么做
- **用户体验**：新用户粘 URL 默认走 auto，省去手动选模板这一步。power user 仍可手动覆盖。
- **安全性**：检测是 best-effort，超时/异常/返回非白名单值全部兜底 "其它"，绝不阻塞主流程。
- **成本**：分类 prompt 极短（~100 tokens），max_tokens=20，单次调用成本可忽略。

### 留给后续的影响
- `detected_template` 写入 task.result，但同名 task 重新执行会重新检测（无缓存）。后续可加 item_id 粒度缓存。
- auto 检测依赖 API key，无 key 时直接兜底 "其它"，用户可通过手动选模板绕过。

---

## Phase R17 — AddMaterial 弹窗：分析范围与任务勾选/细调联动

**完成日期**：2026-05-26
**模型 / 工具**：DS v4-pro
**分支**：feat/phase-r17-add-material-scope-features
**Commit**：pending

### 影响范围
- 前端：`featuresToSteps.ts`、`AddMaterialModal.tsx`、`PreflightDrawer.tsx`、`preflightTasks.ts`
- 类型：`types/workspace.ts`（新增 `AnalysisScope` 类型）
- 测试：`AddMaterialModal.test.tsx`（+3）、`preflightTasks.test.ts`（+2）

### 关键改动
- `featuresToSteps.ts` 新增 `FEATURES_BY_SCOPE`：analysis scope → 允许的 feature 子集映射
- `AddMaterialModal` 第③区 chips 按 scope 过滤；切换 scope card 时清空 features；submit 双保险过滤
- `preflightTasks.ts` `applyCascades` 加 scope 参数：visual_only 禁用 srt/music + 锁 summary_path；av_combined 锁 summary_path
- `PreflightDrawer` 两处 `applyCascades` 调用透传 `sc?.analysisScope`；PFTaskCard 支持 child-level lock
- `AnalysisScope` 类型从 AddMaterialModal 移到 `types/workspace.ts` 避免循环依赖

### 为什么这么做
- 用户决议 visual_only 只走「只看画面」路径，字幕导出和音乐分析 chip 不应出现
- 方案 A（切 scope 清空 features）：避免隐藏 chip 状态泄漏到后端
- 双保险：UI 过滤 + submit 回写过滤，确保 `enabled_features` 永不含 scope 外项

### 验证
- `npm run test`：10 files / 63 tests passed
- `npm run build`：无 TS 错误

---

## 记录模板（复制后填写）

```markdown
## Phase XX – <子任务编号> <标题>

**完成日期**：YYYY-MM-DD
**模型 / 工具**：Opus 4.7 / 小米 2.5 Pro / ...
**分支**：feat/xxx
**Commit**：abc1234 / def5678 / ...

### 影响范围
- 后端 / 前端 / 文档 / 配置 / ...

### 关键改动
- 改了什么文件，做了什么
- 新增了什么接口 / 组件 / 数据结构

### 为什么这么做
- 当时面对的问题
- 考虑过的备选方案 + 为什么没选
- 隐藏假设 / 已知限制

### 留给后续的影响
- 后续修改这块时要注意什么
- 哪些依赖了它（grep 提示）
```

---

# 历史记录（倒序，最新在上）

---

## Track T · T1.1 – 文字结果金句/要点 char 级原文定位

**完成日期**：2026-05-31
**模型 / 工具**：xiaomi mimo 2.5 pro
**分支**：main
**Commit**：（待 commit）

### 影响范围
- 后端：`backend/tests/test_structured_summary_parse.py`（新增）
- 前端：`frontend/src/pages/result/TextResultPage.tsx`、`frontend/src/pages/result/text-result.css`

### 关键改动
- 新增 12 个 pytest 覆盖 `_parse_structured_summary` 的金句子串校验、要点 source_excerpt 校验、para_index 计算、边界情况
- 前端 `scrollToParagraph` → `scrollToCharRange(charStart, charEnd, paraIndex?)`：优先用 char_start/char_end 精确定位，缺失时回退 para_index
- `renderSummary` 签名改为 `onJump(charStart, charEnd, paraIndex?)`，金句/要点点击直接传 char 范围
- 段落渲染支持 `<mark class="tx-char-hl">` 内联高亮，3 秒渐隐动画

### 为什么这么做
- 后端 `_parse_structured_summary` 已有 char 定位逻辑但无测试覆盖，补测试防回归
- 前端原 `scrollToParagraph(para_index)` 只跳段落，金句/要点高亮是整段，违背 T1.1「禁止近似跳转」
- 保留 para_index 兜底兼容旧数据（char_start 未填时仍可跳段落）

### 留给后续的影响
- T1.3 可在此基础上做更丰富的交互（如高亮闪烁、tooltip）
- 后端 prompt 已要求 LLM 输出精确引文，但 LLM 仍可能输出近似文本——substring 校验会丢弃，这是预期行为

---

## Phase R – 输入层重构（Composer 瘦身 + AddMaterialModal 4 步合一 + 单 URL 多类型 + PreflightDrawer）

**完成日期**：2026-05-25
**模型 / 工具**：R1/R5/R6 DS v4-pro；R2/R3/R4 Sonnet 4.6
**分支**：feat/phase-r-input-refactor → main
**Commit**：05bc586 / 81aeecd / c7f94b8 / a5df14d / 4b87616 / 66fba34 / (merge 1594307)

### 影响范围
- 前端：Composer.tsx 删 6 块死 UI（-405 行），AddMaterialModal.tsx 重写（+1108 行，─98 行 MixedContentModal 删除），PreflightDrawer.tsx 重构（+191 行），新增 featuresToSteps.ts（89 行）、pipeline.ts（123 行）、design-tokens.css（355 行）
- 文档：EXECUTION_PLAN.md / ROADMAP.md / AI_HANDOFF.md / DESIGN_SYSTEM.md / test-urls.md 同步
- 后端：pipeline_tasks.py 微调 material_type 分派逻辑；video_analyzer.py 小红书缩略图 webp 兜底
- 测试：新增 QueueTab.test.tsx（47 行）/ pipeline.test.ts（40 行）/ test_pipeline_tasks.py（182 行）

### 关键改动
- Composer 从 630 行瘦身到 ~250 行，删除所有"死按钮"（画质/抽帧/模型下拉/pipeline pill）
- AddMaterialModal 统一作为入口（URL sniff / 上传 → 类型选择 → 一级勾选 → 背景信息 → 一键解析）
- featuresToSteps 翻译层将前端 feature 勾选 → 后端 steps（`lib/featuresToSteps.ts`）
- PreflightDrawer 接管细粒度参数（截帧/模型/Whisper），从模态"细调"按钮唤起
- 小红书 yt-dlp 缩略图 webp 格式兜底 + retry 机制
- 后端 note task 的 material_type 分派修复（image/audio/video 正确映射）
- R3.1 AddMaterialModal Remix 风格化：modal-backdrop / type-card / task-chip / token 化颜色

### 为什么这么做
- 原 Composer 将 SPEC 规定的三层配置（设置页/添加素材/Preflight）压成一层，首页堆了大量无用 UI
- sniff 返回 possible_types ≥ 2 时需支持单链接多类型循环入队
- Remix 风格化让素材添加界面与设计稿 1:1 对齐

### 留给后续的影响
- `enabled_features` 字段塞在 task payload（Dict[str,Any]），后端不动 schema
- 一级项如「音乐分析/OCR」后端可能报"未实现"warning，UI 占位不阻塞
- 多文件批量上传暂不支持（需单独 phase）

---

## Phase N1b – 磁盘布局迁移：data/projects/ → data/workspaces/

**完成日期**：2026-05-19
**模型 / 工具**：Opus 4.7
**分支**：feat/phase-n1b-workspace-layout
**Commit**：94cfc0b (N1b.1 决议落盘) / d0dfa10 (N1b.2 常量改名) / a11512a (N1b.3 迁移脚本) / e411b0c (N1b.4 调用方替换)

### 影响范围
- shared/config.py：新增 WORKSPACES_DATA_DIR + get_workspace_*()，旧名保留为 deprecated alias
- scripts/migrate_n1b_layout.py：半自动迁移脚本（dry-run 默认）
- backend/app/routes/notes.py / workspaces.py：切到新 API
- backend/app/services/pipeline_tasks.py：切到新 API
- shared/storyboard_generator.py：切到新 API
- tests/：同步更新 mock 目标

### 关键改动
- N1b.1：执行计划落盘（方案 A + 半自动迁移 + 常量改名 alias）
- N1b.2：shared/config.py 新增 WORKSPACES_DATA_DIR / get_workspace_*()，旧 API 保留 DeprecationWarning
- N1b.3：scripts/migrate_n1b_layout.py，--dry-run 扫描 + --apply 搬迁 + .bak 保留
- N1b.4：所有调用方批量替换 get_project_* → get_workspace_*，注释中的 data/projects 刷为 data/workspaces

### 为什么这么做
- 产品术语从「project」切到「workspace」后，磁盘路径是唯一遗留不一致的地方
- 选方案 A（目录与 JSON 同层）是因为 rename 即可，不需要改 workspace_store.py
- 选半自动迁移是因为不想启动时静默改用户数据
- 保留 deprecated alias 是为了给第三方脚本一个 release 的缓冲期

### 留给后续的影响
- deprecated alias 保留了一个 release 后删除
- .bak 目录需用户手动清理
- data/projects/ 已空（或改名），后续新 workspace 全部落到 data/workspaces/<id>/

---

## Phase N9 – 图片分支：PaddleOCR + 联想分析 + 多图对比

**完成日期**：2026-05-19
**模型 / 工具**：Opus 4.7
**分支**：feat/phase-n9-image-branch
**Commit**：fadeb9a

### 影响范围
- 依赖：paddlepaddle + paddleocr（中英双语 OCR，~1GB）
- 后端：新增 shared/ocr_service.py + pipeline_tasks::handle_image_task 扩展 + workspaces 路由 bridge 透传 + 新增 image_compare 端点
- 前端：ImageResultPage 加联想分析展示 + 多图对比弹窗 + workspaces 服务新增 compare 类型
- 测试：新增 tests/backend/test_ocr_service.py（2 个用例）

### 用户决策
- OCR 库选型：PaddleOCR（准确、中文优化）
- 4 联想方向全做（用途 / 设计 / 竞品 / 情绪）
- 多图对比：结构化对比表 + VLM 总结（best-effort）

### 关键改动
- 新增 `shared/ocr_service.py`：
  - `extract_text(image_bytes, min_confidence=0.5) -> str`
  - 懒加载 PaddleOCR 引擎（use_textline_orientation 替代已弃用 use_angle_cls）
  - 临时文件写入 + 自动清理
- `handle_image_task` 扩展：
  - 读 preflight 子参数：ocr / association / frame_prompts
  - OCR 路径：PaddleOCR 优先 → VLM 兜底（ocr_text 仅在 PaddleOCR 无结果时用 VLM 的）
  - 联想分析：4 方向独立 VLM 调用（用途/设计/竞品/情绪），结果存入 associations dict
  - prompt_format：按 mj/sd/json 格式调整 VLM prompt 中的提示词部分
- `_bridge_to_pipeline_payload`：image 类型透传 vision/text model + ocr/association/frame_prompts/multi_compare 子参数
- 新增 `GET /workspaces/{wid}/items/{item_id}/image_compare`：
  - 收集同 workspace 内所有已完成 image 素材的结果
  - 结构化对比（描述/标签/OCR）
  - VLM 总结对比（best-effort，失败不影响返回）
- `ImageResultPage`：
  - 标签下方新增联想分析展示区（按方向分段）
  - 底部新增「多图对比」按钮 + ImageCompareDialog 弹窗
  - ImageCompareDialog：表格对比 + VLM 总结

### 为什么这么做
- **PaddleOCR 优先于 VLM OCR**：VLM 的 ocr_text 是"看图猜字"，PaddleOCR 是真正的 OCR 引擎，准确率更高
- **联想方向独立 VLM 调用**：每个方向 prompt 不同，合并成一次调用容易互相干扰
- **多图对比 best-effort VLM**：对比是锦上添花，结构化数据（描述/标签对比表）已足够有价值
- **对比端点用 GET 不用 POST**：对比不产生副作用，GET 更 RESTful

### 留给后续的影响
- **PaddleOCR 首次运行会下载模型**：~100MB，需联网；后续运行用缓存
- **联想分析结果存入 result JSON 的 associations 字段**：前端 ImageResult 类型已加 associations 可选字段
- **多图对比端点是 workspace 级别的**：收集所有 image items，不限于同一次 pipeline
- **N10 可复用联想分析模式**：text 类型的 association 也可用类似 4 方向独立 LLM 调用

---

## Phase N8 – 音频分支：VAD + pyannote 说话人 + librosa 音乐分析

**完成日期**：2026-05-19
**模型 / 工具**：Opus 4.7
**分支**：feat/phase-n8-audio-branch（worktree `/Users/conan/Desktop/nibi-n8`）
**Commit**：dc14841 + N8.6 文档

### 影响范围
- 依赖：silero-vad / librosa / pyannote.audio（含 torch + torchaudio）
- 后端：新增 shared/audio_analyzer.py（~330 行）+ pipeline_tasks::handle_audio_task 大改 + workspaces 路由 bridge 透传
- 测试：新增 9 个 pytest（+1 个 opt-in 真模型 skip）

### 用户决策
- VAD：silero-vad
- pyannote 说话人分离：做（首次需 HF_TOKEN + 同意模型协议）
- 音乐分析：BPM + 调性 + Suno/Udio 提示词全做

### 关键改动
- 新增 `shared/audio_analyzer.py`：
  - 数据类：VadResult / DiarizationResult / MusicAnalysis
  - run_vad / run_diarization / analyze_music / generate_music_prompt / export_srt / export_txt / assign_speakers_to_segments
  - 所有重模型 lazy import + 缺包 graceful skip
- `handle_audio_task` 扩展：
  - 1.5 VAD：转写前跑；无人声 + 无音乐分析 → 日志告警 + 跳过 ASR
  - ASR 接 whisper_lang 透传给云端 /audio/transcriptions
  - 3.5 说话人分离：HF_TOKEN 缺则跳过；否则跑 pyannote 把 speaker 回写到 transcript_segments
  - 3.6 音乐分析：librosa 特征 + LLM 拼 Suno/Udio 提示词
  - 3.7 字幕导出：.srt + .txt 落盘
  - result JSON 加 vad / diarization / music / subtitle_paths 字段
- `_bridge_to_pipeline_payload`：透传 asr / speaker_diarization / music_analysis / subtitle_file 子参数

### 为什么这么做
- **范围收缩到 N8b**：SPEC §5 含"无人声切音乐弹窗"/"说话人标签人工修正 UI"/"多段音乐 6 维度切分"，都涉及前端交互，本期只做后端管线
- **lazy import + 缺包 graceful skip**：任何重模型装不上都不应让 audio 流程崩；让 CI 没装重模型的环境也能跑测试
- **VAD 缺包按"有人声"continue**：保守假设，不主动阻塞 ASR
- **HF_TOKEN 三层环境变量都查**：社区命名不统一（HF_TOKEN / HUGGINGFACE_TOKEN / HUGGING_FACE_HUB_TOKEN 都接）
- **silero VAD 真模型测试默认 skip**：torch jit 模型加载污染 asyncio loop，让 starlette TestClient 测试 crash。`RUN_AUDIO_MODEL_TESTS=1` 才跑

### 留给后续的影响
- **HF_TOKEN 配置流程要文档化**：应在设置页加「HuggingFace Token」字段写入 settings_store
- **音乐分析 LLM 没复用 chat_runner**：直接调 `provider.chat`，未来要接 chat 历史需要抽象化
- **transcript_segments 形状跨供应商不一致**：OpenAI / SiliconFlow 各家略不同；export_srt 已对缺字段做 try/except 兜底，但极端情况字幕可能为空
- **N9/N10 可复用模式**：generate_music_prompt 的"LLM 调用器注入 + 容错 JSON 解析"可复制到 image 联想 / text 改写流程

---

## Phase N7 – 视频分支：AI 镜头分析（PySceneDetect 集成）

**完成日期**：2026-05-19
**模型 / 工具**：Opus 4.7
**分支**：feat/phase-n7-video-branch（worktree `/Users/conan/Desktop/nibi-n7`）
**Commit**：7457d02

### 影响范围
- 依赖：requirements.txt 追加 scenedetect>=0.6.4
- 后端：shared/video_analyzer.py 大改 + backend pipeline_tasks/workspaces.py 透传子参数
- 测试：新增 9 个 pytest（CaptureParams 边界 + 合成视频烟雾）

### 范围收缩决策（重要）
原 N7 计划包含 3 项：AI 镜头 / 路径 1（字幕直接）/ 路径 3（视频模型直接）。
**实际只做了 AI 镜头**，路径 1 & 3 拆出独立 N7b。原因：
- 路径 1 需要 item 维度的字幕抽取——当前 item pipeline 无此步骤，要做需先做 N8 音频管线的 Whisper 集成
- 路径 3 需要视频大模型 API 客户端（Gemini 1.5 Pro / Qwen-VL-Max-Video 等）——新供应商集成，需用户决定接哪家
- 强行塞进 N7 会让估时膨胀到 15-20h+ 且引入多个待决问题

### 关键改动
- 新增 `shared/video_analyzer.py::extract_frames_by_scenes(video_path, frames_per_shot=3)`：
  - PySceneDetect ContentDetector 检测镜头切换点
  - 每镜头 2 帧（首+尾）或 3 帧（首+中+尾，默认）
  - 直接 `cap.set(POS_FRAMES, f) + cap.read()` 定位 target frame，不需要全程顺序读
  - 无切换点（极短视频 / 单镜头）fallback 到首帧
- 新增 `CaptureParams` dataclass + `from_dict` 工厂：
  - 兼容 N5 之前的老 boolean 形状（true → 全默认）
  - 兼容缺字段（mode 非法 → scene；frames_per_shot 非 2/3 → 3）
  - 字符串数字 / 负值自动 clamp
- `extract_frames` 增加 `max_frames` 参数（之前没有上限）
- `process_video` / `run_batch_analysis` 增 `capture_params: CaptureParams | None`：
  - None → 旧 interval 行为（向后兼容老调用方，比如 legacy streamlit 入口）
  - mode=scene → extract_frames_by_scenes
  - mode=interval → extract_frames（含 max_frames）
- `_bridge_to_pipeline_payload`：把 `item.preflight.tasks.frame_prompts` dict 透传到 payload
- `handle_analyze_task`：从 payload 读 frame_prompts → CaptureParams.from_dict → 传给 run_batch_analysis，并在 log 里打印实际配置

### 为什么这么做
- **从 N5 一路打通到管线**：N5 立了 UI + 持久化数据，N7 把这些数据真正送到截帧引擎，闭环
- **CaptureParams 而不是 \*\*kwargs**：参数 4 个，又要从 dict 反序列化，dataclass 更清楚 + 测试好写
- **直接 seek vs 顺序读**：scene 检测后我们已经知道目标 frame index，没必要遍历整个视频读完丢弃 99% 的帧
- **None capture_params = 老行为**：legacy streamlit 入口、CLI 脚本可能直接调 run_batch_analysis 不带新参数；保兼容

### 留给后续的影响
- **N7b**（路径 1 & 3）：需要 item 字幕抽取（依赖 N8）+ 视频大模型 API 集成（新供应商决策）
- **N8 音频**：会引入 Whisper item-level 抽取——做完后 N7b 路径 1 就能动了
- **PySceneDetect 长视频性能**：300+ MB 视频检测 30-60 秒，本 phase 没做异步进度上报，照任务运行中状态即可。如果用户反馈卡顿，加 scene detect 阶段的 set_progress
- **frame_prompts.format / lang 字段**：N5 引入但 N7 未消费——这是「提示词输出」步骤的事，归 N7b/N9 范围

---

## Phase N6 – 任务级 LLM 对话上下文素材多选 chip + RAG 兜底

**完成日期**：2026-05-19
**模型 / 工具**：Opus 4.7
**分支**：feat/phase-n6-task-chat（worktree `/Users/conan/Desktop/nibi-n6`）
**Commit**：ae7ed8b (N6.1) / 435e8cb (N6.2~N6.3) / 935d933 (N6.4~N6.6)

### 影响范围
- 后端：新增 chat context 服务 + chat 路由扩展 + ChatRunner system_prompt 注入
- 前端：新增 TaskChatPanel + chat service 类型扩展 + WorkspaceDetail AI 对话 tab
- 测试：新增 5 个 pytest（chat_context 单元测试）

### 关键改动
- 新增 `backend/app/services/chat_context.py::build_item_context`：按 workspace + item_ids 拼 system prompt，覆盖 task 背景 + 每个 item 的 name/type/tags/results。char-based 阈值 12000 触发截断
- `POST /workspaces/{id}/chat` 请求体加 `item_ids: list[str]`，返回值加 `context_truncated` / `used_item_ids`
- `ChatRunner.start_turn` 加 `system_prompt` 参数：注入到 LLM history 第 0 位但**不落盘**（避免污染对话历史，允许下一轮换素材）
- 新增 `frontend/src/components/workspace/TaskChatPanel.tsx`：素材 chip 多选条 + 全选 + 截断徽章
- WorkspaceDetail AI 对话 tab 从占位 EmptyState 切到 TaskChatPanel
- **保留**：浮动 ChatSidebar 不动，作为「无上下文」快捷入口

### 为什么这么做
- **char 阈值 vs 真 embedding RAG**：现有 `rag_qa_service` 基于 cross-workspace 索引（`project_json_dir`），与 task-level item 上下文不匹配。做真 task-level RAG 需新索引基础设施——超出 N6 6-8h 估时。char 截断在 v1 已覆盖 SPEC §1.5 的「token 兜底」要求。真 embedding RAG 等 N9/N10 跨素材聚合真有需求时再上
- **system_prompt 不落盘**：每轮根据当前勾选重新生成，避免老 prompt 滞留污染后续对话；用户切素材也能即时反映
- **保留浮动 ChatSidebar**：SPEC 没要求砍——它仍是右侧"任意问"快捷入口
- **`results` 字段提取**：跨素材类型 results 形状差异大，用 `_pick_str` 多 key fallback（`summary` / `video_summary` / `asr_summary` 等）+ type 兜底

### 留给后续的影响
- **N7~N10 后端分支**：写新 results 字段时若想让 chat 看到，需在 `chat_context._format_results` 里加 key（或保持向后兼容的命名：`summary` / `transcript` / `ocr_text` / `description` / `frame_prompts`）
- **真 RAG 接入路径**：未来若做 task-level embedding RAG，应在 `build_item_context` 内加「if 截断 → embedding 检索 query 相关 chunks 替换被截 items」，前端无需改动
- **`item_ids` 校验**：路由层未校验 id 属于该 workspace，只在 `build_item_context` 里跳过未命中——理论上存在「跨 workspace 注入」风险，后续考虑路由层加严格校验

---

## Phase N5 – Preflight 抽屉细化（按素材类型展开所有子参数）

**完成日期**：2026-05-19
**模型 / 工具**：Opus 4.7
**分支**：feat/phase-n5-preflight（worktree `/Users/conan/Desktop/nibi-n5`）
**Commit**：02e8d7d (N5.1) / 644fae1 (N5.2~N5.5)

### 影响范围
- 前端（纯前端，不动后端）
- 文件：
  - 新增 `frontend/src/lib/preflightTasks.ts`
  - 新增 `frontend/src/components/workspace/PreflightTaskDetails.tsx`
  - 改 `frontend/src/components/workspace/PreflightConfigPanel.tsx`

### 关键改动
- **数据形状升级**：`PreflightConfig.tasks` 从 `{id: boolean}` 升到 `{id: {enabled, ...params}}`。后端类型 `Record<string, unknown>` 天然兼容，无需迁移。
- **三个核心工具**（`preflightTasks.ts`）：
  - `getTaskParams(tasks, type, id)`：读取任意旧/新形状，按 type+id 补齐默认字段
  - `setTaskParams(tasks, id, params)`：不可变更新
  - `normalizeTasksShape(tasks, type)`：把整个 tasks 升级到新形状（打开抽屉 + 保存时各调一次）
  - `getTopLevelTasks(type)`：替代 PreflightConfigPanel 内联的 `getTaskOptionsByType`，新增图片「多图对比」/文字「多文对比」一级项
- **子参数 UI**（`PreflightTaskDetails.tsx`）：按 (type, taskId) 派发
  - 视频 `frame_prompts`：截帧模式 / 间隔秒数 / 最大帧数 / 镜头取帧数 / 格式 / 语言
  - 视频 `video_summary`：3 条路径 + 总结深度
  - 音频 `asr`：Whisper 语言（8 种）
  - 视频/音频 `music_analysis`：Suno / Udio 格式开关
  - 图片 `frame_prompts`：MJ/SD/JSON
  - 图片/文字 `association`：4 维联想方向多选
  - 文字 `summary`：摘要长度 / `rewrite`：4 种风格 / `translate`：7 种目标语
- **PreflightConfigPanel 第三区**：从单层 Checkbox 列表 → 「一级开关 + 子参数面板」嵌套结构；勾选 enabled 才展开子参数

### 为什么这么做
- SPEC §3.4 明确要求 Preflight 抽屉「展开所有子参数」，与添加素材模态（粗粒度）和设置页（默认值）分层
- **嵌套对象** vs **扁平 `id_field` 命名**：选嵌套——后端 schema 不用动、前端 TaskDetails 子组件直接接收完整 params、读写一致
- **不动后端**：N5 只立 UI + 持久化；子参数实际生效要等 N7~N10 各分支接入

### 留给后续的影响
- **N7~N10 后端**：消费 `preflight.tasks[*].xxx` 时按新形状读，注意 `tasks[id]` 可能是老 boolean（来自 N5 前的存量数据），调用 `bool(task) if isinstance(task, bool) else task.get('enabled')`
- **AddMaterialModal**：仍写老 boolean 形状（粗粒度），打开抽屉时由 `normalizeTasksShape` 自动升级——不需要同步改
- **关联标识**：图片「多图对比」/ 文字「多文对比」一级项已加，但只是 UI 占位，实际跨素材对比逻辑在 N9/N10 实现

---

## Phase 3C – 标签库 7 维度（自动打标 + 手动校正 + 按标签筛选）

**完成日期**：2026-05-18
**模型 / 工具**：Opus 4.7（桌面）+ 小米 2.5 Pro（终端，免费）混合
**分支**：`feat/phase3c-tag-library` → merge 到 main（`2fd8fd3`，--no-ff）
**Commit**：`4a04c1d` / `606b9f7` / `d93d001` / `aea7f55` / `52222e5` / `c1f5b6d` / `5d9b3ba` / `2fd8fd3`（共 8 个，含 merge）
**模型分工**：
- 小米：3C.1（config + 字段）、3C.3（CRUD 端点）、3C.6（item 页 tags 面板）—— 模板性任务
- Opus：3C.2（LLM prompt + 严格 JSON 解析）、3C.4（task 钩子 + 异步线程）、3C.5（chip 栏 + URL 双向同步）—— 设计含思考的任务

### 影响范围
- 后端 service：`tag_generator.py`（LLM 打标 + JSON 解析 + 校验）
- 后端 model：`WorkspaceItem.tags: Dict[str, Any]` 字段（持久化进 workspace.json）
- 后端 config：`shared/config.py::TAG_DIMENSIONS`（6 系统维度 + custom_tags 候选值表）
- 后端 routes：`workspaces.py` 加 3 个 tags 端点 + `_autotag_items_for_task` 钩子
- 前端 types：`SystemTagDimension` / `ItemTags`
- 前端 constants：`tagDimensions.ts` 镜像后端 config（手工同步）
- 前端 components：`TagFilterBar.tsx`（chip 多选）、`ItemTagsPanel.tsx`（展示 + 重新生成）
- 前端 hooks：`useTagFilter.ts`（URL search params 双向同步 + 内存过滤）
- 前端 pages：WorkspaceList 顶部挂筛选栏；4 个 result 页挂 ItemTagsPanel
- 测试：4 个新测试文件，共 12 个新用例，全 backend 101 passed

### 关键改动

**Tag 数据形状（设计契约）**
```python
WorkspaceItem.tags = {
    "content_type": "教程",           # 6 个系统维度，单选 enum
    "subject_domain": "科技",
    "difficulty": "入门",
    "duration_band": "短",
    "information_density": "高",
    "emotion_tone": "中性",
    "custom_tags": ["前端", "React"],  # 自由文本数组
    "_generated_at": "ISO8601",       # 元数据
    "_generated_model": "Qwen/..."
}
```

**LLM 打标 service（3C.2）**：调当前默认 chat provider，prompt 严格要求返回 JSON；解析层支持 markdown 代码块包裹；校验层对系统维度做 `value in choices` 检查，非法值丢弃不抛；任何异常返回 `{}` + log warning（不阻塞主流程）。

**自动打标钩子（3C.4）**：`register_success_callback("analyze"|"text"|"audio"|"image", ...)`，在 daemon Thread 里跑 `generate_tags`，避免阻塞 task worker。跳过已有 tags 的 item，避免重复消耗 LLM 配额。

**URL 双向同步（3C.5）**：`?tags.content_type=教程,访谈&tags.difficulty=入门&tags.custom=React` 格式；`useSearchParams` + `replace: true` 不污染浏览器历史；同维度 OR / 跨维度 AND 语义；custom_tags 走 contains。

**前端筛选（3C.5）**：筛选纯内存做，不走后端接口（性能足够，列表小）。筛选规则：保留至少一个 item 命中筛选的 workspace，工作空间卡片展示该空间下匹配的 items。

### 为什么这么做

- **7 维度选择**：plan 默认 6 个系统维度 + 1 个自由 custom_tags，平衡覆盖度与 LLM 推理稳定性。维度名 / 候选值放在 config，以后改值不改代码
- **存 item.tags 字段而不是独立文件**：减少 IO 套路；tags 本身就是 item 的衍生属性，跟随 workspace.json 走最自然
- **自动跳 + 手动补打**：自动跳保证「分析完即用」；手动按钮兜底失败场景（首次 LLM 调用可能因 prompt 工程问题失败）；不做后台批量是为了避免一次性触发限流
- **筛选纯前端**：列表数据量小（< 100 workspaces），无需后端 query；URL 同步让筛选状态可分享 / 可刷新
- **前端 hardcode 维度配置**：与 shared/config.py 同步两边的代价 < 加一个 GET /tags/config 端点 + 客户端缓存的复杂度
- **chip + dropdown 用原生 div + 外部点击监听**：项目无 Popover 组件，加一个 radix-ui/popover 会引入新依赖；自己实现一个最小可用版 OK

### 留给后续的影响

- **配置同步双写风险**：`shared/config.py::TAG_DIMENSIONS` 和 `frontend/src/constants/tagDimensions.ts` 必须保持一致，加维度时记得改两处。未来想消除可加 GET /tags/config 端点
- **未做手动编辑 UI**：当前 ItemTagsPanel 只展示 + 重新生成，没有给用户「点 badge 直接改值」的入口；后端 PUT /tags 端点已就绪，前端补 UI 即可
- **prompt 工程稳定性**：当前 prompt 在 SiliconFlow 默认模型上测过 OK，换模型时可能需要重测；模型选择不在 settings 里独立配置，跟随 default chat profile
- **未提供「跳过自动打标」开关**：如果用户不想每次分析都触发 LLM 调用，需要在 settings 里加开关 + 钩子里读 settings；目前是硬编码自动跳
- **筛选语义**：跨维度 AND 可能让结果过少；当前空态有清除按钮兜底，UI 上够用。如果用户觉得 AND 太严，可改成 OR（一行代码改动）
- **custom_tags 在 LLM 生成时数量限制为 10**：避免模型失控塞太多；如果觉得限制太死可调 `tag_generator._validate_and_normalize`

### 验证

- 后端：`pytest tests/backend -q` 101 passed（含 12 个新用例）
- 前端：`pnpm tsc --noEmit` 通过
- 端到端：未做（用户已确认搜索链路通过，3C 钩子需要触发新的分析才能验证，留给后续手动跑）

---

## Phase 3B – 知识库 UI（跨工作空间 RAG 检索）

**完成日期**：2026-05-18
**模型 / 工具**：Opus 4.7（桌面 Claude Code）
**分支**：`feat/phase3b-knowledge-search`（待 merge 到 main）
**Commit**：`c606ba4` / `24089ed` / `adf5fb3` / `92b25a6` / `8388c71`（共 5 个）

### 影响范围
- 后端：新增 2 个 service（`workspace_knowledge.py` / `workspace_search_service.py`）+ 1 个 router（`search.py`）；扩 `workspaces.py` 加 `/search` 子路由；`main.py` 注册新 router
- 前端：新增 `services/search.ts` + `pages/SearchPage/SearchPage.tsx` + `pages/WorkspacePage/WorkspaceSearchBar.tsx`；改 `router.tsx`、`layouts/AppShell.tsx`、`pages/WorkspacePage/WorkspaceDetail.tsx`
- 测试：`tests/backend/test_workspace_knowledge.py` / `test_workspaces_search.py` / `test_global_search.py`，共 7 个新用例
- 缓存目录：`data/.local/embeddings/<workspace_id>.{faiss,meta.json}`

### 关键改动
- **数据桥（3B.1）**：把每个 `WorkspaceItem.results` 序列化为临时 JSON 文件，复用 `shared/knowledge_base.load_folder_as_knowledge(only_paths=...)` 喂给 FAISS，不改核心算法
- **缓存层（3B.1）**：以 items 内容 sha256 hash 作为缓存键；命中则反序列化 `VideoChunk` + `faiss.read_index`；不命中重建并写盘；`invalidate_workspace_index()` 用于 item 增删时主动失效
- **单空间检索（3B.2）**：`POST /workspaces/{wid}/search`，复用 `retrieve_with_sources` + `rag_qa_service` 的 LLM 调用模式
- **跨空间检索（3B.3）**：`POST /search`，`ThreadPoolExecutor(max_workers=4)` 并发各 workspace 取候选 → 合并入池 → `rerank_documents` 二次精排取 top_k（量纲统一）→ 综合回答；reranker 失败降级按原 score 排
- **前端检索页（3B.4）**：`/search` 路由 + 范围下拉（全部 / 单工作空间）+ ReactMarkdown 答案区 + 源卡片（含 score / 类型 badge / jump_url）；AppShell 侧栏 🔍 图标接到此页
- **内嵌检索条（3B.5）**：`WorkspaceDetail` 左主区顶部挂 `WorkspaceSearchBar`（窄版），结果内联可折叠
- **SearchSource 字段约定**（plan §Q4）：`workspace_id` / `workspace_name` / `item_id` / `item_type` / `item_title` / `chunk_excerpt` (≤200 字) / `score` / `jump_url`

### 为什么这么做
- **不改 `shared/knowledge_base.py` 核心**：里面 511 行算法是 Streamlit 旧入口 + RAG 旧接口共用的，改动影响面太大；现有 `only_paths` 参数已够用
- **临时 JSON 文件方案**：避免给 knowledge_base 增加「从 dict 列表加载」入口，绕开数据结构演化风险；缓存命中后不再需要这些临时文件
- **items_hash 缓存策略**：相比按 `updated_at` 失效更稳——用户手改 results 也能触发重建；空间换时间，hash 计算成本 ≪ embedding API 调用
- **rerank 跨空间合并 vs score 归一化**：reranker 二次精排比 min-max 规范化更可靠（不同空间向量分布差异大，min-max 容易失真）
- **前端不传 api_key**：后端 fallback 到 `settings.openai_api_key`，前端不沾敏感字段（plan §Q3）

### 留给后续的影响
- **缓存失效未自动接入 item CRUD**：目前 `invalidate_workspace_index` 仅暴露 API，未在 `workspaces.py` 的 add_item / remove_item / update_item 钩子里调用。下次 item 变更时 hash 自然失效会触发重建，但有一次 stale window。如果未来希望立刻生效，需要在 add/remove/update item 后调一次（注意 add_prompt_version 不影响 results 不用调）
- **embeddings 占位字段**：`LongKnowledge.embeddings` 在缓存命中时填 `np.zeros((ntotal, dim))`——目前下游只用 `index` 做 ANN 搜索 + `chunks` 文本不会读这个数组，安全；如果将来改用 `embeddings` 字段，需要持久化真实向量
- **未做并发限流**：跨空间检索一次 API 调用 = workspace 数 × embedding 调用，3+ 个空间触发 SiliconFlow 限流时需要降并发或加退避
- **i18n**：3B 全程用硬编码中文文案（与现有 AppShell / WorkspaceList 风格一致），未抽 i18n key；后续若做英文版需要补 locale
- **测试覆盖**：所有外部 API（create_embeddings / rerank_documents / LLM）都 mock；真实端到端验证需要跑 `./start.sh` + 至少 2 个含 results 的 workspace

---

## Phase 3A – 视频工作台清理 + LICENSE

**完成日期**：2026-05-17
**模型 / 工具**：小米 2.5 Pro（终端 Claude Code）
**分支**：main
**Commit**：`9bb0e42` / `0840702` / `1df97bb` / `368010b` / `a1cb6f9` / `948c115`（共 6 个）

### 影响范围
- 前端：删除整个 `frontend/src/pages/HomePage/` 目录、`frontend/src/layouts/{HomeLayout,WorkbenchShell}.tsx`、`frontend/src/__tests__/NoteForm.test.tsx`、4 个 locale JSON 里 HomePage 相关文案
- 路由：`router.tsx` 删 `/home`，默认跳转改 `/workspaces`
- 后端：`backend/app/main.py` 卸载 `notes.py` 路由（旧 BiliNote 兼容接口，前端零引用）
- UI：`AppShell.tsx` 移除侧栏"工作台"导航项 + logo 跳转改 `/workspaces` + 删未使用的 `Home` 图标 import
- 仓库根目录：新增 `LICENSE`（MIT，作者 conan，年份 2026）

### 关键改动
- 净减 3499 行代码（22 个文件删除 + 3 个文件修改）
- 路由 fallback：访问 `/home` → 404Page
- BiliNote 兼容路由（`/api/*`）整体下线

### 为什么这么做
- 项目曾有两套并存入口：旧 `/home`（BiliNote 单页作业台）和新 `/workspaces`（v1.1 设计契约的主线）
- 新主线已完全覆盖旧入口能力（视频也能进工作空间）
- 后续 Phase 3B（知识库 UI）和 3C（标签库）需要在统一数据模型上建索引，必须先清理双轨数据
- 备选方案：保留旧入口仅隐藏 nav——拒绝，因为代码长期负担

### 留给后续的影响
- **WorkbenchShell** 已删除。如果后续有页面需要类似"顶栏 Header + 主区"的 wrapper，应直接用 `AppShell` 或新建轻量 Layout
- **`/api/*` 路由**已下线。如果未来要做"外部工具调本项目能力"（Phase 9 的 API 模式），需要新设计 RESTful 路由
- **`Home` 图标 import** 已从 `AppShell.tsx` 移除。如果新增侧栏项需要 home 形状图标，从 lucide-react 重新 import
- grep 提示：`grep -rn "/home" frontend/src/` 应零命中（已验证）

---

## Phase 2D – SQLite 切换评估

**完成日期**：2026-05-17
**模型 / 工具**：小米 2.5 Pro
**分支**：main
**Commit**：`a946fa2`

### 影响范围
- 仅文档：新增 `docs/archive/phase-2d-sqlite-evaluation.md`（122 行）
- 无代码改动

### 关键改动
- 实测各 store 体量：task_store 3.4 MB / settings 5.9 KB / chat 1.9 KB / workspace 2.7 KB
- 基准测试：task_store 全量读取 13.6 ms，序列化 30 ms
- 逐项评估 spec v2 §54 行的 4 个 SQLite 触发条件
- 给出复审条件：task_store > 10MB / 首屏 > 300ms / 跨任务联合查询 / 多进程部署 / 事务需求

### 为什么这么做
- spec v2 §3 表里 2D 是 Phase 2 收尾的"仅评估，不一定迁移"动作
- 当前用 JSON store 工作良好（首屏 13.6ms 远低于 500ms 阈值）
- 备选：直接迁 SQLite——拒绝，过度工程

### 留给后续的影响
- Phase 5（存储/性能升级）启动条件已明确写入本评估报告 §6
- 如果未来要做多进程部署（gunicorn workers > 1），**必须**先切 SQLite（JSON store 无并发写保护）

---

## Phase 2 – 内容能力扩展（2A / 2B / 2C.1 / 2C.2 总览）

**完成日期**：2026-05-15 至 2026-05-17
**模型 / 工具**：Opus 4.7（2A / 2C.1）+ Sonnet 4.6（2B / 2C.2）

### 关键交付
- **2A**：LLM 对话侧栏（workspace-aware 流式 SSE，接 SiliconFlow chat_completion_stream）+ 收藏夹管理页（含 5 个端点 pytest）
- **2B**：音频结果页（精简版 VideoResultPage，去三轨保留 transcript + ReactMarkdown 渲染 summary）
- **2C.1**：文本输入层（pypdf / python-docx / readability-lxml 三件套，pipeline 注册 text 任务，workspaces 上传扩展 PDF/DOCX/HTML）
- **2C.2**：文本结果页 + 提示词版本栈（PromptVersionStack 组件复用到 image/video/text 三页）

### 留给后续的影响
- 4 种结果页（video/image/audio/text）的产物路径不统一（在各自的 `_materialize` 端点里），**Phase 3B.1 数据桥**需要逐种类型 grep 确认产物位置
- 提示词版本栈数据存在 `workspace.items[].prompt_versions[]` 字段——Phase 3C 标签库可能复用相同字段位置

---

## Phase X – 主干竖切（TEXT / IMAGE / VIDEO / AUDIO）

**完成日期**：2026-05 上旬
**模型 / 工具**：Opus 4.7
**分支**：feat/phasex-*

### 关键交付
- 起源：2C.2 浏览器验收时发现"demo 结果页能开，但真实分析根本没通"
- X.1 状态桥：item ↔ task 状态联动
- X.3 工作空间详情页接入任务 SSE 进度
- X.4 image pipeline handler 全链路
- X.5 video download→analyze 任务链 + 产物回写
- X.7 video_result 把 analyze json_outputs 转成 frames
- X.A AUDIO 管线全链路

### 留给后续的影响
- 工作空间 item 的状态机已稳定（pending → running → done / failed），Phase 3B 检索时应只索引 `status: done` 的 item
- 主 worktree 启动服务的"路径漂移"问题：之前后端在某个 worktree 下被启动时，`backend_tasks.json` 写到了那个 worktree 的 `.local/`——**永远从 `/Users/conan/Desktop/nibi` 主目录起服务**

---

## Phase 1 – MVP 主干（1A → 1J）

**完成日期**：2026-04 至 2026-05 上旬
**模型 / 工具**：组合（Opus / Sonnet / 小米 / Haiku 分档使用）
**Tag**：未打（用户决定 tag = 开源时刻，延后到所有功能差不多时统一打）

### 关键交付
- 1A 任务列表 API 补字段
- 1B 任务列表前端
- 1C 设置 → 模型管理（providers / models 双层）
- 1D 任务详情骨架 + 输入层（含本地文件上传）
- 1E 前置配置面板
- 1F Pipeline + SSE 进度条
- 1G 视频结果页 + 三轨时间轴（5h，最复杂阶段之一）
- 1H 图片结果页
- 1I 工作包 zip 导出
- 1J 老代码清理 + Phase 1 收口

### 留给后续的影响
- 三轨时间轴（TripleTrack）的关键帧渲染依赖 `/static` 静态文件挂载，路径来自 `_materialize` 的 `keyframe image_path`
- 工作空间 export zip 支持 4 种类型（video/image/audio/text），新增类型时需扩展 export 逻辑

---

## Phase 0 – 设计令牌 + AppShell

**完成日期**：2026-03
**模型 / 工具**：小米 2.5 Pro / Sonnet

### 关键交付
- VidMirror 设计令牌翻译成 Tailwind 4 + CSS 变量
- 全局 AppShell（侧栏 + topbar）
- 暗色模式 token 准备（但未全量调通，Phase 3E 收尾）

### 留给后续的影响
- 侧栏导航项数组在 `frontend/src/layouts/AppShell.tsx` `NAV_ITEMS`——新增页面需要在此加项
- 设计令牌的真相源仍是 `vidmirror-handoff/project/styles.css`，改色或字体应回去比对

---

## Phase N1 – 任务系统差异（trashed/analyzed/上层 project_id）

**完成日期**：2026-05-19
**模型 / 工具**：Opus 4.7
**分支**：`feat/phase-n1-task-system`（worktree `/Users/conan/Desktop/nibi-n1`）
**Commits**：6436504 / ebf9a48 / 5ff638c / a294448 / 89a5795 / ff77385 / c078617

### 影响范围
- 后端：`backend/app/models/workspace.py`、`backend/app/routes/workspaces.py`、`backend/app/services/workspace_store.py`
- 前端：`frontend/src/types/workspace.ts`、`frontend/src/services/workspaces.ts`、`frontend/src/router.tsx`、`frontend/src/layouts/SettingsShell.tsx`、新增 `frontend/src/pages/SettingPage/TrashPage.tsx`、删除 `components/ProjectSwitcher.tsx` 与 `store/projectStore.ts`
- 测试：新增 `tests/backend/test_workspaces_trash.py`（4 用例），修复 `test_workspace_knowledge.py` / `test_workspaces_api.py`

### 关键改动
- **WorkspaceStatus**：`COMPLETED("completed")` 重命名为 `ANALYZED("analyzed")`，`from_dict` 兼容老 `"completed"` 数据
- **新增 trashed: bool 字段**：独立标志位，恢复时不动 status，原状态天然保留
- **软删除路由**：DELETE 改为 `trashed=True`；新增 `POST /workspaces/{id}/restore`、`DELETE /workspaces/{id}/permanent`、`DELETE /workspaces/trash`
- **列表过滤**：`GET /workspaces` 新增 `trashed_only` / `include_trashed` query 参数，默认排除 trashed
- **删 WorkspaceRecord.project_id 字段**（仅上层）：前端 ProjectSwitcher 一并删除（孤儿组件，无引用点）
- **保留 TaskRecord.project_id 与磁盘布局**：拆为独立 N1b phase（详见下面"为什么这么做"）
- **前端垃圾桶页**：`/settings/trash` 路由，列表 + 恢复 + 彻底删除 + 清空，window.confirm 二次确认

### 为什么这么做
- **trashed 用独立字段而非 status 枚举**：spec §1.4 要求"恢复到原状态"。如果用 status="trashed" 覆盖原 status，恢复时需要额外的 `status_before_trash` 字段；用独立 bool 更干净。
- **拆出 N1b（磁盘布局）**：开工后才发现 `shared/config.py::get_project_videos_dir(project_id)` 等 ~15 处把 project_id 当磁盘目录键，pipeline_tasks.py 全分支都用。彻底重构需 6-10h + 老数据搬家，远超 N1 4-6h 估时。用户决议"只拆能看到的那一层"——前端项目下拉框删除、上层字段删除；磁盘 `data/projects/<id>/...` 保留待 N1b。
- **DELETE /trash 路由先于 /{workspace_id}**：FastAPI 路径按声明顺序匹配，否则 `trash` 会被当成 workspace_id 吞掉。

### 留给后续的影响
- 数据兼容：老 workspace JSON 里 `project_id` 字段被 `from_dict` 静默忽略；老 `status="completed"` 自动升级为 `"analyzed"`
- 创建 workspace 后调 pipeline 任务，磁盘文件统一进 `data/projects/default_project/`——N1b 时再迁
- 设置页「垃圾桶」入口当前用字面量 `"垃圾桶"`，N3 设置页重组时补 `layout.menu.trash` i18n key
- N1b 待启动：磁盘布局 → `data/workspaces/<workspace_id>/<item_id>/`，附老数据搬家脚本

---

## Phase N11 – 砍掉的 UI 清理（仅入口隐藏，代码留备份）

**完成日期**：2026-05-19
**模型 / 工具**：小米 2.5 Pro（终端，免费）
**分支**：直接在 main

### 影响范围
- 前端：3 个结果页（Video / Image / Audio）

### 关键改动
- **隐藏「导出复刻工作包」按钮**：VideoResultPage / ImageResultPage / AudioResultPage 三个页面的导出按钮 + `handleExport` 函数 + `downloadExport` import 全部注释掉（代码保留）
- **Taskboard 子标签**：确认已是 4 个（素材/队列/标签库/AI 对话），无需改动
- **AI 导演侧边栏入口**：确认已是 `disabled: true` + 灰显，符合 SPEC §8.1「隐藏或灰显」

### 为什么这么做
- SPEC §8.2 明确：任务级 .zip 导出无强应用场景，代码保留但 UI 隐藏
- 注释而非删除，保证恢复成本极低（取消注释即可）
- `downloadExport` 服务函数保留在 `services/workspaces.ts` 不动

### 留给后续的影响
- 恢复导出功能：取消 3 个结果页的注释 + 恢复 `Download` import + 恢复 `downloadExport` import
- 单素材级导出（.srt / .md / .json / 原文件下载）不受影响，各结果页独立保留

---

## Phase N10 – 文字分支补全（marker PDF / 联想改写翻译 / 多文对比）

**完成日期**：2026-05-19
**模型 / 工具**：Sonnet 4.6
**分支**：`feat/phase-n10-text-branch`（worktree `/Users/conan/Desktop/nibi-n10`）

### 影响范围
- 后端：`shared/text_loader.py`、`backend/app/models/tasks.py`、`backend/app/services/pipeline_tasks.py`、`backend/app/routes/workspaces.py`
- 前端：`frontend/src/services/workspaces.ts`、`frontend/src/pages/result/TextResultPage.tsx`
- 测试：`tests/backend/test_text_pipeline.py`
- 依赖：新增 `marker-pdf>=1.10.0`（~1.5GB 模型，首次运行自动下载）

### 关键改动
- **marker PDF 解析**：`load_pdf()` 改为 marker 优先（支持扫描件 OCR + 图片表格保留）、pypdf 兜底；`TextDocument.meta` 增加 `parser` 字段
- **Preflight 参数透传**：`_bridge_to_pipeline_payload` text 分支透传 summary/association/rewrite/translate/multi_compare 子参数 + text_model
- **LLM 分析能力**：新增 `_text_llm_call` 通用辅助、`_associate_text` 联想归纳（4 方向）、`_rewrite_text` 改写润色（4 风格）、`_translate_text` 翻译（9 种语言）
- **状态机扩展**：TaskStatus 新增 ASSOCIATE / REWRITE / TRANSLATE，handle_text_task 状态机 SUM→ASSOCIATE→REWRITE→TRANSLATE→STORE
- **多文对比端点**：新增 `GET /text_compare`，参考 image_compare 实现结构化对比 + LLM 总结
- **前端结果页升级**：右侧面板增加联想归纳/改写/翻译折叠区 + 多文对比弹窗

### 为什么这么做
- **marker 而非 docling**：marker 是 2024 年社区最受好评的 PDF→Markdown 方案，保留图片+表格+扫描件 OCR 一体；docling 偏技术报告场景，通用性稍弱
- **pypdf 兜底**：marker 模型加载较慢（~30s 首次），轻量场景 pypdf 秒出结果；两层 fallback 保证可用性
- **折叠区而非平铺**：联想/改写/翻译结果可能很长，折叠区避免右侧面板过长影响摘要阅读

### 留给后续的影响
- marker 模型 ~1.5GB，首次运行需下载；后续可考虑模型缓存策略
- 翻译/改写是单次 LLM 调用，超长文本可能截断；SPEC §7.4 的超长文本分段留到后续
- PDF 内图片走图片分支分析（SPEC §7.3 第 4 点）未实现，留到后续

---

## IP.9 Flow Gaps 补齐（Results 总览 + N7b/N8b UI + payload 对齐）

**完成日期**：2026-05-21
**分支**：feat/ip9-flow-gaps
**提交**：
- `235be39` docs(IP.9): Flow Gaps 落盘——补流程图与代码 6 处缺口
- `9886826` feat(IP.9.1): Results 总览页（s05）+ 修跳转 bug + 路由重命名
- `cb27dd5` feat(IP.9.2): N8b 音频前端 6 任务勾选 + 结果页对应区块
- `e618d1a` feat(IP.9.3): N7b 视频路径选择 UI（3 路径 + 视频类型模板）
- `d9d3836` fix(IP.9): align Tier A UI with pipeline payloads

### 影响范围
- 后端：`backend/app/routes/workspaces.py`、`backend/app/services/pipeline_tasks.py`
- 前端：`frontend/src/pages/result/ResultsOverview/`、`frontend/src/pages/result/AudioResultPage.tsx`、`frontend/src/pages/result/ProcessingPage/index.tsx`、`frontend/src/router.tsx`、`frontend/src/components/workspace/PreflightTaskDetails.tsx`、`frontend/src/lib/preflightTasks.ts`、`frontend/src/services/workspaces.ts`
- 测试：`tests/backend/test_pipeline_tasks.py`、`tests/backend/test_workspaces_api.py`
- 文档：`docs/plans/archive/phase-ip9-flow-gaps.md`

### 关键改动
- **Results 总览页**（IP.9.1）：新增 `/workspaces/:id/results` 路由，展示所有 item 的分析结果汇总（视频/音频/图片/文字四类卡片），修复从 Taskboard 跳转 Processing 的 bug
- **N8b 音频前端**（IP.9.2）：AudioResultPage 增加 6 个子任务勾选面板（VAD/说话人/音乐/转写/摘要/联想），结果页对应区块折叠展示
- **N7b 视频路径选择**（IP.9.3）：PreflightDrawer 增加 3 种视频分析路径选择（字幕直接/镜头分析/视频模型直接），按路径动态显示子参数
- **Payload 对齐**（fix）：前端 Preflight 参数与后端 pipeline payload 字段名对齐（`video_path_mode` → `analysis_mode`，`audio_tasks` → `enabled_tasks`）

### 为什么这么做
- **Flow Gaps 文档先行**：先用 `docs/plans/archive/phase-ip9-flow-gaps.md` 落盘 6 处缺口（流程图 + 代码位置），再逐个补齐，避免遗漏
- **Results 总览页独立路由**：SPEC s05 要求"结果总览"，原 ProcessingPage 只显示进度不展示结果，需要独立页面聚合四类结果
- **路径选择 vs 全选**：N7b 视频分析 3 条路径互斥（字幕直接 vs 镜头分析 vs 视频模型），用 radio 而非 checkbox 避免用户混淆
- **字段名对齐**：前端和后端对同一参数用了不同命名（如 `video_path_mode` vs `analysis_mode`），统一为后端命名减少桥接层转换

### 留给后续的影响
- N7b 路径 1（字幕直接）和路径 3（视频模型直接）的后端 handler 尚未实现，当前选择后会 fallback 到路径 2（镜头分析）
- N8b 音乐分析 6 维度切分 UI 已就绪，但后端 librosa 分析逻辑需等 N8b 后端 phase 完成
- Results 总览页的卡片样式为 Tier A（基础版），后续 [C] AI 导演阶段可升级为带预览图/波形图的 Tier B 版本

---

## N7b 路径 1 — 视频字幕直接总结后端 + 结果契约修复

**完成日期**：2026-05-21
**模型 / 工具**：小米 2.5 Pro
**分支**：main
**提交**：
- `f17c04a` feat(N7b): 视频路径 1 字幕直接总结后端
- `aac4578` fix(N7b): ResultsOverview 正确返回路径 1 字幕总结结果
- `9e8667e` fix(N7b): transcript 数组契约修复 + 前端防御 + 测试

### 影响范围
- 后端：`backend/app/services/pipeline_tasks.py`（核心实现）、`backend/app/routes/workspaces.py`（API 契约层）
- 前端：`frontend/src/pages/result/ResultsOverview/index.tsx`（防御性读取）
- 测试：`tests/backend/test_video_result_n7b.py`（新增 3 个用例）
- 文档：`docs/EXECUTION_PLAN.md`、`docs/ROADMAP.md`、`docs/AI_HANDOFF.md`、`docs/OUTSTANDING_TASKS.md`、`docs/COMPLETED_WORK.md`

### 关键改动
- **后端 pipeline_tasks.py**：
  - 新增 `_VIDEO_TEMPLATE_PROMPTS`（6 种视频类型模板：教程/Vlog/访谈/影视点评/产品评测/其它）
  - 新增 `_normalize_transcript_to_lines()`：统一将 string/segments 转为 `VideoResultTranscriptLine[]`
  - 新增 `_extract_audio_from_video()`：ffmpeg 音频提取
  - 新增 `_build_video_summary_prompt()`：按模板+深度构建 LLM 提示词
  - 新增 `_run_subtitle_summary()`：完整路径 1 流程编排（提取音频→Whisper 转写→LLM 总结→结构化输出）
  - 修改 `handle_analyze_task`：`summary_path == 'subtitle'` 时走路径 1
- **后端 workspaces.py**：
  - `_video_result_has_real_data()`：识别 `summary_path == 'subtitle'` 为有效结果
  - `_materialize_video_results_from_analyze()`：路径 1 跳过 JSON 文件处理，直接返回结构化结果
  - `get_item_result()`：对路径 1 的 transcript 做 string→array 规范化（兼容旧数据）
- **前端 ResultsOverview**：
  - `extractSummary`：优先读 `r.summary`（N7b 字幕总结）
  - `extractTranscriptPreview`：`Array.isArray` 防御，string 回退 slice(0,500)

### 为什么这么做
- **transcript 数组化**：前端 `VideoResultTranscriptLine[]` 要求 `{t_sec, t_str, text}` 数组，后端原来返回 string 导致 `TypeError: raw.split is not a function`
- **双层规范化**：后端 return 层 + API 层都做 string→array 转换，确保新数据和旧数据都安全
- **6 种模板**：流程图 `视频.png` 要求按视频类型（教程/Vlog/访谈等）输出不同结构，硬编码模板是最快落地方式
- **tracks_meta.transcript_count = 段数**：原来是字符数，前端期望段数（用于"前 N 段"时间轴展示）

### 留给后续的影响
- 路径 1 依赖 Whisper 模型可用（本地或 API），如不可用会返回空 transcript + error 信息
- `_VIDEO_TEMPLATE_PROMPTS` 硬编码在代码中，后续 V3 视频模板库阶段可改为数据库/文件存储
- 路径 3（Gemini/GPT-4o 视频直接分析）尚未实现，选择路径 3 会 fallback 到路径 2

---

## Phase R7/R8 — 输入流统一 + PreflightDrawer Remix 复刻

**完成日期**：2026-05-25
**分支**：feat/phase-r8-preflight-remix
**提交**：
- R7：`168e611`、`f0bcc94`、`4aa854e`、`23a5f28`、`e137b89`、`5d81753`
- R8：`fb28790`、`e13400b`、`8e98c27`、`915ecef`、`aa592d5`、`cc89351`、`c061071`、`d68b1b1`
- merge 前补丁：修复 stage 回写丢 R8 tasks/models、移除 PreflightDrawer 视觉模型残留、保存路径 3 `models.video`

### 影响范围
- 前端：`frontend/src/pages/WorkbenchPage/PreflightDrawer.tsx`、`frontend/src/pages/WorkbenchPage/preflightTasks.ts`、`frontend/src/components/workspace/AddMaterialModal.tsx`、`frontend/src/components/workspace/PreflightConfigPanel.tsx`、`frontend/src/pages/WorkbenchPage/Composer.tsx`、`frontend/src/pages/WorkbenchPage/Hero.tsx`、`frontend/src/pages/WorkbenchPage/workbench.css`
- 测试：`frontend/src/__tests__/PreflightDrawer.test.tsx`、`frontend/src/__tests__/AddMaterialModal.test.tsx`、`frontend/src/__tests__/preflightTasks.test.ts`
- 文档：`docs/plans/archive/phase-r7-input-flow-unify.md`、`docs/plans/archive/phase-r8-preflight-remix-replica.md`

### 关键改动
- **R7 输入流统一**：AddMaterialModal 单 URL 多类型默认全勾；Composer 传入 URL 时 modal 不再重复输入框；PreflightDrawer 增加 `mode="stage"`，从首页细调时只回写配置，不直接启动 pipeline。
- **R8 PreflightDrawer 复刻**：新增 media kind tabs、编号 section、背景 5 字段、任务卡片、PresetBar、级联锁定规则、footer 状态 pill，并把任务子参数序列化进 `savePreflight({ tasks })`。
- **merge 前修复**：stage 保存会回传 R8 `tasks/models`，AddMaterialModal 一键解析优先保存 staged tasks；执行模式使用级联后的 effective task state；路径 3 视频大模型写入 `models.video`。

### 验证
- `cd frontend && pnpm test --run`：8 files / 40 tests passed
- `cd frontend && pnpm build`：passed
- `.venv/bin/python -m pytest tests/backend -q`：310 passed / 2 skipped
- `cd frontend && pnpm exec eslint <R7/R8 touched files>`：passed；`pnpm lint` 仍被项目存量 baseline 拦截

### 留给后续的影响
- R8 仍只负责 UI 和 payload 落地；后端真正消费所有新增子参数留到后续阶段。
- `pnpm lint` baseline 需要单独技术债阶段处理，不能作为 R7/R8 merge 阻塞。

---

## IP.7 PreflightDrawer 真接 workspace 流程 + 自动建空间

**完成日期**：2026-05-20
**分支**：feat/ip7-preflight-fix
**提交**：
- `28693b5` feat(IP.7.1): 后端 /workspaces/auto-create 接口（LLM 自动命名）
- `2c45989` fix(IP.7.2): PreflightDrawer 改走 workspace item 标准流程
- `e83a69b` feat(IP.7.3): bridge 透传 Composer 高级参数到 download payload
- `5bbda50` test(IP.7.4): API 级冒烟测试通过

### 问题
用户粘 B 站 URL → Processing 显示 "no videos found"。Root cause: PreflightDrawer 硬编码 `task_type='analyze'`，绕过后端 bridge（本应 url→download→analyze 链式执行）。

### 关键改动
- **后端 auto-create**：`POST /workspaces/auto-create`，LLM 生成 4-12 汉字中文名，fallback 到 hostname+时间
- **前端 3 步流程**：`autoCreateWorkspace` → `addWorkspaceItem` → `savePreflight` → `startItemPipeline`，替代原来的 `createPipelineTask({ task_type: 'analyze' })`
- **bridge 透传**：`_bridge_to_pipeline_payload` video/url 分支新增从 background_overrides 透传 quality/frame_mode 等 6 个高级参数

### 为什么这么做
- 标准 3 步流程让后端 bridge 决定 task_type（url→download, local→analyze），不再由前端硬编码
- 自动建空间降低用户门槛：粘 URL 即可开始，不必先手动创建工作空间
- Composer 高级参数（画质/截帧模式等）通过 preflight.background_overrides 透传，保持参数链路统一

### 留给后续的影响
- download handler 暂不消费 quality 等参数（`_resolve_download_kwargs` 只读 format_selector），等 yt-dlp format 映射后再启用

---

## R21.P3.S3 收尾 — intent 链路修复 + av_combined 补图入口

**完成日期**：2026-05-29
**模型 / 工具**：mimo 2.5pro
**分支**：fix/r21-p3-s3-followup
**提交**：
- `0cf1e76` fix(r21.P3.S3): 打通 preflight 顶层 intent 字段，修复学习视频补图推荐恒空
- `ef633de` feat(r21.P3.S3): av_combined 结果页补充按需补图入口

### 问题
学习视频的"按需补图"链路断在 intent 字段写读不一致：
- 前端写入 `tasks.preflight.intent`（嵌套）
- 后端 `PreflightSaveRequest` 没有顶层 `intent` 字段 → `item.preflight.intent` 永远是空串
- 推荐帧接口 `get_suggested_inline_frames` 读顶层 intent → 永远 return []

另外 av_combined 帧分析路径没有转录列表，补图按钮无处挂载。

### 影响范围
- **后端 workspaces.py**：`PreflightSaveRequest` 加 `intent` 字段；`save_preflight` 构造 `PreflightConfig` 时传入 `intent`
- **前端 workspace.ts**：`PreflightSaveRequest` 类型加 `intent`
- **前端 AddMaterialModal.tsx**：`savePreflight` 调用时额外传顶层 `intent`
- **前端 VideoResultPage.tsx**：帧分析路径右侧面板加「📷 补图」按钮 + 挂载 `FramePickerModal`

### 关键改动
- 后端请求体加顶层 `intent: str = ""` 字段，`save_preflight` 传入 `PreflightConfig`
- 前端保存时同时写嵌套（analyze pipeline 读源）和顶层（推荐帧接口读源）
- 帧分析路径复用字幕路径已有的 `suggestedFrames`、`handleInsertFrame`、`FramePickerModal`
- 补图按钮用 `activeFrame` 作为 `segment_idx`

### 验证
- `cd frontend && npx tsc --noEmit`：EXIT=0
- `.venv/bin/python -m pytest tests/ -q`：354 passed / 2 skipped


---

## S0 E2E Bugfix — P1 数据串扰修复（S0.1-S0.3）

**完成日期**：2026-05-29
**模型 / 工具**：xiaomi mimo 2.5pro
**分支**：
- `fix/e2e-p1-subtitles-no-demo`（S0.1）
- `fix/e2e-p1-audio-result-has-real`（S0.2）
- `fix/e2e-p1-visual-only-srt-disabled`（S0.3）
**提交**：
- S0.1：`e6e2173` fix(e2e.p1): /subtitles 端口删 demo fixture 兜底，无 transcript 返回空 SRT
- S0.2：`b94f6c7` fix(e2e.p1): audio_result has_real 认 transcript_segments，修复 demo 兜底误触发
- S0.3：`a368370` fix(e2e.p1+): VideoResultPage visual_only 模式禁用字幕导出按钮

### 问题
E2E 测试发现 7 个问题，其中 3 个 P1 级数据串扰：visual_only 路径用户点 SRT 导出拿到「大疆 Pocket 4」demo 字符串；音频任务跑完 transcript 空 → fall through 到 demo 显示错误内容。

### 影响范围
- **后端 export.py**：删除 `/subtitles` 端口的 demo fixture 降级逻辑，无 transcript 时返回空 SRT + `X-Subtitle-Status: empty` header
- **后端 workspaces.py**：`get_audio_result` 的 `has_real` 判断同时认 `transcript` 和 `transcript_segments`；`tracks_meta.transcript_count` 兜底用 segments 长度
- **前端 VideoResultPage.tsx**：`isVisualOnly` 判断 → 字幕导出按钮 disabled + tooltip「仅画面分析模式无字幕数据」

### 关键改动
- S0.1：删除 `build_demo_audio_result` import + demo fixture 三段降级逻辑 → 空 SRT 返回
- S0.2：`has_real = ... and (results.get("transcript") or results.get("transcript_segments"))` 兜底 whisper 写入路径
- S0.3：按钮 `disabled={isVisualOnly}` + `opacity: 0.5` + `title` 提示

### 验证
- `.venv/bin/python -m pytest tests/backend -q -k "subtitle"`：16 passed
- `.venv/bin/python -m pytest tests/backend -q -k "audio_result"`：3 passed
- `cd frontend && npx tsc --noEmit`：EXIT=0
- S0.3 按钮禁用属 UI 交互，需用户帮看一眼确认 visual_only 任务按钮灰显

---

## E2E P2: S0.4 ResultsOverview React key 警告修复

**完成日期**：2026-05-29
**模型 / 工具**：xiaomi mimo 2.5pro
**分支**：`fix/e2e-p2-results-overview-key`
**提交**：`9cefd2a` fix(e2e.p2): ResultsOverview 补 unique key + AppShell stats 防御

### 问题
E2E 报告问题3：ResultsOverview 页面控制台报 "Each child in a list should have a unique key prop · Check the render method of ResultsOverview"。

### 真凶
`ResultsOverview/index.tsx:441` 的 `frames.slice(0,10).map((f) => <div key={f.idx}>` —— 当 frames 数据中 `idx` 字段未定义时（实际数据为 `[{}, {}, {}]`），`key={undefined}` 导致 React 报警。

### 影响范围
- **前端 ResultsOverview/index.tsx**：`key={f.idx}` → `key={f.idx ?? frame-idx}`（兜底 index）
- **前端 AppShell.tsx**：`stats &&` → `stats?.cpu && stats?.memory &&`（防御 stats 结构异常崩溃）
- **前端 vite.config.ts**：proxy 加 `/admin`（dev 模式下 `/admin/system/stats` 走代理，避免 CORS + HTML 响应导致崩溃）

### 验证
- Playwright dev console：0 errors, 0 warnings（修复前有 1 error = key 警告）
- `npx tsc --noEmit`：EXIT=0


---

## P1 仓库清理（S1-S3）— plans 归档 + 死链修复 + 未用资源清理

**完成日期**：2026-05-29
**模型 / 工具**：xiaomi mimo 2.5pro
**分支**：`chore/cleanup-plans-archive` / `chore/cleanup-unused-assets`

### S1 plans 老 done 归档 + 死链修复
- 39 个已归档 phase md（R0~R21）引用路径从 `plans/phase-xxx.md` 修正为 `plans/archive/phase-xxx.md`
- 涉及文件：EXECUTION_PLAN / AI_HANDOFF / COMPLETED_WORK / ROADMAP / track-F-flow / handoff 计划 / OUTSTANDING_TASKS
- 死链检查：0 命中

### S2 Streamlit 入口冻结标记
- **no-op**：Streamlit 文件（`app.py`、`pages/`、`src/vidmirror/ui/`）已于 Phase 1J（`de41e94`）删除，不存在
- 改为修正 CLAUDE.md §1 过时描述："Streamlit 旧入口已于 Phase 1J 移除，当前纯 FastAPI 后端 + React/Vite 前端"

### S3 未用 assets 清理
- 扫描结果：frontend/public 2 候选（icons.svg / favicon.svg），backend 0 候选，pages 0 候选
- 全仓 rg 确认：icons.svg 0 引用（可删），favicon.svg 1 引用（index.html，不删）
- 删除 `frontend/public/icons.svg`（Vite 模板默认社交图标 sprite）

### 验证
- 死链检查：0 命中
- `ls docs/plans/*.md`：仅剩 5 个保留文件（a2 / e2e-bugfix / handoff / r22 / r23）
- `npm run build`：tsc 报 `ItemCard.tsx` 预存类型错误（main 同样，与本次清理无关）

---

## S6 — R20 综合笔记多格式导出（PDF / Word / Obsidian）

**完成日期**：2026-05-29
**模型 / 工具**：xiaomi mimo 2.5pro
**分支**：feat/phase-r20-notes-export
**提交**：
- `6d0a35e` feat(r20): notes export endpoint + 格式分发
- `92de019` feat(r20): PDF 导出 — Jinja2 HTML 模板 + playwright chromium 渲染
- `a2724b2` feat(r20): Word 导出 — python-docx 构建
- `a6766a3` feat(r20): Obsidian Vault 导出 — zip 含 markdown + frames/
- `e9e539a` feat(r20): 前端 PDF/Word/Obsidian 下载按钮
- `82ec453` test(r20): export 单测 — md_parser + 3 格式 Content-Type + 错误码
- `f0e15f5` fix(r20): Content-Disposition 用 RFC5987 编码中文文件名

### 关键改动
- **后端**：`POST /{workspace_id}/notes/export`，body `{format:"pdf"|"docx"|"obsidian"}`
- **md_parser.py**：从 av_synthesis.md 提取结构化数据（标题/元信息/摘要/画廊/章节/转写/综合）
- **pdf_builder.py**：Jinja2 HTML 模板（`lecture.html.j2`）+ playwright chromium 渲染 A4 PDF，图片 base64 内嵌
- **docx_builder.py**：python-docx 构建 Word 文档，中文默认字体，图片内嵌，表格 Light Grid 样式
- **obsidian_builder.py**：zip 含 YAML frontmatter markdown + frames/ 帧图目录，[[wiki链接]]
- **前端**：AVSynthesisResultPage 启用 3 个导出按钮（移除 disabled + R20 标签）
- **测试**：13 个用例（md_parser 7 + endpoint 6）

### 设计决策
- md→html 方案选择 Jinja2 直接渲染 HTML（零新依赖），而非安装 markdown 解析库
- 图片用 base64 data URI 内嵌 HTML，避免 playwright 文件路径问题
- playwright 仅声明到 requirements.txt（环境已有），chromium 未安装时返回明确错误提示

---

## S0.5-S0.7 — E2E Bugfix P3 收尾（隐藏播放器 / B站412 / VLM 进度）

**完成日期**：2026-05-29
**模型 / 工具**：xiaomi mimo 2.5pro
**分支**：fix/e2e-p3-visual-only-no-player / fix/e2e-p3-bilibili-format-precedence / fix/e2e-p3-vlm-progress-granular
**提交**：
- `78c107c` fix(e2e.p3): visual_only 隐藏播放器，改显「仅画面分析模式」提示
- `272610e` fix(e2e.p3): B站 yt-dlp format 前置，减少 412 重试
- `849571d` fix(e2e.p3): VLM 进度每 5% 上报，消除「卡住后秒满」假象

### 影响范围
- 前端 `VideoResultPage.tsx`（S0.5）/ 后端 `shared/video_download_ytdlp.py`（S0.6）/ `backend/app/services/pipeline_tasks.py`（S0.7）

### 关键改动
- **S0.5**：`isVisualOnly` 时渲染 placeholder（不含播放器），否则正常播放器。
- **S0.6**：`_build_attempts` 对 B站 URL **只用去掉 `format` 参数的 attempts**（带 format 在 B站必 412），非 B站走原逻辑（移入 else）。实测尝试次数 7→1。
- **S0.7**：VLM 逐帧循环加 `last_reported_pct` 节流，相邻差 ≥5% 才 `set_progress`（两处循环都改）。
- **S0.8**（Composer URL input）按计划默认跳过，留给后续测试基础设施 phase。

### 为什么这么做
- E2E 报告的 P3 体验问题；S0.6 经 context7 查 yt-dlp B站策略后定方案。

### 留给后续的影响
- ⚠️ S0.5 placeholder 文案带了 `📽️` emoji，违反 DESIGN_TOKENS §8.9（UI 不写 emoji），后续 Claude Design 更新时去掉。

---

## S4 — N7b 路径 3 视频大模型直接分析（Gemini 后端骨架）

**完成日期**：2026-05-29
**模型 / 工具**：xiaomi mimo 2.5pro
**分支**：feat/phase-n7b-path3-gemini-skeleton
**提交**：
- `e5bbdd9` feat(n7b.s4): Gemini client 封装骨架 — 新建 shared/gemini_client.py
- `d596003` feat(n7b.s4): pipeline_tasks video_model 路径接 client
- `bc03189` test(n7b.s4): Gemini 视频分析骨架单测
- `a9ffd31` docs(n7b.s4): spec 标注路径 3 骨架就绪

### 影响范围
- 后端 `shared/gemini_client.py`（新建）/ `pipeline_tasks.py`（video_model 路径）/ `tests/backend/test_n7b_path3_gemini_skeleton.py`（14 单测）/ `docs/spec/04-video.md`

### 关键改动
- `GeminiVideoClient`：google-genai 新 SDK，File API（`files.upload` → `generate_content` → `files.delete`），`response_schema` 强制结构化 JSON `{summary, segments:[{start,end,text}]}`，默认 `gemini-2.5-flash`。缺 `GEMINI_API_KEY` 构造即 `raise RuntimeError`（明确提示）。延迟 import 不强依赖。
- pipeline `summary_path=="video_model"` 占位 raise 替换为真实调用；`_gemini_segments_to_transcript` 把 segments 映射成 `{t_sec, t_str, text}`，**精确对齐前端 VideoResultPage 读的字段**。

### 为什么这么做
- 用户决议视频大模型选 Gemini，但当前无 API key → 本期只做「骨架 + 接口预留 + mock 单测」，API 到位后填实现即可，无需新 phase。
- 接口形态（File API / 结构化 JSON / flash）由用户拍板。

### 留给后续的影响
- 联调前置：装 `google-genai`（venv 已有 1.75.0，requirements 暂未声明）+ 配 `GEMINI_API_KEY` 到 .env，再把 mock 单测替换为真实联调。

---

## N8b — music_segments 映射修复（多段音乐分析全链路打通）

**完成日期**：2026-05-29
**模型 / 工具**：xiaomi mimo 2.5pro
**提交**：`bdd3fb3` fix(n8b): result 补 music_segments 顶层映射，修复多段音乐分析不显示

### 影响范围
- 后端 `pipeline_tasks.py`（音频 result 组装，一行）

### 关键改动
- result dict 加 `"music_segments": music_dict.get("segments", []) if music_dict else []`，把嵌套的 `music.segments` 展平到顶层。

### 为什么这么做
- 核实「N8b 6 维度」时发现：6 维（genre/mood/instruments/atmosphere + 声学）的后端（`audio_analyzer.py` MusicSegment + segment_audio + analyze_music_segments）和前端（`AudioResultPage.tsx:557` 渲染）**早在 A3.3 就实现了**，唯一断点是 pipeline 返回 `music.segments`（嵌套）而前端读 `result.music_segments`（顶层）→ 永远 undefined。
- handoff §7 设想的「新增 onset density / tempo variance / style label」是**未核实代码的错误计划**（与实际 6 维完全不同），已标作废，避免重复造轮子。

### 留给后续的影响
- N8b 全链路打通；音频 Track 实际进度上调（ROADMAP §2 60%→80%）。

---

## build hotfix — LibraryItem 补 related_task_ids（修前端 build 失败）

**完成日期**：2026-05-29
**模型 / 工具**：Opus 4.8（主协调会话直接修）
**提交**：`669c4d1` fix(library): LibraryItem 补 related_task_ids 字段，修复前端 build 失败

### 影响范围
- 前端 `services/library.ts`（`LibraryItem` 接口，一行）

### 关键改动
- `LibraryItem` 加 `related_task_ids?: string[]`（可选，匹配 `ItemCard.tsx:41` 的可选链用法）。

### 为什么这么做
- `ItemCard.tsx:41` 引用 `item.related_task_ids` 但 `LibraryItem` 未声明 → `tsc -b`（`npm run build`）报 TS2339。此 baseline 错误自 `6ebc2ba`（R21.B1）潜伏，因日常用 `tsc --noEmit`（根 tsconfig，不走 project references）验证未覆盖到。

### 留给后续的影响
- ⚠️ **验证教训**：`tsc --noEmit` 不等于 `npm run build`（`tsc -b`）。发布前 / 改前端类型后应跑 `npm run build` 才能抓到 project references 范围的类型错误。

---

## Phase T2.2 — 网页抓取预览模态

**完成日期**：2026-05-29
**模型 / 工具**：xiaomi mimo 2.5pro
**分支**：feat/phase-t2.2-fetch-preview
**提交**：
- `0e90622` feat(t2.2): link_preview 可选返回 readability 正文
- `8c708d2` feat(t2.2): AddMaterialModal 网页正文预览确认

### 问题
T2.2 核实发现：link_preview.py 只返回 og 元数据（title/description/image_url），不返回正文；用户粘贴 URL 后直接入库，没有"先预览正文再确认"的 UI。

### 影响范围
- **后端 link_preview.py**：新增 `?include_content=true` 查询参数，复用 `shared/text_loader.load_url` 提取正文，返回 `content` + `word_count`。正文提取失败兜底返回空串（不报 500）。
- **后端测试**：新增 2 个测试（test_include_content / test_include_content_extraction_fail），覆盖正常 + 异常路径。
- **前端 linkPreview.ts**：新增 `fetchLinkPreviewWithContent` 函数 + `LinkPreviewWithContent` 接口。
- **前端 AddMaterialModal.tsx**：新增 `contentPreview` / `contentLoading` 状态 + effect 自动加载 + 预览 UI（前 5 段可滚动 + 字数）。

### 关键改动
- link_preview endpoint 加 `_extract_content(url)` 内部函数，调用 `load_url(url, timeout=10)` 提取正文，失败返回空串。
- AddMaterialModal 预览区落点：② 输入源与③分析任务之间，仅 `selectedTypes.includes('text')` 且有 URL 时显示。
- 预览加载失败时显示"无法提取正文（可能是动态加载页面），将使用链接直接入库"，不阻断提交流程。

### 验证
- `.venv/bin/python -m pytest backend/tests/test_link_preview.py -v`：6 passed
- `cd frontend && npx tsc --noEmit`：passed

### 留给后续的影响
- T2.2 完成；文字链路 T 的网页抓取扩展部分进度更新（T2.1 ✅ / T2.2 ✅ / T2.3 部分）。

---

## Phase T2.3 — 微信公众号适配

**日期**：2026-05-29
**分支**：`feat/phase-t2.3-wechat`
**Commits**：`ff71ff3` `37fbb8a`

### 背景
微信公众号正文在 `<div id="js_content">`，readability-lxml 抽取不干净（会混入导航、广告等），需要域名分支专门 xpath 抽取。

### 关键改动
- `shared/text_loader.py` `load_url()` 在 `html_text` 赋值后、readability 之前，检测 `mp.weixin.qq.com` 域名，用 lxml xpath 直抽 `#js_content`。
- 标题优先取 `h1#activity-name` 或 `h2.rich_media_title`，取不到回落 URL。
- 抽到非空才 return；失败或异常回落 readability（不 break 通用路径）。
- `meta["parser"] = "wechat"` 标记走了专门路径。

### 验证
- `pytest tests/backend/test_text_pipeline.py`：30 passed（含 2 个新增微信单测）
- 真实 URL 实测：`parser=wechat`，`char_count=5192`，正文完整

### 留给后续的影响
- 文字链路 T 进度更新：T2.1 ✅ / T2.2 ✅ / T2.3 ✅。
- 标题抽取可后续扩展更多 xpath 规则（当前不同微信模板标题 HTML 结构不统一）。

---

## Phase I1 — 图片 EXIF 提取 + 基本信息卡

**日期**：2026-05-29
**分支**：`feat/phase-i1-exif`
**Commits**：`b32405f`（后端）`176e010`（前端）

### 关键改动
- `backend/app/services/pipeline_tasks.py` `handle_image_task`（image_bytes 拿到后）用 Pillow 提取：
  - `getexif()` → Make/Model(设备) / LensModel(镜头) / DateTimeOriginal(时间)
  - `get_ifd(0x8769)`（ExifIFD）→ FNumber(光圈) / ExposureTime(快门) / ISOSpeedRatings(ISO)；GPSInfo → 经纬度坐标
  - **IFDRational 转 str**（光圈 `f/1.8`、快门 `1/200`）保证 result `json.dumps` 可序列化（关键坑）
  - dimensions: width/height/format/size_kb；PNG 等无 EXIF 兜底空 dict 不报错
- 前端：ImageResult 类型加 `exif`/`dimensions`；ImageResultPage 按设计稿 `image_detail.jsx` 加「基本信息」卡（分辨率/格式/大小）+「EXIF 拍摄信息」卡（设备/镜头/快门/ISO/光圈/时间/地点），无 EXIF 自动隐藏。

### 验证
- `pytest` 13 passed（JPEG 带 EXIF 验全字段 + PNG 无 EXIF 验空值）；`npx tsc --noEmit` EXIT=0。

### 留给后续的影响
- 图片 track I：**I1 ✅**；I2 批量任务（落点在 LibraryPage 而非 ImageResultPage，ROADMAP I2.1 描述不准）；I3 风格 DNA 建议缓到 [C] 复刻一起做（ROADMAP 标注重叠）。

---

## Phase I2.1 — 资料库批量分析（仅图片）

**日期**：2026-05-29
**分支**：`feat/phase-i2-image-batch`
**Commits**：`5a3650b`

### 关键改动
- `frontend/src/pages/LibraryPage/index.tsx`：
  - `handleBatchAnalyze`：从 `selectedSet` 中过滤 `type === 'image'` 的素材，循环调 `startItemPipeline`；非图片 toast.error 提示；全部完成后 toast.success + 清选中态 + 刷新列表。
  - 选择模式工具栏：「删除」按钮旁新增「批量分析」按钮（Sparkles 图标），disabled 条件 = `analyzing || selectedSet.size === 0`。
  - 复用已有浮动任务队列 + 结果页，零后端改动。

### 验证
- Playwright E2E：选择模式 → 工具栏出现「批量分析」按钮 ✅；勾选非图片 → 点批量分析 → toast「请选择图片素材」✅；`npx tsc --noEmit` EXIT=0 ✅。
- ⚠️ 资料库当前 0 张图片，无法实测实际触发分析流程。
- ⚠️ 已知行为：URL 来源图片触发后会重新下载（`handle_image_task` 设计如此，FETCH 阶段总是从 source 拉取）。

### 留给后续的影响
- 图片 track I：**I1 ✅ / I2.1 ✅**；I2.2（如果有）可考虑对已有本地文件跳过 FETCH 直接进 OCR/VLM。

---

## RP1-A 音频结果页打磨

**完成日期**：2026-05-30
**模型 / 工具**：xiaomi-mimo-2.5pro
**分支**：main（直接提交）
**提交**：
- A-1：`8c3e987` feat(rp1-a): A-1 转录段在线编辑 + 字幕导出 edited_text 优先
- A-3：`3143a3f` feat(rp1-a): A-3 摘要模板 segmented control + localStorage 缓存
- A-4：`fbd8e53` feat(rp1-a): A-4 音乐教学拆解图表组件 + recharts 依赖

### 子任务完成情况

**A-1 转录段在线编辑 + 导出 bug 修复**
- 新增 `PATCH /transcript/segments/{idx}` 端点，支持编辑单段转录文本（`edited_text` 字段）
- 修复字幕导出 bug：`_build_srt` / `export_srt` / `export_txt` / `export_vtt` / `export_ass` 优先读取 `edited_text`；`_normalize_segments` 保留 `edited_text` 字段
- 前端双击转录行进入编辑模式，支持保存/恢复原文
- 导出菜单增加"带说话人标注"开关
- 新增 7 个 pytest 验证 edited_text 导出逻辑

**A-2 说话人改名**
- 已有 `speaker_map` 机制（`PATCH /speaker_map` 端点 + 前端 `updateSpeakerMap`），说话人芯片条 + inline 改名 UI 已在 AudioResultPage.tsx 中实现
- ⚠️ 与规划差异：规划写的是用 `speaker_aliases` 存储，实际复用了已有的 `speaker_map` 字段（功能等价，无需新增字段）

**A-3 总结模板 segmented control**
- 新建面板改用 4 格 segmented control（精简/详细/小红书/公众号），更多模板通过下拉菜单选择
- localStorage 缓存已生成摘要（24h TTL），避免重复生成
- ⚠️ 超出规划：规划只说"加 segmented control 入口"，实际额外做了 localStorage 缓存机制

**A-4 音乐教学拆解**
- 新增 MusicTab / MusicBreakdown / MusicReport / MusicMaterialLibrary 四个 React 组件
- 新增 `music_teaching_prompts.py` 服务（LLM 教学解释生成）
- 音乐教学 API 端点 `POST /music-teaching/{seg_idx}`
- 添加 recharts 依赖用于图表渲染
- ⚠️ 超出规划：规划是"音乐分析三 sub-tab（素材库·报告·拆解）"，实际做了完整的图表可视化 + 教学拆解功能

**A-5 小修**
- 音频元信息卡（时长/来源/文件名/URL）已集成到 AudioResultPage 侧边栏
- 无独立 commit（包含在 A-1 中）

### 影响范围
- **后端**：export.py（导出 edited_text 优先）、workspaces.py（transcript PATCH + music-teaching POST）、music_teaching_prompts.py（新文件）
- **前端**：AudioResultPage.tsx（编辑+芯片+音乐 Tab）、audio-result.css、SummariesTab.tsx + CSS（模板 segmented control）、workspaces.ts（API 函数）、result/audio/ 四组件（新目录）
- **共享**：shared/audio_analyzer.py（导出函数 edited_text 优先）
- **测试**：backend/tests/test_export_edited_text.py（7 个用例）

### 验证
- `pytest backend/tests/test_export_edited_text.py -v`：7 passed
- `pnpm build`：EXIT=0

---

## RP1-A 二次迭代 · UI 设计稿对齐（2026-05-30）

**目标**：音频结果页 UI 全面对齐设计稿（颜色 / 字号 / 留白 / 空态提示）

### 改动
- **MusicReport.tsx**：硬编码 indigo 色板（#6366f1 等 6 色）改为设计稿语义色（accent-pink/purple/blue/warm/green，5 色轮转）
- **AudioResultPage.tsx**：新增 demo 数据提示条（"当前为示例数据…"），localStorage 记忆 dismiss 状态（key: audio-demo-banner-dismissed）
- **CSS 字号/留白**：已对齐设计稿（Tab nav 13px/500、段卡片 10px 12px、说话人头像 24px 圆形、时间戳 mono 11px、正文 14px 1.55 行高），无需改动

### 验证
- `pnpm build`：EXIT=0
- Playwright 截图 3 张（转录 / 音乐分析 / 总结）：docs/e2e-test/screenshots/rp1a-polish-*.png

### Commit
- `ec3b7d0` feat(rp1-a): 二次迭代 UI 对齐设计稿（颜色 / 空态提示）

---

## RP1-A 主题修复 + 页面整合（2026-05-30）

**目标**：修复主题分裂 bug（next-themes class 与 design-tokens.css data-theme 不互通）+ 挂载 ThemeSwitcher + 删两页内容重复

### 改动
- **main.tsx**：`<ThemeProvider attribute="class">` → `attribute={['class', 'data-theme']}`，统一两套主题系统
- **AppShell.tsx**：顶栏挂载 `<ThemeSwitcher />`（后端状态 chip 前），import ThemeSwitcher 组件
- **design-tokens.css**：`[data-theme="dark"]` 块补充 5 个 accent 色（pink/purple/blue/warm/green 提亮 10%）
- **AudioResultPage.tsx**：删除顶部 `<ItemTagsPanel>` 重复区块 + import；"任务中心" 按钮改"返回总览"并跳 overview 路由
- **ResultsOverview/index.tsx**：转录预览卡片后新增"打开详情 →"按钮，跳转对应 itemType 的 detail 页

### 验证
- `class="dark"` + `data-theme="dark"` 同时生效（DevTools 确认）
- ThemeSwitcher 可见可点击，light→dark→system 循环切换
- `pnpm build`：EXIT=0
- `npx tsc --noEmit`：EXIT=0
- Playwright 截图：dark/light 首页各 1 张（audio_detail/overview 因后端 offline 待补）

### Commit
- `ba28ada` feat(rp1-a): 主题分裂修复 + 挂 ThemeSwitcher + 删两页内容重复

---

## RP1-A 四迭 UI 整修（2026-05-30）

**目标**：4 个 UI 反馈一次性修 — 空 tab 隐藏 / 总结 UI 重设计 / Overview 重构 / 音频时间轴重做

### 改动
- **AudioResultPage.tsx**：tab 数组改 useMemo 按数据条件 filter（transcript/summary 始终显示，music/vocal/music_transcribe/prompts 按需）；activeTab fallback 到第一个可见 tab
- **SummariesTab.tsx + CSS**：空态居中引导卡片（2×2 模板 grid + 更多模板展开）；有总结时 sidebar 列表项显示模板名 + 内容预览；新增"重新生成"按钮；createSummary catch 500 含 "chat model" → toast + "去设置"按钮
- **ResultsOverview/index.tsx**：2 列网格布局（左主 2/3 + 右辅 1/3）；删 audio 转录预览重复卡片；右辅列 stat 小卡片 + 渐变"打开详情"按钮 + 纵向 action 列表
- **ResultsOverview/overview.css**：新增 2 列网格 + stat-mini + detail-btn + side-action 样式
- **extractAudioTimelineLines**：字段映射修复（transcript_segments.start → t_sec/t_str）；音频时间轴新形态（水平 bar + 圆点 + 前 10 段列表）

### 验证
- `pnpm build`：EXIT=0
- `npx tsc --noEmit`：EXIT=0
- Playwright 截图 4 张：overview light/dark + audio tabs filtered + audio summary empty

### Commit
- `2a75744` feat(rp1-a): 四迭 UI 整修 — 空 tab 隐藏 / 总结 UI 重设计 / Overview 重构 / 音频时间轴重做 + bug 修

---

## RP1-B B-1 学习笔记页双栏 + 视频播放器（2026-05-30）

**目标**：接通视频源 + ln.md 路径 + 设计稿样式对齐

### 改动
- **backend/app/routes/workspaces.py**：`get_item_result` 端点添加 video URL 本地解析（仿 audio 模式），优先返回 `/static/workspaces/{ws}/videos/{file}` 路径
- **backend/app/routes/export.py**：新增 `GET /{workspace_id}/ln` 端点，读取 `ln.md` 文件
- **frontend/src/services/workspaces.ts**：新增 `getLnMarkdown` 函数
- **frontend/src/pages/results/LearningNotesPage/index.tsx**：改用 `getLnMarkdown` 替代 `getAVSynthesisMarkdown`
- **frontend/src/pages/results/LearningNotesPage/learning-notes.css**：重写为 nibi 设计 token（--bg-elev, --ink, --line, --accent-2 等），字体用 --display/--sans/--mono

### 验证
- `pnpm build`：EXIT=0
- `npx tsc --noEmit`：EXIT=0
- 后端 video URL 解析逻辑已实现（需实际视频任务验证）
- ln.md 端点已添加（需实际 ln.md 文件验证）

### Commit
- pending feat(rp1-b): B-1 学习笔记页接通视频源 + ln.md 路径 + 设计稿样式对齐

---

## RP1-B B-2 学习笔记页字幕轨跟随 + 点击 seek（2026-05-30）

**目标**：移植视频复刻页的字幕轨到学习笔记页，实现高亮跟随 + 自动滚动 + 点击 seek

### 改动
- **frontend/src/pages/results/LearningNotesPage/LNVideoPanel.tsx**：改用 forwardRef + useImperativeHandle，对外暴露 seekTo(sec) 方法（带 0~duration 的 clamp）
- **frontend/src/pages/results/LearningNotesPage/LNTranscriptPanel.tsx**（新建）：字幕轨组件，实现 activeTranscriptIdx 算法（最后一个 t_sec ≤ 当前秒）、字幕行渲染、点击 seek、自动滚动到中央（scrollIntoView block:'center'）
- **frontend/src/pages/results/LearningNotesPage/index.tsx**：新增 getItemResult 请求取 transcript（失败兜底空数组）、新建 videoPanelRef、左栏渲染 LNTranscriptPanel
- **frontend/src/pages/results/LearningNotesPage/learning-notes.css**：新增 .ln-transcript-panel / .ln-tr-row / .ln-tr-row[data-active] / .ln-tr-time / .ln-tr-text 样式，全部用 nibi token

### 验证
- `pnpm build`：EXIT=0
- `npx tsc --noEmit`：EXIT=0
- Playwright 截图 4 张：rp1b-b2-{light,dark}-{playing,clicked}.png
- 字幕轨已显示（00:10, 00:30, 01:00 三行）
- 点击字幕行事件已触发（视频源为外部 bilibili 链接无法直接播放验证 seek）

### Commit
- `73733b5` feat(rp1-b): B-2 学习笔记页字幕轨跟随 + 点击 seek

## RP1-B B-3 学习笔记页 HTML/MD 视图切换 + 双向同步（2026-05-30）

**目标**：右栏笔记面板从只读 markdown 升级为 HTML 视图 / MD 源码视图可切换 + 双向同步

### 改动
- **frontend/src/pages/results/LearningNotesPage/HtmlView.tsx**（新建）：react-markdown 渲染 + contentEditable 包装 + DOMPurify 净化粘贴 + blur 时 turndown 转回 markdown；含 TOC h2/h3 提取（从旧 LNNotesPanel 迁移，B-6 复用）
- **frontend/src/pages/results/LearningNotesPage/MdView.tsx**（新建）：CodeMirror 6 核心 API（EditorState/EditorView + lang-markdown + history），内容变更即时回写 markdown
- **frontend/src/pages/results/LearningNotesPage/LNNotesPanel.tsx**：整个重写为 toolbar（HTML / MD 源码 segmented control）+ 根据 view 分发 HtmlView 或 MdView
- **frontend/src/pages/results/LearningNotesPage/index.tsx**：增量改 — markdown 提为独立 useState + view state（localStorage 'ln-view'）+ switchView（切走前 blur flush）+ 换 LNNotesPanel props；左栏 LNVideoPanel + LNTranscriptPanel 原样保留
- **frontend/src/pages/results/LearningNotesPage/learning-notes.css**：新增 .ln-toolbar / .ln-html-view / .ln-md-view 样式，全部 nibi token，light + dark 可读

### 依赖
- codemirror @codemirror/lang-markdown @codemirror/state @codemirror/view @codemirror/commands
- dompurify @types/dompurify（deprecated stub，dompurify 自带类型）
- turndown @types/turndown turndown-plugin-gfm
- remark-gfm 3→4（升级，修复与 react-markdown@10 的兼容性）

### 验证
- `pnpm build`：EXIT=0
- `npx tsc --noEmit`：EXIT=0
- Playwright 截图 4 张：rp1b-b3-{light,dark}-{html,md}.png
- HTML 视图：TOC、标题、加粗、斜体、行内代码、代码块、checkbox、表格、blockquote、链接全部渲染正确
- MD 视图：CodeMirror 6 行号 + markdown 源码渲染正确
- 视图切换内容不丢；localStorage 记住偏好

### Commit
- `cdb5a37` feat(rp1-b): B-3 学习笔记页 HTML/MD 双向同步

---

## RP1-B B-4 学习笔记在线编辑 + 自动保存（2026-05-30）

**目标**：编辑笔记后自动保存回 ln.md，刷新不丢

### 改动
- **backend/app/routes/export.py**：新增 `PATCH /{workspace_id}/ln` 端点 — 接收 `{ markdown }` 覆盖写 ln.md + bump `item.results['ln_version']`（整数 +1）+ 返回 `{ saved_at, version }`
- **frontend/src/services/workspaces.ts**：新增 `patchLnMarkdown(ws, markdown)` 函数
- **frontend/src/pages/results/LearningNotesPage/index.tsx**：markdown state 变化 → debounce 1500ms → 调 patchLnMarkdown；维护 saveState（idle/saving/saved/error）+ lastSavedAt；isInitialLoad ref 跳过首次加载；顶栏显示保存状态文案
- **frontend/src/pages/results/LearningNotesPage/learning-notes.css**：新增 `.ln-save-status` 样式（var(--ink-4) + var(--mono) 小字，margin-left:auto 右对齐）
- **backend/tests/test_ln_patch.py**（新建）：5 个测试 — 创建文件+返回 version / 写入内容正确 / version 递增 / 覆盖写 / 404

### 设计决策
- last-write-wins，不做并发冲突检测（单机用户）
- version 存在 video item 的 results JSON 字段里，不触发 DB schema 迁移
- debounce 用 setTimeout + useRef 自写，不装新依赖

### 验证
- `pytest backend/tests/`：100 passed
- `pnpm build`：EXIT=0
- `pnpm tsc -b`：EXIT=0

### Commit
- `07ae2b6` feat(rp1-b): B-4 学习笔记在线编辑 + 自动保存

---

## RP1-B B-5 截图插光标 + 字幕引用进笔记（2026-05-30）

**目标**：视频暂停 → 截当前帧 → 上传 → 插入 MD 编辑器光标位置；收纳 B-2 推迟的字幕引用按钮

### 改动
- **frontend/src/store/lnEditorStore.ts**（新建）：zustand store — `cmView: EditorView | null` + `setCmView` + `insertAtCursor(text): boolean`（dispatch insert 到 selection.main.head，无 view 返回 false）
- **frontend/src/pages/results/LearningNotesPage/MdView.tsx**：EditorView 创建后调 `useLnEditorStore.getState().setCmView(view)`，卸载时清空
- **backend/app/routes/export.py**：新增 `POST /{workspace_id}/ln/screenshots` — 接 multipart file + ts，存 `ws_root/ln-screenshots/shot-{ts:06d}-{HHmmss}.png`，返回 `{ url, filename }`（URL 对齐 /static 挂载）
- **frontend/src/services/lnScreenshots.ts**（新建）：`uploadLnScreenshot(ws, blob, ts)` — multipart POST
- **frontend/src/pages/results/LearningNotesPage/LNVideoPanel.tsx**：加"📷 截图插入"按钮 — canvas 抓帧 → toBlob → 上传 → `insertAtCursor(\`![截图@${tsStr}](${url})\n\`)`；6 项错误处理（readyState / getContext / toBlob / 上传 / 无编辑器 / 跨域）
- **frontend/src/pages/results/LearningNotesPage/LNTranscriptPanel.tsx**：每行加"引用"按钮（Quote icon）— `stopPropagation` 避免触发行级 seek → `insertAtCursor('> [' + t_str + '] ' + text + '\n')`；hover 时才显示
- **frontend/src/pages/results/LearningNotesPage/index.tsx**：传 `workspaceId` 给 LNVideoPanel
- **frontend/src/pages/results/LearningNotesPage/learning-notes.css**：新增 `.ln-video-toolbar` / `.ln-shot-btn` / `.ln-tr-quote` 样式

### 设计决策
- 跨组件通信用 zustand（项目已有 7 个 store），不做 ref forwarding（4 层 prop drilling）
- HTML 视图下截图 → toast 提示"请先切到 MD 视图"（方案 B，不做自动切换）
- 截图目录 `data/workspaces/{ws}/ln-screenshots/`，URL 拼法对齐 B-1 视频 URL 本地化
- 引用按钮 hover 才显示（opacity 0→1），不干扰字幕行的点击 seek
- 插入后 B-4 的 debounce PATCH 自动触发保存，无需额外处理

### 验证
- `pnpm build`：EXIT=0
- `pnpm tsc --noEmit`：EXIT=0
- `pytest backend/tests -q -k "ln"`：5 passed

### Commit
- `6a6cc16` feat(rp1-b): B-5 截图插光标 + 字幕引用进笔记

---

## RP1-B B-6 TOC 当前章节高亮 + 时间戳锚点 chip（2026-05-30）

**目标**：HTML 视图笔记加两个导航增强——TOC 滚动高亮 + 时间戳可点击 chip

### 改动
- **frontend/src/pages/results/LearningNotesPage/HtmlView.tsx**：
  - 接收 `onSeek` prop，用 scroll 事件监听器实现 TOC 当前章节高亮（替代 IntersectionObserver，contentEditable 兼容性更好）
  - 正则 `TS_RE` 解析 `[mm:ss]` / `[mm:ss~mm:ss]` / `[hh:mm:ss]` 为可点击 chip
  - `processChildren` 递归处理 ReactNode，只在 text 节点替换，代码块内不替换
  - `parseTs` 导出供测试使用
- **frontend/src/pages/results/LearningNotesPage/LNNotesPanel.tsx**：接收并转发 `onSeek` 给 HtmlView
- **frontend/src/pages/results/LearningNotesPage/index.tsx**：传 `onSeek={(sec) => videoPanelRef.current?.seekTo(sec)}` 给 LNNotesPanel
- **frontend/src/pages/results/LearningNotesPage/learning-notes.css**：
  - `.ln-html-scroll`：滚动容器（flex:1, overflow-y:auto）
  - `.ln-toc-item[data-active]`：左侧高亮条 + 文字加粗
  - `.ln-ts-chip`：inline、mono、accent-pink 文字、小圆角、hover 背景
- **frontend/src/__tests__/timestamp-chip.test.ts**（新建）：8 个测试用例覆盖 parseTs + TS_RE 正则匹配

### 设计决策
- 用 scroll 事件监听器替代 IntersectionObserver：contentEditable 内 observer 回调不稳定，scroll + getBoundingClientRect 更可靠
- 激活区阈值 = 容器高度 30%（靠上的 heading 才算"当前"）
- 时间戳 chip 只在 HTML 视图渲染，MD 源码视图保持纯文本
- onSeek 回调取区间起点秒数（如 `[01:30~05:00]` → 90 秒）

### 验证
- `vitest run timestamp-chip.test.ts`：8 passed
- `pnpm build`：EXIT=0
- Playwright 手测：4 个 chip 渲染成功 + TOC 滚动跟随高亮
- 截图归档：`rp1b-b6-toc-active.png` + `rp1b-b6-ts-chip.png`

### Commit
- `6ca4166` feat(rp1-b): B-6 TOC 当前章节高亮 + 时间戳锚点 chip

---

## RP1-B+ 方案 B — 按 intent 分流入口 + 学习/复刻顶栏 toggle

**完成日期**：2026-05-31
**模型 / 工具**：mimo 2.5pro
**计划文档**：`docs/plans/rp1b-intent-routing-mimo-prompt.md`
**合并说明**：整合并取代原 C-2 toggle 计划（`rp1-c2-mimo-prompt.md`）

### 问题
所有视频 item「打开」都跳 `video_detail`（复刻提示词布局），不看 intent。`intent=learning` + `summary_path=av_combined` 的视频也掉进复刻页，而它本该看的 md 总结（图文分镜）没有入口。

### 影响范围
- **frontend/src/types/workspace.ts**：`PreflightConfig` 接口添加 `intent?: string` 字段（与后端对齐）
- **frontend/src/pages/WorkspacePage/TaskboardPage/MaterialCard.tsx**：新增 `resolveItemRoute()` helper；`handleClick` 按 intent 分流（learning → `/ln`，其它 → `video_detail`）
- **frontend/src/pages/WorkspacePage/TaskboardPage/FavoritesTab.tsx**：同上，新增 `resolveItemRoute()` + `handleClick` 按 intent 分流
- **frontend/src/pages/FavoritesPage/FavoritesPage.tsx**：`resultRouteFor()` 按 intent 分流
- **frontend/src/pages/result/ResultsOverview/index.tsx**：新增 `resolveDetailRoute()` helper；3 处跳转改为按 intent 分流
- **frontend/src/pages/results/LearningNotesPage/index.tsx**：顶栏 `ln-nav` 添加 `[学习笔记 | 复刻]` toggle，复刻按钮跳 `video_detail`
- **frontend/src/pages/results/LearningNotesPage/learning-notes.css**：新增 `.ln-mode-toggle` / `.ln-mode-btn` 样式
- **frontend/src/pages/result/VideoResultPage.tsx**：两处 `vd-nav`（字幕模式 + 普通模式）添加 toggle，学习笔记按钮跳 `/ln`
- **frontend/src/pages/result/result.css**：新增 `.vd-mode-toggle` / `.vd-mode-btn` 样式

### 设计决策
- intent 取自 `item.preflight.intent`（后端 PreflightConfig 已有此字段，前端类型补上）
- toggle 样式参考设计稿 `storyboard.jsx` 的 sb-tabs（segmented 控件），当前页 `data-active="true"`
- 两页互切：/ln 的 `videoItem.item_id` 用于构建 video_detail 路由；video_detail 直接跳 `/workspaces/${ws}/ln`
- 不在 video_detail 重复实现 md 总结视图（方案 B 核心原则）
- 旧 `/result` 静态重定向保留不动（新入口不再走它，仅兼容旧 URL）

### 验证
- `pnpm tsc --noEmit`：EXIT=0
- `pnpm build`：EXIT=0
- Playwright 自动化测试：6 项全通过
  - learning 视频(484d8bb6…)「打开」→ 进 `/ln` ✅
  - `/ln` 顶栏 toggle 可见 ✅
  - 点「复刻」→ 切到 `video_detail` ✅
  - `video_detail` 顶栏 toggle 可见 ✅
  - 点「学习笔记」→ 切回 `/ln` ✅
- 截图归档：`rp1b-intent-{taskboard,after-click,ln-default,toggle-to-vd,vd-toggle}.png`

### Commit
- `39e9839` feat(rp1-b+): 按 intent 分流入口 + 学习/复刻顶栏 toggle（方案B/整合C-2）

---

## RP1-B+ 学习笔记页修复（数据源/视频源/md-html-pdf/toggle）

**完成日期**：2026-05-31
**模型 / 工具**：mimo 2.5pro
**计划文档**：`docs/plans/rp1b-learning-notes-fix-mimo-prompt.md`

### 问题
2026-05-31 用户实测 learning 视频的 /ln，发现 3 个问题：
1. /ln 笔记是「逐帧画面提示词」（图文分镜.md，复刻向）而非学习总结
2. /ln「暂无可用视频源」（videoSrc 取自 getWorkspace 的 item.results.video.url，没经 /static 适配）
3. HTML 视图空 / 双向同步多余（contentEditable+turndown 双向，用户要单向 md→html 美化预览）

### 影响范围
- **backend/app/routes/export.py**：GET /ln 优先级2 从读图文分镜.md 改为读 item.results.summary；删 _locate_analyze_report_dir import
- **backend/tests/test_ln_get_fallback.py**：图文分镜兜底用例 → summary 兜底
- **frontend/.../LearningNotesPage/index.tsx**：视频源改用 getItemResult 的 video.url；默认视图改 md；去掉 toggle + 导出菜单，简化为打印按钮
- **frontend/.../LearningNotesPage/HtmlView.tsx**：去掉 contentEditable/turndown/DOMPurify，改为纯只读美化预览
- **frontend/.../LearningNotesPage/LNNotesPanel.tsx**：HtmlView 不再接收 onMarkdownChange
- **frontend/.../LearningNotesPage/learning-notes.css**：美化 H1/H2 样式 + @media print 只留笔记正文

### 设计决策
- 后端三级降级：ln.md → item.results.summary → 404（删掉图文分镜那一路，它是复刻向）
- 视频源：getItemResult 返回的 video.url 已经过 /static 适配，直接用
- HTML = 纯只读美化预览（单向 md→html），md 编辑只在 MdView(CodeMirror)
- 导出 PDF = window.print() + @media print CSS（隐藏 nav/视频/toolbar，只留美化正文）
- toggle 去掉：intent 是单值（learning|replica），技术上不支持 "both"，toggle 永远不显示 → 直接移除
- 默认视图改 md（用户主要编辑 md，html 只是预览）

### 验证
- pytest 4/4 通过（summary 兜底 + ln.md 优先 + 404 + 不存在 ws）
- `pnpm tsc --noEmit`：EXIT=0
- `pnpm build`：EXIT=0

### Commit
- `c855d71` fix(rp1-b+): 学习笔记接 summary + 视频源修 + md源/html美化预览/pdf + toggle规则

## RP1-B B-8 学习笔记页内 AI 问答抽屉（2026-05-31）

**完成日期**：2026-05-31
**模型 / 工具**：mimo 2.5pro
**计划文档**：`docs/plans/rp1-b8-mimo-prompt.md`

### 改动
- **backend/app/routes/chat.py**：`ChatCreateRequest` 新增可选 `system_prompt` 字段；前端传 `system_prompt` 时直接用它替代 `build_item_context` 构建的上下文
- **frontend/src/services/chat.ts**：`CreateChatTurnRequest` 新增 `system_prompt` 可选字段
- **frontend/src/pages/results/LearningNotesPage/ChatDrawer.tsx**（新增）：浮动「问 AI」按钮 + 右侧 360px 抽屉 UI，复用 `createChatTurn` + `subscribeChatTurn` 流式模式
- **frontend/src/pages/results/LearningNotesPage/index.tsx**：import ChatDrawer；`useMemo` 构建 `chatSystemPrompt`（ln.md 全文 + transcript 字幕）；LNNotesPanel 外包一层 `position:relative` 容器，ChatDrawer 作为兄弟节点
- **frontend/src/pages/results/LearningNotesPage/learning-notes.css**：新增 `.ln-chat-fab` / `.ln-chat-drawer` / `.ln-chat-bubble-*` 等样式

### 设计决策
- 后端契约扩展：加 `system_prompt` 可选字段，优先级高于 `item_ids`，不破坏现有 ChatSidebar 行为
- 上下文由前端构建（ln.md 全文 + transcript 字幕段），通过 `system_prompt` 传给后端
- 抽屉 UI 复用 ChatSidebar 的流式模式（POST 创建 turn → SSE delta → done 重拉 messages）
- 作用域提示「仅基于本视频笔记与字幕回答」显示在抽屉顶部
- 不做全局问答、不做多会话管理、不装新依赖

### 验证
- `pnpm tsc --noEmit`：EXIT=0
- `pnpm build`：EXIT=0
- Playwright 手测：问「这个视频讲了什么？」→ 流式返回基于笔记+字幕的详细回答

## RP1-C0 视频复刻页数据契约修复（2026-05-31）

**完成日期**：2026-05-31
**模型 / 工具**：mimo 2.5pro
**计划文档**：`docs/plans/rp1-c0-data-contract-mimo-prompt.md`

### 问题
视频复刻页前端契约期望 frames 包含 `image_path`, `sec`, `ts`, `prompt_mj` 等字段。但 `_materialize_video_results_from_analyze` 函数存在两个 bug：
1. 提前返回逻辑只检查 `results["frames"]` 是否存在，没有检查是否是目标格式
2. 字段映射缺失：视觉 JSON 字段是 `image_prompt_en`，代码直接读 `prompt_mj`（空值）

### 改动
- **backend/app/routes/workspaces.py**：
  - 新增 `_is_target_frame_format(frames)`：检查 frames 是否已具备目标字段（`image_path`, `sec`, `ts`, `prompt_mj`）
  - 新增 `_convert_absolute_to_static_url(abs_path, data_root)`：把绝对路径转成 `/static/...` URL
  - 修改 `_materialize_video_results_from_analyze`：只有目标格式才提前返回；支持合并 raw frames 和视觉 JSON frames；修复 `image_prompt_en` → `prompt_mj` 映射；`prompt_sd`/`prompt_video` 用 `image_prompt_en` 兜底
- **backend/tests/test_video_result_materialize.py**（新增）：19 个测试用例
- **docs/plans/rp1-c0-data-contract-mimo-prompt.md**（新增）：计划文档
- **docs/EXECUTION_PLAN.md**：添加 C-0 条目

### 设计决策
- `_is_target_frame_format` 只检查第一帧，因为所有帧格式一致
- raw frames 与视觉 JSON 按顺序合并：优先保留 raw frame 的真实图片路径，补充视觉 JSON 的元数据
- `prompt_sd` 没有源字段时用 `{ positive: image_prompt_en, negative: "" }` 兜底
- `prompt_video` 没有源字段时用 `image_prompt_en` 兜底
- `summary_path=subtitle` 路径不受影响（已有的 early return 逻辑）

### 验证
- pytest 133/133 通过（含 19 个新增测试）
- `pnpm tsc --noEmit`：EXIT=0
- `pnpm build`：EXIT=0

### Commit
待提交

---

## RP1-C0.1 补修：frames_dir 兜底用 timestamp 拼文件名（2026-05-31）

**完成日期**：2026-05-31
**模型 / 工具**：mimo 2.5pro
**父任务**：RP1-C0

### 问题
frames_dir 兜底找图用 idx 秒数拼文件名，但应该用 timestamp/sec。导致 timestamp=00:00:03, idx=2 时找不到 *_00_00_03.jpg。

### 改动
- **backend/app/routes/workspaces.py**：把 timestamp 解析提前到 frames_dir 兜底逻辑之前；用 `int(sec_val)` 转时分秒拼文件名
- **backend/tests/test_video_result_materialize.py**：新增 2 个测试（timestamp vs idx、重复 timestamp 复用）
- **docs/plans/rp1-c1-mimo-prompt.md**：`frame.url` → `frame.image_path`；点击缩略图用 `seekTo(frame.sec)` 不新增 `setActiveFrame`
- **docs/plans/rp1-c0-data-contract-mimo-prompt.md**：追加 C-0.1 章节

### 验证
- pytest 135/135 通过（含 21 个 C-0/C-0.1 测试）
- `pnpm tsc --noEmit`：EXIT=0
- `pnpm build`：EXIT=0

### Commit
待提交

---

## RP1-C-1 视频复刻页主帧大视图 + 缩略图轨道（2026-05-31）

**完成日期**：2026-05-31
**模型 / 工具**：mimo 2.5pro
**父任务**：RP1-C

### 改动
- **frontend/src/pages/result/VideoResultPage.tsx**：
  - 新增主帧大图区域（`vd-main-frame`），显示 `frames[activeFrame].image_path`，点击打开 lightbox
  - 新增缩略图横向轨道（`vd-thumb-track`），80×60 缩略图，`data-active` 高亮跟随 `activeFrame`，点击 `seekTo(frame.sec)`
  - `activeFrame` 变化时 `scrollIntoView({inline:'center'})` 居中当前缩略图
  - 视频播放器缩小为次要位置（`vd-player-mini`），保留播放/暂停能力
  - 新增 lightbox 全屏遮罩（自写，fixed + Esc/点遮罩关闭）
  - 新增 `Maximize2`/`X` 图标 import、`lightboxOpen` 状态、`activeThumbRef` ref
- **frontend/src/pages/result/result.css**：
  - 新增 `.vd-main-frame-area` / `.vd-main-frame` / `.vd-thumb-track` / `.vd-thumb[data-active]` / `.vd-player-mini` / `.vd-lightbox` 系列样式
  - 全部使用 nibi token，支持 light/dark

### 验证
- `pnpm tsc --noEmit`：EXIT=0
- `pnpm build`：EXIT=0
- Playwright 手测：主帧大图渲染、缩略图 21 帧 + 点击切帧 + 高亮跟随、lightbox 打开/Esc 关闭
- 截图：`rp1c-c1-main-frame.png` / `rp1c-c1-thumb-track.png` / `rp1c-c1-lightbox.png`

### Commit
feat(rp1-c): C-1 复刻页主帧大视图 + 缩略图轨道

---

## RP1-C-3 帧多选 + 批量复制 + 导出复刻包（2026-05-31）

**完成日期**：2026-05-31
**模型 / 工具**：mimo 2.5pro
**父任务**：RP1-C
**Commit**：`35ac5cf` feat(rp1-c): C-3 帧多选 + 批量复制 + 导出复刻包

### 改动
- **frontend/src/pages/result/VideoResultPage.tsx**：
  - 新增 `selectedFrames` (Set\<number\>) 状态 + `lastClickedIdx` ref + `exporting` 状态
  - `handleFrameSelect(idx, e)`: Shift 连选区间 [lastClickedIdx, idx]，普通点击 toggle
  - `selectAllFrames` / `clearSelectedFrames` 全选/清空
  - `handleBatchCopy`: 拼接选中帧 prompt_mj → clipboard
  - `handleExportReproduce`: 调 service POST → blob 下载
  - 缩略图加 `data-selected` 属性 + checkbox 叠层 `.vd-thumb-check`
  - 点击缩略图行为：Shift/Meta/Ctrl → 多选，普通 → seekTo
  - 工具栏 `.vd-select-bar`：已选计数 + 复制/导出/全选/清空按钮
- **frontend/src/services/workspaces.ts**：
  - 新增 `exportReproducePackage(ws, item, frameIndices)` — POST reproduce/export → blob 下载
- **frontend/src/pages/result/result.css**：
  - `.vd-thumb[data-selected]` 橙色边框、`.vd-thumb-check` checkbox 叠层、`.vd-select-bar` 工具栏、`.vd-btn-tool` 按钮
- **backend/app/routes/workspaces.py**：
  - 新增 `POST /{ws}/items/{item}/reproduce/export` 端点
  - 接收 `{ frame_indices: int[] }`，zip 打包 frames/*.jpg + prompts.txt + styles.json + manifest.json
  - 用 zipfile + BytesIO + StreamingResponse 流式返回
  - 新增 import: `io`, `zipfile`, `StreamingResponse`
- **backend/tests/test_reproduce_export.py**：4 个测试用例
  - test_export_basic: 选 2 帧校验 zip 内容（manifest/prompts/styles）
  - test_export_invalid_indices: 无效索引 → 400
  - test_export_workspace_not_found: 不存在 ws → 404
  - test_export_single_frame: 单帧导出

### 验证
- `.venv/bin/python -m pytest backend/tests -q`：139 passed
- `pnpm tsc --noEmit`：EXIT=0
- `pnpm build`：EXIT=0

---

## RP1-C-4 帧提示词在线编辑 + 版本（2026-05-31）

**完成日期**：2026-05-31
**模型 / 工具**：mimo 2.5pro
**父任务**：RP1-C
**Commit**：`8b712ef` feat(rp1-c): C-4 帧提示词在线编辑 + 版本

### 前置调查
版本是 **item 级**（`prompt_versions: Dict[str, List[PromptVersion]]`，按 item_id 索引），不是 frame 级。现有 `PromptVersionStack` + `addPromptVersion` 接口不需要改。

### 改动
- **frontend/src/pages/result/VideoResultPage.tsx**：
  - 新增 `editing` / `editText` / `selectedVersionIdx` 状态
  - `startEdit`: 预填当前提示词（或选中版本内容）
  - `saveEdit`: 带帧标记 `[帧 N (ts)]` 调 `handleAddPromptVersion`
  - `cancelEdit`: 还原
  - 切帧自动退出编辑态（`useEffect` on `activeFrame`）
  - 提示词区 UI 改造：标题行 + "✎ 改"按钮 → textarea 编辑态 → 保存/取消
- **frontend/src/components/result/PromptVersionStack.tsx**：
  - Props 新增 `selectedIdx?: number | null` / `onSelectVersion?: (idx) => void`
  - VersionDropdown 新增 `selectedIdx` prop，按钮标签显示选中版本号
  - 版本预览区显示选中版本内容（非最新）
  - dropdown 选择时调 `onSelectVersion`

### 验证
- `pnpm tsc --noEmit`：EXIT=0
- `pnpm build`：EXIT=0
- `.venv/bin/python -m pytest backend/tests -q`：139 passed

---

## RP1-C-5 复刻页小修 — 帧标题改名（2026-05-31）

**完成日期**：2026-05-31
**模型 / 工具**：mimo 2.5pro
**父任务**：RP1-C（收尾）
**Commit**：`7767158` feat(rp1-c): C-5 复刻页小修 — 帧标题改名

### 前置核对
- **标签展示**：已存在（`Object.values(frame.tags ?? {}).flat()` 渲染为 chip）→ 跳过
- **重试端点**：后端无 frame 级 status/retry 机制，`VideoResultFrame` 无 status 字段 → 超出小修范围，跳过

**C-5 范围说明**：失败帧「重试」因当前无 frame status（失败态）机制未实现 → 转 backlog（见 OUTSTANDING_TASKS）；本次完成 = 帧标题改名 + 标签展示（原已有）。
- **帧标题**：只读展示，无编辑功能 → 实现

### 改动
- **backend/app/routes/workspaces.py**：
  - 新增 `PATCH /{ws}/items/{item}/frames/{idx}/title` 端点
  - 标题存入 `item.results.frame_title_overrides`（Dict[str, str]，key=帧索引字符串）
  - GET result 端点在 `_materialize_video_results_from_analyze` 后合并 overrides
  - 新增 `FrameTitleRequest` model + 4 个测试
- **frontend/src/services/workspaces.ts**：
  - 新增 `updateFrameTitle(ws, item, frameIdx, title)`
- **frontend/src/pages/result/VideoResultPage.tsx**：
  - 新增 `titleEditing` / `titleEditValue` / `frameTitles` 状态
  - `displayTitle` 优先取 `frameTitles[activeFrame]`，兜底 `frame.title`
  - 右侧面板帧标题点击 → inline input（Enter 保存 / Esc 取消）
  - 保存后 `frameTitles` 本地更新 + PATCH 持久化
- **backend/tests/test_frame_title.py**：4 个测试用例

### 验证
- `.venv/bin/python -m pytest backend/tests -q`：143 passed
- `pnpm tsc --noEmit`：EXIT=0
- `pnpm build`：EXIT=0

---

## Phase R24 — VLM 多帧并发提速（并发数随性能档位）

**完成日期**：2026-06-01
**模型 / 工具**：Opus 4.8（Claude Code）
**分支**：main（直接提交，沿用本项目 main 工作流）
**提交**：
- `227cc7c` perf(video): VLM 多帧并发调用提速

### 问题
用户反映视频分析慢（106 帧约 1 小时）。原以为是「逐帧串行调 VLM」，但读码确认：截帧 VLM 调用**早已并发**——`shared/video_analyzer.py:process_video` 用 `ThreadPoolExecutor(max_workers=API_CONCURRENCY)`，`API_CONCURRENCY=3` 固定。慢的真因是「Qwen3-VL-32B 单帧 ~100s × 帧数 ÷ 3」。所以真正的杠杆不是「加并发」，而是「把并发数调高」。同时发现 R22 协作取消有缺口：`_cancel_event` 只让 pipeline 轮询循环退出，没传进后台 daemon，取消后截帧 worker 仍把帧全部跑完。

### 影响范围
- **shared/settings_store.py**：`_TIERS` 增 `vlm_concurrency`（low=3 / medium=6 / high=8）+ `PerformanceConfig.vlm_concurrency` property——并发档与 R23 性能档位联动的真相源。
- **shared/video_analyzer.py**：`run_batch_analysis` / `process_video` / `_analyze_frame_task` 增 `concurrency` + `cancel_event` 两个可选参数（默认 `None` 回退 `API_CONCURRENCY`，向后兼容旧调用与测试）。
- **backend/app/services/pipeline_tasks.py**：新增 `_tier_vlm_concurrency()`；3 个 VLM 调用点（av_combined / N7 / R22 并行轨）都传并发档；3 处取消点把事件 `set()` 下沉到 worker。
- **tests/test_video_analyzer_concurrency.py**：新增 7 个单测。

### 关键改动
- 并发数从「固定 3」改为「随性能档位 3/6/8」，经 `_tier_vlm_concurrency()` 注入；`process_video` 内 `worker_count = concurrency or API_CONCURRENCY`。
- `cancel_event` 下沉：`_analyze_frame_task` 顶部检查取消即返回 None（不发起 VLM 调用）；`process_video` 提交循环检查取消停止提交、收集循环取消时 `f.cancel()` 撤销排队帧并跳过全局总结；用户主动取消时 pipeline 三处 `is_cancel_requested` 分支补 `_cancel_event.set()`。
- 帧顺序由既有 `frames.sort(timestamp)` 保证；进度 `frame_count` 在 `as_completed` 中单调递增；并发上限 8 防 SiliconFlow 429 限流；未引入新依赖（标准库 `concurrent.futures`）。
- **为什么这么做**：起点已是并发 3，提到 6/8 约 2~2.7×（106 帧 1h → 22~30min）；要进「十几分钟」需进一步「多图合并减少调用次数」→ 已规划 R25（`docs/plans/r25-vlm-batch-mimo-prompt.md`）。

### 验证
- `.venv/bin/python -m pytest tests/backend/test_pipeline_tasks.py tests/test_video_analyzer_smoke.py tests/test_video_analyzer_concurrency.py tests/backend/test_performance_tier.py -q`：72 passed
- 确定性基准（sleep 模拟单帧）：并发 3→2.8× / 6→5.5× / 8→7.3×，近线性。
- 真实视频端到端耗时对比：**待用户跑**（需真实 SiliconFlow key + 视频；非代码层可验证）。

---

## Track K · R0 — note_assembler 核心 + 只读 API + 文档收口

**完成日期**：2026-06-05
**模型 / 工具**：Opus 4.8（Claude Code）
**分支**：feat/k-r0-1-note-assembler
**提交**：
- R0.1：`067e083` feat(k-m7-r0.1): note_assembler 核心 + 单测
- R0.2：`257dd68` feat(k-m7-r0.2): 只读 API GET /…/note + 前端 service
- R0.3：文档收口（本 commit）

### 问题
R0 的目标是把 WorkspaceItem 已有的 results/tags/summaries 数据按统一 schema 序列化为 md 文件落盘，为后续 NoteShell 统一笔记页提供标准化数据层。不调 LLM，不改任何现有消费方。

### 影响范围
- **后端 `backend/app/services/note_assembler.py`**（新增，218 行）：
  - `note_dir(ws_id, item_id)` — 返回 `<ws>/notes/<item_id>/` 路径
  - `build_frontmatter(item, ws_id)` — 按 §3.4 schema v1 构建 frontmatter dict
  - `build_source_md(item)` / `build_note_md(item, frontmatter)` — 按 item.type 取正文来源（text=content；audio/video=transcript 拼可读 md；image=ocr_text+description）
  - `serialize_summaries(item, item_note_dir)` — 逐条写成 `summaries/<template>/v<n>.md`
  - `assemble_item_note(ws_id, item_id, *, overwrite=True)` — 组装 + 落盘，best-effort 不抛异常
- **后端 `backend/app/routes/workspaces.py`**（+79 行）：
  - 新增 `GET /{workspace_id}/items/{item_id}/note` 路由，惰性组装：目录不存在时从 task store 回填 results 再 assemble
- **前端 `frontend/src/types/workspace.ts`**（+17 行）：
  - 新增 `ItemNoteSummary` / `ItemNote` 接口
- **前端 `frontend/src/services/workspaces.ts`**（+10 行）：
  - 新增 `getItemNote(workspaceId, itemId)` 函数（仅 service，UI 留给 R1）
- **测试 `backend/tests/test_note_assembler.py`**（新增，437 行）：
  - 25 项测试：4 类型 frontmatter 字段 / 正文来源 / summaries 落盘 / 幂等（overwrite=True/False）/ best-effort

### 关键设计决策（§3.3 摘要）
- per-item 目录：`<ws>/notes/<item_id>/`，用 item_id 不用 task_id（用户视角稳定）
- note.md 初始正文 = 当前主体全文；summaries 不自动并入 note.md（R1 才「应用到主笔记」）
- source.md = 原始依据（偏只读），text 类型与 note.md 可能相同——预期行为
- 惰性组装：API 读时若目录不存在则自动 assemble 一次，覆盖历史 item
- assemble 失败 best-effort（try/except + 日志），绝不阻断 item 分析主流程

### 验证
- `KMP_DUPLICATE_LIB_OK=TRUE .venv/bin/python -m pytest backend/tests/test_note_assembler.py -v`：25 passed
- `pnpm tsc --noEmit`：通过
- `pytest backend/tests/test_item_summary.py backend/tests/test_summaries.py backend/tests/test_structured_summary_parse.py`：32 passed，零回归

## Track K · R1 — NoteShell 壳 + Markdown 编辑 + 总结风格面板（2026-06-05）

分支：`feat/k-r1-1-note-write`，含 R1.1 / R1.2 / R1.3 三个子任务。

### 问题
R0 提供了只读 `GET /…/note` API 和 md 落盘，但没有编辑能力和 UI。R1 的目标是：搭建统一笔记壳 NoteShell + 打通 note.md 写接口 + 接入总结风格面板（先只接 text 跑通）。

### 影响范围
- **后端 `backend/app/routes/workspaces.py`**（+103 行）：
  - 新增 `PUT /{workspace_id}/items/{item_id}/note`，body=`{body}`；保留旧 frontmatter 机器字段、version+1、updated_at、user_edited=true
  - note.md 不存在时先 assemble_item_note 拿 frontmatter 再写
- **后端 `backend/app/models/workspace.py`**（+1 行修复）：
  - `from_dict` legacy summary 迁移：`results["summary"]` 可能是 dict，加 `isinstance(str)` 防崩溃
- **前端 `frontend/src/pages/result/NoteShell/index.tsx`**（新增，~370 行）：
  - NoteShell 壳：顶栏（返回/标题/类型徽章/视图切换/保存状态）
  - TagChips：frontmatter.tags → chips 展示
  - NoteEditor：独立 CodeMirror 实例（不依赖 lnEditorStore），1.5s debounce 自动保存
  - 视图记忆 `localStorage('nibi-note-view-mode')`：阅读(ReactMarkdown) / Markdown(CodeMirror)
  - SummariesPanel（折叠式）内嵌 SummariesTab + onApplyToNote 回调
  - SourcePanel：source.md 只读折叠区
- **前端 `frontend/src/components/SummariesTab.tsx`**（+20 行）：
  - 新增可选 prop `onApplyToNote?(summary: ItemSummary)`，存在时显示「应用到主笔记」按钮
  - 旧页不传 → 按钮不显示 → 零回归
- **前端 `frontend/src/services/workspaces.ts`**（+10 行）：新增 `putItemNote`
- **前端 `frontend/src/router.tsx`**（+5 行）：新增路由 `…/items/:itemId/note` → lazy NoteShell
- **前端 `frontend/src/pages/result/TextResultPage.tsx`**（+10 行）：顶部加「统一笔记(beta)」入口按钮
- **测试 `tests/backend/test_item_note_write.py`**（新增）：5 项测试全部通过

### 关键设计决策
- 正文编辑只提交 body（不含 frontmatter），前端永不碰 YAML——frontmatter 全由后端维护
- NoteEditor 独立于 ln 的 MdView（不用 lnEditorStore 全局单例），避免与 /ln 页面冲突
- 应用到主笔记 = `putItemNote(summary.content_md)`，统一走同一个写接口
- viewMode 用 localStorage 持久化，跨会话记忆

### 验证
- `pnpm tsc --noEmit`：0 error
- `pnpm build`：成功
- `KMP_DUPLICATE_LIB_OK=TRUE .venv/bin/python -m pytest tests/backend/`：457 passed, 0 failed
- API 烟测：创建 text item → PUT /note → GET /note，frontmatter.version 递增到 2，user_edited: true，正文读回一致
- 前端 NoteShell 路由 HTTP 200，Vite 返回入口页

### 已知基线风险（R1 非直接来源，记录备查）
1. **`./dev.sh` 本轮运行失败**：前端 pid 写入时报 `../.local/frontend.pid: No such file or directory`。本轮手动启动前后端完成 API/路由烟测，不能写"dev.sh 验收通过"。
2. **`pnpm test`（vitest）14 失败**：125 个测试里 111 通过、14 失败。失败集中在既有基线：SummariesTab 测试缺 Router 包裹、AddMaterialModal 旧断言、AVSynthesis 导出按钮断言。R1 对 SummariesTab 只新增可选 `onApplyToNote` 按钮，不是这些失败的直接来源。

## Track K · R2 — 对照视图 + 三态切换 + 收口（2026-06-05）

分支：`feat/k-r2-1-compare-view`，含 R2.1 / R2.2 两个子任务。

### 问题
R1 完成后 NoteShell 只有「阅读 | Markdown」两态。R2 的目标是：把正文区扩展为「阅读 | Markdown | **对照**」三态。对照 = 桌面宽屏左右分栏（左编辑右预览），窄屏自动降级回两态。**不装任何新库**（复用现有 `react-markdown` + `@codemirror/*`）。

### 影响范围
- **前端 `frontend/src/pages/result/NoteShell/index.tsx`**（+50 行）：
  - `ViewMode` 类型从 `'read' | 'edit'` 扩展为 `'read' | 'edit' | 'compare'`
  - 切换按钮数组改为 `['read','edit','compare']`，标签「阅读 | Markdown | 对照」
  - 新增 `CompareView` 小组件（就地定义）：左 = `<NoteEditor>`，右 = `<ReactMarkdown>`，共享 `editingBody` + `handleEditorChange`，保存逻辑完全复用 R1
  - R2.2 增强：右栏加「预览 | source 原文」toggle（数据来自 `note.source_md`，只读）
  - `matchMedia('(min-width: 1024px)')` 窄屏降级：窄屏不渲染「对照」按钮；localStorage 存 `compare` 时进页 fallback 到 `read`
  - localStorage 读取兼容三值

### 关键设计决策
- **不装库**：用户 2026-06-05 拍板「先做对照视图，不装库」。真·WYSIWYG（Tiptap/Milkdown）记为 backlog，后续单独评估
- 对照左右共享同一份 `editingBody`，左边改 = 右边实时变 = 1.5s 自动保存，零新增 save 代码
- 窄屏降级用运行时 `matchMedia` 监听，缩窗时实时切回阅读态

### 验证
- `pnpm tsc -b`：0 error
- `pnpm test`（vitest）：14 fail（基线，不新增）
- 手测：三态切换正常；对照左改右实时预览；对照态自动保存 + 刷新保持；窄屏无对照按钮不卡死
- 回归 R1：阅读/Markdown/应用到主笔记/概览条/source 折叠全部正常
