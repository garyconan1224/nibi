# AI Handoff

Last updated: 2026-05-19（N11 后收口：前端 build blocker + 文档状态同步）

---

## 启动必读

每次新会话先对账，不要直接相信本文件：

```bash
git fetch --all --prune
git status --short --branch
git log --oneline -5
git branch --show-current
```

然后按顺序读：

1. `AGENTS.md`
2. `docs/WORKFLOW.md`
3. `docs/SPEC.md`
4. `docs/EXECUTION_PLAN.md`
5. `docs/design/`
6. `docs/OUTSTANDING_TASKS.md`

`docs/archive/` 下旧 spec / plan 仅作历史参考，不参与当前决策。

---

## 当前真实进度

| 阶段 | 状态 | 说明 |
|---|---|---|
| Phase 0~1 | ✅ 已合并 main | MVP 主干完成 |
| Phase 2A~2D | ✅ 已合并 main | 内容能力扩展完成，2D 结论为暂不切 SQLite |
| Phase 3A~3C | ✅ 已合并 main | 知识库 + 标签库完成 |
| [A] 现状同步 | ✅ 已完成 | 合并 spec、设计稿归位、文档体系重写 |
| [B] N1~N11 spec-gap | ✅ 已完成 | N1 到 N11 主线全部结束 |
| N1b | ⏸ 待做 | 磁盘布局 `data/projects/` → `data/workspaces/` |
| N7b | ⏸ 待做 | 视频总结路径 1（字幕直接）+ 路径 3（视频大模型直接） |
| N8b | ⏸ 待做 | 音频前端交互：无人声弹窗 / 说话人修正 / 音乐切分 |
| [C] AI 导演 | ⏸ 待选 | 需先补完整设计稿 |
| [D] 开源准备 | ⏸ 待选 | README、license、安全检查、CI、push 策略解除等 |

截至本交接，`docs/EXECUTION_PLAN.md` 是当前最准确的计划状态来源。

---

## 当前基线提醒

- 本地 `main` 预计领先 `origin/main`，这是 push 暂缓策略下的正常状态。
- 不要主动 `git push origin`，统一等 `[D]` 开源准备阶段。
- FastAPI + React/Vite 是当前产品线；`app.py`、`pages/`、`src/vidmirror/ui/` 是 Streamlit legacy compatibility path，不要往旧入口加新产品功能。
- Codex 在本项目默认只做检查、测试、分支比较、文档/状态同步和下一步建议；写业务功能必须等用户明确授权。

---

## 本次收口内容

本次收口目标是让开源前基线更干净：

- 修复前端 `pnpm build` 的 4 个 TypeScript blocker：
  - `ItemTagsPanel.tsx` 删除未使用的 `TAG_DIMENSION_LABELS` import
  - `SearchPage.tsx` 把旧的 `EmptyState icon` 用法改成组件实际支持的 `illustration`
- 同步过期文档：
  - `docs/WORKFLOW.md`
  - `CLAUDE.md`
  - `AGENTS.md`
  - `docs/AI_HANDOFF.md`
  - `docs/OUTSTANDING_TASKS.md`

完成后应验证：

```bash
.venv/bin/python -m pytest tests/backend -q
cd frontend && pnpm build
git status --short --branch
```

---

## .git 体积清理（未授权，不要擅自执行）

`.git` 当前约 `278M`。根因是早期历史里包含 `.venv/` 和 `backend/app/services/test_note_output/`。

如用户明确说「做 .git 清理」或「做 filter-repo」，再执行：

```bash
cp -r .git .git.bak-20260519-before-filterrepo
git filter-repo --path .venv --path backend/app/services/test_note_output --invert-paths
du -sh .git
git log --oneline -5
```

注意：

- `git filter-repo` 会重写所有 commit hash。
- 操作前必须确认 `git-filter-repo` 可用。
- 操作后仍然不要 push。

---

## 推荐下一步

完成本次收口 commit 后，建议让用户在下面选一个：

1. `.git` 历史瘦身
2. `[D] 开源准备`
3. `[C] AI 导演设计补齐`
4. `N1b` 磁盘布局重构
