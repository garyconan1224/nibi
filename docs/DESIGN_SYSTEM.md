# VidMirror Design System

> Token 定义：`frontend/src/styles/design-tokens.css`
> 设计稿来源：`docs/design/styles.css` + `docs/design/system_design_v1.1.md`
> 最后更新：2026-05-19

---

## 1. 颜色

### 1.1 语义对照表

| Token | 色值 | 语义 | 典型用途 |
|-------|------|------|---------|
| `--accent` / `--accent-pink` | `#FF4D7E` coral | 输入 / 输出层 | 入口按钮、最终输出区、强调 |
| `--accent-2` / `--accent-purple` | `#B84CFF` purple | AI 分析层 | 任务卡片、AI 相关 UI |
| `--accent-3` / `--accent-blue` | `#3C77FB` blue | 结构化层 | 图片模块、结构化数据 |
| `--accent-warm` / `--accent-amber` | `#FFB84C` amber | 分镜层 / 用户决策 | 需要用户选择的弹窗、分镜 UI |
| `--accent-green` | `#22D39A` teal | 完成态 | 成功状态、可导出节点 |

> 语义来源：`system_design_v1.1.md` §1.3

### 1.2 中性色

| Token | 用途 |
|-------|------|
| `--bg` | 页面背景 |
| `--bg-elev` | 卡片 / 弹窗等浮起层 |
| `--bg-sunken` | 凹陷区域（输入框背景、code block） |
| `--ink` | 主文字 |
| `--ink-2` | 正文 / 二级文字 |
| `--ink-3` | 辅助文字 / placeholder |
| `--ink-4` | 最淡文字（时间戳、计数） |
| `--line` | 默认边框 / 分割线 |
| `--line-strong` | 强调边框（hover 态） |

### 1.3 暗色模式

所有 token 在 `[data-theme="dark"]` 下有对应覆写，组件不需要单独处理。`next-themes` 的 `ThemeProvider` 通过 `class` 策略切换。

---

## 2. 字体

### 2.1 字体栈

| Token | 字体栈 | 用途 |
|-------|--------|------|
| `--sans` | Inter / PingFang SC / system-ui | 正文默认 |
| `--mono` | SF Mono / JetBrains Mono / Menlo | 代码、时间戳、标签 |
| `--display` | Instrument Serif / Source Han Serif SC | 大标题、数字展示 |

### 2.2 字体级别

| 类名 | 字号 | 场景 |
|------|------|------|
| `.display` | 由容器控制（clamp） | 页面大标题（Hero h1、统计数字） |
| `.lede` | 17px / 1.55 | Hero 区域引导段落 |
| `.eyebrow` | 11px / mono / uppercase / 0.14em | 区域小标签（"PIPELINE"、"RECENT"） |
| `.mono` | 继承父级 | 行内等宽文字 |
| `.kw` | 10.5px / mono | 关键词高亮标签 |

---

## 3. 间距

### 3.1 Spacing Scale

| Token | 值 | 常见用途 |
|-------|----|---------|
| `--sp-1` | 4px | 图标与文字间距、紧凑 gap |
| `--sp-2` | 8px | 列表项间距、小 padding |
| `--sp-3` | 12px | 按钮内部 padding、中等 gap |
| `--sp-4` | 16px | 卡片内 padding、标准 gap |
| `--sp-5` | 20px | 区域 padding |
| `--sp-6` | 24px | 大区域间距 |
| `--sp-8` | 32px | section 间距 |

### 3.2 密度规则

- **紧凑区**（toolbar、chip 行）：`--sp-1` ~ `--sp-2`
- **标准区**（卡片内容、表单）：`--sp-3` ~ `--sp-4`
- **宽松区**（section 之间、页面 padding）：`--sp-6` ~ `--sp-8`

---

## 4. 圆角

| Token | 值 | 场景 |
|-------|----|------|
| `--radius-sm` | 10px | 小元素（chip、kbd、缩略图） |
| `--radius` | 18px | 卡片、面板（默认） |
| `--radius-lg` | 28px | 大卡片（Composer、Summary） |
| `--radius-pill` | 99px | 胶囊形（按钮、badge、step pill） |

---

## 5. 按钮

### 5.1 三种形态

| 类名 | 样式 | 场景 |
|------|------|------|
| `.btn` | 白底 + 边框 | 次要操作（"取消"、"筛选"） |
| `.btn-ghost` | 透明无边框 | 工具栏图标按钮、最小干扰操作 |
| `.btn-primary` | 黑底白字 | 主操作（"保存"、"确认"） |
| `.btn-run` | 黑底 + 红色图标圆 | 启动任务（Composer 的"开始解析"） |

### 5.2 使用规则

- 一个区域最多一个 `.btn-primary` 或 `.btn-run`
- 禁用态：`opacity: 0.5; pointer-events: none`
- hover 态由 token 自带，不需要额外 class
