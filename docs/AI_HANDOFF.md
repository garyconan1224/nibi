# AI Handoff

Last updated: 2026-05-16

---

## Phase 2A 开工交接（2026-05-16，最新）

> 这一段是给下一个会话开 **Phase 2A（LLM 聊天 + 收藏夹页面）** 时直接抄的笔记。
> 当前分支已切到 `feat/phase2a-llm-favorites`，主目录就是 worktree。
> 下面的「现状」是直接读代码得来的，不是猜的。

### 2A 范围（决议复述）

1. **LLM 聊天**：工作区右侧（或独立面板）一个 ChatSidebar，调用 LLM 流式回复，回合持久化。
2. **收藏夹页面**：FavoritesPage，按 4 个 tab 分类展示用户收藏的 items。

### 已确认的设计决议

| 项 | 值 |
|---|---|
| 分支 | `feat/phase2a-llm-favorites`（已在 main worktree 上 checkout） |
| 聊天持久化 | 新建 `shared/chat_store.py` → `data/chats/<workspace_id>.jsonl`（一行一条消息） |
| 聊天接口（两段式，对齐 1F） | `POST /workspaces/{id}/chat`（创建回合返回 `chat_id`）+ `GET /workspaces/{id}/chat/events?chat_id=...`（SSE 拉流） |
| 收藏夹 tab | 待 2A 第 1 步扫码确定（见下方「收藏夹现状」） |

### 现状扫码结果

#### 1F SSE 模板（直接照抄）

