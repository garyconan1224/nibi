---
phase: 3E
title: 暗色模式全调通
status: pending
estimate_hours: 1
model: 小米 2.5 Pro
branch: main
worktree: 否
depends_on: [3D]
---

## 范围概述

Phase 1 收尾时遗留：dark mode token 准备好但未全量调通各页面。3E 做收尾，逐页面排查 dark: 变体缺失、对比度问题。

如果 Claude Design 在 3C 之后已经做了完整 UI 翻新，本阶段可能已经被一并解决，届时本文件直接标 `status: done` 即可。

## TODO

**进入此阶段时再展开操作步骤。** 大致工作：
1. 启动 dev server，切到 dark mode
2. 逐页面截图：HomePage / WorkspaceList / WorkspaceDetail / 4 个 ResultPage / Settings 各子页 / FavoritesPage / SearchPage
3. 标注问题：色对比 / 边框缺失 / 图标可见性 / overlay 透明度
4. 改 Tailwind class（dark: 变体）或 css 变量
5. 验收：所有页面切 light/dark 无视觉异常
