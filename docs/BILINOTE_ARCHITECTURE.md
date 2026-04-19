# BiliNote 架构深度调研（VidMirror 前端重写蓝本）

> 目的：为 VidMirror 前端像素级复刻 BiliNote UI 提供完整技术选型与实施基线。
>
> 参考源：`/Users/conan/Desktop/BiliNote`（下文所有 `BillNote_frontend/...` 与 `backend/...` 相对路径均以该目录为根）。
>
> 本项目：`/Users/conan/Desktop/nibi`（VidMirror，当前前端为 Streamlit + FastAPI 双端）。
>
> 全文由 3 个章节文件组成，避免单文件过长：
> - 本文（概览 / 技术栈 / 路由 / 布局 / 状态 / API / 状态机）
> - `BILINOTE_ARCHITECTURE_COMPONENTS.md`（组件层逐件精读）
> - `BILINOTE_ARCHITECTURE_GAPS.md`（VidMirror 适配缺口 & 迁移映射）

---

## 1. 技术栈总览

来源：`BillNote_frontend/package.json`（实测版本号，与 Readme 宣传一致）

| 类别 | 选型 | 版本 | 备注 |
| --- | --- | --- | --- |
| 构建 | Vite | `^6.2.0` | `vite.config.ts` 启用 `@vitejs/plugin-react` + `tailwindcss()` + `@tailwindcss/vite`；`@` 别名指向 `src` |
| 框架 | React | `^19.0.0` | 使用 `react-dom@^19.0.0` + JSX runtime |
| 语言 | TypeScript | `~5.7.2` | `tsconfig.json` 启用 `strict` |
| 样式 | TailwindCSS | `^4.0.17` | Tailwind 4（非 3.x！）通过 `@tailwindcss/vite` 插件集成，无 `tailwind.config.js`，主题在 CSS 变量里 |
| 组件库 | Radix UI + Shadcn | 多个 `@radix-ui/react-*` | `components.json` 配置 `"style": "new-york"`、`"baseColor": "neutral"`、`"cssVariables": true` |
| 图标 | `lucide-react` + `@lobehub/icons` | `^0.485.0` / `^2.0.7` | `@lobehub/icons` 提供 OpenAI/Claude/DeepSeek 等 AI 品牌图标 |
| 路由 | `react-router-dom` | `^7.5.0` | v7（data router API） |
| 状态 | `zustand` | `^5.0.3` | 带 `persist` 持久化 |
| HTTP | `axios` | `^1.8.4` | 统一封装 |
| 表单 | `react-hook-form` + `zod` + `@hookform/resolvers` | `^7.55.0` / `^3.24.2` | 校验 |
| 面板 | `react-resizable-panels` | `^2.1.9` | 三栏可拖拽布局 |
| Markdown | `react-markdown` + `remark-gfm` + `rehype-raw` | 最新 | 配合自定义组件 |
| Mindmap | `markmap-lib` + `markmap-view` + `markmap-toolbar` | `^0.18.12` | 思维导图渲染 |
| Toast | `sonner` | `^2.0.3` | 全局提示 |
| 动画 | `framer-motion` + `tailwindcss-animate` + `tw-animate-css` | - | 过渡 |
| Theme | `next-themes` | `^0.4.6` | 暗色模式 |
| 国际化 | `i18next` + `react-i18next` | `^25.3.2` | 中英双语 |
| 其它 | `react-player`、`react-to-print`、`html-to-image`、`dompurify`、`katex`、`highlight.js` | - | 视频预览 / 导出 / 数学公式 / 代码高亮 |

关键细节：
- **无 `tailwind.config.ts`**：Tailwind 4 走 CSS-first 配置，主题 token 定义在 `src/App.css`（`@theme`）与 `src/index.css` 中。
- **Shadcn 组件**别名（`components.json`）：
  - `@/components` / `@/components/ui`
  - `@/lib/utils`（`cn()` 函数）
  - `@/hooks`
- **入口 HTML**：`index.html` 仅挂载 `<div id="root">` + `<script type="module" src="/src/main.tsx">`。

---

## 2. 路由与入口

**`src/main.tsx`** 核心：
```
createRoot(#root).render(<RouterProvider router={router} />)
```
并调用 `initI18n()`、`initSettingsStore()`（预热持久化）。

**`src/App.tsx`** 定义 `router`（`createBrowserRouter`）：

