---
phase: 9
title: 导入导出 / 互操作（Obsidian / Notion / 跨设备同步）
status: archived
estimate_hours: 5
model: Sonnet 4.6
branch: feat/phase9-interop
worktree: 是
depends_on: [8]
---

> ⚠️ **已归档**：本计划已被 `docs/SPEC.md` 取代，不再参与执行。保留作历史参考。

## 范围概述

让分析结果不被锁在本工具里，可流向用户已有的知识管理体系。

## TODO

**进入此阶段时再展开操作步骤。** 候选功能：
1. **Obsidian 同步**：导出工作空间为 Obsidian vault（已有 `bilibili-notes-to-obsidian` skill 是线索）
2. **Notion 导出**：用 Notion API 写入指定 database
3. **Markdown / DOCX 批量导出**：增强现有 1I zip 导出
4. **跨设备同步**：iCloud / Dropbox / Syncthing 友好的数据布局
5. **API 模式**：提供 REST API 让其他工具调用本项目能力（需在 Phase 4 加密改造之后）
