# AI Handoff

Last updated: 2026-05-17（Phase 2C 全部合并之后）

---

## 当前真实进度（按 git log 对账，非凭记忆）

| 子阶段 | 状态 | 关键 commit |
|---|---|---|
| 2A LLM 侧栏 + 收藏夹 | ✅ 已合并 main | `c41121f` / `cbc9eb2` / `41757d2` |
| 2B 音频结果页 | ✅ 已合并 main | `06c1c2f` / `ff19a22` |
| 2C.1 文本输入层（PDF/DOCX/网页正文） | ✅ 已合并 main | `9c05428` → `06b722c`，merge `1f68427` |
| 2C.2 文本结果页 + 提示词版本栈 | ✅ 已合并 main | `041df98` → `7e08e74` |
| **2D SQLite 切换评估** | ⏳ **下一步** | — |

> ⚠️ 写新交接前请**先 `git log --oneline -20` 对账**，不要相信本文件里写的「下一步」如果它和 git 冲突。

---

## Phase 2D 开工交接（下一步）

> 来源：`~/.claude/plans/nibi-spec-v2-md-users-conan-claude-plan-validated-dijkstra.md` §2D。

### 2D 范围（spec v2 §3 决议）

- 标题：SQLite 切换评估（**只评估，不一定迁移**）
- 估时：1h
- 分支：直接在 main（spec 标「否」需要 worktree）
- 推荐模型：⭐**小米 2.5 Pro（终端，免费优先）** 或 Sonnet 4.6
- 强制顺序：2A → 2B / 2C → **2D 收尾**

### 交付物

一份评估报告（建议 `docs/PHASE_2D_SQLITE_EVALUATION.md`），回答：

1. 当前三个 JSON store 的体量与增长曲线：
   - `data/projects/*/workspace.json`（workspace_store）
   - `data/.local/backend_tasks.json`（task_store）
   - providers / global settings（settings_store）
2. 是否触发 v1.1 / 总规划列出的 SQLite 切换临界点（单文件 > N MB、并发写冲突、跨表查询需求、备份/迁移工具缺失等）。
3. 触发了：给迁移工作量估时（schema 设计 / 数据迁移脚本 / 代码改造）。
4. 没触发：给一个「下一次复审」的触发条件（例：「workspace.json > 5MB 时复审」）。

### 不要做的事

- ❌ 不要顺手开始真正迁移代码 —— 这一步只是评估报告。
- ❌ 不要修改 store 模块本身。
- ❌ 不要引入新依赖（Python 自带 sqlite3 足够评估用）。

### commit 模板

```
docs(phase2d): 2D SQLite 切换评估报告
```

---

## 历史交接（已完成，仅备查）

旧版本本文件曾贴有 Phase 2B 开工的详细扫码笔记。2B 已于 `06c1c2f` 合并，相关内容请翻 `git log -p docs/AI_HANDOFF.md` 查找。本次重写已移除，避免下一个 AI 把已完成的工作当成下一步重做（这正是「让我重做 2C.1」事故的根因）。