| path | element | 说明 |
| --- | --- | --- |
| `/` | `<Index/>` → `<Navigate to="/home">` | 根重定向 |
| `/home` | `<HomeLayout/>` | 主工作区（左历史 + 中表单 + 右笔记） |
| `/settings` | `<SettingLayout/>` | 设置页（左菜单 + 右详情） |
| `/settings` 子路由 | `model` / `provider` / `transcription` / `screenshot` / `about` / `...` | 在 `SettingLayout` 的 `<Outlet/>` 里切换 |
| `*` | `<NotFoundPage/>` | 404 |

> 注意：BiliNote 只有 2 个顶级路由（`/home` 与 `/settings`），**没有独立的分析页、创作页**——所有工作都发生在 `/home` 的表单 + 右侧笔记预览中。VidMirror 的「下载 / 分析 / 创作」三视图在 BiliNote 里不存在对应路由。

---

## 3. 布局系统

### 3.1 `HomeLayout`（`src/layouts/HomeLayout.tsx`）

- 根容器：`flex h-screen w-screen`
- 使用 `<PanelGroup direction="horizontal">` 的三栏可拖拽结构：
  1. **左栏**：`NoteHistory`（任务历史列表，默认宽度约 `260px`，可折叠到 `0`）
  2. **拖拽把手**：`<PanelResizeHandle>` + 1px 分割线
  3. **中栏**：`NoteForm`（输入 URL / 选择模型 / 触发生成），宽度自适应
  4. **拖拽把手**
  5. **右栏**：`MarkdownViewer`（笔记预览 + 思维导图 Tab），默认宽度约 `40%`
- 顶部有一条 `topbar`：Logo + 设置按钮 + 主题切换 + 语言切换
- 移动端（`md:hidden`）切换为 Tab 切换模式（History / Form / Preview）

### 3.2 `SettingLayout`（`src/layouts/SettingLayout.tsx`）

- 左：`MenuBar` 垂直导航（模型 / 提供商 / 转录 / 截图 / 关于 ...）
- 右：`<Outlet/>` 渲染子路由内容
- 顶部有「返回主页」按钮 → `navigate('/home')`

### 3.3 `RootLayout`（如存在）

- 实际未在路由里直接使用；`HomeLayout` 与 `SettingLayout` 各自独立渲染 `ThemeProvider` / `Toaster`。

---

## 4. 状态管理（Zustand）

所有 store 在 `src/store/` 下。均用 `zustand/middleware` 的 `persist` 持久化到 `localStorage`。

### 4.1 `taskStore`（`src/store/taskStore/index.ts`）

核心类型 `Task`：
```ts
interface Task {
  id: string;            // taskId（UUID，与后端一致）
  platform: string;      // bilibili | youtube | ...
  status: 'PENDING' | 'PARSING' | 'DOWNLOADING' | 'TRANSCRIBING' | 'SUMMARIZING' | 'SUCCESS' | 'FAILED';
  videoUrl: string;
  createdAt: number;
  markdown?: string;     // 成功后的笔记内容
  transcript?: string;   // 转录文本
  audioMeta?: { title; cover_url; duration; ... };
  formData?: Partial<VideoRequest>; // 表单快照，用于重试
  message?: string;      // 进度/错误信息
}
```
动作：`addPendingTask` / `updateTaskContent` / `updateTaskStatus` / `removeTask` / `clearAllTasks` / `retryTask`。

持久化 key：`task-storage`。

### 4.2 `configStore`（`src/store/configStore`）

管理用户偏好：主题、语言、默认截图开关、默认 `link`、默认 quality、默认 format 复选、默认 style、默认模型/提供商 id、是否显示视觉理解（`video_understanding`）等。

### 4.3 `modelStore`

管理「当前选定模型」与「模型列表」——从后端 `/api/provider/*` 拉取。

### 4.4 `providerStore`

管理「大模型提供商」CRUD：OpenAI / Ollama / DeepSeek / Claude / 本地 / 自定义。字段：`provider_id`、`name`、`base_url`、`api_key`、`enabled`、`logo` 等。

---

## 5. 自定义 Hooks

唯一的 hook：**`src/hooks/useTaskPolling.ts`**。

逻辑：
1. 监听 `taskStore` 里所有非终态任务（状态不在 `['SUCCESS','FAILED']`）
2. 每 **3 秒** 调用 `GET /api/task_status/{task_id}` 轮询
3. 根据返回：
   - `status==='SUCCESS'`：写入 `markdown` / `transcript` / `audioMeta`，切换到 SUCCESS
   - `status==='FAILED'`：写入 `message`，切换 FAILED 并 toast
   - 其它：更新 `status` + `message`（用于 `StepBar`）
4. 页面卸载或任务终结时 `clearInterval`

**没有 SSE / WebSocket**——BiliNote 纯轮询方案。

---

## 6. API 协议

