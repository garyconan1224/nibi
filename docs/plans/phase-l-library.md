---
name: phase-l-library
status: ready
phase: L (Library aggregation page)
track: F (Flow) / 落地汇总视图
prerequisite: F3 已完成
model: L1 ⭐ DS v4-pro / L2 Sonnet 4.6 或 DS v4-pro / L3-L4 ⭐ DS v4-pro
branch: 可直接打 main（每个子任务 <5 文件）
created: 2026-05-22
---

# Phase L — 资料库聚合页落地

## 背景与目标

侧边栏「资料库」按钮（`frontend/src/layouts/AppShell.tsx:34`）**当前临时指向 `/search`**，是占位。
F1~F4 跑完后已经有一堆真实分析结果散落在各个 workspace 里，需要一个统一的汇总视图：
- 一眼看到所有已分析内容
- 按类型 / 工作空间快速筛选
- 多维度排序，方便复盘测试结果
- 点卡片下钻到现有 Results 子页（不重复造详情页）

视觉真相源：`docs/design/VidMirror.html` 的「资料库 LIBRARY · 7 ITEMS」页面（用户截图给过）。

---

## 用户决议（不要再问）

| 决议项 | 用户拍板结果 |
|---|---|
| 工作空间呈现 | **方案三（workspace 也是卡片，和 item 平级）**：选「工作空间」chip 时显示 workspace 卡片网格；选其它 chip（视频/音频/图片/文字）时按方案一显示平铺的 item 卡片 |
| 类型筛选 UI | **顶部多选 chip**：[全部] [视频] [音频] [图片] [文字] [工作空间]，多选可叠加，「全部」与其它互斥 |
| 排序维度 | **全做，先做创建时间**（默认）：创建时间 / 完成时间 / 时长 / 状态 |
| 数据源 | **复用 workspaces API，新增聚合端点**（不建新表，0 迁移） |

---

## 数据模型现状（已查清，不需要改 schema）

`backend/app/models/workspace.py::WorkspaceItem`：

```
item_id / type (video|audio|image|text) / source / source_value
name / status / results / related_task_ids
created_at / updated_at / preflight / tags
```

✅ 100% 覆盖 Library 页所需字段。`WorkspaceRecord.items` 是 `List[WorkspaceItem]`，只需新增一个聚合端点摊平 + 反向带 workspace 信息。

---

## 路由现状（已查清）

`frontend/src/router.tsx` 没有 `/library`。需要新增：

```
{ path: 'library', element: withSuspense(<LibraryPage />) }
```

同时改 `AppShell.tsx:34` 把 `path: '/search'` 改为 `path: '/library'`。

---

## 子任务拆分（4 个，每个一 commit）

### L1 — 后端：聚合端点 `GET /workspaces/library`

**模型**：⭐ DS v4-pro
**预计**：1~2 小时

**改动文件**（≤3）：
- `backend/app/routes/workspaces.py`：新增 `@router.get("/library")` 端点
- `tests/backend/test_workspaces_api.py`：追加 2 个测试
- 必要时改 `backend/app/models/workspace.py`（仅在需要新增 to_dict 字段时）

**端点契约**：

```http
GET /workspaces/library?include_trashed=false
```

**Response**：
```json
{
  "items": [
    {
      "item_id": "...",
      "workspace_id": "...",
      "workspace_name": "...",
      "type": "video",
      "source": "url",
      "source_value": "https://www.bilibili.com/video/BV...",
      "name": "三代封神！那四代呢？大疆Pocket 4首发体验",
      "status": "done",
      "created_at": "2026-05-22T10:00:00",
      "updated_at": "2026-05-22T10:01:30",
      "duration_seconds": 92,
      "thumbnail": null,
      "results_summary": {
        "has_summary": true,
        "has_transcript": true
      },
      "primary_task_status": "done"
    }
  ],
  "workspaces": [
    {
      "workspace_id": "...",
      "name": "...",
      "items_count": 3,
      "items_count_by_type": {"video": 2, "audio": 1, "image": 0, "text": 0},
      "cover_thumbnail": null,
      "updated_at": "2026-05-22T10:01:30",
      "status": "active"
    }
  ]
}
```

