# Outstanding Tasks

This file tracks coordination work that should happen before the next implementation pass. It is intentionally product-facing and does not ask the next agent to start coding immediately.

## P0 - Product Selection Only

- Choose the next primary product lane:
  - project/workspace setup
  - media ingestion
  - analysis review
  - script/storyboard output
- Define the smallest user-visible success state for the chosen lane.
- Choose the MVP artifact for that lane: report, storyboard, script draft, workspace state, or another explicit output.
- Decide how visible Streamlit should remain during this phase: frozen legacy entry, hidden from user-facing docs, or scheduled for removal.

## P0 - Repository Hygiene Follow-Up

- Commit the hygiene changes as their own small commit if the user approves.
- After the commit, re-check that cookies, sqlite databases, local db files, zip archives, logs, and downloaded media do not appear in `git status`.
- Keep `data/workspaces/*.json` under review separately. They are currently outside this pass because the requested scope was cookies, local databases, and zip archives.

## P1 - After Product Selection

- Convert the selected product lane into a short implementation plan.
- Confirm the plan with the user before editing business logic.
- Then implement one narrow slice per session, with verification attached to that slice.

## Deferred Technical Debt

- Keep Streamlit work frozen unless the user explicitly asks for legacy support.
- Continue aligning docs around FastAPI + React/Vite as the mainline.
- Revisit persistence boundaries after the product lane is chosen, especially if workspace state becomes the MVP artifact.
