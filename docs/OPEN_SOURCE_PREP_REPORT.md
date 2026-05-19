# 开源准备 · 仓库卫生扫描报告

> 生成时间：2026-05-19
> 工具：小米 2.5 Pro 终端
> 范围：[D] 开源准备阶段前置扫描，不修任何东西
> 当前 main HEAD：9997e5e

---

## 🔴 高风险（必须开源前修）

✅ **无发现**。tracked 文件中未检出真实 API key 残留、密码字面量或邮箱泄露。

唯一命中项 `local_settings.example.py:4` 的 `sk-xxx...` 是模板占位符（文件头注释明确说明），非真实 key，无需处理。

---

## 🟡 待决策（用户拍板）

### 1. `.git` 体积 278MB — 是否做 history 清理？

`.git` 目录 278MB，对一个中小型项目偏大。可能原因：
- 历史上曾 tracked 过大文件（图片/视频/数据集）后又删除
- 多分支 worktree 累积

**建议**：开源前用 `git-filter-repo` 或 `BFG Repo-Cleaner` 清理历史大文件，否则 clone 体验差。需要用户确认是否值得做。

### 2. `docs/nibi-spec-merged.md` 死链 — 删引用还是补文件？

3 处 archive 文件仍引用 `docs/nibi-spec-merged.md`（或 `../nibi-spec-merged.md`），但该文件不存在：
- `docs/archive/plan-v1.md`
- `docs/archive/design-spec-v1.md`
- `docs/archive/spec-v3.md`
- `docs/archive/spec-v2.md`

**建议**：这 4 个文件都在 `archive/` 里且已标记 DEPRECATED，直接把死链引用删掉即可，不需补文件。

### 3. README 第 100 行 `TODO: 添加功能截图` — 补还是删？

README 里留了一个 TODO 标记。

**选项**：
- A）开源前补上功能截图（需要运行系统截图）
- B）删掉 TODO 行和「截图」section，README 里不留 TODO

### 4. README 第 7 行 API key 明文警告是否过时？

> ⚠️ **API key 当前以明文保存在 `models.json` 与 `.env` 中。开源前 Phase 4 将引入加密存储。**

当前 phase 编号体系已变（N1~N11），"Phase 4" 指向不明确。开源前需要更新或删除这行。

### 5. `.gitignore` 覆盖完整性 — 是否需要补充？

当前 `.gitignore` 工作正常：无不该 tracked 的文件被 track，无应 tracked 的文件被 ignore。

已正确 ignore 的关键项：`.env`、`.venv/`、`node_modules/`、`__pycache__/`、`data/`、`.local/`、`*.DS_Store`。

**可考虑补充**：`*.swp`（vim 临时文件）、`*.swo`。当前没有遗漏的硬性问题。

---

## 🟢 健康（已 OK 的项）

- **敏感信息**：无真实 API key / token / 密码泄露
- **邮箱泄露**：tracked 文件中无邮箱地址
- **TODO/FIXME**：代码中（排除 docs/）无 TODO/FIXME/HACK 标记
- **本机路径**：仅出现在 locale 占位文案中（`/Users/you/cookies` 作为示例），非真实路径泄露
- **README 命令可执行性**：`start.sh`、`backend/app/main.py`、`frontend/package.json`、`scripts/preflight_check.py`、`tests/e2e_qa.py` 均存在
- **端口配置**：`.env.example` 中 `BACKEND_PORT=8000`、`VITE_PORT=5173` 与 README 一致
- **.gitignore 覆盖**：无遗漏，`git ls-files` 未检出任何不该 tracked 的文件
- **Legacy 入口**：`app.py` + `pages/` 已在 phase 1J 删除（commit f6db5c2），不存在于工作区
- **大文件**：tracked 文件最大为 `frontend/pnpm-lock.yaml`（411KB），无 > 1MB 文件

---

## 📋 6 项扫描原始结果

### 1. 敏感信息泄漏扫描

