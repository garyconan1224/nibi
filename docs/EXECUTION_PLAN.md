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
- [ ] **N1b** 磁盘布局 `data/projects/<project_id>/...` → `data/workspaces/<workspace_id>/...` + 老数据搬家 — `6-10h` P1（从 N1 拆出）
- [ ] **N2** 侧边栏从 8 砍到 4 + Taskboard 子标签 5→4（隐藏「导出」入口）— `2-3h` P0
- [ ] **N3** 设置页重组 9→7（合并分析默认偏好 / 模型与渠道 / 新增任务垃圾桶）— `6-8h` P0
- [ ] **N4** 添加素材模态升级（4 步合一 + 自动识别类型 + 智能默认勾选 + 背景信息折叠）— `4-5h` P1
- [ ] **N5** Preflight 抽屉细化（按素材类型展开所有子参数）— `4-6h` P1
- [ ] **N6** 任务级 LLM 对话上下文素材多选 chip + RAG 兜底 — `6-8h` P1
- [ ] **N7** 视频分支补全：PySceneDetect AI 镜头分析 / 总结路径 1 & 3 / 视频运镜延后 — `8-10h` P2
- [ ] **N8** 音频分支补全：VAD 双路 / pyannote 说话人 / 音乐分析 — `8-10h` P2
- [ ] **N9** 图片分支补全：PaddleOCR / 4 联想方向 / 多图对比 — `6-8h` P2
- [ ] **N10** 文字分支补全：marker/docling PDF / 改写翻译并排对照 / 多文对比 — `6-8h` P2
- [ ] **N11** 砍掉的 UI 清理（仅入口隐藏，代码留备份）— `1-2h` P3

### 延后阶段（N1~N11 完成后）

- [ ] **[C] AI 导演模块** — 复刻功能（收藏帧 + 提示词版本 UI / A/B 对比 / 风格 DNA 报告 / 生成模型 API 接入）。需先补完整设计稿。
- [ ] **[D] 安全 + 开源准备** — v1.0.0 发布。含加密改造 / CI / push 策略解除 / 仓库整理。

---

## 当前下一步

**N2 侧边栏从 8 砍到 4 + Taskboard 子标签 5→4**（P0，估时 2-3h）。

具体范围见 `docs/SPEC.md` §1.7 / §1.8：
- 一级导航砍至 4 项（任务中心 / 资料库 / AI 导演[灰] / 设置）
- Taskboard 子标签从 5 砍至 4（隐藏「导出」入口）
- 砍掉的代码留备份，本 phase 仅做入口隐藏

> 📍 **N2 开工参数**：
> - **模型**：Sonnet 4.6 或 ⭐ 小米 2.5 Pro（纯前端入口隐藏 / 路由调整，不动后端，符合 CLAUDE.md「简单阶段」）
> - **分支**：直接在主 worktree 开 `feat/phase-n2-sidebar`
> - **不 push**：commit 留本地，等 [D] 阶段统一推

---

## Tag / 开源策略

用户决定：**不按 SemVer 节奏自动打 tag**。Tag 等到「功能都差不多」时统一打，**那时就是开源时刻**。在那之前每个 Phase 完成只 commit，不 tag。

---

## 归档说明

旧 Phase 3D~10 计划（`docs/plans/phase-3d-style-report.md` ~ `phase-10-extensibility.md`）已被合并 spec 取代，frontmatter 已标 `status: archived`。这些文件保留作历史参考，不再参与执行。
