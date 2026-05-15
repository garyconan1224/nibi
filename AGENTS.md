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

- At the start of a new coding session, read `docs/AI_HANDOFF.md` and `docs/OUTSTANDING_TASKS.md` before choosing work.
- The immediate next step after this hygiene pass is **product selection only**. Do not begin feature implementation until the user chooses the product direction.
- Keep each turn scoped to one clear task. If a request starts to expand into product design plus implementation, separate the decision step from the coding step.

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
