# Release Process

## 1) Pre-flight

1. Run QA:
   - `python3 tests/e2e_qa.py`
2. Follow secret/privacy checklist:
   - `docs/RELEASE_CHECKLIST.md`
3. Confirm no local secret files are staged:
   - `.env`
   - `.local/settings.json`
   - `*_cookies.txt`

## 2) Versioning

- Update version reference (if used) in docs/changelog.
- Use semantic versioning suggestion:
  - patch: bugfix only
  - minor: backward-compatible features
  - major: breaking changes

## 3) GitHub Release Notes (template)

### Highlights
- Bullet list of user-facing improvements

### Fixes
- Bugfix list (e.g., Bilibili downloader retry/header improvements)

### QA
- `tests/e2e_qa.py` result

### Breaking Changes
- If any, include migration instructions

## 4) Post-release checks

- Create a smoke test issue and verify:
  1. Download page
  2. Analyzer page
  3. Creator page knowledge loading