**实现要点**：
1. 复用现有 `_enrich_workspace()` 里的 `_items_count_by_type()` / `_cover_thumbnail()` / `_sync_item_with_tasks()`
2. `duration_seconds` 优先从 `item.results` 里取（不同 type 字段名可能不一样：video → `duration`，audio → `duration`，image 没有，text 没有；找不到给 `null`）
3. `primary_task_status`：拿 `item.related_task_ids` 里最新一个 task 的 status，方便前端显示 running/queued/done/error 徽标
4. 默认 `include_trashed=false`，过滤掉 `WorkspaceRecord.trashed=True` 的工作空间
5. **不要做分页**——本地工具数量级（< 1000 items）不需要

**测试**（2 个 happy path + 1 错误，写在 `test_workspaces_api.py`）：
- 空库：返回 `{"items": [], "workspaces": []}`，200
- 有 2 workspace × 各 3 items：返回 6 items + 2 workspaces，字段齐全
- `include_trashed=true` vs 默认：trashed 工作空间是否过滤正确

**commit**：`feat(L1): 新增 /workspaces/library 聚合端点 + 测试`

---

### L2 — 前端：LibraryPage 骨架 + 路由 + ItemCard 组件

**模型**：Sonnet 4.6 或 ⭐ DS v4-pro（看复杂度，能不升档就不升）
**预计**：半天

**改动文件**（≤6）：
- 新增 `frontend/src/pages/LibraryPage/index.tsx`
- 新增 `frontend/src/pages/LibraryPage/ItemCard.tsx`
- 新增 `frontend/src/pages/LibraryPage/WorkspaceCard.tsx`
- 新增 `frontend/src/pages/LibraryPage/library.css`（或用 Tailwind 写在 tsx，看现有风格）
- 改 `frontend/src/router.tsx`：注册 `/library`
- 改 `frontend/src/layouts/AppShell.tsx:34`：`path: '/search'` → `path: '/library'`
- 新增 `frontend/src/services/library.ts`：调 `GET /workspaces/library`

**视觉对照**：`docs/design/VidMirror.html`「资料库」页面 + 用户截图。
重点元素：
- 顶部条：`资料库 · LIBRARY · 7 ITEMS`
- 右上角：网格/列表视图切换 + 「导入」按钮（导入按钮 L2 先放占位，不接逻辑）
- 卡片：状态徽标（running 黄 / queued 灰 / done 绿 / error 红）、时长 mm:ss、缩略图占位区、标题、副标题、`来源.com/路径 · 类型` 尾标

**点击下钻**：
- ItemCard 点击 → 跳 `/workspaces/{workspace_id}/items/{item_id}/overview`
- WorkspaceCard 点击 → 跳 `/workspaces/{workspace_id}`

**L2 范围限定**（不做的）：
- ❌ chip 筛选（L3 做）
- ❌ 排序（L4 做）
- ❌ 视图切换（L4 做）
- ❌ 「导入」按钮逻辑

**完工标准**：
- `pnpm build` 通过、`pnpm lint` 通过
- `./start.sh` 起服务，点侧边栏「资料库」→ 看到所有 items 平铺，卡片视觉对齐设计稿
- 点卡片能正确跳到对应详情页

**commit**：`feat(L2): LibraryPage 骨架 + ItemCard/WorkspaceCard 组件 + 路由接线`

---

### L3 — 前端：顶部多选 chip 筛选 + workspace 视图切换

**模型**：⭐ DS v4-pro
**预计**：2~3 小时

**改动文件**（≤3）：
- 改 `frontend/src/pages/LibraryPage/index.tsx`：加 chip 状态 + 渲染逻辑
- 新增 `frontend/src/pages/LibraryPage/FilterChips.tsx`
- 必要时新增 `frontend/src/store/libraryStore.ts`（zustand，存 chip 选中状态 + 排序，避免回退页面丢状态）

**Chip 规则**：
- 选项：`[全部] [视频] [音频] [图片] [文字] [工作空间]`
- 「全部」与其它互斥；其它之间可多选
- 默认选中「全部」
- **选中「工作空间」时**：渲染切换为 `WorkspaceCard` 网格（数据用 response.workspaces）
- **选中其它任一组合（不含「工作空间」）**：渲染 `ItemCard` 平铺，按选中类型过滤
- 「工作空间」与其它类型同时选中：上半部分显示 workspace 卡，下半部分显示 item 卡（分两个 section，每个 section 头部小标题）

**顶部统计数字同步更新**：`资料库 · LIBRARY · {当前筛选后数量} ITEMS`