```
# API key / token 模式
local_settings.example.py:4:SILICONFLOW_API_KEY = "sk-xxxx..."（模板占位，非真实 key）

# 本机绝对路径
frontend/src/locales/en-US/settings.json:96:  /Users/you/cookies（示例文案）
frontend/src/locales/zh-CN/settings.json:96:  /Users/you/cookies（示例文案）

# 邮箱
（无命中）

# TODO / FIXME / HACK
（无命中）
```

### 2. .gitignore 覆盖完整性

```
# 不该 tracked 但被 track 的文件
（无 — git ls-files 未检出 .DS_Store / .pyc / .log / .zip / .sqlite / node_modules）

# 应该 tracked 但被 ignore 的文件
（无异常）
```

已正确 ignore：`.env`、`.venv/`、`node_modules/`、`__pycache__/`、`data/`、`.local/`、`*.pytest_cache`、`frontend/dist/`

### 3. README 命令可执行性体检

```
✅ start.sh                    存在
✅ backend/app/main.py         存在
✅ frontend/package.json       存在
✅ scripts/preflight_check.py  存在
✅ tests/e2e_qa.py             存在
✅ 端口 5173/8000               .env.example 中确认
⚠️ README:100  TODO: 添加功能截图（待决策）
⚠️ README:7    "Phase 4" 引用过时
```

### 4. docs/ 内部链接死链扫描

```
❌ docs/nibi-spec-merged.md — 被 4 处 archive 文件引用，但文件不存在
   - docs/archive/plan-v1.md
   - docs/archive/design-spec-v1.md
   - docs/archive/spec-v2.md
   - docs/archive/spec-v3.md

✅ docs/SPEC.md              存在
✅ docs/EXECUTION_PLAN.md    存在
✅ docs/AI_HANDOFF.md        存在
✅ docs/COMPLETED_WORK.md    存在
✅ docs/WORKFLOW.md          存在
✅ docs/archive/README.md    存在
✅ docs/archive/plan-v1.md   存在
✅ docs/archive/migration-plan-v1.md   存在
✅ docs/archive/phase-x-main-pipeline.md 存在
✅ docs/archive/phase-2d-sqlite-evaluation.md 存在
✅ docs/archive/worktree-inventory.md  存在
```

### 5. 仓库大小 / 大文件审计

```
.git 目录：278MB

Top 10 tracked 文件（按大小）：
  411KB  frontend/pnpm-lock.yaml
   67KB  docs/design/VidMirror.html
   64KB  backend/app/services/pipeline_tasks.py
   63KB  backend/app/routes/workspaces.py
   58KB  docs/design/system_design_v1.1.md
   52KB  docs/SPEC.md
   50KB  docs/design/styles.css
   49KB  docs/design/check/settings.png
   49KB  docs/design/check/settings2.png
   44KB  docs/archive/design-spec-v1.md

无 > 1MB 的 tracked 文件。
```

### 6. 待清理 legacy 入口

```
app.py — 已删除（phase 1J, commit f6db5c2）
pages/ — 已删除（phase 1J, commit f6db5c2）

最近 git 记录：
  f6db5c2 chore(phase1j): 1J 清理 Streamlit 与老 React 组件，Phase 1 收口
  2b08881 feat(2.6): add VidMirror logo and indigo theme
  e973a2b feat(2.4): HistoryPanel live polling via st.fragment

Legacy 入口已彻底清除，无需额外处理。
```

---

## 🎯 建议下一步动作清单

按优先级排序：

1. **（高）README 更新**：删掉第 7 行过时的 "Phase 4" API key 警告（或改写为当前准确描述），处理第 100 行 TODO 截图标记
2. **（中）docs 死链清理**：删除 `docs/archive/` 中 4 个文件对 `nibi-spec-merged.md` 的引用（均为 deprecated 归档文件，影响小但开源前应干净）
3. **（中）.git 体积调查**：278MB 偏大，开源前用 `git rev-list --objects --all | git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' | sort -rnk3 | head -20` 查历史大文件来源，决定是否做 BFG 清理
4. **（低）.gitignore 补充**：可选加 `*.swp` / `*.swo`，当前无硬性遗漏
5. **（低）docs/archive/ 死链**：如有意保持 archive 原貌可跳过，仅影响内部浏览
