# PR-2 国际化重构规划：HomePage 模块

## 概述

**范围**：`frontend/src/pages/HomePage/` 及其子组件的全量 i18n 化  
**基线**：以 PR-1 完成的 `providers.json` + `common.json` 扩展架构为参考  
**交付物**：新增 `frontend/src/locales/{zh-CN,en-US}/homePage.json` namespace  
**预估工作量**：3-4 人日

---

## 硬编码文本清单与分类

### 1. TaskDashboard.tsx（~10 keys）
```
"任务中心"         → dashboard.title
"轮询中"          → dashboard.polling
"刷新任务列表"     → dashboard.refresh  (title/aria-label)
"全部项目"        → dashboard.allProjects
"搜索任务 ID / 类型 / 状态…"  → dashboard.searchPlaceholder
"没有匹配的任务"   → dashboard.empty.noMatch
"暂无任务记录"     → dashboard.empty.noTasks
"共 X 条任务"      → dashboard.stats.total
"，过滤后 X 条"    → dashboard.stats.filtered
"切换项目"        → dashboard.projectSwitch (title)
```

### 2. TaskItem.tsx（~5 keys）
```
"取消任务"        → task.cancel (aria-label, title)
"收起日志"        → task.logs.collapse (aria-label)
"展开日志"        → task.logs.expand (aria-label)
"暂无日志"        → task.logs.empty
```

### 3. TaskLogViewer.tsx（~4 keys）
```
"等待日志..."      → logs.waiting
"未连接"          → logs.disconnected
"SSE 连接已断开，日志停止更新"  → logs.sseDisconnected
```

### 4. NoteForm.tsx（~20+ keys）— 最复杂
```
# 验证错误消息（Zod schema）
"请选择文本模型提供商"    → form.validation.textProviderRequired
"请选择文本模型"         → form.validation.textModelRequired
"请选择视频模型提供商"    → form.validation.videoProviderRequired
"请选择视频模型"         → form.validation.videoModelRequired
"至少选择一种格式"       → form.validation.formatRequired
"至少选择一个执行步骤"    → form.validation.stepsRequired

# 提交错误 & UI 文本
"当前模型不可用，请在「设置 → 提供商管理」中检查模型配置后重试"  → form.errors.modelUnavailable
"提交失败，请重试"                                              → form.errors.submitFailed
"拖拽视频 / 音频到此处，或"  → form.upload.drag
"点击选择"                  → form.upload.clickSelect

# 下拉菜单 Placeholder & 空态
"选择提供商"      → form.placeholders.selectProvider
"暂无提供商"      → form.empty.noProviders
"加载中..."       → form.loading  (can reuse common.status.loading)
"选择模型"        → form.placeholders.selectModel
"暂无模型"        → form.empty.noModels
"选择下载策略"    → form.placeholders.selectDownloadMode
```

### 5. MarkdownViewer.tsx（~5 keys）
```
"导出笔记"        → export.button
"复制"           → export.copy
"下载"           → export.download
"刷新预览"        → preview.refresh
"加载失败"        → preview.loadFailed
```

### 6. MarkmapComponent.tsx（~3 keys）
```
"保存思维导图"     → mindmap.save
"导出 HTML"       → mindmap.exportHtml
"放大缩小"        → mindmap.zoom  (if labeled)
```

---

## namespace 架构方案

### 推荐方案：分层结构（与 providers.json 保持一致）

```json
{
  "dashboard": {
    "title": "任务中心",
    "polling": "轮询中",
    "refresh": "刷新任务列表",
    "allProjects": "全部项目",
    "searchPlaceholder": "搜索任务 ID / 类型 / 状态…",
    "empty": {
      "noMatch": "没有匹配的任务",
      "noTasks": "暂无任务记录"
    },
    "stats": {
      "total": "共 {{count}} 条任务",
      "filtered": "，过滤后 {{count}} 条"
    },
    "projectSwitch": "切换项目"
  },
  "task": {
    "cancel": "取消任务",
    "logs": {
      "expand": "展开日志",
      "collapse": "收起日志",
      "empty": "暂无日志"
    }
  },
  "logs": {
    "waiting": "等待日志...",
    "disconnected": "未连接",
    "sseDisconnected": "SSE 连接已断开，日志停止更新"
  },
  "form": {
    "validation": { ... },
    "placeholders": { ... },
    "empty": { ... },
    "upload": { ... }
  },
  "export": { ... },
  "mindmap": { ... }
}
```

---

## 共享 key 协议

- **跨 namespace 复用**：`actions.*`（取消、保存等）、`status.*`（加载、失败等）来自 `common.json`
- **引用方式**：`t('common:actions.cancel')`（声明式）或在 `useTranslation` hook 中声明 namespace 数组
- **避免重复**：已在 `common.json` 定义的词汇（save, cancel, loading 等）不在 homePage.json 中冗余

---

## 验收标准

✅ `frontend/src/locales/{zh-CN,en-US}/homePage.json` 已生成，key 完全对齐  
✅ HomePage 所有子组件的 `useTranslation` hook 已更新为 `useTranslation(['homePage', 'common'])`  
✅ 所有硬编码字符串已转换为 `t()` 调用，支持插值（如 `{{count}}`、`{{name}}`）  
✅ `npm run build` 编译成功，零 TypeScript 错误  
✅ `npx i18next-parser --fail-on-update` 一致性验证通过  
✅ 相关单元测试运行通过（NoteForm.test.tsx、usePipelineTasks.test.ts）

---

## 后续建议

- **PR-3 预留**：Settings 其他页面（ModelManagementPage、TranscriberPage 等）i18n 化，预估 2-3 人日
- **全局 key 评估**：后续可考虑将高频 common.* key 升级为全局 i18next 插件，简化跨 namespace 调用
- **自动化增强**：`i18next-parser` 可添加 `--no-restore` flag 防止意外恢复已删除的 key

