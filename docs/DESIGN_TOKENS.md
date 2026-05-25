# Nibi 设计规范速查（Remix 版）

> **唯一 UI 真相源**：`docs/design/`（VidMirror Remix 设计稿镜像，2026-05-25 同步）
> 视觉/交互验证：`docs/design/check/` 里 10+ 张页面截图
> 详细业务规则：`docs/design/system_design_v1.1.md`（1530 行，按 § 分章节）
>
> **写新 UI 之前必读本文件**。本文件是给 AI 快速取用的 token + class 词典；不是完整 spec。
> 当本文件与 `docs/design/styles.css` 冲突时，**以 `styles.css` 为准**，并修正本文件。

---

## 1. 设计基调

- **Bold AI-creative vibe**：极简科技 + 艺术感。
- **大字号 serif 衬线体**作 Display 标题，搭配高饱和 Accent 色块。
- **明暗双主题**（light / dark），切换由根节点 `data-theme` 控制；所有颜色用 token，禁止 hardcoded hex。
- **本地优先桌面工具**调性：朴素、安静、不抢戏；动效短促（120-280ms），避免弹跳/overshoot。

---

## 2. 颜色 Token

### 2.1 中性背景与文字（light / dark 两套）

| Token | Light | Dark | 用法 |
|---|---|---|---|
| `--bg` | `#f6f5f0` | `#0d0c10` | 最底层背景 |
| `--bg-elev` | `#ffffff` | `#16151b` | 卡片 / 弹层 / 抽屉 |
| `--bg-sunken` | `#efede6` | `#0a0a0d` | 输入框 / 代码块 / 凹陷面板 |
| `--ink` | `#111111` | `#f7f6f2` | 主文字 / 主按钮背景 |
| `--ink-2` | `#3a3a3a` | `#d4d3ce` | 正文 |
| `--ink-3` | `#6b6b6b` | `#8f8d86` | 辅助 / mono 元信息 |
| `--ink-4` | `#a0a0a0` | `#5b5a55` | 占位符 / 最弱信息 |
| `--line` | `rgba(0,0,0,0.08)` | `rgba(255,255,255,0.08)` | 分割线 / 卡片边框 |
| `--line-strong` | `rgba(0,0,0,0.18)` | `rgba(255,255,255,0.2)` | hover 态边框 / 强调线 |
| `--pill-bg` / `--pill-ink` | `#111` / `#fff` | `#f7f6f2` / `#0d0c10` | 高对比胶囊（深底浅字） |

### 2.2 Accent 色（语义化，跨主题不变）

| Token | 色值 | 语义 |
|---|---|---|
| `--accent` | `#FF4D7E` 粉 | **输入/输出层入口**、最终输出按钮、错误/失败、复刻专项重点 |
| `--accent-2` | `#B84CFF` 紫 | **视频模块**、任务系统、AI 分析层 |
| `--accent-3` | `#3C77FB` 蓝 | **图片模块**、结构化层 |
| `--accent-warm` | `#FFB84C` 橙 | 用户决策节点、勾选面板、分镜 |
| `--accent-green` | `#22D39A` 绿 | **音频模块**、可导出节点、完成/成功态、live 指示 |
| `--accent-deep` | `#C8365A` 深红 | 复刻专项（Director）卡片 |

> **铁律**：组件颜色按**业务语义**选 accent，不要按"好看不好看"挑。
> 例：音频相关组件用绿色（accent-green）；视频用紫色（accent-2）；图片用蓝色（accent-3）；用户决策/确认用橙色（accent-warm）。

### 2.3 状态色

| 状态 | Token | 说明 |
|---|---|---|
| 运行中 | `--accent-3`（蓝，可带 `proc-blink` 动画） | running / progress |
| 等待中 | `--ink-4` 或 `--ink-3` | queued / pending |
| 成功 | `--accent-green` | done / success |
| 失败 | `--accent` | error / failed |
| 警告 | `--accent-warm` | warning |

---

## 3. 字体栈

| Token | 字体 | 用途 |
|---|---|---|
| `--display` | `Instrument Serif`, `Source Han Serif SC`, `Noto Serif SC`, Georgia, serif | **大标题**（页面 hero / section 标题）|
| `--sans` | `Inter`, `PingFang SC`, -apple-system, BlinkMacSystemFont, sans-serif | 默认正文 |
| `--mono` | ui-monospace, `SF Mono`, `JetBrains Mono`, Menlo, Consolas | 元信息、代码、tag、状态 chip、URL |

