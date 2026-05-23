# VidMirror Design System (Remix Edition)

> **Token 定义**：`frontend/src/styles/design-tokens.css` / `docs/design/styles.css`
> **设计规格来源**：`/Users/conan/Downloads/vidmirror (Remix)/system_design_v1.1.md` 与 `styles.css` 
> **最后更新**：2026-05-23

---

## 1. 设计风格与色彩 (Vibe & Colors)

### 1.1 核心风格
本系统采用 **Bold AI-creative vibe** 视觉调性，融合了极简现代排版与高饱和度的 AI 科技感。其核心特征为：
- 大字号的 Serif 衬线体标题配以小字号的等宽 Monospace 元信息。
- 根据不同的功能模块或处理阶段，采用不同的语义色彩做高亮。
- 优秀的毛玻璃效果（backdrop-filter）和流畅的过渡动画。

### 1.2 颜色语义对照表

| 用途 | Token | 默认 Hex | 对应语义说明 |
| :--- | :--- | :--- | :--- |
| **输入 / 输出层** | `--accent` / `--accent-pink` | `#FF4D7E` | 入口按钮、最终输出区、核心 CTA 操作、系统错误状态（error） |
| **任务系统 / AI 分析** | `--accent-2` / `--accent-purple` | `#B84CFF` | 任务卡片、视频模块相关的 AI 处理层、视觉分析（VLM） |
| **结构化展示** | `--accent-3` / `--accent-blue` | `#3C77FB` | 图片模块、结构化层、链接下载阶段（download） |
| **用户决策 / 分镜** | `--accent-warm` / `--accent-amber` | `#FFB84C` | 勾选面板、弹窗询问、分镜（Storyboard）及 AI 镜头分析 |
| **完成态 / 可导出** | `--accent-green` | `#22D39A` | 成功完成的节点、音频模块主色、所有绿色的导出文件按钮 |
| **复刻专项** | `--accent-deep` | `#C8365A` | 专用于复刻中心（Director）标签、收藏夹与版本记录等 |

### 1.3 基础中性色

| Token | Light Mode (`:root`) | Dark Mode (`[data-theme="dark"]`) | 典型用途 |
| :--- | :--- | :--- | :--- |
| `--bg` | `#f6f5f0` (温暖的灰白) | `#0d0c10` (极深紫灰) | 页面整体背景 |
| `--bg-elev` | `#ffffff` | `#16151b` | 卡片、弹窗等悬浮/浮起层背景 |
| `--bg-sunken` | `#efede6` | `#0a0a0d` | 输入框、代码块、凹陷式背景容器 |
| `--ink` | `#111111` | `#f7f6f2` | 主标题、强调文字 |
| `--ink-2` | `#3a3a3a` | `#d4d3ce` | 正文阅读、二级文字 |
| `--ink-3` | `#6b6b6b` | `#8f8d86` | 辅助说明、placeholder 占位、等宽标签 |
| `--ink-4` | `#a0a0a0` | `#5b5a55` | 极淡辅助字（时间戳、任务状态排队） |
| `--line` | `rgba(0,0,0,0.08)` | `rgba(255,255,255,0.08)` | 默认轻量级边框、分割线 |
| `--line-strong` | `rgba(0,0,0,0.18)` | `rgba(255,255,255,0.2)` | 悬停态（hover）或强化的边框 |

---

## 2. 字体与排版 (Typography)

### 2.1 字体栈

| 类别 (Token) | 字体栈定义 | 适用场景 |
| :--- | :--- | :--- |
| **display** (`--display`) | `'Instrument Serif'`, `'Source Han Serif SC'`, Georgia, serif | 大标题、突出数字、强调倾斜字 |
| **sans** (`--sans`) | `'Inter'`, `'PingFang SC'`, -apple-system, Arial, sans-serif | 默认阅读文本、组件标题、按钮等 |
| **mono** (`--mono`) | ui-monospace, `'SF Mono'`, `'JetBrains Mono'`, monospace | 时间戳、参数值、小标签、KBD 键、日志 |

### 2.2 辅助排版类名 (Typography Helpers)

