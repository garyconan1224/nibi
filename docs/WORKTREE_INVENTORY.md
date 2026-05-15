# Worktree Inventory

Last updated: 2026-05-15

This is a non-destructive inventory only. Do not delete, prune, or rewrite any worktree from this document without explicit user approval.

Primary workspace at inventory time:

- `/Users/conan/Desktop/nibi` -> `bd972eb`, branch `codex/qa-handoff-worktree-sync`, clean. This was the inventory baseline before the handoff-sync documentation commit was merged.

## Likely Safe Cleanup Candidates

These worktrees are clean and their current HEAD is already contained in `main`.

| Worktree | Ref | HEAD | Notes |
| --- | --- | --- | --- |
| `/Users/conan/.codex/worktrees/085f/nibi` | detached | `1dfee53` | merged into main |
| `/Users/conan/.codex/worktrees/4f4e/nibi` | detached | `6511d0c` | merged into main |
| `/Users/conan/.codex/worktrees/54da/nibi` | detached | `1dfee53` | merged into main |
| `/Users/conan/.codex/worktrees/7bda/nibi` | `codex/phase1d-workspace-upload` | `79a1356` | merged via `0e6bf53`; clean |
| `/Users/conan/.codex/worktrees/9d24/nibi` | detached | `1dfee53` | merged into main |
| `/Users/conan/.codex/worktrees/a9cb/nibi` | detached | `f2bce91` | old origin/main snapshot |
| `/Users/conan/.codex/worktrees/c888/nibi` | detached | `f2bce91` | old origin/main snapshot |
| `/Users/conan/.codex/worktrees/publish-vidmirror` | `codex/publish-vidmirror` | `f2bce91` | old publish branch; clean |
| `/Users/conan/Desktop/nibi/.claude/worktrees/adoring-ptolemy-593372` | `claude/adoring-ptolemy-593372` | `f2bce91` | old origin/main snapshot |
| `/Users/conan/Desktop/nibi/.claude/worktrees/naughty-moore-47c4f5` | `claude/naughty-moore-47c4f5` | `1dfee53` | merged into main |
| `/Users/conan/Desktop/nibi/.claude/worktrees/nervous-cohen-ad1dbd` | `claude/nervous-cohen-ad1dbd` | `1dfee53` | merged into main |
| `/Users/conan/Desktop/nibi/.claude/worktrees/sweet-antonelli-81b970` | `claude/sweet-antonelli-81b970` | `adaae08` | merged into main |
| `/Users/conan/Desktop/nibi/.claude/worktrees/sweet-swirles-bd44f5` | `claude/sweet-swirles-bd44f5` | `590a344` | merged into main |
| `/Users/conan/Desktop/nibi/.claude/worktrees/upbeat-bohr-11329b` | `claude/upbeat-bohr-11329b` | `a891eb1` | merged via `bd972eb`; clean |
| `/Users/conan/Desktop/nibi/.claude/worktrees/vigorous-albattani-e0ac01` | `claude/vigorous-albattani-e0ac01` | `f2bce91` | old origin/main snapshot |
| `/Users/conan/Desktop/nibi/.claude/worktrees/wizardly-jackson-40b2fd` | `claude/wizardly-jackson-40b2fd` | `f2bce91` | old origin/main snapshot |
| `/Users/conan/Desktop/nibi/.claude/worktrees/youthful-herschel-a374da` | `claude/youthful-herschel-a374da` | `a32dd24` | merged into main |

## Needs Review Before Cleanup

These worktrees or branches are unmerged, dirty, or both. Do not remove them without a separate decision.

| Worktree | Ref | HEAD | State | Why review first |
| --- | --- | --- | --- | --- |
| `/Users/conan/.codex/worktrees/989d/nibi` | `codex/python-venv-standardization` | `3e138da` | clean, unmerged | branch is 3 commits ahead and 10 behind main |
| `/Users/conan/.codex/worktrees/9a89/nibi` | detached | `355bb31` | clean, unmerged | detached unmerged commit needs inspection |
| `/Users/conan/.codex/worktrees/ca0d/nibi` | detached | `91a301d` | dirty, unmerged | modified `backend/app/routes/workspaces.py`; untracked `tests/` |
| `/Users/conan/.codex/worktrees/da1e/nibi` | `codex/ai-collaboration-foundation` | `6f6df30` | clean, unmerged | older collaboration docs branch, 1 ahead and 50 behind main |
| `/Users/conan/Desktop/nibi/.claude/worktrees/dazzling-poitras-1c2594` | `claude/dazzling-poitras-1c2594` | `6d66f1b` | dirty, unmerged | untracked `package-lock.json`; branch 9 ahead and 50 behind main |
| `/Users/conan/Desktop/nibi/.claude/worktrees/nifty-wozniak-485687` | `claude/nifty-wozniak-485687` | `f8410df` | dirty, unmerged | modified `data/nibi.db`; untracked `frontend/pnpm-lock.yaml`; branch 19 ahead and 50 behind main |

Unmerged local branches without an active worktree also exist:

- `feat/settings-phase2-m0`
- `refactor/phase-d-polish`

## Recommended Cleanup Process

1. Start from `/Users/conan/Desktop/nibi`.
2. Re-run `git worktree list` and `git status --short --branch`.
3. For each likely safe cleanup candidate, confirm no local dirty state remains.
4. Remove only one approved worktree at a time with `git worktree remove <path>`.
5. Delete the corresponding branch only after confirming the worktree removal and branch status.
6. For dirty or unmerged worktrees, inspect or stash changes before any removal.
