# VidMirror 适配缺口分析 & 迁移映射

> 对比双方：
> - BiliNote：React + Vite + Tailwind + Zustand（`BiliNote/BillNote_frontend`）
> - VidMirror（nibi）：Streamlit 多页 + FastAPI（`/Users/conan/Desktop/nibi`）
>
> 目标：把 VidMirror 前端「重写为 BiliNote 同款 React SPA」，同时保留 VidMirror 已有的视觉分析 / 分镜 / 项目多开能力。

---

## 1. 技术栈差异

| 维度 | BiliNote | VidMirror 当前 | 重写后目标 |
| --- | --- | --- | --- |
| 前端框架 | React 19 + Vite 6 | Streamlit 1.33+（Python 渲染） | 迁移到 React 19 + Vite 6（复刻 BiliNote） |
| 样式 | Tailwind 4 + Shadcn | Streamlit 原生 CSS | Tailwind 4 + Shadcn |
| 状态 | Zustand persist | `st.session_state`（服务端） | Zustand persist |
| 通信 | REST 轮询 | REST + SSE + WebSocket（已有） | REST + 可选 SSE（BiliNote 无 SSE） |
| 后端 | FastAPI（`/api/generate_note`） | FastAPI（`/pipeline/tasks`） | 保留 VidMirror 后端，新增 BiliNote 风格兼容层 |
| 国际化 | i18next（zh/en） | 仅中文硬编码 | i18next（可只装 zh-CN） |

---

## 2. 功能对照表

### 2.1 BiliNote 有 / VidMirror 没有

| 功能 | 位置 | 迁移代价 | 说明 |
| --- | --- | --- | --- |
| 三栏可拖拽布局 | `HomeLayout.tsx` + `react-resizable-panels` | ★★ 中 | 新增依赖 + 布局组件 |
| Markdown 导出 PDF / 图片 | `MarkdownView/` + `react-to-print` + `html-to-image` | ★★ 中 | 前端功能，可直接复用 |
| 思维导图 | `MarkmapComponent/` + `markmap-*` | ★★★ 高 | 渲染库 + MD→Mindmap 转换 |
| 截图插帧（笔记里嵌视频截图） | 后端 `screenshot=true` | ★★★ 高 | 后端需新增视频抽帧 + 笔记合成 |
| 多平台 URL 识别 | `constant/note.ts` + `NoteForm` | ★ 低 | VidMirror 已有 bilibili downloader，补 youtube/douyin/kuaishou |
| 多模型提供商管理 | `SettingPage/provider/` | ★★ 中 | VidMirror 已有 `core/providers/`，需迁移前端 UI |
| ASR 后端切换（fast-whisper/groq） | `SettingPage/transcription/` | ★ 低 | VidMirror 已有 `services/asr_*`，前端补 UI |
| 主题切换（dark/light/system） | `next-themes` | ★ 低 | 纯前端 |
| 国际化（zh/en） | `i18next` | ★ 低 | 可先只做 zh |
| 任务重试（复用 task_id） | `taskStore.retryTask` + 后端支持 | ★★ 中 | VidMirror 后端需补重试协议 |
| 视频元信息展示（封面 / 时长） | MarkdownView 元信息 Tab | ★ 低 | 后端 downloader 已有 meta |
| 本地视频上传 | `POST /api/upload` + `NoteForm` 本地 tab | ★★ 中 | VidMirror 后端需加 `/upload` 路由 |

### 2.2 VidMirror 有 / BiliNote 没有（需新增组件）

| 功能 | 现有位置 | 需新增前端组件 |
| --- | --- | --- |
| 项目多开（切换 / 新建） | `shared/project_store.py` + `sidebar.py:render_project_switcher` | `ProjectSwitcher` 组件（放 `HomeLayout` 左上，替代 BiliNote 的 Logo 下方空位） |
| 视觉分析（多模态帧分析） | `src/vidmirror/core/analyzer.py` + `views/analyze.py` | `AnalyzeView` 页面（BiliNote 无此路由，需新增 `/home/analyze`） |
| 分镜 A/B/C 生成 | `views/create.py`（创作视图） | `StoryboardPanel` 组件（并列显示 A/B/C 三版本，支持切换采纳） |
| 知识库 RAG | `core/knowledge_base.py` + `routes/rag.py` | `KnowledgeBasePanel`（设置页新增子页或独立 Tab） |
| SSE / WebSocket 订阅 | `/pipeline/tasks/{id}/events` 与 `/ws` | 可选：`useTaskStream` hook 替代 `useTaskPolling`（建议先复刻轮询版，后期再升级） |
| 任务取消 | `/pipeline/tasks/{id}/cancel`（待确认） | 在 `NoteHistory` 卡片上加「取消」按钮 |
| 多 task_type（`download/analyze/create/storyboard`） | `pipeline.py:TaskCreateRequest` | `taskStore.Task.type: TaskType` 新字段；`StepBar` 按 type 展示不同步骤集 |

### 2.3 命名冲突映射