### 6.1 基础约定

- `axios` 基础 URL 从 `VITE_BACKEND_BASE_URL` 读取，默认 `http://127.0.0.1:8000`
- 统一响应包装 `ResponseWrapper`（后端 `app/utils/response.py`）：
  ```json
  { "code": 0, "msg": "...", "data": {...} }
  ```
  `code===0` 表成功；前端 `axios` 拦截器会抛错 toast。

### 6.2 核心端点（`backend/app/routers/note.py`）

| Method | Path | 请求体 | 响应 | 用途 |
| --- | --- | --- | --- | --- |
| POST | `/api/generate_note` | `VideoRequest`（见下） | `{task_id}` | 创建笔记生成任务 |
| GET | `/api/task_status/{task_id}` | — | `{status, message, result?, task_id}` | 轮询状态 |
| POST | `/api/delete_task` | `{video_id, platform}` | `{msg}` | 删除任务结果 |
| POST | `/api/upload` | `multipart/form-data (file)` | `{url: "/uploads/xx"}` | 本地视频上传 |
| GET | `/api/image_proxy?url=...` | — | 图片流 | 绕过 B 站防盗链 |

**`VideoRequest`**（`note.py:37-51`）：
```py
video_url: str
platform: str          # bilibili | youtube | douyin | kuaishou | local
quality: "fast" | "medium" | "slow"
screenshot: bool = False
link: bool = False
model_name: str
provider_id: str
task_id: str | None    # 传入表示重试
format: list[str]      # ["bulleted","mindmap","quiz","summary",...]
style: str             # "academic" | "minimalist" | ...
extras: str | None     # 用户补充 prompt
video_understanding: bool = False  # 视觉理解开关
video_interval: int = 0            # 抽帧间隔（秒）
grid_size: list[int]               # 网格拼图尺寸
```

**`task_status` 响应**（`note.py:162-219`）：
- 读取 `{task_id}.status.json`（进度文件）+ `{task_id}.json`（结果文件）
- `status='SUCCESS'` 时，`result` 字段含 `markdown` / `transcript` / `audio_meta`
- `status='FAILED'` 时走 `R.error` 路径（`code!=0`）

### 6.3 其它路由

- `/api/provider/*`：模型提供商 CRUD、连接测试（`backend/app/routers/provider.py`）
- `/api/model/*`：模型列表
- `/api/download/*`：下载历史
- 无 SSE、无 WebSocket。

---

## 7. 状态机与任务生命周期

### 7.1 后端枚举（`backend/app/enmus/task_status_enums.py`）

```py
class TaskStatus(str, Enum):
    PENDING      = "PENDING"       # 排队中
    PARSING      = "PARSING"       # 解析链接
    DOWNLOADING  = "DOWNLOADING"   # 下载中
    TRANSCRIBING = "TRANSCRIBING"  # 转录中
    SUMMARIZING  = "SUMMARIZING"   # 总结中
    FORMATTING   = "FORMATTING"    # 格式化中
    SAVING       = "SAVING"        # 保存中
    SUCCESS      = "SUCCESS"
    FAILED       = "FAILED"
```

### 7.2 切换点（`backend/app/services/note.py`）

- 接收到任务 → `PENDING`（`note.py:148` 重试模式 / 新建时立刻写）
- 进入 `generate()` → `PARSING`（`services/note.py:123`）
- 开始下载 → `DOWNLOADING`（`services/note.py:141`）
- 开始 ASR → `TRANSCRIBING`（`services/note.py:154`）
- LLM 总结 → `SUMMARIZING`（`services/note.py:471`）
- 格式化 Markdown → `FORMATTING`
- 写结果文件 → `SAVING` → `SUCCESS`
- 任何异常 → `FAILED`（捕获后写 `.status.json`）

### 7.3 前端消费

**`StepBar`** 组件（`src/pages/HomePage/components/StepBar.tsx`）：
- 接收 `status: TaskStatus` 作为 prop
- 内部固定 6 步数组：`['PENDING','PARSING','DOWNLOADING','TRANSCRIBING','SUMMARIZING','SUCCESS']`
- 根据当前 status 计算 `activeIndex`，渲染步进条（圆点 + 连线 + 文案）
- `FAILED` → 整条变红并显示错误 message

### 7.4 取消机制

**当前版本没有取消**。重试由前端 `retryTask()` 触发：携带原 `task_id` 重新 POST `/api/generate_note`，后端重置 `.status.json` 为 `PENDING`。

---

（续见 `BILINOTE_ARCHITECTURE_COMPONENTS.md` 与 `BILINOTE_ARCHITECTURE_GAPS.md`）

