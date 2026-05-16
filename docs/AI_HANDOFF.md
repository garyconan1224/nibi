# AI Handoff

Last updated: 2026-05-17

---

## Phase 2B 开工交接（2026-05-17，最新）

> 这一段是给下一个会话开 **Phase 2B（音频结果页）** 时直接抄的笔记。
> 2A 已合入 main（merge `c41121f`），分支 `feat/phase2a-llm-favorites` 可以留着不删，也可以等用户决定后清理。
> 现状全部来自直接读代码，非猜测。

### 2B 范围（spec v2 §3 决议）

- 标题：音频结果页
- 估时：2–3h
- 分支建议：直接在 main 做（spec 标「否」需要 worktree）
- 推荐模型：Sonnet 4.6（或小米 2.5 Pro 优先）—— 中等多文件 CRUD，复杂度低于 2A
- 强制顺序：必须在 2A 之后；与 2C 之间无依赖，2B / 2C 任选先后；2D 在 2B/2C 完成后

### 现状扫码结果

#### 后端

- `/workspaces/{id}/items/{id}/result` 在 [backend/app/routes/workspaces.py:648](../backend/app/routes/workspaces.py#L648) — 只对 `item.type == 'video'` 工作，其它类型 400。
- `/workspaces/{id}/items/{id}/image_result` 在 [:734](../backend/app/routes/workspaces.py#L734) — Phase 1H 加的，独立端点。
- **缺 `/audio_result`**。2B 要按 `image_result` 的模式新加一个：
  - 优先返回 `item.results`（管线已填充时）；
  - 否则返回 `build_demo_audio_result(item_id, name)` —— 需要新写 demo fixture（参考 `_build_demo_image_result` / `video_result_demo.build_demo_video_result`）。
- **数据形状建议**（复用现有 `VideoResultTranscriptLine`，去掉视频帧）：
  ```python
  {
    "source": "demo_fixture" | "item_results",
    "audio": {"item_id", "title", "url", "duration_sec", "duration_str"},
    "transcript": [{"t_sec", "t_str", "text"}, ...],
    "summary": "...",   # 可选：LLM 摘要
    "tracks_meta": {"total_sec", "transcript_count"},
  }
  ```
- 没有专门的 audio pipeline handler；音频走的是 `analyze` / `transcribe`，结果落 `item.results`。Phase 2B 暂不动管线，只做结果页读取。

#### 前端

- router：[frontend/src/router.tsx:55-62](../frontend/src/router.tsx#L55) 已有 `result`（视频）+ `image_result`（图片）路由。缺 **`audio_result`** 路由。
- 现有页面参考：[VideoResultPage.tsx](../frontend/src/pages/result/VideoResultPage.tsx) 937 行（含三轨）；音频页应是 VideoResultPage 的精简版（去掉 frames / TripleTrack，保留 `<audio>` 播放器 + transcript 列表 + 摘要 + 提示词/导出 tabs）。
- 类型在 [frontend/src/services/workspaces.ts:159](../frontend/src/services/workspaces.ts#L159) — 复用 `VideoResultTranscriptLine`，新增 `AudioResult` interface + `getAudioItemResult()` 客户端方法。

#### 2A 留下的坑（要在 2B 顺手修）

我在 [FavoritesPage.tsx:resultRouteFor](../frontend/src/pages/FavoritesPage/FavoritesPage.tsx) 把 audio 类型映射到了 `/result`，但目前 `/result` 端点会对 audio 返回 400。**2B 路由接入后要把 audio 改到 `/audio_result`**：
```ts
function resultRouteFor(entry) {
  const map = { video: 'result', image: 'image_result', audio: 'audio_result', text: 'text_result' }
  return `/workspaces/${ws}/items/${item.item_id}/${map[item.type]}`
}
```

#### WorkspaceDetail 入口

- ItemRow 当前 [WorkspaceDetail.tsx:719](../frontend/src/pages/WorkspacePage/WorkspaceDetail.tsx#L719) **没有「查看结果」按钮**，进 result 页目前只能从收藏夹或手动拼 URL。可考虑在 2B 顺手加一个：item.status === 'done' 时显示一个「查看结果」按钮，按 type 跳对应路由。是否做由用户决定，不是 2B 强制项。

### 2B 拆分建议（4–5 个 commit）

| 顺序 | 子任务 | commit 信息建议 |
|---|---|---|
| 2B.1 | 后端 `audio_result` demo fixture + 端点 + 测试 | `feat(phase2b): 2B.1 新增 audio_result 端点（含 demo fixture）` |
| 2B.2 | 前端 `AudioResult` 类型 + service 方法 | `feat(phase2b): 2B.2 前端 audio_result 客户端` |
| 2B.3 | AudioResultPage 组件（音频播放器 + transcript） | `feat(phase2b): 2B.3 音频结果页 UI` |
| 2B.4 | 路由接入 + FavoritesPage 跳转修正 | `feat(phase2b): 2B.4 接入 /audio_result 路由并修正收藏夹跳转` |
| 2B.5（可选） | ItemRow「查看结果」按钮 + 端到端冒烟 | `feat(phase2b): 2B.5 工作区入口与冒烟` |

### 风险提示

- `item.type` 是字符串 `'audio'`（见 [models/workspace.py:88](../backend/app/models/workspace.py#L88) ItemType 枚举），写后端校验时直接比对字符串。
- 音频文件路径与视频共用 `data/videos/`（一些通过 ffmpeg 抽出的音轨也存这里），url 字段可能是 `file://` 或 `/api/files/...` 形式，需要看 1D 上传后 `source_value` 长什么样再决定 `<audio src>` 怎么写。
- 不要新增 audio-specific 的 pipeline 处理逻辑（spec 范围外）。

---

## Phase 2A 收口纪要（2026-05-16）

> Phase 2A 全部完成，分支 `feat/phase2a-llm-favorites`，6 个 commit 已落（2A.1 → 2A.6）。

### 已交付

| 子任务 | 内容 | 关键文件 |
|---|---|---|
| 2A.1 | jsonl 聊天持久化 | [shared/chat_store.py](../shared/chat_store.py) · [tests/backend/test_chat_store.py](../tests/backend/test_chat_store.py) |
| 2A.2 | 两段式 SSE 聊天接口 | [backend/app/routes/chat.py](../backend/app/routes/chat.py) · [backend/app/services/chat_runner.py](../backend/app/services/chat_runner.py) · [tests/backend/test_chat_api.py](../tests/backend/test_chat_api.py) |
| 2A.3 | 前端 ChatSidebar | [frontend/src/components/workspace/ChatSidebar.tsx](../frontend/src/components/workspace/ChatSidebar.tsx) · [frontend/src/services/chat.ts](../frontend/src/services/chat.ts) |
| 2A.4 | 收藏夹页面（5 tab） | [frontend/src/pages/FavoritesPage/FavoritesPage.tsx](../frontend/src/pages/FavoritesPage/FavoritesPage.tsx) |
| 2A.5 | 路由 + 侧栏入口 | [frontend/src/router.tsx](../frontend/src/router.tsx) · [frontend/src/layouts/AppShell.tsx](../frontend/src/layouts/AppShell.tsx) |
| 2A.6 | 冒烟 + 文档 | 本节 |

### 接口速查

- `POST /workspaces/{id}/chat` body `{prompt, chat_id?, model?}` → `{turn_id, chat_id, status}`
- `GET /workspaces/{id}/chat/events?turn_id=...` SSE：事件 `delta` / `done` / `error`，30s `: heartbeat`
- `GET /workspaces/{id}/chat/messages?chat_id=...` 历史
- `GET /workspaces/{id}/chat/list` 按 chat_id 汇总
- 收藏夹路由：`/favorites`，无新增后端接口（复用 `WorkspaceItem.type` + `WorkspaceRecord.favorites`）

### 设计要点 / 已踩坑

1. **chat_runner 当前是「假流式」**：底层 `sf_client.chat_completion` 非流式；拿到完整文本后按 24 字符切片，每片 40ms 间隔模拟 token。UX 已经成型，后续要换真实流式只需替换 `_default_llm_caller`。
2. **chat router 必须复用 workspaces 的 `_store` 实例**（已在 2A.6 修复）：`WorkspaceStore` 在 `__init__` 加载磁盘到内存，独立两个实例会出现一边 create 后另一边 get 不到的 bug。
3. **ChatSidebar 是浮动 drawer**：通过 fixed 定位，不和 WorkspaceDetail 原 layout 冲突；卸载时 `EventSource.close()` 已处理。
4. **`data/chats/`** 已加入 `.gitignore`。

### 验证状态（自动跑过的）

- `pytest tests/backend -q` → **61 passed**
- `cd frontend && pnpm build` → 0 error
- curl 冒烟：`/health` 200 / 空 prompt 422 / 不存在 ws 404 / 空 messages 返回 `[]` 全部正确

### 留给用户的 UI 验证（建议手测）

- 打开 `/workspaces/<id>`，点右下浮动按钮 → ChatSidebar 弹出，发一条消息看到逐段流式输出、新会话按钮能清空。
- 打开 `/favorites`，切 5 个 tab，看计数与卡片是否一致；点卡片应跳到对应 result 页。

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
