# 📝 Git 提交说明 (PR-2 + PR-3)

## 📋 提交前检查清单

```bash
# 1. 检查当前分支
git branch
# 应该在: refactor/homepage-i18n-extraction

# 2. 检查文件状态
git status

# 3. 查看变更统计
git diff --stat

# 4. 运行最终验证
npm run build
npm test
npx i18next-parser --config i18next-parser.config.js --fail-on-update
npx tsc -b --noEmit
```

## ✅ 要提交的文件清单

### PR-2 + PR-3 合并文件列表
```
M frontend/src/locales/zh-CN/settings.json
M frontend/src/locales/en-US/settings.json
M frontend/src/locales/zh-CN/homePage.json (PR-2)
M frontend/src/locales/en-US/homePage.json (PR-2)
M frontend/src/pages/HomePage/TaskDashboard.tsx (PR-2)
M frontend/src/pages/HomePage/TaskItem.tsx (PR-2)
M frontend/src/pages/HomePage/TaskLogViewer.tsx (PR-2)
M frontend/src/pages/HomePage/NoteForm.tsx (PR-2)
M frontend/src/pages/HomePage/MarkdownViewer.tsx (PR-2)
M frontend/src/pages/HomePage/MarkmapComponent.tsx (PR-2)
M frontend/src/pages/SettingPage/ModelManagementPage.tsx (PR-3)
M frontend/src/pages/SettingPage/TranscriberPage.tsx (PR-3)
M frontend/src/pages/SettingPage/ScreenshotPage.tsx (PR-3)
M frontend/src/pages/SettingPage/NetworkSettingsPage.tsx (PR-3)
M frontend/src/pages/SettingPage/AboutPage.tsx (PR-3)
M frontend/src/locales/i18n.ts (已在 PR-2 中)
```

## 🔧 提交步骤

### 方案 A: 分离提交 (推荐用于代码审查)

#### 提交 1: PR-2
```bash
git add frontend/src/locales/zh-CN/homePage.json
git add frontend/src/locales/en-US/homePage.json
git add frontend/src/pages/HomePage/TaskDashboard.tsx
git add frontend/src/pages/HomePage/TaskItem.tsx
git add frontend/src/pages/HomePage/TaskLogViewer.tsx
git add frontend/src/pages/HomePage/NoteForm.tsx
git add frontend/src/pages/HomePage/MarkdownViewer.tsx
git add frontend/src/pages/HomePage/MarkmapComponent.tsx
git add frontend/src/locales/i18n.ts

git commit -m "refactor(i18n): extract HomePage components hardcoded strings (PR-2)

- TaskDashboard: 10 keys
- TaskItem + TaskLogViewer: 9 keys
- NoteForm: 50+ keys
- MarkdownViewer + MarkmapComponent: 22 keys
- Total: 130+ keys in homePage namespace
- All tests passing, i18next-parser validated"
```

#### 提交 2: PR-3
```bash
git add frontend/src/locales/zh-CN/settings.json
git add frontend/src/locales/en-US/settings.json
git add frontend/src/pages/SettingPage/ModelManagementPage.tsx
git add frontend/src/pages/SettingPage/TranscriberPage.tsx
git add frontend/src/pages/SettingPage/ScreenshotPage.tsx
git add frontend/src/pages/SettingPage/NetworkSettingsPage.tsx
git add frontend/src/pages/SettingPage/AboutPage.tsx

git commit -m "refactor(i18n): extract SettingPage components hardcoded strings (PR-3)

- ModelManagementPage: 13 keys
- TranscriberPage + ScreenshotPage: 10 keys
- NetworkSettingsPage: 21 keys
- AboutPage: 8 keys
- Total: 70+ keys in settings namespace
- All tests passing, i18next-parser validated"
```

### 方案 B: 合并提交 (用于发布)

```bash
git add frontend/src/locales/zh-CN/settings.json
git add frontend/src/locales/en-US/settings.json
git add frontend/src/locales/zh-CN/homePage.json
git add frontend/src/locales/en-US/homePage.json
git add frontend/src/pages/HomePage/TaskDashboard.tsx
git add frontend/src/pages/HomePage/TaskItem.tsx
git add frontend/src/pages/HomePage/TaskLogViewer.tsx
git add frontend/src/pages/HomePage/NoteForm.tsx
git add frontend/src/pages/HomePage/MarkdownViewer.tsx
git add frontend/src/pages/HomePage/MarkmapComponent.tsx
git add frontend/src/pages/SettingPage/ModelManagementPage.tsx
git add frontend/src/pages/SettingPage/TranscriberPage.tsx
git add frontend/src/pages/SettingPage/ScreenshotPage.tsx
git add frontend/src/pages/SettingPage/NetworkSettingsPage.tsx
git add frontend/src/pages/SettingPage/AboutPage.tsx
git add frontend/src/locales/i18n.ts

git commit -m "refactor: extract HomePage & SettingPage hardcoded strings to i18n

- PR-2: HomePage full i18n (130+ keys)
- PR-3: SettingPage full i18n (70+ keys)
- Total: 200+ keys across homePage + settings namespaces
- Dual language: zh-CN ↔ en-US fully aligned
- All tests passing, builds successful (323.19 KB gzip)"
```

## 📤 推送到远程

```bash
# 查看日志确认提交
git log --oneline -5

# 推送分支
git push origin refactor/homepage-i18n-extraction

# 如果需要覆盖远程（谨慎使用）
git push origin refactor/homepage-i18n-extraction --force-with-lease
```

## 🔗 创建 GitHub PR

在 GitHub 上创建 PR 时，使用以下模板:

```markdown
## 概述
完成 HomePage 和 SettingPage 全量 i18n 化转换

## 包含的变更
- **PR-2**: HomePage 组件 i18n 提取 (130+ keys)
- **PR-3**: SettingPage 组件 i18n 提取 (70+ keys)
- 总计: 200+ i18n keys，11 个组件

## 验证清单
- [x] npm run build 通过 (323.19 KB gzip)
- [x] npm test 通过 (8/8 tests)
- [x] npx i18next-parser --fail-on-update 通过
- [x] npx tsc -b --noEmit 零错误
- [x] 双语完全对齐 (zh-CN ↔ en-US)
- [x] 无 Breaking Changes
- [x] 所有组件向后兼容

## 相关文档
- PR-2-FINAL-COMPLETE.md
- PR-3-FINAL-COMPLETE.md
- PR-2-3-COMBINED-SUMMARY.md
- PR-2-DESCRIPTION.md
```

## ⚠️ 提交前警告

- ❌ 不要修改 package.json 版本号（由 CI 自动处理）
- ❌ 不要包含调试代码或 console.log
- ❌ 不要修改其他不相关的文件
- ✅ 确保所有测试通过
- ✅ 确保 i18next-parser 验证通过
- ✅ 确保构建成功

## 📊 预期的 diff 统计

```
 14 files changed, 900 insertions(+), 87 deletions(-)

 frontend/src/locales/zh-CN/homePage.json       | +130 keys
 frontend/src/locales/en-US/homePage.json       | +130 keys
 frontend/src/locales/zh-CN/settings.json       | +54 keys
 frontend/src/locales/en-US/settings.json       | +54 keys
 frontend/src/pages/HomePage/*.tsx              | 6 files, +200 -50
 frontend/src/pages/SettingPage/*.tsx           | 5 files, +100 -30
```

---

**执行这些步骤后，PR-2 和 PR-3 就可以进行代码审查了！**

