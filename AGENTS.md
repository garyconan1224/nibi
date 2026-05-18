# Codex Global Rules

## Core Behavior

- Think before coding. State assumptions when they affect architecture, data, security, or user-visible behavior.
- If a request is ambiguous in a high-risk way, present the tradeoff instead of silently choosing one path.
- Prefer the simplest solution that fully solves the problem.
- Make surgical changes. Avoid refactoring unrelated code.
- Match the codebase's existing style and structure unless there is a strong reason not to.
- Clean up only what your own change makes unnecessary.

## Project Line

- The active product line is **FastAPI + React/Vite**.
- `app.py`, `pages/`, and `src/vidmirror/ui/` are **legacy Streamlit compatibility paths**. Do not add new product work there unless the user explicitly asks for legacy maintenance.
- Runtime data does not belong in git. Keep cookies, local databases, sqlite files, zip exports, downloaded media, logs, and local env files out of commits.

## Collaboration Handoff

**Required reading order at the start of every session** (single source of truth as of 2026-05-18):

1. [`docs/WORKFLOW.md`](docs/WORKFLOW.md) — Master workflow, current phase, design-vs-code decisions per phase
2. [`docs/nibi-spec-merged.md`](docs/nibi-spec-merged.md) — Product specification (8 modules, product-requirement granularity)
3. [`docs/PROJECT_EXECUTION_PLAN.md`](docs/PROJECT_EXECUTION_PLAN.md) — Engineering plan (Phase checkboxes, current step)
4. [`docs/design/`](docs/design/) — Design source files (19 jsx components, VidMirror.html, styles.css, v1.1 design contract)
5. `docs/AI_HANDOFF.md` / `docs/OUTSTANDING_TASKS.md` — Session-level handoff notes (if present)

**Deprecated, do not read for current decisions**:
- `nibi-spec-v2.md` (replaced by `docs/nibi-spec-merged.md`)
- `docs/archive/system_design_v3_final.md`
- `plan.md`, `system_design_for_claude_design_v1.md`

**Current phase**: [A] state sync (see WORKFLOW.md §4). Next: [B] N1~N11 spec-gap landing per `docs/nibi-spec-merged.md` Appendix C.

Keep each turn scoped to one clear task. If a request starts to expand into product design plus implementation, separate the decision step from the coding step.

---

## Codex 职责边界（重要，必读）

本项目中 **Codex 只承担检查、测试、分支比较和下一步建议**，不写新业务功能。

### Codex 可以做的事

- 运行测试：`pytest tests/backend -q`、`cd frontend && pnpm test`
- 比较分支 diff：`git diff main..<branch>` 并给出文字评审
- 检查 lint 和 build：`pnpm lint`、`pnpm build`
- 读取 `docs/AI_HANDOFF.md`、`docs/OUTSTANDING_TASKS.md` 后给出下一步建议
- 发现并报告潜在问题（bug、类型错误、遗漏测试），但**不自行修复**
- 比较多个 agent 分支，指出差异，交由用户决定采用哪一份

### Codex 不可以做的事

- ❌ **不写新业务功能**（API 端点、前端页面、数据模型等）
- ❌ 不在 `main` 分支直接提交代码
- ❌ 不 apply / cherry-pick 其他 agent 的 stash 或 commit
- ❌ 不把另一个 agent 的 worktree 分支当作 main 来 rebase
- ❌ 不在检测到同主题 worktree 时继续实现——先报告，等用户决定

### Codex 分支前缀

- 检查任务：`codex/qa-<task>`（例：`codex/qa-phase1d`）
- 审查任务：`codex/review-<task>`（例：`codex/review-upload-endpoint`）

### 启动检查（每次会话必须先跑）

```bash
git fetch --all --prune
git status --short --branch
git log --oneline -5
git branch --show-current
```

**单 agent 串行原则（2026-05-18 起）**：项目已不再多 agent 并发。如果 `git status` 显示工作区有未提交改动且不属于本次任务，或当前分支与预期不符，**立刻停下问用户**，不要继续。

### 发现冲突时的报告模板

> 启动检查发现 [描述冲突，例如"工作区有未提交改动疑似上次未 commit 完"]。
> 我只能做检查，不会继续写功能。
> 请你决定：A（先处理未提交改动）/ B（让我对比 diff 并报告）。

## Quality And Risk

- Avoid speculative abstractions, optionality, and future-proofing that were not requested.
- Preserve correctness first for database, auth, permissions, and validation logic.
- Keep communication concrete, scoped, and honest about uncertainty.

## Verification

- Turn vague tasks into verifiable goals.
- For bug fixes, define how the bug is reproduced or detected.
- For behavior changes, add or update the narrowest useful test when a test pattern exists.
- Before finishing, verify with the strongest available signal available in context.
- If something was not verified, say so clearly.

## Web Defaults

- For React and Next.js work, prefer framework-native patterns over custom infrastructure.
- Respect server/client boundaries in Next.js.
- Keep components focused and avoid unnecessary prop drilling or effect-heavy state flow.
- Handle loading, empty, error, and success states cleanly.

## Skill Index

- Core behavior: `karpathy-guidelines`, `test-driven-development`
- Web and full-stack: `next-best-practices`, `vercel-react-best-practices`, `vercel-composition-patterns`
- Database and auth: `supabase-postgres-best-practices`, `better-auth-best-practices`
- Testing and tooling: `webapp-testing`, `playwright`
- Document and media workflows: `pdf`, `remotion-best-practices`