辅助 class：
- `.display` — 应用 Display serif + `font-weight: 400` + `letter-spacing: -0.02em` + `line-height: 0.95`
- `.mono` — 应用等宽栈
- `.eyebrow` — mono + 大写 + tracking，常作 section 上方小标签
- `.lede` — Hero 副文案样式

---

## 4. 圆角

| Token | 值 | 用途 |
|---|---|---|
| `--radius` | `18px` | **默认卡片** / 抽屉 / popover |
| `--radius-sm` | `10px` | 按钮 / chip / kbd / 输入框 |
| `--radius-lg` | `28px` | Composer / Summary 大容器 / hero |
| (literal) | `99px` | 胶囊按钮 / pp-chip / chip-dot |

---

## 5. 阴影

| Token | 用途 |
|---|---|
| `--shadow-sm` | 小卡片 hover |
| `--shadow-md` | Composer / 中等卡片 |
| `--shadow-lg` | 大悬浮面板（FloatingTaskQueue popover、抽屉、modal）|

---

## 6. 动效

- **加速曲线**：`cubic-bezier(0.4, 0, 0.2, 1)`（标准 ease）；popover 入场可用 `cubic-bezier(0.2, 0.8, 0.2, 1)`
- **过渡时间**：
  - 状态变更 / hover：120-220ms
  - 抽屉 / 弹层入场：220-280ms
  - 进度条插值：400ms
- **禁止**：弹跳、overshoot、装饰性 spin、`transform: scale(...)` 大幅度变化
- **常用 keyframe**：
  - `proc-blink`：running 状态点闪烁 `1.6s infinite`，`0%,100% {opacity:1} 50% {opacity:0.35}`
  - `ks-menu-in`：popover 入场 200ms

---

## 7. 核心 class 词典

### 7.1 全局壳

| Class | 角色 |
|---|---|
| `.app-shell` / `.sidebar` / `.workarea` / `.topbar` | App layout |
| `.sb-btn` / `.sb-dot` / `.sb-sep` / `.sb-spacer` | Sidebar 按钮 |
| `.crumb` | Topbar 面包屑（display + mono 双语对照） |
| `.chip` / `.chip-dot` | Topbar 状态胶囊（后端/GPU/Live） |

### 7.2 按钮

| Class | 角色 |
|---|---|
| `.btn` | 默认按钮（边框风格）|
| `.btn-ghost` | 透明背景，hover 出边框 |
| `.btn-primary` | 高对比主按钮（深底浅字） |
| `.btn-pop` | Tweaks 等弹出触发按钮 |
| `.btn-run` / `.wb-btn-run` | Workbench 解析主 CTA |

### 7.3 Workbench / Composer（首页输入）

| Class | 角色 |
|---|---|
| `.hero` / `.hero-eyebrow` / `.lede` | Hero 区 |
| `.composer` / `.composer-url` / `.composer-run` / `.composer-projects` | Composer 主容器 |
| `.platform` | URL 前置平台标识方块（自动按平台变色） |
| `.pp-add` / `.pp-chip` / `.pp-none` / `.pp-popover` / `.pp-search` / `.pp-list` / `.pp-row` / `.pp-foot` | 工作空间多选 popover |
| `.kw` | 元信息标签（mono 小 chip） |

### 7.4 AddMaterial Modal

| Class | 角色 |
|---|---|
| `.modal-backdrop` / `.modal` | 标准 Remix modal 容器（**不是** shadcn dialog） |
| `.m-head` / `.m-body` / `.m-section` / `.m-foot` | 4 段结构 |
| `.type-row` / `.type-card[data-active]` | ① 素材类型卡片 |
| `.task-chips` / `.task-chip[data-on]` / `.tc-box` | ③ 分析任务勾选 chip |
| `.bg-toggle` / `.bg-panel` / `.field-input` / `.field-label` / `.pill-row` / `.pill[data-on]` | ④ 背景信息折叠区 |
| `.modal-actions` / `.modal-foot-status` | Footer |

### 7.5 PreflightDrawer（细调抽屉）

