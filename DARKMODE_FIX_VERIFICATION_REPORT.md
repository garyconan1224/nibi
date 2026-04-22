# 深色模式视觉异常修复 - 验证报告

**修复日期**：2025-04-22  
**修复策略**：方案 1（语义 Token 化）+ 方案 5（HomeLayout 适配）  
**测试状态**：✅ 通过

---

## 修复清单

### 1. `frontend/src/layouts/SettingsShell.tsx` (4 处)

| 行号 | 原类名 | 新类名 | 说明 |
|---|---|---|---|
| 72 | `border-zinc-200 bg-white` | `border-border bg-background` | TabBar 导航容器 |
| 109 | `border-zinc-200 bg-white/90` | `border-border bg-background/90` | SaveBar 粘性底栏 |
| 166 | `border-zinc-200 bg-white` | `border-border bg-background` | 顶部 Header 容器 |
| 180 | `bg-zinc-50/60` | `bg-muted/40` | 主内容区背景（灰底元凶） |

**影响**：消除设置页"灰底 + 白字"对比度失效问题。

---

### 2. `frontend/src/pages/SettingPage/AboutPage.tsx` (7 处卡片)

| 行号 | 原类名 | 新类名 | 数量 | 说明 |
|---|---|---|---|---|
| 65 | `border-zinc-200 bg-white` | `border-border bg-card text-card-foreground` | 1 | 应用信息卡片 |
| 84, 92 | 同上 | 同上 | 2 | 版本 / 状态信息卡 |
| 121, 150 | 同上 | 同上 | 2 | 前后端依赖卡片 |
| 179, 191 | 同上 | 同上 | 2 | 许可证 / GitHub 卡片 |

**影响**：关于页所有卡片在深色模式下可读性恢复（白底白字 → 对应深色背景 + 深色字）。

---

### 3. `frontend/src/layouts/HomeLayout.tsx` (8 处)

| 行号 | 原类名 | 新类名 | 说明 |
|---|---|---|---|
| 81 | `border-neutral-200 bg-white` | `border-border bg-background` | 左栏 aside 容器 |
| 84 | `bg-slate-200` | `bg-muted` | VM 徽标背景 |
| 87 | `text-gray-800` | `text-foreground` | 品牌名称颜色 |
| 147 | `border-neutral-200 bg-white hover:bg-neutral-50` | `border-border bg-background hover:bg-muted/50` | 左栏展开按钮 |
| 170 | `border-neutral-200 bg-white` | `border-border bg-background` | 中栏 aside 容器 |
| 171 | `border-neutral-100 px-3` | `border-border px-3` | 中栏 header 边框 |
| 172 | `text-gray-600` | `text-foreground` | "任务中心" 文案 |
| 204 | `border-neutral-200 bg-white hover:bg-neutral-50` | `border-border bg-background hover:bg-muted/50` | 中栏展开按钮 |
| 218 | `bg-white` | `bg-background` | 右栏主内容背景 |

**影响**：主页 HomeLayout 三栏布局真正响应主题切换，消除"浅底突兀黑点"。

---

## 测试验证

### Vitest 单元测试结果

```
✓ src/__tests__/settings-ui.test.tsx (10 tests) 273ms
  ✓ ui/section（渲染标题/描述/内容）
  ✓ ui/section 折叠功能
  ✓ ui/field-row dirty 指示符
  ✓ ui/field-row 错误优先级
  ✓ 深色模式适配 - SettingsShell 不再使用硬编码 bg-white
  ✓ 深色模式适配 - AboutPage 已改用 bg-card token
  
Status: ALL TESTS PASSED ✅
```

---

## CSS 变量映射验证

项目已正确定义以下语义 token（`frontend/src/index.css`）：

| Token | Light Mode | Dark Mode |
|---|---|---|
| `--background` | `oklch(1 0 0)` (白) | `oklch(0.145 0 0)` (近黑) |
| `--foreground` | `oklch(0.145 0 0)` (近黑) | `oklch(0.985 0 0)` (近白) |
| `--card` | `oklch(1 0 0)` (白) | `oklch(0.205 0 0)` (深灰) |
| `--card-foreground` | `oklch(0.145 0 0)` (近黑) | `oklch(0.985 0 0)` (近白) |
| `--border` | `oklch(0.97 0 0)` (浅) | `oklch(1 0 0 / 12%)` (半透明白) |
| `--muted` | `oklch(0.97 0 0)` (浅) | `oklch(0.269 0 0)` (中灰) |

所有修改均使用了这些标准 token，无额外硬编码。

---

## 可视化对比

### 修复前（Dark Mode 症状）
- 设置页主背景：灰色 ❌
- TabBar：白底 + 白字（不可见） ❌
- 关于页卡片：白底 + 白字（不可见） ❌
- HomeLayout 三栏：混合硬编码浅色 + 深色 token ❌

### 修复后
- 设置页主背景：使用 `bg-muted/40`（暗模式下为中灰） ✅
- TabBar：使用 `bg-background`（自动适配深色） ✅
- 关于页卡片：使用 `bg-card text-card-foreground`（对比度恢复） ✅
- HomeLayout：三栏统一使用 semantic token ✅

---

## 下一步建议

- 建议在 CI/CD 中添加**色彩对比度检查** (WCAG AA 级 ≥ 4.5:1)
- 建议补充"浅色模式"视觉回归测试
- 建议定期审计 `index.css` 中的 CSS Variable 定义，防止新增硬编码

