# docs/archive — 历史归档目录

> **这里的所有文件都已 DEPRECATED**，仅保留作为历史参考与决策溯源。
> **不再维护、不参与冲突仲裁。**
>
> 当前真相源在 [`docs/SPEC.md`](../SPEC.md) + [`docs/EXECUTION_PLAN.md`](../EXECUTION_PLAN.md) + [`docs/WORKFLOW.md`](../WORKFLOW.md)。

---

## 归档索引

### 旧 spec 文档（被 SPEC.md 取代）

| 文件 | 原位置 | 说明 |
|---|---|---|
| [`spec-v2.md`](spec-v2.md) | 仓库根 `nibi-spec-v2.md` | v2 合并版，曾标"唯一标准" |
| [`spec-v3.md`](spec-v3.md) | 仓库根 `system_design_v3_final.md` | v3 设计文档，1115 行详细描述 |
| [`design-spec-v1.md`](design-spec-v1.md) | 仓库根 `system_design_for_claude_design_v1.md` | v1 给 Claude Design 的设计规格 |
| [`plan-v1.md`](plan-v1.md) | 仓库根 `plan.md` | 早期 Phase 0/1A 阶段计划 |

### 旧改造规划

| 文件 | 说明 |
|---|---|
| [`migration-plan-v1.md`](migration-plan-v1.md) | 2026-05-03 写的项目改造规划，引用了已迁移的 design_reference/ |

### 旧 Phase 文档（被 EXECUTION_PLAN.md 的 N1~N11 路线取代）

| 文件 | 说明 |
|---|---|
| [`phase-x-main-pipeline.md`](phase-x-main-pipeline.md) | Phase X 主干竖切计划（已完成） |
| [`phase-2d-sqlite-evaluation.md`](phase-2d-sqlite-evaluation.md) | 2D SQLite 切换评估（结论：暂不切） |
| [`worktree-inventory.md`](worktree-inventory.md) | 多 agent 时代的 worktree 清单（单 agent 串行后失效） |

### 已完成 / 已 archived 的 Phase Plans

[`plans/`](plans/) 目录共 12 份：

- `phase-3a-video-workbench-cleanup.md` ✅ 已完成
- `phase-3b-knowledge-search.md` ✅ 已完成
- `phase-3c-tag-library.md` ✅ 已完成
- `phase-3d-style-report.md` ⛔ 被 SPEC §8.1「AI 导演整体延后」取代
- `phase-3e-dark-mode.md` ⛔ 取消
- `phase-4-security-opensource.md` ⛔ 归到 [D] 开源准备阶段统一规划
- `phase-5-storage-perf.md` ⛔ 归到未来
- `phase-6-multi-compare.md` ⛔ 归并到 SPEC 模块 6/7 多图/多文对比
- `phase-7-automation.md` ⛔ 未来
- `phase-8-local-models.md` ⛔ 未来
- `phase-9-interop.md` ⛔ 未来
- `phase-10-extensibility.md` ⛔ 未来

---

## 何时查这里

- 追溯某个产品决议的源头（"为什么要做 7 维度标签"等）
- 想看以前的实现思路怎么演化的
- 写开源历史 / Changelog 时引用
