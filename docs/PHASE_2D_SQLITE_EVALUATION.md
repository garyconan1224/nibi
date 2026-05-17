# Phase 2D — SQLite 切换评估报告

> 评估日期：2026-05-17
> 评估范围：当前所有 JSON store 的体量、性能、增长趋势
> 触发条件来源：`nibi-spec-v2.md` 第 55 行

---

## 1. 触发条件（spec v2 定义）

> 任务数 > 30 / 首屏 > 0.5s / 跨任务搜字幕 / 标签库 7 维度索引 — 触发任一才切 SQLite。

---

## 2. 当前各 Store 体量

| Store | 文件路径 | 大小 | 记录数 | 写入模式 |
|-------|---------|------|--------|---------|
| task_store | `.local/backend_tasks.json` | **3.4 MB** | 84 条 | 全量重写（每次写都序列化整个 dict） |
| settings_store | `.local/settings.json` | 5.9 KB | 1 个文件 | read-modify-write 全量覆盖 |
| chat_store | `data/chats/<wid>.jsonl` | 1.9 KB | 4 行 | **追加写入**（jsonl，每行一条消息） |
| workspace_store | `data/workspaces/<wid>.json` | 2.7 KB | 1 个 workspace | 单文件原子写 |
| project_store | `data/projects/<pid>/` | 140 MB 总计 | 18 个项目 | 目录结构，分析数据占大头 |

### task_store 详细分析（唯一接近阈值的 store）

- 84 条记录：36 SUCCESS / 35 FAILED / 13 CANCELLED
- 最大单条记录：**713 KB**（含 2191 条 log entry = 254 KB + result = 458 KB）
- 读取耗时：**13.6 ms**（全量 3.4 MB JSON parse）
- 序列化耗时：**30.0 ms**（全量 indent=2 dump）
- 每次 `append_log()` 调用都会触发全量 3.4 MB 的序列化 + 原子写入

---

## 3. 逐项触发评估

### 3.1 任务数 > 30 — ⚠️ 勉强触发

84 条 > 30，**形式上触发**。但需区分：

- **历史累计** 84 条（含已终态的 SUCCESS/FAILED/CANCELLED）
- **活跃任务** 通常 0–2 条（本地工具，非 SaaS 并发场景）
- spec 里的「任务数 > 30」大概率指的是「活跃任务数导致首屏卡顿」，而非历史总数

**结论**：名义触发，实际不是瓶颈。当前 84 条全量加载 13.6 ms，远低于 0.5s 首屏阈值。

### 3.2 首屏 > 0.5s — ❌ 未触发

- task_store 全量读取 13.6 ms
- settings_store 5.9 KB，可忽略
- workspace_store 单文件 2.7 KB，可忽略
- 前端 zustand 从 SSE 接收增量更新，不轮询全量

即使 task_store 增长到 500 条（估算 ~20 MB），JSON parse 耗时约 80 ms，仍在 0.5s 以内。

### 3.3 跨任务搜字幕 — ❌ 未触发

当前没有跨任务搜索字幕的需求。字幕数据在各分析结果 JSON 里，按 project 隔离。如果未来需要，这更像是 RAG/向量检索的场景（已有 `shared/knowledge_base.py`），而非 SQL JOIN 场景。

### 3.4 标签库 7 维度索引 — ❌ 未触发

当前无标签系统。

---

## 4. 真正的风险点（非 SQLite 触发条件，但值得关注）

### 4.1 task_store 日志膨胀（中风险）

最大单条记录有 **2191 条 log entry**（254 KB）。每次 `append_log()` 都全量重写 3.4 MB 文件。

- **当前影响**：append_log 延迟 ~30 ms，用户无感
- **增长预测**：如果连续跑 10 个 note 任务（每个生成 ~2000 条 log），文件将膨胀到 ~10 MB，单次写入 ~100 ms
- **建议**：终态任务裁剪 log（只保留最后 N 条或摘要），无需 SQLite

### 4.2 并发写入安全（低风险）

task_store 和 workspace_store 都用 `threading.Lock` + 原子写入（tempfile + fsync + os.replace），对单进程 FastAPI + ThreadPoolExecutor 场景足够。

- SQLite 在这方面更好（WAL 模式支持并发读），但当前无并发写冲突报告
- 如果未来切多进程（gunicorn workers > 1），JSON store 会出现写竞争，那时必须切 SQLite

### 4.3 project_store 140 MB 不是 store 问题

140 MB 是分析产物（json_data / videos / text / audio），不是元数据。project 元数据本身极小。这些文件不需要进 SQLite，它们是 blob 数据，文件系统存储是正确的。

---

## 5. 结论

**当前不触发 SQLite 迁移。** 四个触发条件中：

| 条件 | 状态 | 说明 |
|------|------|------|
| 任务数 > 30 | ⚠️ 形式触发 | 84 条历史记录，但活跃任务极少，全量加载 13.6 ms |
| 首屏 > 0.5s | ❌ 未触发 | 最大 store 读取 13.6 ms |
| 跨任务搜字幕 | ❌ 未触发 | 无此需求 |
| 标签库 7 维度索引 | ❌ 未触发 | 无标签系统 |

---

## 6. 下一次复审触发条件

满足以下**任一**条件时，应重新评估 SQLite 迁移：

1. **task_store 文件 > 10 MB**（约 250–300 条记录，含大量 log）
2. **首屏任务列表加载 > 300 ms**（实测，非理论推算）
3. **需要跨任务/跨项目联合查询**（如全局字幕搜索、跨项目统计）
4. **需要多进程部署**（gunicorn workers > 1，JSON 文件写竞争）
5. **需要事务一致性**（如批量操作需要 rollback）

---

## 7. 当前推荐：优化 task_store 日志（不迁移 SQLite）

在不引入 SQLite 的前提下，建议做一个小优化：

- **终态任务 log 裁剪**：任务进入 SUCCESS/FAILED/CANCELLED 后，只保留最后 50 条 log entry
- 预估效果：最大记录从 713 KB 降到 ~20 KB，task_store 整体从 3.4 MB 降到 ~1 MB
- 工作量：~30 分钟，改 `task_store.py` 一个文件

这个优化可以推迟 SQLite 迁移 6–12 个月（除非使用模式剧变）。