- `.display`: 启用衬线展示字体，字重 `400`，`letter-spacing: -0.02em; line-height: 0.95`。
- `.lede`: 引导正文段落，字号 `17px`，行高 `1.55`。
- `.eyebrow`: 用于卡片上方的小眉标，`11px`，等宽，全大写，`letter-spacing: 0.14em`，颜色为 `var(--ink-3)`。
- `.mono`: 行内局部文本启用等宽字体。
- `.kw`: 关键词高亮小气泡标签，字号 `10.5px`，使用 `mono`。

---

## 3. 圆角与阴影 (Radius & Shadows)

### 3.1 圆角 Scale
Remix 规范采用了更为饱满圆滑的倒角：
- `--radius-sm`: `10px`，用于表单输入框、下拉框、小按钮、chip 标签、kbd 键和内部小缩略图。
- `--radius`: `18px` (基准圆角)，用于常规任务卡片、设置弹窗面板、详情页结果区块等。
- `--radius-lg`: `28px`，用于主容器，如 URL Composer 面板、Summary 主体容器等。
- `--radius-pill`: `99px`，用于全圆角胶囊按钮、流程指示点和 Step Pill 管道。

### 3.2 阴影 Scale
- `--shadow-sm`: `0 1px 2px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.04)` — 用于小卡片、菜单弹出层。
- `--shadow-md`: `0 6px 24px rgba(0,0,0,0.08)` — 用于主 Composer 面板。
- `--shadow-lg`: `0 24px 80px rgba(0,0,0,0.18)` — 用于侧拉抽屉、全屏模态框。

---

## 4. 间距与密度 (Spacing & Density)

### 4.1 Spacing Scale
- `4px` (`--sp-1`): 图标与文本的间距、极紧凑布局
- `8px` (`--sp-2`): 列表间距、内容 Padding、小 Gap
- `12px` (`--sp-3`): 按钮内部横向 Padding、常规 Flex Gap
- `16px` (`--sp-4`): 标准卡片 Padding、网格间距 (standard gap)
- `20px` (`--sp-5`): 详情页区域 Margin、大区域 Padding
- `24px` (`--sp-6`): 工作区外边距、大区段间距
- `32px` (`--sp-8`): Section 级间距、Hero 主标题上方 Padding

### 4.2 密度 Tweaks 规则
界面通过 `[data-density]` 属性支持三种密度切换：
1. **compact**（紧凑）：行高缩至 `0.92`，卡片 padding 与 margin 等比缩至 `0.85`。
2. **cozy**（标准，默认）：基准比例。
3. **roomy**（宽松）：各项间距比例扩至 `1.15` 倍。

---

## 5. 交互与动效 (Transitions)

### 5.1 动画物理曲线
- 动画加速曲线统一使用：`cubic-bezier(0.4, 0, 0.2, 1)`。
- 绝不使用超调或弹跳动效（no bounce/overshoot），确保专业低调的生产力工具调性。

### 5.2 状态过渡时间
- **微交互状态** (按钮 hover、数据勾选、文字高亮): `120ms – 160ms`。
- **组件级状态** (切换 Tab、卡片上浮、列表重排): `200ms – 220ms`。
- **大面板出入** (抽屉拉出、侧边对话框展示、模态框浮现): `280ms`。
- **进度条缓动** (处理进度增长插值): `400ms`。

---

## 6. 默认预设与业务契约 (Presets & Contracts)

根据 `system_design_v1.1.md` §15，前端呈现和交互处理须遵循如下默认契约：

1. **并行处理限制**：
   - 轻量配置（4 核 / 8GB）建议并行任务数：`1`（最大允许 2）
   - 中等配置（8 核 / 16GB）建议并行任务数：`2`（最大允许 4）
   - 重度配置（16+ 核 / 32GB+）建议并行任务数：`4`（最大允许 8）
2. **可跳过的中间阶段**：
   - 画面准备 (`frames`)：可跳过（跳过则自动将总结路径退化为纯文本路径 1）
   - 人声转录 (`asr`)：可跳过（跳过则字幕为空，总结只基于画面或视频模型进行）
   - 视觉大模型分析 (`vlm`)：部分可跳过（单帧 API 报错 3 次后该帧标为“分析失败”，但任务整体不报错）
   - 总结与入库 (`sum` / `store`)：不可跳过，是作业的终态核心价值。
3. **存储与清理保留时间**：
   - 临时生成的截帧和音频：默认保留 `14` 天，归档任务保留 `3` 天。
