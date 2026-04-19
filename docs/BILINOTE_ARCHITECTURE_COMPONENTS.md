# BiliNote 组件层逐件精读

> 所有文件路径以 `/Users/conan/Desktop/BiliNote/BillNote_frontend/` 为根。

## 目录树总览

```
src/
├── App.tsx / main.tsx / App.css / index.css
├── layouts/
│   ├── HomeLayout.tsx          # 主工作区三栏
│   ├── SettingLayout.tsx       # 设置页
│   └── topbar.tsx              # 顶部栏
├── pages/
│   ├── Index.tsx               # 路由根重定向 → /home
│   ├── HomePage/
│   │   ├── Home.tsx            # 仅引用 HomeLayout
│   │   └── components/
│   │       ├── NoteForm/       # 输入与生成（最复杂的组件簇）
│   │       ├── NoteHistory.tsx # 左侧任务历史
│   │       ├── MarkdownView/   # 右侧笔记预览 + 导出
│   │       ├── MarkmapComponent/  # 思维导图
│   │       ├── StepBar.tsx     # 步进条
│   │       └── transcriptViewer.tsx  # 原始字幕
│   ├── SettingPage/
│   │   ├── index.tsx
│   │   ├── about.tsx
│   │   └── components/
│   │       ├── menuBar.tsx
│   │       ├── model/          # 模型 CRUD
│   │       ├── provider/       # 提供商 CRUD
│   │       ├── transcription/  # ASR 配置
│   │       └── screenshot/
│   └── NotFoundPage/
├── components/
│   ├── ui/                     # Shadcn 原子组件（button/input/card/dialog/tabs/...）
│   ├── Icons/platform.tsx      # 平台图标 SVG
│   └── ThemeSwitcher / LangSwitcher
├── store/  (见主报告 §4)
├── hooks/useTaskPolling.ts
├── services/
│   ├── note.ts        # generate / task_status / delete / retry
│   ├── model.ts       # 模型列表
│   ├── upload.ts      # 本地上传
│   └── downloader.ts
├── lib/
│   ├── utils.ts       # cn() + 工具
│   └── markmap.ts     # markmap 封装
├── constant/note.ts   # 平台/style/format 枚举
├── types/index.d.ts
├── utils/index.ts
└── locals/zh-CN.ts / en-US.ts
```

---

## 组件逐件说明

### `NoteForm`（`pages/HomePage/components/NoteForm/`）

**核心组件**。单文件目录，包含：
- 视频 URL 输入（`<Input>`）+ 粘贴按钮，自动识别平台（bilibili / youtube / douyin / kuaishou / 本地上传）
- **平台图标** 显示：`components/Icons/platform.tsx`
- **模型选择器**：两级下拉（Provider → Model），图标用 `@lobehub/icons`
- **Quality** 单选：fast / medium / slow
- **Format 多选**：`[bulleted, mindmap, quiz, summary, key_points]`（`constant/note.ts`）
- **Style** 单选：academic / minimalist / creative
- **高级选项** Collapsible：
  - `screenshot` switch（截图插入）
  - `link` switch（保留原链接）
  - `video_understanding` switch（视觉理解，后端抽帧送多模态模型）
  - `video_interval` number（抽帧间隔秒）
  - `grid_size` 两个 number（网格列/行）
  - `extras` textarea（额外 prompt）
- **提交按钮**：禁用态 / loading 态（基于当前是否存在 PENDING 任务）
- 使用 `react-hook-form` + `zod` schema 校验
- 提交流程：`addPendingTask(...)` → `POST /api/generate_note` → 等待 `useTaskPolling` 驱动

### `NoteHistory`（`pages/HomePage/components/NoteHistory.tsx`）

- 从 `taskStore` 读取 `tasks: Task[]`，倒序渲染
- 每条卡片：平台图标 + 视频标题（取自 `audioMeta.title` 或 url） + 状态徽章 + 时间
- 点击：`setCurrentTask(task.id)` → 右侧 `MarkdownViewer` 展示该任务
- hover 出现「删除」小图标 → `removeTask(id)` + `POST /api/delete_task`
- 顶部「清空全部」按钮
- 状态徽章颜色：
  - `SUCCESS` 绿、`FAILED` 红、`PENDING/PARSING/DOWNLOADING/...` 蓝闪烁（`tw-animate-css` 动画）