| Class | 角色 |
|---|---|
| `.pf-drawer` / `.pf-drawer-head` / `.pf-drawer-body` / `.pf-drawer-foot` | 抽屉容器（520px 宽） |
| `.pf-section` / `.pf-section-title` | 编号 section 头（01 / 02 / 03） |
| `.pf-field` / `.pf-sel` / `.pf-inp` | 字段 + select + input |
| `.pf-model-row` | provider + model 双 select 一行 |
| `.pf-task-card` / `.pf-task-card[data-on]` / `[data-locked]` / `[data-disabled]` | 任务勾选卡片（lock / disabled 三态） |
| `.media-kind-tabs` | 顶部 video/audio/image/text tab |
| `.preset-bar` | §15.2 prefset chip 行 |

### 7.6 状态与小元素

| Class | 角色 |
|---|---|
| `.step-pill` / `.step-row` | Processing 阶段条 |
| `.spinner` | 18px 圆形 spinner |
| `.tasklet` | 任务详情侧栏卡片 |
| `.proc-wrap` / `.proc-main` / `.proc-hero` / `.proc-side` | Processing 页面布局 |
| `.live` | 红色 ● LIVE 角标 |

---

## 8. 给 AI 的写代码铁律

1. **任何颜色 / 边框 / 圆角 / 阴影必须用 token**。看到 hex / rgba / px 边框值直接拒绝（除非是 token 已有的"未命名"值如 `99px` 胶囊、`rgba(255,255,255,0.18)` 在深底胶囊的半透白）。
2. **Display 大标题用 `.display` class**，不要自己写 `font-family: 'Instrument Serif'`。
3. **元信息（URL / hash / stage 名 / 计数 / 平台 tag）一律 `.mono` + 11px 左右**。
4. **modal 必须用 `.modal-backdrop` + `.modal` + `.m-head/body/section/foot` 结构**，不要套 shadcn `<Dialog>` 默认样式（可保留无障碍底座但可见结构走 Remix）。
5. **按业务语义选 accent**：音频→绿，视频→紫，图片→蓝，决策/确认→橙，错误/输入输出→粉。**不要按"哪个好看"选**。
6. **写新组件先 grep `docs/design/components/`** 看 Remix 里有没有现成版本（19 个 jsx 文件几乎覆盖了所有页面）。有 → 1:1 复刻；无 → 找最近似的 class 词汇沿用。
7. **新 class 命名跟现有体例**：组件前缀（`pf-` / `pp-` / `mat-` / `m-`）+ 部位词。不要混用 BEM / camelCase。
8. **暗色主题**：写完检查根 `[data-theme="dark"]` 下是否有失控的 hardcoded（用 `:where(:root[data-theme="dark"]) .my-class { ... }` 不需要单独写覆盖，token 已经处理）。
9. **不写 emoji** 进 UI 文本（保留给 mono 状态点：● ○ ✗ × ↻）。

---

## 9. 速查索引

| 想找什么 | 看哪 |
|---|---|
| 全部颜色 / 字体 / 圆角 / 阴影定义 | `docs/design/styles.css` L2-65 |
| 152 个 class 完整 CSS | `docs/design/styles.css` 全文 |
| 各页面长什么样 | `docs/design/check/*.png`（home / taskboard / process / results / library / director / search / settings / storyboard） |
| 具体组件 jsx 实现 | `docs/design/components/<page>.jsx`（19 个） |
| 业务规则（状态机 / 级联 / 数据契约） | `docs/design/system_design_v1.1.md`（按 § 章节查） |
| 浮动队列 §11.3 | `docs/design/components/p1_features.jsx` L160-370 |
| 前置配置抽屉 §4 | `docs/design/components/preflight.jsx` |
| 添加素材 modal | `docs/design/VidMirror.html` 中嵌入或 components 中相关文件 |

---

## 10. 更新规则

- Remix 设计稿源在用户机器 `/Users/conan/Downloads/vidmirror (Remix)`。
- 用户拿到新版本时，**一次性 rsync 同步到 `docs/design/`**（保留 git diff 可审计）。
- 本文件 (`DESIGN_TOKENS.md`) 在每次同步后，**人工 review 是否需要补充新 token / class**；token 改名要全仓 grep 改。
- 同步流程：
  ```bash
  rsync -a --delete --exclude='scraps' --exclude='.thumbnail' --exclude='.DS_Store' \
    "/Users/conan/Downloads/vidmirror (Remix)/" docs/design/
  ```
