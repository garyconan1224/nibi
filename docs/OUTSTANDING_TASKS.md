# Outstanding Tasks

> ⚠️ 本文件是「下一步该做什么」的快照。**写入前必须先 `git log --oneline -20` 对账**，避免把已完成阶段当作待办。

Last updated: 2026-05-18（现状同步完成，进入 N1~N11 路线）

---

## P0 — 当前 main 基线

- 最新合并：docs/spec-merged 分支全部内容已入 main（local main 领先 origin 59 commits）。
- Phase 0~3C 全部完成，现状同步 [A] 已完成。
- 详细进度见 `docs/PROJECT_EXECUTION_PLAN.md`。

## P0 — 下一步

**N1 任务系统差异**（详见 `docs/AI_HANDOFF.md` 的 N1 开工交接段）。

- 估时：4-6h
- 优先级：P0
- 推荐模型：Sonnet 4.6 或 Opus 4.7（若涉及 schema 迁移）
- 分支：待定（进入时确认）
- 具体范围：trashed/analyzed 状态 / 软删除垃圾桶 / 删 project_id

## P0 — N1 之后

按 `docs/PROJECT_EXECUTION_PLAN.md` 的 N1~N11 路线依次推进：
- N2 侧边栏精简（2-3h）
- N3 设置页重组（6-8h）
- N4 添加素材模态（4-5h）
- ...

## 长期遗留技术债

- Streamlit 旧入口冻结，除非用户明确要求维护。
- 持续把文档对齐到 FastAPI + React/Vite 主线。
- `docs/PHASE_X_MAIN_PIPELINE.md` 里记录的「任务存储路径漂移」问题 — 长期注意只从 `/Users/conan/Desktop/nibi` 主目录起服务，不在 worktree 内 `./start.sh`。
- Push 策略：所有 push 暂缓到 [D] 开源准备阶段。
