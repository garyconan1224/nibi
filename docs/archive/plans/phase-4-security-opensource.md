---
phase: 4
title: 安全 + 开源准备（破坏性变更）
status: archived
estimate_hours: 8
model: Opus 4.7（加密改造）+ 小米（文档/扫描）
branch: feat/phase4-security
worktree: 是
depends_on: [3E]
opensource_threshold: true   # 这一阶段完成 = 开源时刻
---

> ⚠️ **已归档**：本计划已被 `docs/SPEC.md` 取代，不再参与执行。保留作历史参考。

## 范围概述

Phase 4 是开源门槛。完成它意味着项目准备好对外发布。涉及破坏性变更（API key 存储格式改变），所以是单独 phase。

## 开源门槛清单（贯穿做，不堆到最后）

下面这些事项**不能等到 Phase 4 才集中处理**，应该在 Phase 3 各子任务中顺手做。Phase 4 是最终验收。

- [ ] **API key 加密**：从明文 models.json → 加密存储（可考虑 keyring / 主密码派生）
- [ ] **敏感数据扫描**：每次 phase 收尾跑 `git grep` 扫 token/key/password
- [ ] **`.gitignore` 复核**：确保 `data/`、`.env`、`.venv`、`node_modules`、`.local/` 全部被忽略
- [x] **LICENSE 文件**（已在 3A.5 加入 MIT）
- [ ] **README 改写**：当前 README 偏内部交接，需重写成面向外部用户（功能介绍 / 安装 / 使用 / FAQ / 贡献指南）
- [ ] **依赖 license 审计**：跑 `pip-licenses` 和 `pnpm licenses list`，确保无 GPL 污染
- [ ] **`.env.example` 完整且无真 key**
- [ ] **`docs/AI_HANDOFF.md` 等内部文档处理**：决定 删/移私有/保留
- [ ] **`data/projects/*` 不进 git**：复核现有 .gitignore 覆盖
- [ ] **examples/ 目录**：放几个开箱即用的示例工作空间（非个人数据）
- [ ] **CONTRIBUTING.md**：贡献指南
- [ ] **CODE_OF_CONDUCT.md**：行为准则
- [ ] **Issue / PR 模板**：`.github/ISSUE_TEMPLATE/` `.github/PULL_REQUEST_TEMPLATE.md`
- [ ] **CI workflow**：GitHub Actions 跑 pytest + pnpm build

## TODO

**进入此阶段时再展开操作步骤。** 展开时需要先回答：
1. 加密方案选哪个：keyring（系统钥匙串）vs 主密码 PBKDF2 vs 移到 macOS Keychain only
2. 老用户迁移路径（明文 → 加密）：自动迁移 / 提示用户手动重输
3. 是否要在开源前做一次安全审计（CodeQL / Snyk / Semgrep）
