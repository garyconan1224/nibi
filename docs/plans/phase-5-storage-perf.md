---
phase: 5
title: 存储 / 性能升级
status: archived
estimate_hours: 6
model: Opus 4.7（若涉及 SQLite 迁移）
branch: feat/phase5-storage
worktree: 是
depends_on: [4]
trigger_condition: 见 docs/PHASE_2D_SQLITE_EVALUATION.md §6 复审条件
---

> ⚠️ **已归档**：本计划已被 `docs/nibi-spec-merged.md` 取代，不再参与执行。保留作历史参考。

## 范围概述

Phase 2D 评估结论：当前不需要 SQLite 迁移。Phase 5 在达到 2D 列出的复审条件之一时启动：
- task_store 文件 > 10 MB
- 首屏任务列表加载 > 300 ms
- 需要跨任务/跨项目联合查询
- 需要多进程部署（gunicorn workers > 1）
- 需要事务一致性

## TODO

**进入此阶段时再展开操作步骤。** 候选工作：
1. SQLite 迁移（如果 2D 复审触发）：schema 设计 + 数据迁移脚本 + 代码改造
2. task log 裁剪（终态任务只保留最后 50 条 log entry）
3. 分析产物清理策略（超过 N 个月未访问的工作空间提示归档）
4. 前端缓存（zustand persist + IndexedDB）
