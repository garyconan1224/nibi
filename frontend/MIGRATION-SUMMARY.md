# 国际化与依赖管理迁移总结

## 执行日期

2026-04-22

## PR-1 完成状态 ✅

### 1. 依赖管理方案实施
- **方案**：npm `overrides` 强制统一 `@lobehub/icons` 的传递依赖（React 19.2.5）
- **优势**：零迁移成本、构建流程无变化、与当前 npm 锁文件兼容
- **维护规则**：@lobehub/icons 大版本升级时必须重新评估

**验证结果**：
```bash
$ npm ls @lobehub/icons react
├─ @lobehub/icons@5.5.4 overridden ✓
└─ All subtree react → 19.2.5 deduped ✓

$ npm run build  → ✓ 成功（gzip: 320.99 KB）
```

### 2. 国际化基础设施建设
- **Parser 配置**：`i18next-parser.config.js` 自动扫描 58 个源文件
- **Namespace 架构**：4 个 namespace (`common` / `home` / `settings` / `providers`)
- **语言支持**：zh-CN + en-US（完全对齐）
- **默认值策略**：zh-CN 空字符串（提醒填充）/ en-US key 本身（临时 fallback）

**验证结果**：
```bash
$ npx i18next-parser --fail-on-update
# Stats: 58 files were parsed, no updates required ✓

$ npm run build && npx tsc -b --noEmit
# ✓ 编译成功，零 TypeScript 错误
```

### 3. ProvidersManagementPage 完全国际化
- **硬编码提取**：27 个中文字符串 → 32 个 JSON key
- **Namespace 支持**：双 namespace 查询（providers + common）
- **插值功能**：支持动态变量（如 `Provider "{{name}}" created`）

### 4. 文件交付物（13 个）
| 类型 | 数量 | 文件 |
|------|------|------|
| 修改 | 10 | package.json, README.md, i18n.ts, common.json×2, home.json×2, settings.json×2, ProvidersManagementPage.tsx |
| 新增 | 3 | i18next-parser.config.js, providers.json×2 |

---

## PR-2 规划 📋

### 范围：HomePage 模块全量国际化
- TaskDashboard：~10 keys（任务中心面板）
- TaskItem + TaskLogViewer：~9 keys（日志与任务状态）
- NoteForm：~20+ keys（表单验证、placeholder 等）
- MarkdownViewer + 辅助组件：~8 keys（导出、预览等）

**预留 namespace**：`homePage.json`（分层结构）
```
{
  "dashboard": { ... },  // 任务中心
  "task": { ... },       // 任务卡片
  "logs": { ... },       // 日志相关
  "form": { ... },       // 表单输入
  "export": { ... },     // 导出功能
  "mindmap": { ... }     // 思维导图
}
```

**预估工作量**：3-4 人日  
**后续**：PR-3 Settings 其他页面（2-3 人日）

---

## 关键决策记录

| 决策 | 理由 | 备选项 |
|------|------|--------|
| npm overrides | 低成本、快速验证 | pnpm 迁移（长期优化） |
| 双语对齐检查 | 防止漏翻 | 仅中文先行（风险高） |
| Parser `keepRemoved: true` | 人工审查后决策 | `keepRemoved: false`（自动清理） |
| Namespace 分层 | 便于模块化维护 | 全局平坦结构（简化但可扩展性差） |

---

## 后续建议

1. **PR 提交顺序**：PR-1 → 审查通过后启动 PR-2 → PR-3
2. **自动化增强**：CI 集成 `npx i18next-parser --fail-on-update` 防止遗漏 key
3. **翻译工作流**：英文 fallback 到 key 本身，提醒翻译人员逐个补齐
4. **长期规划**：评估 pnpm 单一包管理器迁移时机（6-12 个月后）

---

## 参考文档

- `PR-1-CHECKLIST.md` — 合并前最终确认清单
- `PR-2-PLANNING.md` — HomePage i18n 化详细规划
- `frontend/README.md` — 依赖管理说明
- `frontend/i18next-parser.config.js` — Parser 配置说明

