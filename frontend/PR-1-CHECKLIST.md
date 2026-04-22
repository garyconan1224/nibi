# PR-1 最终确认清单：依赖覆盖 + 国际化基础设施

## 一、依赖管理（package.json overrides）

- [x] **overrides 块添加** — `@lobehub/icons` 的 `react` 与 `react-dom` 强制指向顶层版本 `$react` / `$react-dom`
- [x] **npm install 验证** — 
  ```
  npm ls @lobehub/icons react
  # @lobehub/icons@5.5.4 overridden ✓
  # react@19.2.5 (all subtree deduped) ✓
  ```
- [x] **README.md 文档** — 新增「依赖管理说明」章节，记录决策逻辑与维护规则
  - 选择 `overrides` 而非 pnpm 迁移的理由（低成本、稳定性）
  - 每次大版本升级必须重新评估的强制流程
  - Git commit message 记录决策时间点

---

## 二、国际化基础设施

### 2.1 i18n.ts 配置
- [x] `providers` namespace 已注册
  ```ts
  import zhProviders from './zh-CN/providers.json'
  import enProviders from './en-US/providers.json'
  resources: { 'zh-CN': { ..., providers: zhProviders }, ... }
  ns: ['common', 'home', 'settings', 'providers']
  ```
- [x] namespace 数组支持 — 组件可通过 `useTranslation(['providers', 'common'])` 进行双 namespace 查询

### 2.2 i18next-parser 自动化配置
- [x] `frontend/i18next-parser.config.js` 已生成
  - 扫描范围：`src/**/*.{ts,tsx}`
  - 默认值策略：zh-CN 空字符串 / en-US key 回退
  - `keepRemoved: true` — 保留未使用 key，人工审查后决策
  - `ignoredKeys: ['form']` — 排除虚假 key 混入 common namespace
- [x] Parser 一致性验证
  ```
  npx i18next-parser --fail-on-update
  # Stats: 58 files were parsed ✓
  # No updates required ✓
  ```

### 2.3 语言包文件结构
- [x] **zh-CN 与 en-US 完全对齐**（8 个 JSON 文件 × 4 namespace）
  | Namespace | zh-CN keys | en-US keys | 状态 |
  |-----------|-----------|-----------|-----|
  | common | 8 | 8 | ✓ |
  | home | 2 | 2 | ✓ |
  | settings | 2 | 2 | ✓ |
  | providers | 32 | 32 | ✓ |

---

## 三、ProvidersManagementPage i18n 化

- [x] **硬编码提取** — 27 个硬编码中文字符串 → `t()` 调用
- [x] **Namespace 声明** — `useTranslation(['providers', 'common'])`
- [x] **插值支持** — 测试连接成功 toast: `t('test.successToast', { name })`
- [x] **TypeScript 验证** — `npx tsc -b --noEmit` 零错误

---

## 四、文件清单

### 修改文件（10）
- [x] `frontend/package.json` — overrides 块添加
- [x] `frontend/README.md` — 依赖管理说明新增
- [x] `frontend/src/locales/i18n.ts` — providers namespace 注册
- [x] `frontend/src/locales/zh-CN/common.json` — actions / status 扩展
- [x] `frontend/src/locales/en-US/common.json` — actions / status 扩展
- [x] `frontend/src/locales/zh-CN/home.json` — 保留（2 keys）
- [x] `frontend/src/locales/en-US/home.json` — 保留（2 keys）
- [x] `frontend/src/locales/zh-CN/settings.json` — 保留（2 keys）
- [x] `frontend/src/locales/en-US/settings.json` — 保留（2 keys）
- [x] `frontend/src/pages/SettingPage/ProvidersManagementPage.tsx` — i18n 化完成

### 新增文件（3）
- [x] `frontend/i18next-parser.config.js` — Parser 配置
- [x] `frontend/src/locales/zh-CN/providers.json` — 32 keys
- [x] `frontend/src/locales/en-US/providers.json` — 32 keys

---

## 五、质量保证

- [x] **编译验证** — `npm run build` 成功，gzip 320.99 KB（预期范围）
- [x] **诊断检查** — IDE 零报错（所有 6 个修改文件）
- [x] **Parser 一致性** — `--fail-on-update` 通过（无遗漏或冗余 key）
- [x] **依赖树稳定** — `@lobehub/icons` 传递 React 版本统一为 19.2.5，无分叉

---

## 六、审查反馈通道

提交前请确认以下问题：

1. **overrides 决策确认** — 是否接受使用 npm overrides 而非迁移 pnpm？
2. **Namespace 架构评价** — `common` / `home` / `settings` / `providers` 的分层是否合理？
3. **默认值策略** — 英文 fallback 到 key 本身（`form.title`）还是空字符串，需翻译人员确认？
4. **Parser 忽略规则** — `ignoredKeys: ['form']` 的例外处理是否充分？

---

## 七、合并信号灯

🟢 **可合并** — 所有检查项已通过，可直接合并到 main/develop 分支

---

## 后续任务

→ **PR-2**：HomePage i18n 化（TaskDashboard、TaskItem、NoteForm 等）预计 3-4 人日  
→ **PR-3**：Settings 其他页面 i18n 化（ModelManagementPage、TranscriberPage 等）预计 2-3 人日

