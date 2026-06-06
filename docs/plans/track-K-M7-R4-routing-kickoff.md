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

### 共享 helper

`frontend/src/lib/resolveItemRoute.ts` — 统一入口，MaterialCard / FavoritesTab / LibraryPage / ResultsOverview 共用。

### 涉及文件

| 文件 | R4.1 | R4.2 |
|---|---|---|
| `MaterialCard.tsx` | ✅ 本地→共享 | — |
| `FavoritesTab.tsx` | ✅ 本地→共享 | — |
| `ResultsOverview/index.tsx` | ✅ 本地→共享 | ✅ useEffect 兜底跳转 |
| `LibraryPage/ItemCard.tsx` | — | ✅ 用共享 helper |
| `LibraryPage/index.tsx` | — | ✅ 用共享 helper |
| `backend/app/routes/workspaces.py` | — | ✅ library API 加 preflight |
| `frontend/src/services/library.ts` | — | ✅ LibraryItem 加 preflight 类型 |

### 不动的东西

- 旧路由（`/overview`、`/_detail`、`/ln`）不删、不改，直接访问仍可用
- storyboard（复刻流）不碰
- `_detail/_result` 页本身不改
- ProcessingPage 现有 note→/note 跳转不动

## R4 子任务

### R4.1 卡片 + overview 路由分流 ✅

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

### R4.2 overview 收敛 + 剩余落点统一直达

**目标**：
1. 消除 resolveItemRoute 重复定义，提取到 `@/lib/resolveItemRoute`
2. LibraryPage（ItemCard + index）改用共享 helper
3. ResultsOverview 进入时：笔记向 → useEffect navigate(`/note`, {replace:true})
4. 后端 library API 加 preflight 字段

**改动**：
1. `frontend/src/lib/resolveItemRoute.ts` — 新建共享 helper
2. `MaterialCard.tsx` / `FavoritesTab.tsx` — 删除本地定义，import 共享版
3. `ResultsOverview/index.tsx` — 删除本地定义，import 共享版 + useEffect 兜底
4. `LibraryPage/ItemCard.tsx` — import 共享版，navigate 改用 resolveItemRoute
5. `LibraryPage/index.tsx` — import 共享版，navigate 改用 resolveItemRoute
6. `backend/app/routes/workspaces.py` — library API 加 preflight 字段
7. `frontend/src/services/library.ts` — LibraryItem 类型加 preflight

**验收**：
- 任务中心 + Library 点笔记素材都直达 /note
- 直接访问笔记素材的 /overview 自动跳 /note
- 复刻素材 /overview 保留
- 旧链接不 404
- `pnpm -C frontend tsc -b` 绿
