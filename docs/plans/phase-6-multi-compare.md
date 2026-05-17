---
phase: 6
title: 多源对比（多图对比 / 多文对比 / 跨任务检索进阶）
status: pending
estimate_hours: 6
model: Opus 4.7
branch: feat/phase6-multi-compare
worktree: 是
depends_on: [5]
---

## 范围概述

总规划里 Phase 4 的功能点之一，本路线放到 Phase 6。在 3B（单/跨工作空间检索）和 3D（风格报告）的基础上，做更高级的多源对比能力。

## TODO

**进入此阶段时再展开操作步骤。** 候选场景：
1. **多图对比**：N 张图片并列，AI 给出共性/差异分析
2. **多文对比**：N 篇文档（PDF/网页）并列，结构化对比表
3. **多视频对比**：N 个视频的关键帧/转写并列
4. **跨工作空间问答**：3B 已实现基础检索，6 做"对比式问答"（问"A 和 B 在 X 方面有何不同"）
5. **数据 / 引文导出**：对比报告导出成 Markdown / DOCX
