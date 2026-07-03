# 开源准备检查报告

> 更新时间：2026-07-03
> 当前分支：`codex/opensource-prep`
> 范围：仓库卫生、公开说明、CI 基础配置。未做业务功能实现，不 push。

## 当前结论

项目可以进入开源准备流程，但还不能直接公开发布。

主要原因：

- 当前工作区仍包含一批未提交业务改动，涉及字幕翻译、mixed 笔记、X/Twitter 接入、Provider timeout、NoteShell UI 等，需要先拆分、验收并决定是否进入公开版。
- GitHub Actions 原先引用已删除的 `app.py`，公开后 CI 会失败；本轮已修复。
- 仓库包含大量内部协作文档、计划文档、历史截图和验收材料，公开前需要决定保留、精简或迁移到私有归档。

## 本轮已处理

1. 新建开源准备分支：`codex/opensource-prep`。
2. 修复 CI 明确错误：
   - `.github/workflows/lint.yml` 不再编译不存在的 `app.py`。
   - 三个 GitHub Actions workflow 的 Python 版本统一为 `3.11`。
3. 更新 README：
   - 补充本地优先说明。
   - 补充 API Key / Cookie / 用户素材不进仓库的公开说明。
   - 补充第三方平台条款、版权和合法使用免责声明。
   - 启动依赖改为 Python 3.11+。

## 本轮验证

已通过：

- `git diff --check`
- `rg -n "app.py" .github` 无命中
- `python3 -m py_compile backend/app/main.py`
- `cd frontend && pnpm build`

未验证：

- GitHub Actions 真实 runner 尚未运行。
- 后端全量测试尚未运行。
- 当前未提交业务改动尚未做功能验收。

## 敏感信息扫描

当前粗扫未发现明显真实密钥。

命中项：

- `local_settings.example.py` 中的 `sk-xxxxxxxx...` 是模板占位符。
- 多处代码、测试和文档包含 `api_key`、`token`、`password` 字段名或 fake key，这是实现/测试语义，不是实密钥。

开源前仍建议执行一次专门工具扫描，例如：

```bash
gitleaks detect --source . --no-git
gitleaks detect --source .
```

第二条会扫描 git 历史，风险更高也更有价值。

## 仓库体积与运行时数据

当前本地目录体积概况：

- `.git`：约 89MB
- `docs`：约 25MB
- `data`：约 2.1GB，已被 `.gitignore` 忽略
- `frontend/node_modules`：约 915MB，已被 `.gitignore` 忽略
- `.local`：约 25MB，已被 `.gitignore` 忽略

tracked 文件中有不少截图、设计稿和测试证据图片，主要集中在：

- `docs/design/`
- `docs/e2e-test/screenshots/`
- `docs/plans/r21-main-verify/`
- `docs/archive/design-uploads-2026-05-25/`

这些不是安全阻断，但会影响公开仓库的专业度和体积。建议开源前按“公开文档”和“内部过程证据”拆分。

## CI 风险

已修：

- `lint.yml` 不再引用 `app.py`。

仍待处理：

- `requirements.txt` 包含 `pyannote.audio`、`marker-pdf`、`playwright`、`faiss-cpu` 等重依赖，CI 安装可能慢或失败。
- `backend-tests.yml` 目前只跑 `pytest tests/backend -q`，而项目实际还有 `backend/tests/` 下的测试。需要决定公开 CI 跑哪一层。
- `qa-e2e.yml` 运行 `python tests/e2e_qa.py`，是否能在无本地模型、无 API Key、无浏览器素材的 GitHub runner 上稳定通过，需要单独验证。

建议下一步把 CI 拆成：

1. 最小静态检查：Python compile + frontend build。
2. 纯单元测试：不依赖真实网络、模型 Key、下载平台。
3. 手动触发 E2E：只在配置了 secrets 或本地执行时运行。

## 文档公开策略

建议公开保留：

- `README.md`
- `LICENSE`
- `.env.example`
- `frontend/.env.example`
- `docs/rules/` 中对外开发有用的工程规则
- 必要的架构/接口说明

建议公开前精简或迁移：

- `CLAUDE.md`
- `AGENTS.md`
- `GEMINI.md`（当前已 gitignore，但本地存在）
- `docs/AI_HANDOFF.md`
- `docs/COMPLETED_WORK.md`
- `docs/EXECUTION_PLAN.md`
- 大量 `docs/plans/`
- 大量历史截图和验收报告

这些文档不是一定不能公开，但它们包含内部协作流程、代理分工、历史施工记录，会降低公开仓库的可读性。

## 当前阻断清单

1. 未提交业务改动必须先拆分验收。
2. X/Twitter 接入依赖非正式接口，且存在真实网络 integration 测试，建议不要作为第一版公开核心能力。
3. CI 还未在当前分支实际跑通。
4. 公开文档需要精简，避免把内部 handoff / 计划流直接暴露成主文档。
5. 需要做 git 历史敏感信息扫描；如发现历史大文件或密钥，需在明确备份后再做历史清理。

## 建议执行顺序

1. 先整理当前未提交业务改动：拆 commit 或排除出公开版。
2. 跑最小验证：`python -m py_compile backend/app/main.py`、后端纯单测、前端 build。
3. 调整 CI 依赖范围，避免公开后 Actions 因重依赖或真实网络失败。
4. 精简公开文档目录。
5. 执行敏感信息和历史扫描。
6. 先 push 到 GitHub 私有仓库，等 Actions 绿后再改公开。