文件：[backend/app/routes/pipeline.py:119](backend/app/routes/pipeline.py#L119) — `stream_task_events`

关键模式（写 chat SSE 时复用）：

- 用 `StreamingResponse(event_stream(), media_type="text/event-stream")` 返回
- 内部 `async def event_stream()` 循环 `_store.get(...)` → 增量产生事件
- 事件格式：`yield f"data: {json.dumps(...)}\n\n"`，事件类型用 `type` 字段（`log` / `task` / `error`）
- **30s 心跳**：静默超时下发 `: heartbeat\n\n`（SSE 注释行，EventSource 自动忽略），防反代断流
- **去重**：仅在 status/progress 变化时下发快照，减少前端无谓重渲染
- **轮询间隔**：0.5s（不要更密）
- **终结状态**：`cur_status in _TERMINAL_STATUSES` 时 break，break 前再补发一次幂等快照

前端消费参考：[frontend/src/hooks/useTaskSse.ts](frontend/src/hooks/useTaskSse.ts) + [frontend/src/pages/HomePage/TaskLogViewer.tsx:41](frontend/src/pages/HomePage/TaskLogViewer.tsx#L41)
（用原生 `EventSource(url)`，靠它自带重连，组件卸载时 `close()`）

→ **chat SSE 直接 fork 这套**，type 字段换成 `delta` / `done` / `error`，心跳沿用 `: heartbeat`。

#### 收藏夹现状（关键发现）

数据结构在 [backend/app/models/workspace.py:88](backend/app/models/workspace.py#L88)（WorkspaceItem）和 [:155](backend/app/models/workspace.py#L155)（WorkspaceRecord）：

```python
class WorkspaceItem:
    item_id: str
    type: str           # ← 已经有！来自 ItemType: "video" | "audio" | "image" | "text"
    source: str         # "url" | "local"
    source_value: str
    name: str
    status: str
    ...

class WorkspaceRecord:
    ...
    items: List[WorkspaceItem]
    favorites: List[str]   # 只是 item_id 字符串列表，不是独立对象
```

**关键结论**：
1. **不需要新增 `media_type` 字段**——`WorkspaceItem.type` 已经覆盖了 video/audio/image/text 四类，正好对应「4 个 tab」决议。
2. **favorites 是「指针列表」**：`rec.favorites: List[str]` 只存 item_id，前端展示时要 `rec.items.filter(it => rec.favorites.includes(it.item_id))` 再按 `it.type` 分组。
3. **不需要新增后端接口**：现有 `POST/DELETE /workspaces/{ws_id}/favorites/{item_id}`（[workspaces.py:491](backend/app/routes/workspaces.py#L491)）够用了。FavoritesPage 只是在前端组装。

→ **4 个 tab 直接用 ItemType 的 4 个枚举值**：全部 / video / audio / image / text（或 5 个 tab：全部 + 4 类）。

#### `shared/chat_store.py` 现状

**不存在**，需新建。无历史包袱。建议接口（参考 `task_store` / `workspace_store` 的写法）：

```python
class ChatStore:
    def append(self, workspace_id: str, msg: ChatMessage) -> None  # 追加一行 jsonl
    def list(self, workspace_id: str, chat_id: str | None = None) -> list[ChatMessage]
    def list_chats(self, workspace_id: str) -> list[ChatSummary]  # 按 chat_id 分组
```

### 2A 拆分建议（5–6 个 commit）

| 顺序 | 子任务 | commit 信息建议 |
|---|---|---|
| 2A.1 | 新建 `shared/chat_store.py` + 单测 | `feat(phase2a): 2A.1 新增 chat_store jsonl 持久化` |
| 2A.2 | `POST /chat` + `GET /chat/events` SSE 接口 + happy/error 测试 | `feat(phase2a): 2A.2 工作区聊天接口（两段式 SSE）` |
| 2A.3 | 前端 ChatSidebar 组件（接 SSE） | `feat(phase2a): 2A.3 ChatSidebar 流式聊天 UI` |
| 2A.4 | 前端 FavoritesPage（4/5 tab 按 ItemType 分组） | `feat(phase2a): 2A.4 收藏夹页面（按类型 tab 分组）` |
| 2A.5 | 路由 + 侧栏入口接入 | `feat(phase2a): 2A.5 接入路由与侧栏入口` |
| 2A.6（可选） | 端到端冒烟 + 文档 | `test(phase2a): 2A.6 端到端冒烟与文档补充` |

### 风险提示

- `data/chats/` 是新目录，确认 `.gitignore` 已忽略 `data/`（项目规则禁止 commit 运行时数据）。
- LLM 调用走 `shared/api_key_resolver.py` + `shared/runtime_llm_config.py`，**不要**在 chat 路由里直接读 env。
- SSE 接口务必复用 30s 心跳，否则反代会切流。



## Current Scope

This handoff is for the current FastAPI + React/Vite mainline after Phase 1D local file upload and the multi-agent collision rules were merged.

Primary workspace: `/Users/conan/Desktop/nibi`

Active product line: **FastAPI backend + React/Vite frontend**. Streamlit remains a legacy compatibility path only.

## Completed In This Pass

- Merged Phase 1D local file upload into `main`:
  - `79a1356 feat(phase1d): add workspace local file upload`
  - `0e6bf53 Merge branch 'codex/phase1d-workspace-upload' into main`
- Merged multi-agent collaboration rules into `main`:
  - `a891eb1 docs(collab): 多 agent 防撞规则与职责边界`
  - `bd972eb Merge branch 'claude/upbeat-bohr-11329b' into main`
- Pushed the verified feature baseline to GitHub. The last feature/collaboration baseline before this handoff sync was `bd972eb`.
- Verified the merged mainline from Codex:
  - `.venv/bin/pytest tests/backend/test_workspaces_api.py -q` -> `8 passed`
  - `cd frontend && pnpm build` -> passed
  - frontend Vitest files run individually -> `8 passed`
- Added `docs/WORKTREE_INVENTORY.md` as a non-destructive inventory of old Codex/Claude worktrees.

## Do Next

Next implementation session should start a single Claude build task for **Phase 1E network link input**, unless the user changes direction.

Recommended Phase 1E boundary:

1. Let users add a network media URL to a workspace from the React workspace detail page.
2. Persist the link as a workspace material/item through the FastAPI workspace API.
3. Show clear loading, success, empty, and error states in the existing UI.
4. Add or update the narrowest useful backend tests and run frontend build checks.
5. Do not start Phase 1F pre-configuration panel work in the same session.

## Guardrails For The Next Agent

- Follow the multi-agent rules in `CLAUDE.md` and `AGENTS.md`.
- Claude official / Claude Xiaomi are build agents. Codex is for checks, tests, branch comparison, and next-step advice.
- Before editing, run `git fetch --all --prune`, `git status --short --branch`, `git worktree list`, `git branch -a`, and `git log --oneline HEAD..main`.
- Start Phase 1E on a new Claude build branch such as `claude-official/phase1e-network-link-input`.
- If a same-topic worktree or branch exists, stop and ask the user before implementing.
- Do not commit runtime data, local cookies, sqlite databases, zip files, logs, `.env`, or downloaded media.
- Do not delete local real files when cleaning git history unless the user explicitly asks for deletion.
- Do not clean old worktrees inside the Phase 1E commit. Use `docs/WORKTREE_INVENTORY.md` for a separate cleanup decision.
