# AI Handoff

Last updated: 2026-05-19（N5 完成，进入 N6）

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
| **N5 Preflight 抽屉** | ✅ 待 merge | 4 类素材子参数全套 UI + tasks 形状升级 |
| **N6 任务级 LLM 对话** | ⏳ **下一步** | P1，估时 6-8h，素材 chip 多选 + RAG 兜底 |

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

## N5 完工小结

- 分支：`feat/phase-n5-preflight`，worktree `/Users/conan/Desktop/nibi-n5`，**待 merge**
- commits：
  - `02e8d7d` N5.1 类型与读写兼容层（`frontend/src/lib/preflightTasks.ts`，300 行）
  - `644fae1` N5.2~N5.5 4 类素材子参数 UI 全套（新增 `PreflightTaskDetails.tsx` + 重写 PreflightConfigPanel 第三区）
  - N5.6 文档更新（本提交）
- 改动：
  - 数据形状：`PreflightConfig.tasks` 从 `{id: boolean}` 升到 `{id: {enabled, ...params}}`。后端类型 `Record<string, unknown>` 兼容，**无需后端改动**
  - 视频：截帧模式（AI 镜头/按秒）+ 间隔秒数 + 最大帧数 + 镜头取帧数（2/3）+ 提示词格式 + 提示词语言 + 3 条总结路径 + 总结深度
  - 音频：Whisper 语言（8 种）+ 音乐分析 Suno/Udio 格式开关
  - 图片：MJ/SD/JSON 格式 + 4 维联想方向多选 + 一级新增「多图对比」
  - 文字：摘要长度 / 改写风格 / 7 种翻译目标语 / 4 维联想 + 一级新增「多文对比」
- 验证：`pnpm tsc -b --noEmit` 除 4 条 baseline 错误外不新增（与 N1 完工后基线一致）
- 用户合并步骤：
  ```bash
  cd /Users/conan/Desktop/nibi
  git merge --no-ff feat/phase-n5-preflight -m "Merge N5: Preflight 抽屉子参数细化"
  git worktree remove /Users/conan/Desktop/nibi-n5
  git branch -d feat/phase-n5-preflight
  ```

---

## N6 开工交接（下一步）

> 来源：`docs/SPEC.md`（任务级 AI 对话章节）。

### N6 范围

- 标题：任务级 LLM 对话上下文素材多选 chip + RAG 兜底
- 估时：6-8h
- 优先级：P1
- **模型**：⭐ **Opus 4.7**（上下文拼接 + RAG 兜底逻辑，符合「复杂阶段」）
- **分支**：`feat/phase-n6-task-chat`，新 worktree `/Users/conan/Desktop/nibi-n6`
- **不 push**：commit 留本地

### 具体差异项

1. WorkspaceDetail「AI 对话」Tab 内的对话输入框上方加素材 chip 多选条
2. 选中素材 → 把对应 `item.results` / 摘要注入对话上下文
3. 未选中、或上下文 token 超阈值 → 走 RAG 检索兜底（沿用 Phase 3B 的索引）
4. UI 上展示「本次问答用了哪些素材 / RAG 命中片段」

### 开工前准备

1. 读 `docs/SPEC.md` 任务级 AI 对话章节
2. 看现有 `rag.py` 路由 + 前端 `services/rag.ts`
3. 确认 token 阈值切到 RAG 的判定方式

### 不要做的事

- ❌ 不要顺手做 N7（视频 PySceneDetect 后端实现）
- ❌ 不要修改 Phase 3B 已建立的 RAG 索引结构

---

## 历史交接（已完成，仅备查）

Phase 2D 评估报告见 `docs/archive/phase-2d-sqlite-evaluation.md`，结论：暂不切 SQLite，等 workspace.json > 5MB 时复审。

更早的交接记录（Phase 2B/2C 等）请翻 `git log -p docs/AI_HANDOFF.md` 查找。
