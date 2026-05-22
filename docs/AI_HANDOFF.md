# AI Handoff

Last updated: 2026-05-22（F1.7 URL 规整 + 前端冒烟完成）

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

用户决议：**不去 [C] / [D]**，先把现有功能跟流程图 5 张对齐打磨。新长期路线图 `docs/ROADMAP.md` 6 条 track 已落盘。

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

### 🥇 端到端冒烟测试（30min，**下一个会话推荐**）

F1.6 + F2 Bug2 + F2 Bug3 修复完成后，路径 1 全链路已就绪（ASR → 清洗 → 总结 → duration 透传）且 yt-dlp 下载有格式降级保护。建议先粘一个真实 B 站 URL 走一遍完整流程，验证：

1. `./start.sh` 启动
2. 打开 `/` → 不选工作空间 → 粘真实短 B 站 URL（< 5 分钟）
3. 调画质 720p / 抽帧 A / fps 2
4. 「开始解析」→ Preflight 确认 → 提交
5. 看 toast「已自动创建工作空间「XXX」」
6. 跳 Processing → 看 yt-dlp 下载日志
7. download 完成 → 自动 analyze → 完成跳 Result
8. 回 Taskboard 试：Compare Tab / Tags 增删 / 快速抽字幕 / 「生成分镜」
9. 顶栏看 CPU/MEM 实时跳

**预期**：所有 Tier A 功能点都能走通，没有挂 toast 或 console error。若卡壳，对标 docs/ROADMAP.md 找对应 track。

### 🥈 路线选择（冒烟验证后定）

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
