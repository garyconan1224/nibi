# 项目执行计划总索引

> **本文件作用**：项目级共享执行计划。任何 AI 工具（Claude / 小米 / Codex / Cursor）开新会话只要读这一份就能知道：① 整个项目要做什么、② 当前到哪一步、③ 下一步去读哪个详细计划文件、④ 如何对账避免重做。
>
> **维护规则见 CLAUDE.md「项目执行计划维护流程」一节**。
>
> Last updated: 2026-05-18

---

## 使用方法（每个新会话开始时跑一遍）

1. 读本文件，找到第一个未打勾的子任务
2. 如果是 N1~N11 阶段，读 `docs/SPEC.md` 对应模块理解产品需求
3. 如果该子任务有对应的 `docs/plans/<file>.md` 详细计划：
   - 若 `status: pending` 且操作步骤段是 `TODO` → 停下问用户「要先展开这个 phase 的具体执行计划吗？」
   - 若 `status: ready` 或 `in_progress` 且已有操作步骤 → 按里面的步骤执行
4. 每完成一个子任务，在本文件勾上对应方框，并按"流程"更新 `docs/COMPLETED_WORK.md`

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
- [x] **N7b 路径 1** 视频字幕直接总结 — `4h` P2（`f17c04a` `aac4578` `待提交`）。音频提取 → Whisper 转写 → 6 种模板 LLM 总结，transcript 数组契约已对齐。
- [ ] **N7b 路径 3** 视频模型直接分析 — `8-12h` P2（依赖视频大模型 API 集成决策：Gemini / GPT-4o / Qwen-VL-Max）。*UI 已就绪（IP.9.3），后端 handler 待实现*
- [x] **N8** 音频分支补全：VAD（silero）/ pyannote 说话人 / 音乐分析（librosa + Suno/Udio）— `8-10h` P2
- [ ] **N8b** 音频前端交互：无人声切音乐模式弹窗 / 说话人标签人工修正 UI / 多段音乐 6 维度切分 — `6-8h` P3 *UI 已就绪（IP.9.2），后端 librosa 分析待实现*
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

详细执行计划：[docs/plans/phase-h2-taskboard.md](plans/phase-h2-taskboard.md)
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

详细执行计划：[docs/plans/phase-h3-processing.md](plans/phase-h3-processing.md) / [phase-h4-results.md](plans/phase-h4-results.md) / [phase-h5-storyboard.md](plans/phase-h5-storyboard.md)

详细执行计划：[docs/plans/phase-h1-workbench.md](plans/phase-h1-workbench.md)

### 延后阶段（N1~N11 + H 系列完成后）

- [ ] **[C] AI 导演模块** — 复刻功能（收藏帧 + 提示词版本 UI / A/B 对比 / 风格 DNA 报告 / 生成模型 API 接入）。需先补完整设计稿。
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

---

**H 系列 + IP 系列全部完工**（2026-05-20，一日产出 ~30 个 commit）：
- H1~H5 设计稿 1:1 复刻 ✅
- IP.1~IP.8 Connection Audit（死按钮死参数清零 + 所有现存后端接到 UI）✅
- 阻塞 bug 修复：TaskRunner.append_log / PreflightDrawer 绕过桥接 ✅
- 清理：H2.6 删旧 WorkspaceDetail（-680 行）✅

**当前 main**：`f33db14` — UI ↔ 后端 100% 接通 + Flow Gaps 补齐

下一步候选（按 ROI 排序）：
1. 🥇 **端到端冒烟测试**（用户自己跑，~30min）—— IP.7 修了阻塞 bug 但没真正粘 URL 走完链路
2. 🥈 **[C] AI 导演模块**（4-7 天 Opus）—— 需先补设计稿 + 拍板生成模型 API
3. 🥈 **[D] 开源准备**（2-3 天）—— 加密 / CI / push / 仓库整理
4. 🥉 **N7b 后端** 视频总结路径 1/3 handler（UI 已就绪，依赖字幕抽取 + 视频大模型 API 决策）
5. 🥉 **N8b 后端** 音频 librosa 分析（UI 已就绪）

延后子阶段：
- **N7b 后端**（P2，8-12h）— UI 已就绪（IP.9.3），后端 handler 待实现
- **N8b 后端**（P3，6-8h）— UI 已就绪（IP.9.2），后端 librosa 分析待实现
- **[C] AI 导演模块**（需先补设计稿）
- **[D] 安全 + 开源准备**

---

## Tag / 开源策略

用户决定：**不按 SemVer 节奏自动打 tag**。Tag 等到「功能都差不多」时统一打，**那时就是开源时刻**。在那之前每个 Phase 完成只 commit，不 tag。

---

## 归档说明

旧 Phase 3D~10 计划（`docs/plans/phase-3d-style-report.md` ~ `phase-10-extensibility.md`）已被合并 spec 取代，frontmatter 已标 `status: archived`。这些文件保留作历史参考，不再参与执行。
