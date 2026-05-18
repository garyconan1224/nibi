---
phase: 3A
title: 视频工作台清理 + LICENSE 文件
status: done
estimate_hours: 1.5
actual_hours: 1
model: 小米 2.5 Pro
branch: main
worktree: /Users/conan/Desktop/nibi
depends_on: []
completed_date: 2026-05-17
commit_count: 6
commits:
  - 9bb0e42 chore(phase3a): 3A.1 删除 HomePage 目录与 NoteForm 测试
  - 0840702 refactor(phase3a): 3A.2 router 默认跳转改 /workspaces + 删 /home 路由
  - 1df97bb chore(phase3a): 3A.3 清理 i18n 里 HomePage 相关文案
  - 368010b chore(phase3a): 3A.4 卸载 notes.py 路由（前端零引用，安全移除）
  - a1cb6f9 docs(phase3a): 3A.5 新增 MIT LICENSE 文件
  - 948c115 fix(phase3a): 3A.6 删除 AppShell 侧栏残留的工作台导航项
---

## 背景

项目里曾经有两套并存的产品入口：
1. `/home`（旧）：BiliNote 时代留下的"视频作业台"单页
2. `/workspaces`（新）：v1.1 设计契约定的新主线

新主线完全覆盖了旧入口能力，所以本子阶段清理旧入口，为后续 3B/3C 在统一数据模型上建索引扫清障碍。

## 已完成内容

- 删除 22 个文件、修改 3 个文件、净减 3499 行
- 删除：`frontend/src/pages/HomePage/` 整个目录、`HomeLayout`、`WorkbenchShell`、`NoteForm.test`、4 个 locale JSON、bilinote 测试
- 修改：`router.tsx`（删 /home 路由、默认跳 /workspaces）、`i18n.ts`、`backend/app/main.py`（卸载 notes.py）
- 补丁：`AppShell.tsx` 侧栏移除工作台 nav 项、Logo 跳转改 /workspaces、移除未使用 Home 图标 import
- 新增：根目录 `LICENSE` 文件（MIT, conan, 2026）

## 验收（已通过）

- `pnpm tsc --noEmit` 通过
- `pnpm build` 通过
- `pytest tests/backend -q`：80 passed, 0 failed
- 浏览器手测：访问 `/home` → 404；侧栏无小房子图标；Logo 点击跳 `/workspaces`
- `grep -rn "'/home'" frontend/src/` 零残留

## 经验留档

- 删除旧入口时容易漏 **侧栏导航项** 和 **logo 点击 navigate 目标**，下次类似清理任务（比如未来 Streamlit 旧入口若复活）记得 grep `navigate('/<path>')` 和 sidebar items 数组
- WorkbenchShell 这次只有 HomeLayout 用，可以一起删；如果未来类似组件被多处共享，要保留