| BiliNote 概念 | VidMirror 概念 | 建议统一命名 |
| --- | --- | --- |
| Note（笔记） | Analyze（分析结果） | 前端保留 `Note` 作为通用 Markdown 产物类型；业务语义用 `Analysis`、`Storyboard` 子类型 |
| Video（视频源） | Download task 产出的媒体资源 | 统一用 `Media`（`media_id` / `media_meta`） |
| `/api/generate_note` | `/pipeline/tasks {task_type:'analyze'}` | 新增兼容适配层：`POST /api/notes/generate` 内部转发到 pipeline |
| `task_id` | `task_id` | 保持一致 ✓ |
| `task_status.json` | `TaskStore` 内存态 + SSE 推送 | 前端只认 REST 响应形态，屏蔽差异 |
| `VideoRequest.platform` | `project.platform`（弱化） | 前端保留 platform 字段，后端默认从 URL 自动识别 |
| `TaskStatus.SAVING/FORMATTING` | VidMirror 无此细分 | 前端合并为 `FINALIZING`；映射层把 `SAVING/FORMATTING` → `FINALIZING` |
| `screenshot`（笔记里插截图） | `video_understanding`（视觉分析） | 保持独立，前端新增两个 switch |

---

## 3. 重写建议路线图

1. **Phase A：骨架复刻**（1-2 周）
   - 创建 `frontend/` 目录，`npm create vite@latest` → React + TS
   - 按 BiliNote 的 `package.json` 安装全部依赖（锁定相同大版本）
   - 复刻 `index.html` / `main.tsx` / `App.tsx` / 路由结构
   - 复刻 `HomeLayout` / `SettingLayout` / 顶部栏
   - Shadcn 原子组件用 `npx shadcn@latest add` 全装

2. **Phase B：核心业务组件**（2-3 周）
   - `NoteForm` + `NoteHistory` + `StepBar` + `MarkdownViewer` + `MarkmapComponent`
   - `taskStore` / `configStore` / `modelStore` / `providerStore`
   - `useTaskPolling`
   - 后端新增 `POST /api/notes/generate` + `GET /api/notes/tasks/{id}/status` 兼容层
     （已有雏形：`backend/app/routes/notes.py`）

3. **Phase C：VidMirror 差量功能**（2 周）
   - `ProjectSwitcher`（侧栏顶部）
   - `AnalyzeView` / `StoryboardPanel`（右侧主区按 `task.type` 路由）
   - 视觉分析高级选项面板（接入 `video_understanding/video_interval/grid_size`）
   - 可选：`useTaskStream`（SSE）替代轮询

4. **Phase D：设置页 & 收尾**（1 周）
   - 迁移 `SettingPage/model|provider|transcription|screenshot|about`
   - i18next（先只 zh-CN）
   - 主题切换
   - QA + e2e

---

## 4. 风险与提醒

- **Tailwind 4 与 Tailwind 3 不兼容**：主题配置方式不同（CSS `@theme` 而非 `tailwind.config.js`），复制 BiliNote 的 `App.css` / `index.css` 时要整段搬。
- **React 19 + React Router 7**：部分第三方库对 React 19 兼容度一般；`react-markdown` 需确保 ≥9.0.0。
- **Shadcn new-york 风格**：`components.json` 里 `"style": "new-york"` 决定了 Button 的圆角与间距；初始化时要指定一致。
- **后端兼容层**：BiliNote 的 `POST /api/generate_note` 响应结构 `{code,msg,data}` 与 VidMirror `/pipeline/tasks` 的裸 JSON 不一致，前端必须走统一 axios 拦截器，建议在后端新增兼容路由而非改动前端每次调用。
- **markmap-lib 打包体积**：约 200KB gzip，按需动态 `import()`。
- **SSE vs 轮询**：BiliNote 纯轮询最简单；如果要享受 VidMirror 已有的 SSE，抽象成 `useTaskStream` hook，内部同时处理 SSE 失败降级到轮询。
- **任务 ID 语义**：BiliNote 的 `task_id` 是 UUID 字符串；VidMirror `TaskRecord.task_id` 格式待确认（若不同需在兼容层内做转换）。

---

## 5. 代码引用速查

| 场景 | BiliNote 文件 | 行号锚点 |
| --- | --- | --- |
| 路由表 | `src/App.tsx` | `createBrowserRouter([...])` |
| 轮询实现 | `src/hooks/useTaskPolling.ts` | 全文 |
| 任务状态机 | `backend/app/enmus/task_status_enums.py` | 1-30 |
| 请求体 | `backend/app/routers/note.py` | 37-64 |
| 后端轮询响应 | `backend/app/routers/note.py` | 162-219 |
| 状态切换点 | `backend/app/services/note.py` | 123 / 141 / 154 / 471 |
| 图片防盗链代理 | `backend/app/routers/note.py` | 222-246 |
| Shadcn 配置 | `BillNote_frontend/components.json` | 全文 |
| Vite 别名 | `BillNote_frontend/vite.config.ts` | `alias: {'@': ...}` |

| 场景 | VidMirror 对应 |
| --- | --- |
| 后端入口 | `backend/app/main.py` |
| 管道任务 API | `backend/app/routes/pipeline.py` |
| 笔记 API 雏形 | `backend/app/routes/notes.py` |
| 任务状态机 | `backend/app/models/tasks.py:14-45` |
| 侧栏导航（当前 Streamlit） | `src/vidmirror/ui/sidebar.py` |
| 三视图渲染 | `app.py:91-98` |
| 项目多开 | `shared/project_store.py` + `app.py:78-87` |

