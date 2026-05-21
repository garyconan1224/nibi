# Outstanding Tasks

> 本文件是「下一步该做什么」的快照。写入前必须先 `git log --oneline -20` 对账，避免把已完成阶段当作待办。

Last updated: 2026-05-21（N7b 路径 1 后端完成 + 结果契约修复）

---

## P0 — 当前 main 基线

- 最新基线：N1~N11 主线 + H 系列 + IP 系列全部完成，详见 `docs/EXECUTION_PLAN.md`。
- **IP.9 Flow Gaps 已完成**（2026-05-21）：Results 总览页 + N7b/N8b UI + payload 对齐，5 个 commit 合入 main。
- **N7b 路径 1 已完成**（2026-05-21）：视频字幕直接总结后端 + 结果契约修复（transcript 数组化），3 个 commit 合入 main。
- **N7b/N8b UI 已就绪**，后端 handler 待实现：
  - N7b 路径 3（视频模型直接）— 依赖 Gemini / GPT-4o / Qwen-VL API 集成决策
  - N8b 音频 librosa 分析（6 维度切分）
- 当前工作重点是在以下方向中做选择：
  - 端到端冒烟测试（用户自己跑，~30min）
  - `[C] AI 导演模块`（需先补设计稿）
  - `[D] 安全 + 开源准备`
  - N7b/N8b 后端实现
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
- `N7b` 路径 3 后端 handler（UI 已就绪，依赖 Gemini / GPT-4o / Qwen-VL API 集成决策）。路径 1 已完成。
- `N8b` 音频 librosa 分析后端（UI 已就绪，6 维度切分）。
