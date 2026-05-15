# AI Handoff

Last updated: 2026-05-15

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
