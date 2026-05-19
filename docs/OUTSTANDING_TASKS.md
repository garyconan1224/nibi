# Outstanding Tasks

> 本文件是「下一步该做什么」的快照。写入前必须先 `git log --oneline -20` 对账，避免把已完成阶段当作待办。

Last updated: 2026-05-19（N11 完成后收口）

---

## P0 — 当前 main 基线

- 最新基线：N1~N11 主线全部完成，详见 `docs/EXECUTION_PLAN.md`。
- 当前工作重点不再是继续 N1~N11，而是在以下方向中做选择：
  - `.git` 历史瘦身（需用户明确授权，因为会重写 commit hash）
  - `[C] AI 导演模块`（需先补设计稿）
  - `[D] 安全 + 开源准备`
  - 拆出的子阶段 `N1b / N7b / N8b`
- Push 策略不变：所有 `git push origin` 暂缓到 `[D]` 开源准备阶段。

## P0 — 已知收口事项

- `.git` 当前约 `278M`，原因是早期历史包含 `.venv/` 和 `backend/app/services/test_note_output/`。清理方案是 `git filter-repo`，但必须等用户明确说「做」。
- `docs/EXECUTION_PLAN.md` 是当前最准确的执行状态来源。
- `docs/WORKFLOW.md`、`CLAUDE.md`、`AGENTS.md`、`docs/AI_HANDOFF.md` 应保持与 N11 后状态一致。

## P1 — 可选下一步

- **推荐 1：开源前仓库收口**：验证 `pnpm build` / 后端测试，修小型基线错误，整理 handoff 文档。
- **推荐 2：.git 历史瘦身**：先备份 `.git`，再用 `git filter-repo` 移除历史大文件路径，完成后不 push。
- **推荐 3：[D] 开源准备**：README、license、安全检查、CI、发布前清单。

## 长期遗留技术债

- Streamlit 旧入口冻结，除非用户明确要求维护。
- `N1b` 磁盘布局：`data/projects/` → `data/workspaces/` 仍是高影响待做项。
- `N7b` 视频路径 1/3、`N8b` 音频前端交互仍是拆出的后续子阶段。
