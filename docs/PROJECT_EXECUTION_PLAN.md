# 项目执行计划总索引

> **本文件作用**：项目级共享执行计划。任何 AI 工具（Claude / 小米 / Codex / Cursor）开新会话只要读这一份就能知道：① 整个项目要做什么、② 当前到哪一步、③ 下一步去读哪个详细计划文件、④ 如何对账避免重做。
>
> **维护规则见 CLAUDE.md「项目执行计划维护流程」一节**。
>
> Last updated: 2026-05-18

---

## 使用方法（每个新会话开始时跑一遍）

1. 读本文件，找到第一个未打勾的子任务
2. 打开它对应的 `docs/plans/<file>.md` 详细计划
3. 如果该文件 `status: pending` 且操作步骤段写着 `TODO: 进入此阶段时再展开`，停下问用户「要先展开 phase X 的具体执行计划吗？」
4. 如果该文件已经展开操作步骤（`status: ready` 或 `in_progress`），按里面的步骤执行
5. 每完成一个子任务，在本文件勾上对应方框，并按"流程"更新 `docs/COMPLETED_WORK.md`

---

## 进度总览（打勾 = 已合并入 main）

### Phase 0 — 设计令牌 + AppShell
- [x] 全部完成（详见 [phase-0.md](plans/phase-0.md)）

### Phase 1 — MVP 主干（v1.0.0-mvp）
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

### Phase 2 — 内容能力扩展
- [x] 2A LLM 对话侧栏 + 收藏夹
- [x] 2B 音频结果页
- [x] 2C.1 文本输入层（PDF/DOCX/网页）
- [x] 2C.2 文本结果页 + 提示词版本栈
- [x] 2D SQLite 切换评估（结论：暂不切，见 [PHASE_2D_SQLITE_EVALUATION.md](PHASE_2D_SQLITE_EVALUATION.md)）

### Phase 3 — 知识库 + 工作空间整顿
- [x] **3A** 视频工作台清理 — [phase-3a-video-workbench-cleanup.md](plans/phase-3a-video-workbench-cleanup.md) ✅
- [x] **3B** 知识库 UI（跨工作空间 RAG 检索）— [phase-3b-knowledge-search.md](plans/phase-3b-knowledge-search.md) ✅
  - [x] 3B.1 workspace 知识库数据桥 + FAISS 缓存层
  - [x] 3B.2 单工作空间检索端点
  - [x] 3B.3 跨工作空间检索端点 + reranker 合并
  - [x] 3B.4 前端搜索页 + 侧栏入口
  - [x] 3B.5 WorkspaceDetail 内嵌搜索条
- [ ] **3C** 标签库 7 维度 — [phase-3c-tag-library.md](plans/phase-3c-tag-library.md) ⏸ 待开工时展开
- [ ] **3D** 风格报告 / 对比原作 — [phase-3d-style-report.md](plans/phase-3d-style-report.md) ⏸
- [ ] **3E** 暗色模式全调通 — [phase-3e-dark-mode.md](plans/phase-3e-dark-mode.md) ⏸

> 📍 **3C 完成后 = Claude Design 介入做完整 UI 翻新的最佳时机**（信息架构定型）

### Phase 4 — 安全 + 开源准备（破坏性，v2.0.0）
- [ ] 详见 [phase-4-security-opensource.md](plans/phase-4-security-opensource.md) ⏸

### Phase 5 — 存储 / 性能升级
- [ ] 详见 [phase-5-storage-perf.md](plans/phase-5-storage-perf.md) ⏸

### Phase 6 — 多源对比
- [ ] 详见 [phase-6-multi-compare.md](plans/phase-6-multi-compare.md) ⏸

### Phase 7 — 自动化
- [ ] 详见 [phase-7-automation.md](plans/phase-7-automation.md) ⏸

### Phase 8 — 本地模型 / 私有化
- [ ] 详见 [phase-8-local-models.md](plans/phase-8-local-models.md) ⏸

### Phase 9 — 导入导出 / 互操作
- [ ] 详见 [phase-9-interop.md](plans/phase-9-interop.md) ⏸

### Phase 10 — 插件 / 扩展性
- [ ] 详见 [phase-10-extensibility.md](plans/phase-10-extensibility.md) ⏸

---

## 当前下一步

**Phase 3C 标签库 7 维度**（3B 已完成，分支 `feat/phase3b-knowledge-search` 5 个 commit 待用户 merge 到 main）。
3C 计划见 [docs/plans/phase-3c-tag-library.md](plans/phase-3c-tag-library.md)，处于 pending 状态，操作步骤待用户进入此 phase 时再展开。

---

## Tag / 开源策略

用户决定：**不按 SemVer 节奏自动打 tag**。Tag 等到「功能都差不多」时统一打，**那时就是开源时刻**。在那之前每个 Phase 完成只 commit，不 tag。

开源门槛清单见 [phase-4-security-opensource.md](plans/phase-4-security-opensource.md) 顶部 frontmatter。
