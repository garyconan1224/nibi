# Track F：全流程（Flow）

> 来源：原 `docs/ROADMAP.md` §3（拆分于 2026-05-26）。
> 目的：确保从粘 URL 到看到结果的每一步都不掉链，体验顺畅。

---

## F1 流程缺口补齐（IP.9）

**索引**：`docs/plans/phase-ip9-flow-gaps.md`
**前置**：IP.8 已合并 ✅
**模型分配**：UI 层 ⭐ deepseek v4-pro；后端层 Sonnet / Opus
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
  - **改动文件**（< 5 个，deepseek v4-pro cover）：
    - 新增 `frontend/src/lib/url.ts`：`normalizeMediaUrl(raw)` 处理①纯 BV 号 → 拼完整 URL ②缺 scheme 补 `https://` ③去追踪参数白名单（`spm_id_from / vd_source / share_source / share_medium / bbid / ts / unique_k`）④去尾斜杠便于 dedup
    - 改 `frontend/src/pages/WorkbenchPage/Composer.tsx`：提交前调用 `normalizeMediaUrl()`，让 `detectPlatform` 和后端拿到的都是同一个干净 URL
    - 改 `frontend/src/pages/WorkbenchPage/platforms.ts`：`detectPlatform` 内部也先补 scheme 兜底
    - 改 `backend/app/routes/pipeline.py` 或 `task_runner.py`：后端再做一次幂等规整（前端可能被绕过，比如 curl 直调 / 测试脚本）
    - 新增 `tests/frontend/url.test.ts` 或 vitest 单测：5 个 case（纯 BV / 缺 scheme / 带追踪参数 / 已规整 / 不规范末尾斜杠）
    - 新增后端单测：同一视频带不同追踪参数应去重成一个任务
  - **真实冒烟（必跑）**：`./start.sh` 起前后端 → 浏览器打开 `/` → 粘完整带追踪参数的 B 站 URL（用户提供：`https://www.bilibili.com/video/BV1qA5j6jEJC/?spm_id_from=333.1007.tianma.6-2-20.click&vd_source=...`）→ Preflight → 提交 → 看 yt-dlp 日志 → 到 Results。**全链路通才算完工**，不准再用 `python -c` 直调代替。
  - **模型**：⭐ deepseek v4-pro（Claude Code + ccswitch）
  - **分支**：`feat/f1.7-url-normalize`（或直接 main 也行，<5 文件改动）
  - **完工验收**：用户粘的 4 种 URL 变体都能正常跑出结果，且任务去重正确

**完工验收（F1 整体）**：粘 B 站 URL → 完整流程图每个节点都跑通 → Results 总览能正确分流 → URL 规整与去重正确
**当前状态**：Tier A（UI 层）已完成，Tier B 后端路径 1 + 字幕清洗 + URL 规整已完成，仅剩 F1.5 Gemini（待用户拍板 API key 来源）

---

## F2 真端到端冒烟测试 + Bug 修

**前置**：F1 完成
**模型**：用户自己跑 + ⭐ deepseek v4-pro 修小 bug
**状态**：✅ 8/10 URL 通过，3 Bug 已修（2026-05-22）
**索引**：`docs/plans/phase-f2-smoke.md`
**已修 Bug**：
- `00bc28c` Bug A：task_runner 所有任务硬编码 DOWNLOAD，改为按 task_type 映射
- `489cc76` Bug B：preflight 布尔型 transcribe+summarize 未触发 N7b 字幕路径
- `c366226` Bug C：本地文件 item 显示名覆盖实际文件名，analyze 找不到视频
**待补**：#6 小红书 / #7 抖音 / #8 微信公众号需用户提供真实 URL

---

## F3 错误体验优化 ✅

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

---

## F4 URL 内容类型嗅探

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

---

## L 资料库聚合页 ✅

**前置**：F3 已完成
**目标**：统一的资料库汇总视图——跨 workspace 浏览所有已分析内容，按类型/工作空间筛选，多维度排序，点卡片下钻 Results
**模型**：⭐ deepseek v4-pro（4 子任务均 <5 文件）
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
