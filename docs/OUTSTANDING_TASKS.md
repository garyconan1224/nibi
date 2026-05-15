# Outstanding Tasks

This file tracks coordination and product work that should happen before the next implementation pass.

## P0 - Current Mainline State

- The verified feature/collaboration baseline before this handoff sync is `bd972eb`.
- Phase 1D local file upload is merged.
- Multi-agent collision rules are merged into `CLAUDE.md` and `AGENTS.md`.
- Codex QA after merge:
  - backend workspace API tests passed: `8 passed`
  - frontend build passed
  - frontend Vitest files passed individually: `8 passed`

## P0 - Next Build Task

- Recommended next task: **Phase 1E network link input**.
- Build owner should be Claude official or Claude Xiaomi, not Codex.
- Suggested branch: `claude-official/phase1e-network-link-input`.
- Keep the session scoped to network link input only. Do not include Phase 1F pre-configuration panel work.
- Codex should review/test the completed branch before it is merged.

## P0 - Worktree Cleanup Follow-Up

- Review `docs/WORKTREE_INVENTORY.md` before deleting any old worktree.
- Do not remove dirty worktrees without first inspecting, stashing, or confirming the local changes.
- Do not mix worktree cleanup with Phase 1E feature work.

## P1 - After Phase 1E

- Run Codex QA on the Phase 1E branch:
  - relevant backend tests
  - frontend build
  - narrow UI smoke check if a dev server is available
- Merge only after the user confirms the reviewed branch.
- Then choose between Phase 1F pre-configuration panel and worktree cleanup.

## Deferred Technical Debt

- Keep Streamlit work frozen unless the user explicitly asks for legacy support.
- Continue aligning docs around FastAPI + React/Vite as the mainline.
- Revisit persistence boundaries after the product lane is chosen, especially if workspace state becomes the MVP artifact.
