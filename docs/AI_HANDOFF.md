# AI Handoff

Last updated: 2026-05-19（N4 完成，进入 N5）

---

## 当前真实进度（按 git log 对账）

| 阶段 | 状态 | 说明 |
|---|---|---|
| Phase 0~1 全部 | ✅ 已合并 main | MVP 主干完成 |
| Phase 2A~2D | ✅ 已合并 main | 内容能力扩展完成（含 2D SQLite 评估） |
| Phase 3A~3C | ✅ 已合并 main | 知识库 + 标签库完成 |
| 现状同步 [A] | ✅ 已完成 | 合并 spec + 设计稿归位 + 文档体系重写 |
| **N1 任务系统差异** | ✅ 已合并 main | 8 个 commit，含 trashed/analyzed/软删垃圾桶/删 project_id |
| **N1b 磁盘布局重构** | ⏸ 已拆出 | 从 N1 分出，作为独立 P1 phase |
| **N2 侧边栏精简** | ✅ 已合并 main | 侧边栏 4 项 + Taskboard 4 子标签 |
| **N3 设置页重组** | ✅ 已合并 main | 设置页 tabs 10→7，合并模型与渠道 / 分析默认偏好 |
| **N4 添加素材模态** | ✅ 已合并 main | 4 步合一 + 自动识别 + 智能勾选 + 背景折叠 |
| **N5 Preflight 抽屉** | ⏳ **下一步** | P1，估时 4-6h |

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

## N2 完工小结

- 分支：`feat/phase-n2-nav-cleanup`，已合并 main
- commits：1 个（N2.1 侧边栏精简 4 项 + Taskboard 子标签切换）
- 改动：
  - AppShell.tsx：工作区→任务中心、砍收藏夹、知识库检索→资料库、新增 AI 导演（灰显 disabled）
  - WorkspaceDetail.tsx：平铺→Tabs（素材/队列/标签库/AI 对话），移除导出 ZIP 卡片及关联代码
- 验证：改动文件无 lint/build 错误（其他文件有 baseline 错误，与 N2 无关）

---

## N3 完工小结

- 分支：`feat/phase-n3-settings`，已合并 main
- commits：1 个（N3.1 设置页重组 9→7）
- 改动：
  - ProvidersAndModelsPage.tsx：合并供应商管理 + 模型管理，内部 Tabs 切换
  - AnalysisDefaultsPage.tsx：合并截帧/转写/提示词模板 + 任务默认勾选占位
  - SettingsShell.tsx：tabs 从 10 个精简为 7 个
  - router.tsx：新增 providers-models / analysis-defaults 路由，旧路由重定向
- 验证：新文件编译通过，lint 无新增错误

---

## N4 完工小结

- 分支：`feat/phase-n4-add-material`，已合并 main
- commits：1 个（N4.1 添加素材模态 4 步合一 + 自动识别 + 智能勾选）
- 改动：
  - AddMaterialModal.tsx（新建，637 行）：4 步向导 + URL/文件自动识别类型 + 分析任务智能默认勾选 + 背景信息折叠 + 自动保存 preflight + 触发 pipeline
  - WorkspaceDetail.tsx：移除旧内联模态（~200 行），改用 AddMaterialModal
- 验证：编译通过，新文件无 lint 错误

---

## N5 开工交接（下一步）

> 来源：`docs/SPEC.md` §3.4。

### N5 范围

- 标题：Preflight 抽屉细化（按素材类型展开所有子参数）
- 估时：4-6h
- 优先级：P1
- **模型**：⭐ **Opus 4.7**（跨多素材类型 + 子参数细化，符合 CLAUDE.md「复杂阶段」）
- **分支**：`feat/phase-n5-preflight`
- **不 push**：commit 留本地，等 [D] 阶段统一推

### 具体差异项

1. **视频子参数**：截帧模式（按秒/AI 镜头分析）、间隔秒数、最大帧数、镜头取帧数、总结路径、总结深度
2. **音频子参数**：Whisper 语言、说话人分离开关、Suno/Udio 格式开关
3. **图片子参数**：提示词格式（MJ/SD/JSON）、联想方向（4 维度）
4. **文字子参数**：摘要长度、联想方向、改写风格、翻译目标语

### 开工前准备

1. 读 `docs/SPEC.md` §3.4（Preflight 子参数表格）
2. 读现有 PreflightConfigPanel.tsx
3. 确认哪些子参数已有、哪些需要新增

### 不要做的事

- ❌ 不要顺手改 N6 任务级 LLM 对话
- ❌ 不要改动后端 pipeline 逻辑（N5 纯前端细化）

---

## 历史交接（已完成，仅备查）

Phase 2D 评估报告见 `docs/archive/phase-2d-sqlite-evaluation.md`，结论：暂不切 SQLite，等 workspace.json > 5MB 时复审。

更早的交接记录（Phase 2B/2C 等）请翻 `git log -p docs/AI_HANDOFF.md` 查找。
