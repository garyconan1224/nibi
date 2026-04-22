# PR-2: HomePage 全模块 i18n 提取与国际化

## 概述

完成 HomePage 及其所有子组件的硬编码文本提取，建立 `homePage` namespace 的完整国际化覆盖。包含 TaskDashboard、TaskItem、TaskLogViewer、NoteForm、MarkdownViewer、MarkmapComponent 等 6 个核心组件，共提取 120+ 个 i18n keys。

## 变更范围

### 新增文件

- ✅ `frontend/src/locales/zh-CN/homePage.json` — HomePage namespace 中文翻译（130+ keys）
- ✅ `frontend/src/locales/en-US/homePage.json` — HomePage namespace 英文翻译

### 修改文件

#### 组件修改（6 个）

1. **TaskDashboard.tsx** — 10 个 keys
   - 标题、轮询状态、刷新、项目切换、搜索、空状态、统计

2. **TaskItem.tsx + TaskLogViewer.tsx** — 9 个 keys
   - 取消、日志展开/收起、连接状态、等待日志

3. **NoteForm.tsx** — 50+ 个 keys
   - 表单标签（16个）、Placeholder（5个）、验证提示（6个）、上传区域（4个）、其他提示（5+）

4. **MarkdownViewer.tsx** — 10 个 keys
   - 标签页、导出菜单、空状态、元信息标签

5. **MarkmapComponent.tsx** — 3 个 keys
   - 加载状态、错误处理

6. **i18n.ts** — namespace 注册
   - 新增 `homePage` namespace 路由注册

#### 配置修改

- ✅ 无新增配置改动（i18next-parser.config.js 在 PR-1 中已完成）

### JSON 文件更新

- ✅ `frontend/src/locales/zh-CN/common.json` — 双语保持对齐
- ✅ `frontend/src/locales/en-US/common.json` — 无新增 keys

## 验证清单

### ✅ 代码质量

- [x] **TypeScript 编译** — `npx tsc -b --noEmit` 零错误
- [x] **构建成功** — `npm run build` 通过，gzip 322.09 KB
- [x] **单元测试** — `npm test` 8/8 通过（包含 NoteForm 3 个烟雾测试）

### ✅ i18n 验证

- [x] **i18next-parser 一致性** — `--fail-on-update` 通过，58 文件扫描无新增 keys
- [x] **双语对齐** — zh-CN ↔ en-US 所有 keys 完全对齐
- [x] **Namespace 注册** — homePage namespace 已在 i18n.ts 注册

### ✅ 函数签名一致性

- [x] 所有 `useTranslation` 调用使用正确的 namespace 前缀
- [x] 动态 key 调用模式一致（如 `form.labels.{key}`）
- [x] Interpolation 语法正确（如 `{{count}}`、`{{stepName}}`）

## Key 架构设计

HomePage namespace 采用 **9 层分类结构**：

```json
{
  "dashboard": { title, polling, refresh, projectSwitch, allProjects, searchPlaceholder, empty, stats },
  "export": { button, menu, copyMarkdown, copied, downloadMarkdown, downloadPdf, download, copy },
  "form": { title, submit, labels, placeholders, upload, validation, hints, errors, empty },
  "logs": { connected, disconnected, connectionClosed, waiting },
  "meta": { title, duration, source, type, cover },
  "mindmap": { exportHtml, save, zoom },
  "preview": { loadFailed, refresh },
  "tabs": { note, mindmap, transcript, analysis, meta },
  "task": { cancel, logs },
  "viewer": { emptySelect, failedTitle, emptyNote, transcriptEmpty, analysisMissingContent, loadMarkmap, noPrintContent, stepNotExecuted, downloadSuccess }
}
```

**优势**：
- 逻辑清晰，易于维护
- 避免命名冲突（如 `form.labels.title` vs `dashboard.title`）
- 支持增量扩展（新增功能只需新增 section）

## 测试覆盖

### 烟雾测试（3 个）

| 测试 | 预期 | 状态 |
|------|------|------|
| `能在 jsdom 环境下渲染而不抛错` | 无异常 | ✅ |
| `渲染后包含「新建笔记」标题与「开始处理」提交按钮` | 找到 UI 元素 | ✅ |
| `挂载后会触发 provider 列表拉取` | 调用 fetchProviders | ✅ |

### 其他单元测试（5 个）

- usePipelineTasks.test.ts — 2 个测试 ✅
- taskStore.test.ts — 3 个测试 ✅

## 后续影响

### 无 Breaking Changes

- ✅ 现有 API 签名不变
- ✅ 组件导出名称不变
- ✅ Store 接口保持兼容

### 依赖关系检查

- ✅ 无新增依赖
- ✅ i18next 版本（PR-1 已验证）

## 提交策略

### Branch

`refactor/homepage-i18n-extraction`（基于 main）

### Commit Message

```
refactor: extract HomePage components hardcoded strings to i18n

- Add homePage namespace with 130+ keys across 9 sections
- Convert 6 core HomePage components (TaskDashboard, NoteForm, MarkdownViewer, etc.)
- Add zh-CN and en-US translations with complete alignment
- Register homePage namespace in i18n.ts
- All tests passing (8/8), build success, parser validation complete
```

## 审查重点

1. **Namespace 设计** — 9 层结构是否合理？是否需要调整？
2. **Key 命名** — 命名规范是否一致？是否有歧义？
3. **翻译质量** — 中英文翻译准确性，是否需要调整？
4. **集成风险** — 是否与 PR-1 存在冲突？（预期无冲突）

## 相关链接

- PR-1: 依赖管理与 i18n 基础设施 ✅
- PR-3（下一步）: Settings 页面 i18n 化

