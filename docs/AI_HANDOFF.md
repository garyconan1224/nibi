# AI Handoff

Last updated: 2026-05-18（现状同步完成，进入 N1~N11 路线）

---

## 当前真实进度（按 git log 对账）

| 阶段 | 状态 | 说明 |
|---|---|---|
| Phase 0~1 全部 | ✅ 已合并 main | MVP 主干完成 |
| Phase 2A~2D | ✅ 已合并 main | 内容能力扩展完成（含 2D SQLite 评估） |
| Phase 3A~3C | ✅ 已合并 main | 知识库 + 标签库完成 |
| 现状同步 [A] | ✅ 已完成 | 合并 spec + 设计稿归位 + 文档体系重写 |
| **N1 任务系统差异** | ⏳ **下一步** | P0，估时 4-6h |

> ⚠️ 写新交接前请**先 `git log --oneline -20` 对账**，不要相信本文件里写的「下一步」如果它和 git 冲突。

---

## N1 开工交接（下一步）

> 来源：`docs/SPEC.md` 附录 C.2 N1 行。

### N1 范围

- 标题：任务系统差异
- 估时：4-6h
- 优先级：P0
- **模型**：⭐ **Opus 4.7（桌面）** —— 跨后端模型 + routes + 前端 + **schema 迁移**（删 `project_id` 是破坏性），符合 CLAUDE.md「复杂阶段」定义
- **分支**：**新开 worktree** + 分支 `feat/phase-n1-task-system`，**不在主 worktree** `/Users/conan/Desktop/nibi` **直接改代码**（主 worktree 仅用于 merge）
- **不 push**：按 CLAUDE.md §「Push 策略」，commit 留本地，等 [D] 阶段统一推

### 具体差异项

1. **trashed / analyzed 状态字段**：后端 task 状态机增加这两个状态，前端状态徽章适配
2. **软删除垃圾桶**：删除任务改为软删除（标记 trashed），新增垃圾桶页面/入口恢复或永久删除
3. **删 project_id 冗余字段**：task 表去掉 project_id（如果 spec 决议如此）

### 开工前准备

1. 读 `docs/SPEC.md` 找 N1 相关模块描述
2. 读现有 task 状态机代码（`backend/app/` 相关文件）
3. 确认是否需要 schema 迁移（涉及数据库变更需先问用户）
4. 拆子任务 → 写到 `docs/plans/phase-n1-task-system.md` → 问用户确认

### 不要做的事

- ❌ 不要顺手改 N2/N3 的东西
- ❌ 不要重构无关的任务系统代码
- ❌ 不要引入新依赖（除非 spec 明确要求）

---

## 历史交接（已完成，仅备查）

Phase 2D 评估报告见 `docs/archive/phase-2d-sqlite-evaluation.md`，结论：暂不切 SQLite，等 workspace.json > 5MB 时复审。

更早的交接记录（Phase 2B/2C 等）请翻 `git log -p docs/AI_HANDOFF.md` 查找。
