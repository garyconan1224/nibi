---
title: "R4 任务中心笔记向素材直达 NoteShell"
status: done
created: 2026-06-06
completed_date: 2026-06-06
depends_on: []
---

# R4 任务中心笔记向素材直达 NoteShell

## 背景

任务中心（taskboard）点素材卡片时，笔记向素材仍走旧的 overview/detail 两步路由。
R4 把这条路径缩短：笔记向素材（intent !== 'replica'）点卡片直接进 `/note`（NoteShell），
复刻向保留原路由不动。

## R4 设计

### 路由分流规则

| intent | 行为 |
|---|---|
| `replica` | 保留原逻辑（video→video_detail，audio→audio_detail 等） |
| 非 replica（含 learning/summary/未填） | → `/workspaces/{ws}/items/{itemId}/note` |

### 涉及文件

- `frontend/src/pages/WorkspacePage/TaskboardPage/MaterialCard.tsx` — `resolveItemRoute`
- `frontend/src/pages/WorkspacePage/TaskboardPage/FavoritesTab.tsx` — `resolveItemRoute`（重复定义）
- `frontend/src/pages/result/ResultsOverview/index.tsx` — `resolveDetailRoute`

### 不动的东西

- 旧路由（`/overview`、`/_detail`、`/ln`）不删、不改，直接访问仍可用
- storyboard（复刻流）不碰
- `_detail/_result` 页本身不改

## R4 子任务

### R4.1 卡片 + overview 路由分流（本阶段）

**目标**：改 MaterialCard、FavoritesTab、ResultsOverview 三处路由 helper，
笔记向素材点卡片直达 `/note`，复刻保留原路。

**改动**：
1. MaterialCard.tsx `resolveItemRoute`：加 `if (item.preflight?.intent !== 'replica') return .../note`
2. FavoritesTab.tsx `resolveItemRoute`：同上
3. ResultsOverview.tsx `resolveDetailRoute`：同上

**验收**：
- 任务中心点笔记素材（text/image/audio/video 各一）直达 NoteShell
- 复刻素材（intent=replica）仍走原路
- 旧链接 /overview、/_detail 直接访问仍可用
- `pnpm -C frontend tsc -b` 绿
