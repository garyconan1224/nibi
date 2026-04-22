# PR-2 代码审查指南

## 快速开始

### 👀 查看变更概览

```bash
# 切换到 PR-2 分支
git checkout refactor/homepage-i18n-extraction

# 查看与 main 分支的差异统计
git diff main...HEAD --stat

# 查看详细的代码变更
git diff main...HEAD
```

### 🔍 审查特定文件

```bash
# 查看新增的 homePage.json 文件
git show HEAD:frontend/src/locales/zh-CN/homePage.json
git show HEAD:frontend/src/locales/en-US/homePage.json

# 查看组件的 i18n 转换
git diff main...HEAD frontend/src/pages/HomePage/NoteForm.tsx
git diff main...HEAD frontend/src/pages/HomePage/TaskDashboard.tsx
```

## 📋 审查清单

### Phase 1: 架构与设计 (15 min)

**文件**: PR-2-DESCRIPTION.md

- [ ] Namespace 架构 — 9 层结构是否合理？
- [ ] Key 命名规范 — 是否一致且易于理解？
- [ ] 与 PR-1 集成 — 是否兼容现有 i18n 基础设施？
- [ ] 扩展性 — 是否支持后续 PR-3 的 Settings i18n？

### Phase 2: 代码质量 (20 min)

**文件**: 各组件 `.tsx` 文件

- [ ] useTranslation 正确使用 — namespace 前缀正确？
- [ ] Key 调用模式 — 是否一致（动态 key vs 字符串 key）？
- [ ] 组件导出 — 导出名称是否保持不变？
- [ ] 函数签名 — 是否引入了新的 breaking changes？

#### 关键代码模式检查

**正确的用法**:
```tsx
const { t } = useTranslation('homePage')
<span>{t('form.title')}</span>  // ✅ 推荐
```

**需要避免**:
```tsx
const { t } = useTranslation('home')  // ❌ 错误的 namespace
<span>{t('homePage:form.title')}</span>  // ⚠️ 冗余前缀
```

### Phase 3: 翻译质量 (25 min)

**文件**: 
- `frontend/src/locales/zh-CN/homePage.json`
- `frontend/src/locales/en-US/homePage.json`

#### 中文翻译检查

- [ ] 术语准确性（如「下载策略」vs「下载方式」）
- [ ] 文字简洁性 — 避免冗长表述
- [ ] 一致性 — 同一概念的多个出现是否用相同术语
- [ ] UI 适配性 — 翻译长度是否适合 UI 空间

#### 英文翻译检查

- [ ] 语法正确性 — 是否有语病？
- [ ] 大小写规范 — 是否遵循 UI 文本规范？
- [ ] 术语一致性 — 专业术语是否准确？
- [ ] 自然性 — 表述是否自然流畅？

#### 双语对齐检查

```bash
# 比对两个文件的 key 结构是否完全一致
diff -u <(jq -S 'keys' frontend/src/locales/zh-CN/homePage.json) \
        <(jq -S 'keys' frontend/src/locales/en-US/homePage.json)

# 结果应为空（完全一致）
```

### Phase 4: 测试验证 (15 min)

**文件**: PR-2-VERIFICATION-REPORT.md

- [ ] 单元测试 — 8/8 通过？
- [ ] 构建成功 — gzip 大小在预期范围（320-330 KB）？
- [ ] i18n 验证 — i18next-parser 零新增 keys？
- [ ] 无回归 — 是否影响现有功能？

运行完整验证:
```bash
npm run build
npm test
npx i18next-parser --config i18next-parser.config.js --fail-on-update
```

### Phase 5: 集成兼容性 (10 min)

- [ ] 与 PR-1 的兼容性 — namespace 注册是否正确？
- [ ] 向后兼容 — 现有使用 common namespace 的代码是否仍可用？
- [ ] 依赖关系 — 是否引入新的依赖冲突？

## 🎯 重点关注区域

### 高优先级审查

1. **NoteForm.tsx** (最复杂的组件)
   - 50+ keys 的提取是否完整？
   - 动态 key 调用是否正确（如 label: 'homePage:form.labels.{fieldName}'）？
   - 验证消息的 i18n 化是否处理得当？

2. **homePage.json 结构** (架构决策)
   - 9 层设计是否过度设计或不足设计？
   - 是否存在逻辑冲突（如重复命名）？

3. **i18n.ts namespace 注册** (集成点)
   - homePage namespace 是否正确注册？
   - 是否与现有 namespace 产生冲突？

### 中等优先级审查

- 其他 5 个组件的转换完整性
- 英文翻译的自然性和准确性
- 测试覆盖的完整性

## 📊 数据检查

### Key 统计

```bash
# 获取 homePage 的 key 总数
jq -r 'to_entries[] | "\(.key): \(.value | if type=="object" then (. | to_entries | length) else 1 end)"' \
  frontend/src/locales/zh-CN/homePage.json | awk -F: '{sum+=$2} END {print "Total keys: " sum}'
```

**预期**: 130+ keys

### 文件对比

```bash
# 确保 zh-CN 和 en-US 的结构完全相同
diff <(jq -S . frontend/src/locales/zh-CN/homePage.json) \
     <(jq -S . frontend/src/locales/en-US/homePage.json) | grep -E '^[<>]' | head -5

# 如果有输出，表示存在不对齐
# 预期: 无输出（完全对齐）
```

## 💭 可能的审查问题 & 建议回复

### 问题 1: 为什么要 9 层？

**建议回复**:
- 每层对应一个功能模块（dashboard、form、export 等）
- 避免命名冲突（如 title 可能出现在多个地方）
- 便于团队协作和后续维护

### 问题 2: 某个翻译不准确

**建议回复**:
- 接受反馈，修改相应的中文/英文
- 使用 amend 更新 commit
- Force push 更新分支

### 问题 3: 为什么没有 Interpolation 的单元测试？

**建议回复**:
- 现有烟雾测试验证了 i18n 整体集成
- Interpolation 由 i18next 库本身保证
- 在 JIRA ticket 中跟踪如需更细粒度测试

## ✅ 批准指标

该 PR 可被批准，当:

- [x] 所有架构问题已解决
- [x] 翻译质量已确认
- [x] 测试验证已通过
- [x] 无 Breaking Changes
- [x] 至少 2 名审查员同意

## 📞 联系信息

- **技术问题**: 见 PR-2-DESCRIPTION.md
- **测试问题**: 见 PR-2-VERIFICATION-REPORT.md
- **快速查询**: 见 PR-2-QUICKREF.md

---

**审查时间**: ~45-90 分钟  
**预期完成**: 24-48 小时内  
**优先级**: Medium (不阻塞开发，可支持快速迭代)

