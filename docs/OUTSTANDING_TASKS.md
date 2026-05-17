# Outstanding Tasks

> ⚠️ 本文件是「下一步该做什么」的快照。**写入前必须先 `git log --oneline -20` 对账**，避免把已完成阶段当作待办（曾经发生过：AI 让用户重做已合并的 2C.1）。

Last updated: 2026-05-17（Phase 2C.2 合并之后）

---

## P0 — 当前 main 基线

- 最新合并：`7e08e74`（2C.2 review 修复）。
- Phase 2A / 2B / 2C.1 / 2C.2 全部合并入 main，详见 `docs/AI_HANDOFF.md` 顶部对账表。

## P0 — 下一步建议任务

**Phase 2D｜SQLite 切换评估**（详见 `docs/AI_HANDOFF.md` 的 2D 开工交接段）。

- 估时：1h
- 分支：直接在 main 上做（不开 worktree）
- 推荐模型：⭐小米 2.5 Pro（终端，免费优先）或 Sonnet 4.6
- 产物：`docs/PHASE_2D_SQLITE_EVALUATION.md`（评估报告）
- commit 模板：`docs(phase2d): 2D SQLite 切换评估报告`

## P1 — 2D 之后

- 等用户回看 2D 评估结论再决定下一程：
  - 触发临界点 → 启动 SQLite 迁移子阶段（需新拆 2E.x，先回 spec v2 §3 表补行）。
  - 未触发 → 进入 Phase 3 主线（参考 `nibi-spec-v2.md` §3）。

## 长期遗留技术债

- Streamlit 旧入口冻结，除非用户明确要求维护。
- 持续把文档对齐到 FastAPI + React/Vite 主线。
- `docs/PHASE_X_MAIN_PIPELINE.md` 里第 184 行记录的「任务存储路径漂移」问题 — 长期注意只从 `/Users/conan/Desktop/nibi` 主目录起服务，不在 worktree 内 `./start.sh`。
- 旧 worktree（如 `phase2c2-text-prompt-version`）合并后清理需用户授权，参考 `docs/WORKTREE_INVENTORY.md`。
