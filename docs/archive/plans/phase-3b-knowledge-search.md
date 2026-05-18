---
phase: 3B
title: 知识库 UI（跨工作空间 RAG 检索）
status: done
estimate_hours: 5
actual_hours: ~2.5
model: Opus 4.7
branch: feat/phase3b-knowledge-search
worktree: 否（直接在主目录 /Users/conan/Desktop/nibi 的 feat/phase3b-knowledge-search 分支上做）
depends_on: [3A]
subtasks: [3B.1, 3B.2, 3B.3, 3B.4, 3B.5]
commits:
  - c606ba4 feat(phase3b): 3B.1 workspace 知识库数据桥 + FAISS 缓存层
  - 24089ed feat(phase3b): 3B.2 单工作空间检索端点 + 测试
  - adf5fb3 feat(phase3b): 3B.3 跨工作空间检索端点 + reranker 合并
  - 92b25a6 feat(phase3b): 3B.4 前端搜索页 + 侧栏入口接入
  - 8388c71 feat(phase3b): 3B.5 WorkspaceDetail 内嵌搜索条
completed_date: 2026-05-18
---

## 工作环境

- 工作目录: `/Users/conan/Desktop/nibi`（主目录，已在 `feat/phase3b-knowledge-search` 分支）
- 分支: `feat/phase3b-knowledge-search`（基于 main `948c115`）
- `.env` 在主目录，无需额外操作

## 背景

Phase 3A 已完成视频工作台清理。3B 目标：把已有的 RAG 算法接到「工作空间」体系，做跨工作空间的语义检索 UI。

### 现有资产盘点

| 层 | 文件 | 状态 |
|---|---|---|
| 核心算法 | `shared/knowledge_base.py` (511 行) | ✅ 完整 FAISS + SiliconFlow embeddings/rerank |
| 入口 | `retrieve_with_sources()` / `load_folder_as_knowledge()` | ✅ 但要 `project_json_dir` 绝对路径 |
| 旧 RAG 端点 | `backend/app/routes/rag.py` `POST /rag/ask` | ✅ 但只服务 `data/projects/<pid>/json_data/`，不认 workspace |
| 旧 service | `backend/app/services/rag_qa_service.py` | ✅ 参考它怎么调 retrieve_with_sources |
| 工作空间 | `data/workspaces/<wid>.json` + 分析产物分散在各 item.results | ❌ 没法直接喂 RAG |
| 前端 services | `frontend/src/services/` | ❌ 零 RAG 接入 |
| 侧栏入口 | `frontend/src/layouts/AppShell.tsx` (放大镜🔍图标已存在但无路由) | ⚠️ 占位待接 |

## 设计决策（已对齐，不要再问）

- **Q1 跨 workspace 策略**：每个 workspace 独立 FAISS → 各自 top-K → 合并 → reranker 二次精排
- **Q2 缓存**：`data/.local/embeddings/<workspace_id>.faiss` + `<workspace_id>.meta.json`，items 变化打 dirty flag，下次检索 lazy 重建，启动不预热
- **Q3 API key**：前端不传，后端 fallback 到 `settings.openai_api_key`
- **Q4 SearchSource 字段约定**：
  ```ts
  type SearchSource = {
    workspace_id: string
    workspace_name: string
    item_id: string
    item_type: 'video' | 'image' | 'audio' | 'text'
    item_title: string
    chunk_excerpt: string  // ≤200 字
    score: number
    jump_url: string       // /workspaces/{ws}/items/{id}/<type>_result
  }
  ```

## 子任务

### 3B.1 数据桥 + 缓存层（后端，~1h）

新增 `backend/app/services/workspace_knowledge.py`：

- `collect_workspace_json_paths(workspace_id) -> list[Path]`：扫 workspace items，把每个 item 的分析产物 JSON 路径收集出来（产物路径在 item.results 或 `data/projects/<pid>/json_data/`，参考 workspaces.py 里 `_materialize` 怎么解析）
- `build_or_load_workspace_index(workspace_id, api_key) -> LongKnowledge | ShortKnowledge`：
  - 检查 `data/.local/embeddings/<wid>.faiss` 是否存在且 `.meta.json` 里 hash 与当前 items 内容 hash 一致
  - 命中缓存：`faiss.read_index` + 反序列化 chunks → 装回 LongKnowledge
  - 未命中：调 `load_folder_as_knowledge`（用临时目录或改 knowledge_base.py 增加"从 paths 列表加载"的入口；优先后者）
  - 写缓存：`faiss.write_index` + meta.json（含 chunks 序列化、embedding_model、items_hash、created_at）
- `invalidate_workspace_index(workspace_id)`：删除缓存文件