**commit**：`feat(L3): Library 顶部多选 chip 筛选 + workspace/item 视图切换`

---

### L4 — 前端：排序下拉 + 网格/列表视图切换

**模型**：⭐ DS v4-pro
**预计**：2~3 小时

**改动文件**（≤3）：
- 改 `frontend/src/pages/LibraryPage/index.tsx`
- 新增 `frontend/src/pages/LibraryPage/SortMenu.tsx`
- 改 `libraryStore.ts`：加 `sortBy` + `viewMode` 字段

**排序选项**（dropdown，默认创建时间）：
- 创建时间（最新在前）/ 创建时间（最早在前）
- 完成时间（最新在前）—— 没 `completed_at` 字段？用 `status==done` 且 `updated_at` 最近代替；若 item 未 done 排到最后
- 时长（长→短）/ 时长（短→长）—— 没时长（image/text）的排到最后
- 状态（error → running → queued → done）—— 让用户能优先看到失败任务

**视图切换**：
- 默认：网格（设计稿样式）
- 列表：表格行（图标 + 标题 + 类型 + 状态 + 时长 + 创建时间），点行同样下钻
- 切换状态存 `libraryStore.viewMode`

**完工标准**：
- 默认进页面：所有 items 按创建时间倒序，网格视图
- 切排序 → 顺序立即变化
- 切列表视图 → 渲染表格
- 刷新页面 → 视图模式 / 排序 / chip 选择保持（用 localStorage 持久化 libraryStore）

**commit**：`feat(L4): Library 排序下拉 + 网格/列表视图切换 + 状态持久化`

---

## 完工标准（Phase L 整体）

- [ ] `GET /workspaces/library` 端点 + 测试 OK
- [ ] 侧边栏「资料库」按钮指向 `/library`（不再是 `/search`）
- [ ] 进 `/library` 看到设计稿一致的卡片网格
- [ ] chip 筛选 / 排序 / 视图切换全部生效
- [ ] 点 ItemCard → 跳对应 Results 详情页
- [ ] 点 WorkspaceCard → 跳 `/workspaces/{id}` Taskboard
- [ ] `pnpm build` + `pnpm lint` + `pnpm test` 全通
- [ ] 后端 pytest 全通
- [ ] ROADMAP §3 追加 §L 章节 + commit hash
- [ ] AI_HANDOFF.md 更新「下一步」

---

## DS 接力 Prompt（每个子任务一次会话，复制粘贴用）

### 开 L1 时

```
你是 DS v4-pro，做 Nibi 项目 Phase L 子任务 L1。
读 CLAUDE.md + docs/plans/phase-l-library.md，执行 §L1。
完成后跑 .venv/bin/python -m pytest tests/backend -q，全绿再 commit。
做完停下，等我开 L2 会话。
```

### 开 L2 时

```
你是 DS v4-pro（或 Sonnet 4.6 自行判断），做 Nibi 项目 Phase L 子任务 L2。
读 CLAUDE.md + docs/plans/phase-l-library.md，执行 §L2。
L1 已合并（commit 见 git log），后端 /workspaces/library 端点可用。
做完跑 cd frontend && pnpm build && pnpm lint，全绿再 commit。
做完停下，等我开 L3 会话 + 截图复盘视觉。
```

### 开 L3 / L4 时

仿照 L2 prompt，把 §L 编号换掉，提示 DS 上一子任务已合并。

---

## 边界与禁区

- ❌ 不要做分页（local 工具，数据量小）
- ❌ 不要新建 library_items DB 表 / 视图（直接聚合现有 items 已够用）
- ❌ 不要改 `WorkspaceItem` 字段（schema 已够用）
- ❌ 不要顺手重写 `FavoritesPage` 或 `SearchPage`，即使它们结构类似
- ❌ 不要做「导入」按钮的逻辑（L2 留占位即可，未来单开 phase）
- ❌ 不要在 L2 里把 chip / 排序顺手做了——颗粒度按 L1~L4 走，每个独立 commit 便于回滚

---

## 升档触发（DS 转 Opus）

- 任一子任务真实改到 ≥5 个文件
- 发现 WorkspaceItem schema 不够用，需要数据迁移
- 跨 RSC/SSE/状态机
- DS 自己不确定

遇到立刻停，让用户升 Opus。