### `StepBar`（`pages/HomePage/components/StepBar.tsx`）

- props: `{ status: TaskStatus, message?: string }`
- 内部常量：
  ```ts
  const STEPS = [
    {key:'PENDING',     label:'排队中'},
    {key:'PARSING',     label:'解析链接'},
    {key:'DOWNLOADING', label:'下载中'},
    {key:'TRANSCRIBING',label:'转录中'},
    {key:'SUMMARIZING', label:'总结中'},
    {key:'SUCCESS',     label:'完成'},
  ]
  ```
- 当前步骤高亮（绿色圆点 + 粗体文字），未达步骤灰色，已完成步骤带 ✓
- `FAILED` 时整条变红，下方显示 `message` 红字
- 宽度 100%，在 `MarkdownViewer` 顶部仅当任务非 SUCCESS 时渲染

### `MarkdownViewer`（`pages/HomePage/components/MarkdownView/`）

- 顶部 `<Tabs>`: [笔记 | 思维导图 | 字幕 | 元信息]
- **笔记 Tab**：
  - `react-markdown` + `remark-gfm` + `rehype-raw` + `rehype-highlight` + `rehype-katex`
  - 自定义 `code` 组件 → `highlight.js` 语法高亮
  - 自定义 `img` 组件 → 替换为 `/api/image_proxy?url=...` 以绕过防盗链
  - 顶部工具条：复制 MD / 导出 PDF（`react-to-print`）/ 导出图片（`html-to-image`）
- **思维导图 Tab**：`MarkmapComponent`（见下）
- **字幕 Tab**：`transcriptViewer.tsx` 展示原始 ASR 文本
- **元信息**：视频封面 + 标题 + 时长 + 平台

### `MarkmapComponent`（`pages/HomePage/components/MarkmapComponent/`）

- 基于 `markmap-lib`（MD→JSON AST）+ `markmap-view`（SVG 渲染）+ `markmap-toolbar`（工具条）
- 从当前任务的 `markdown` 字段生成
- `lib/markmap.ts` 封装了 `Transformer` 与 `Markmap` 实例化
- 支持缩放 / 居中 / 导出 SVG

### `transcriptViewer.tsx`

- 展示 `task.transcript` 纯文本
- 支持按时间戳分段（如果后端带时间戳）

### `SettingPage` 子组件

- `menuBar.tsx`：垂直菜单，图标 + 文案，当前项高亮
- `model/`：显示已配置模型列表，新增 / 编辑 / 删除 / 测试连接
- `provider/`：提供商 CRUD，包括 `base_url`、`api_key`、`enabled`
- `transcription/`：选择 ASR 后端（fast-whisper / groq / openai-whisper）、模型大小、语言
- `screenshot/`：截图风格、宽度、水印
- `about.tsx`：版本号、作者、开源协议、更新日志

### `components/ui/`（Shadcn）

常见原子组件（从 `package.json` 的 `@radix-ui/*` 推断）：
`button`、`input`、`textarea`、`select`、`dialog`、`tabs`、`tooltip`、`dropdown-menu`、`accordion`、`collapsible`、`switch`、`checkbox`、`radio-group`、`separator`、`scroll-area`、`avatar`、`card`、`popover`、`toast/sonner`、`progress`。

### `components/Icons/platform.tsx`

导出一组 SVG 组件：`BilibiliIcon` / `YoutubeIcon` / `DouyinIcon` / `KuaishouIcon` / `LocalFileIcon`，统一 `size` prop。

### `components/ThemeSwitcher` & `LangSwitcher`

- Theme：`next-themes` 三态切换（light / dark / system）
- Lang：`i18next` 切换 zh-CN ↔ en-US，下拉菜单里显示国旗 emoji

---

（续见 `BILINOTE_ARCHITECTURE_GAPS.md` 完成缺口分析）