meta.json 形状：
```json
{
  "workspace_id": "...",
  "items_hash": "sha256(...)",
  "embedding_model": "...",
  "chunks": [ VideoChunk dict 序列 ],
  "created_at": "ISO8601"
}
```

测试 `tests/backend/test_workspace_knowledge.py`：1 happy（命中缓存）+ 1 错误（无 api_key）。

**commit**：`feat(phase3b): 3B.1 workspace 知识库数据桥 + FAISS 缓存层`

### 3B.2 单工作空间检索端点（后端，~30min）

`backend/app/routes/workspaces.py` 加 `POST /{workspace_id}/search`：
- 请求体：`{query: str, top_k?: int = 5}`
- 返回：`{answer, sources[]}`（answer 复用 rag_qa_service 的 LLM 调用，sources 按 Q4 字段补全）

测试 `tests/backend/test_workspaces_search.py`：1 happy + 1 错误（workspace 不存在 → 404）。

**commit**：`feat(phase3b): 3B.2 单工作空间检索端点 + 测试`

### 3B.3 跨工作空间检索端点（后端，~1.5h）

新增 `POST /search` (top-level)：
- 请求体：`{query: str, top_k?: int = 10, workspace_ids?: string[]}`（workspace_ids 空 = 全部）
- 实现：
  1. 遍历 workspace_ids（或全部）
  2. ThreadPoolExecutor 并发调 `build_or_load_workspace_index` + `retrieve_with_sources`
  3. 合并 chunks 到候选池
  4. `shared.sf_client.rerank_documents` 二次精排取 top_k
  5. 调一次 LLM 综合回答
  6. 返回 `{answer, sources[]}`

性能要求：3 个 workspace × 50 chunks 命中缓存时整体 < 3s。

测试 `tests/backend/test_global_search.py`：1 happy（跨 workspace 引用）+ 1 错误（含不存在 id）。

**commit**：`feat(phase3b): 3B.3 跨工作空间检索端点 + reranker 合并`

### 3B.4 前端 SearchPage + 侧栏接入（~1.5h）

- `frontend/src/services/search.ts`：`searchGlobal(query, opts)` / `searchWorkspace(wid, query)`
- `frontend/src/pages/SearchPage/SearchPage.tsx`：
  - 顶部输入框 + "范围"下拉
  - 提交按钮 + loading 态
  - 答案区（ReactMarkdown 渲染，含 [1][2] 引用标记）
  - 源列表（卡片式：workspace_name + item_title + chunk_excerpt + score + 跳转）
  - 空态 / 错误态
- `router.tsx`：加 `/search` 路由
- `AppShell.tsx`：把侧栏🔍图标接到 `/search`

约束：Tailwind 4 + 现有 shadcn 组件，不引新依赖。i18n key 加在 `frontend/src/locales/`。

**commit**：`feat(phase3b): 3B.4 前端搜索页 + 侧栏入口接入`

### 3B.5 工作空间内嵌搜索（~30min）

`WorkspaceDetail.tsx` 顶部加搜索条（窄版），调 `searchWorkspace(wid, query)`，结果内联展开，可折叠。

**commit**：`feat(phase3b): 3B.5 WorkspaceDetail 内嵌搜索条`

## 验收

每个 commit 后跑：
- `cd /Users/conan/Desktop/nibi-phase3b && pytest tests/backend -q`
- `cd frontend && pnpm tsc --noEmit`

全部完成后端到端：
- `./start.sh`
- 至少 2 个工作空间手测：全局检索 / 单空间检索 / 引用跳转 / 缓存命中速度

## 风险提示（遇到立刻停下问用户）

1. `shared/knowledge_base.py` 的 `load_folder_as_knowledge` 改不动 → 改用临时目录 workaround
2. 缓存的 chunks 序列化失败（VideoChunk frozen dataclass，可能要 asdict）
3. workspace items 产物路径不统一（4 种类型）→ 先 grep `_materialize` 和各 result 端点
4. rerank 跨 workspace score 量纲不一致 → 可能要 min-max 规范化
5. 并发请求 embeddings API 触发限流

## 不要做的事

- ❌ 不要改 `shared/knowledge_base.py` 核心算法
- ❌ 不要动 `backend/app/routes/rag.py` 的 `/rag/ask`（保留旧入口）
- ❌ 不要做 UI 大改
- ❌ 不要主动 merge 回 main
- ❌ 不要在主 worktree 改代码

## 完成后

回到主 worktree `/Users/conan/Desktop/nibi`，更新：
1. `docs/PROJECT_EXECUTION_PLAN.md`：勾上 3B 5 个子任务
2. `docs/COMPLETED_WORK.md`：追加完成记录
3. 本文件 frontmatter：`status: done` + 填 `commits`、`completed_date`、`actual_hours`
