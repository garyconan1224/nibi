# AI Handoff

Last updated: 2026-05-19（N1 完成，进入 N2）

---

## 当前真实进度（按 git log 对账）

| 阶段 | 状态 | 说明 |
|---|---|---|
| Phase 0~1 全部 | ✅ 已合并 main | MVP 主干完成 |
| Phase 2A~2D | ✅ 已合并 main | 内容能力扩展完成（含 2D SQLite 评估） |
| Phase 3A~3C | ✅ 已合并 main | 知识库 + 标签库完成 |
| 现状同步 [A] | ✅ 已完成 | 合并 spec + 设计稿归位 + 文档体系重写 |
| **N1 任务系统差异** | ✅ 完成（待 merge） | 分支 `feat/phase-n1-task-system`，8 个 commit |
| **N1b 磁盘布局重构** | ⏸ 已拆出 | 从 N1 分出，作为独立 P1 phase |
| **N2 侧边栏精简** | ⏳ **下一步** | P0，估时 2-3h |

> ⚠️ 写新交接前请**先 `git log --oneline -20` 对账**，不要相信本文件里写的「下一步」如果它和 git 冲突。

---

## N1 完工小结（待 merge）

- 分支：`feat/phase-n1-task-system`
- worktree：`/Users/conan/Desktop/nibi-n1`（commit 全部已写入，等用户 merge 进 main 后可删）
- commits：N1.1 模型字段、N1.2 列表过滤、N1.3 软删 + restore + permanent + 清空、N1.4 删上层 project_id、N1.5 前端类型 + 删 ProjectSwitcher、N1.6 垃圾桶页面、N1.7 测试修复 + 新增 4 个 trash 用例
- 拆出未做：**磁盘布局 `data/projects/<project_id>/...` 仍保留**——拆为独立 phase **N1b**，因为牵涉到老数据搬家与十几个文件，不在 N1 4-6h 估时范围内。
- 验证：`pytest tests/backend -q` 105 passed；`pnpm build` 仅余 4 个 baseline tsc 错误（与 N1 无关）。
- 用户合并步骤：
  ```bash
  cd /Users/conan/Desktop/nibi
  git merge --no-ff feat/phase-n1-task-system -m "Merge N1: 任务系统差异（trashed/analyzed/上层 project_id）"
  git worktree remove /Users/conan/Desktop/nibi-n1
  git branch -d feat/phase-n1-task-system
  ```

---

## N2 开工交接（下一步）

> 来源：`docs/SPEC.md` §1.7 / §1.8。

### N2 范围

- 标题：侧边栏从 8 砍到 4 + Taskboard 子标签 5→4
- 估时：2-3h
- 优先级：P0
- **模型**：Sonnet 4.6 或 ⭐ 小米 2.5 Pro（纯前端入口隐藏 / 路由调整，符合 CLAUDE.md「简单阶段」）
- **分支**：可直接在主 worktree 开 `feat/phase-n2-sidebar`
- **不 push**：commit 留本地，等 [D] 阶段统一推

### 具体差异项

1. **一级导航砍至 4 项**：任务中心（Taskboard）/ 资料库 / AI 导演（灰显，等 [C] 阶段）/ 设置
2. **Taskboard 子标签砍至 4 项**：素材 / 队列 / 标签库 / AI 对话（隐藏「导出」入口）
3. **代码留备份**：仅入口隐藏，不删功能代码（导出仍可走 API 触发，只是 UI 不可见）

### 开工前准备

1. 读 `docs/SPEC.md` §1.7 / §1.8
2. 找前端侧边栏 / Taskboard 组件
3. 拆子任务（应该比 N1 简单很多）

### 不要做的事

- ❌ 不要顺手改 N3 设置页重组（那是 N3 的事）
- ❌ 不要删被隐藏入口对应的页面代码 / 路由代码
- ❌ N1b 磁盘布局重构属于独立 phase，不要在 N2 里捎带

---

## 历史交接（已完成，仅备查）

Phase 2D 评估报告见 `docs/archive/phase-2d-sqlite-evaluation.md`，结论：暂不切 SQLite，等 workspace.json > 5MB 时复审。

更早的交接记录（Phase 2B/2C 等）请翻 `git log -p docs/AI_HANDOFF.md` 查找。
