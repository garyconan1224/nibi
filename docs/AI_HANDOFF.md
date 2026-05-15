# AI Handoff

Last updated: 2026-05-15

## Current Scope

This handoff is for repository hygiene and AI collaboration setup only. It intentionally does not introduce business functionality.

Primary workspace: `/Users/conan/Desktop/nibi`

Active product line: **FastAPI backend + React/Vite frontend**. Streamlit remains a legacy compatibility path only.

## Completed In This Pass

- Removed tracked runtime artifacts from the git index with `git rm --cached` only:
  - `data/cookies/www.bilibili.com_cookies.txt`
  - `vidmirror.zip`
- Confirmed `data/nibi.db` is not currently tracked and was not present in the workspace during this pass.
- Updated `.gitignore` so future cookies, local databases, sqlite files, and zip archives stay out of git.
- Added the collaboration foundation files:
  - `AGENTS.md`
  - `docs/AI_HANDOFF.md`
  - `docs/OUTSTANDING_TASKS.md`
- Updated `README.md` and `CLAUDE.md` to make the active line explicit: FastAPI + React/Vite first, Streamlit legacy.

## Do Next

Next session must enter **product selection only**. Do not write feature code in the same step.

Recommended product-selection questions:

1. Which user journey is the next primary product lane: project/workspace setup, media ingestion, analysis review, or script/storyboard output?
2. What is the smallest user-visible success state for that lane?
3. Which artifact should be considered the MVP output: analysis report, storyboard, script draft, or workspace state?
4. What should happen to Streamlit during this phase: keep frozen, hide from docs, or schedule removal?

## Guardrails For The Next Agent

- Do not implement product features before the user chooses the product direction.
- Do not commit runtime data, local cookies, sqlite databases, zip files, logs, `.env`, or downloaded media.
- Do not delete local real files when cleaning git history unless the user explicitly asks for deletion.
- If another cleanup pass is requested, prefer `git rm --cached` for tracked local artifacts.
