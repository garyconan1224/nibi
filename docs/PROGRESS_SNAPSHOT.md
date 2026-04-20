# VidMirror 前端复刻进度快照

> 生成时间：2026-04-20
> 参考蓝本：`BILINOTE_ARCHITECTURE_GAPS.md §3` 路线图（Phase A/B/C/D）
> 当前分支：`main`（HEAD `26aa81d`）

---

## 1. 已完成

### Phase A — 骨架复刻（全部完成 ✅）

| 子任务 | 状态 | Commit / 文件 |
|--------|------|--------------|
| A.1 BiliNote 架构调研文档 | ✅ | `47b3006` / `docs/BILINOTE_ARCHITECTURE*.md` |
| A.2 BiliNote 兼容适配层 | ✅ | `b1a0aff` / `backend/app/routes/notes.py` |
| A.3 Vite + React 19 + Tailwind 4 + Shadcn 脚手架 | ✅ | `a38d97a`（tag `v0.4.0`）|
| A.4+A.5 全局样式 + 路由骨架 + 布局壳 | ✅ | `306ca72` / `src/App.tsx`、`layouts/` |
| A.6 Axios client + 后端健康检查 | ✅ | `08de7e9` / `src/services/client.ts`、`hooks/useBackendHealth.ts` |

### Phase B — 核心业务组件（全部完成 ✅，但细节有减量，见 §4）

| 子任务 | 状态 | Commit / 文件 |
|--------|------|--------------|
| B.1 TaskType / Zustand store / 轮询 Hook 定义 | ✅ | `2d31387` / `store/taskStore.ts`、`types/task.ts` |
| B.2 NoteForm（URL 输入 + 提交） | ✅（精简版）| `ca9bcd3`（tag `v0.5.1`）/ `pages/HomePage/NoteForm.tsx` |
| B.3 TaskDashboard（任务历史列表） | ✅ | 同上 / `pages/HomePage/TaskDashboard.tsx` |
| B.4 ProcessingStepper（步进条，对应 BiliNote StepBar） | ✅ | 同上 / `pages/HomePage/ProcessingStepper.tsx` |
| B.5 MarkdownViewer（Markdown 渲染） | ✅（精简版）| 同上 / `pages/HomePage/MarkdownViewer.tsx` |
| B.6 TaskItem（任务卡片）| ✅ | `PHASE_B_6_7_FINAL_SUMMARY.md` / `pages/HomePage/TaskItem.tsx` |
| B.7 TaskLogViewer（SSE 实时日志）| ✅ | 同上 / `pages/HomePage/TaskLogViewer.tsx` |
| usePipelineTasks 轮询 Hook | ✅ | `hooks/usePipelineTasks.ts` |

### Phase C — 后端接入（大部分完成）

| 子任务 | 状态 | Commit / 文件 |
|--------|------|--------------|
| C.1 三栏可拖拽布局修复 | ✅ | `1fbdbf0`、`7ca77ba`、`ca48b1e` / `layouts/HomeLayout.tsx` |
| C.2 NoteForm 接入 POST /pipeline/tasks | ✅ | `b5ace6c`、`7bb5873` / `services/pipeline.ts` |
| C.3 轮询恒返回空列表问题修复 | ✅ | `58113f9` / `store/taskStore.ts`（setTasks 防御逻辑）|
| C.4 download SUCCESS 显示完成卡片 | ✅ | `edb85d2` / `MarkdownViewer.tsx` |
| C.5 设置页——提供商管理 + 关于页 | ✅ | `7e42888`、`26aa81d` / `pages/SettingPage/` |
| C.6 CORS + 后端健康检测修复 | ✅ | `38ac153`、`1ee07e4`、`3006717` |

### Phase D — 设置页（部分完成）

| 子任务 | 状态 | Commit / 文件 |
|--------|------|--------------|
| 提供商管理页（列表/编辑/新增/测试连接）| ✅ | `26aa81d` / `ProvidersManagementPage.tsx` |
| 关于页（静态展示）| ✅ | `7e42888` / `AboutPage.tsx` |

---

## 2. 进行中

**当前工作分支**：`main`

**未提交改动（git status）**：

| 文件 | 类型 | 描述 |
|------|------|------|
| `frontend/src/pages/SettingPage/ProvidersManagementPage.tsx` | modified | 提供商编辑表单仍在调整中 |
| `backend/app/main.py` | modified | 后端入口有改动，内容待确认 |
| `backend/app/routes/providers.py` | modified | 提供商 API 路由有改动 |
| `requirements.txt` | modified | 依赖变动 |
| `data/cookies/www.bilibili.com_cookies.txt` | modified | Cookie 更新（非代码）|

**未追踪文件（游离在 git 外）**：`BROWSER_VERIFICATION_CHECKLIST.md`、`FINAL_VERIFICATION_REPORT.md`、`VERIFICATION_SUMMARY.md`、`token-thrift-refactor.skill`、`verify-fix.js`（均为验证/调试产物）

---

## 3. 未开始

### Phase B 遗留减量项（优先级 🔴 高）

| 子任务 | 说明 |
|--------|------|
| NoteForm 模型/提供商二级下拉 | 缺失：当前只有 URL 输入框，无 Provider→Model 选择器 |
| NoteForm quality/format/style 控件 | 缺失：fast/medium/slow 单选、format 多选、style 单选 |
| NoteForm 高级选项折叠面板 | 缺失：screenshot/link/video_understanding/extras 等 |
| MarkdownViewer Tabs | 缺失：笔记/思维导图/字幕/元信息 四个 Tab |
| MarkmapComponent（思维导图）| 缺失：markmap 库已安装（package.json），组件未创建 |
| transcriptViewer（字幕展示）| 缺失 |
| MarkdownViewer 导出工具条 | 缺失：复制 MD / 导出 PDF / 导出图片 |
| configStore / modelStore / providerStore | 缺失：当前只有 taskStore，无其他三个 store |
| zustand persist 持久化 | 缺失：taskStore 无 localStorage 持久化 |

### Phase C 未开始项（优先级 🟡 中）

| 子任务 | 说明 |
|--------|------|
| ProjectSwitcher 组件 | VidMirror 特有，左栏顶部项目切换 |
| AnalyzeView / StoryboardPanel | 右侧主区按 task.type 路由切换 |
| useTaskStream（SSE 替代轮询）| 可选升级，TaskLogViewer 已部分实现 SSE |
| 任务取消按钮 | TaskItem 卡片缺「取消」操作 |

### Phase D 未开始项（优先级 🟡 中）

| 子任务 | 说明 |
|--------|------|
| 模型管理页（model/）| SettingLayout 菜单缺此项 |
| 转录设置页（transcription/）| ASR 后端切换 UI |
| 截图设置页（screenshot/）| 截图风格、宽度、水印配置 |
| 主题切换（ThemeSwitcher）| next-themes 已安装，未集成到 UI |
| 国际化（LangSwitcher + i18next）| i18next 已安装，未集成；无 locals/ 目录 |
| QA + e2e | 测试覆盖 |

---

## 4. 与 BiliNote 的偏差

| 偏差点 | BiliNote 约定 | VidMirror 当前实现 | 风险 |
|--------|-------------|-------------------|------|
| **路由 API** | `createBrowserRouter`（v7 Data Router） | `BrowserRouter + Routes`（v6 组件式） | 低——功能等价，但未来 loader/action 无法使用 |
| **三栏布局语义** | 左=历史、中=表单、右=笔记预览 | 左=表单、中=任务中心、右=Markdown | 中——布局逻辑反转，影响用户心智模型 |
| **NoteForm 功能** | 完整：URL + 模型 + quality + format + style + 高级选项 | 精简：仅 URL 输入框 | 🔴 高——核心交互缺失 |
| **MarkdownViewer** | 4 Tabs：笔记/思维导图/字幕/元信息 | 单页：无 Tab，无 Markmap | 🔴 高——核心展示缺失 |
| **Store 数量** | 4 个（task/config/model/provider） | 1 个（taskStore，无持久化）| 🔴 高——配置无法持久 |
| **react-markdown 版本** | 架构文档要求 ≥9.0.0 | 当前安装 `^8.0.7` | 🟡 中——rehype-raw 与 v8 可能兼容性问题 |
| **ProvidersManagementPage 请求客户端** | 统一 axios（`http` 实例）| 裸 `fetch`（bypass axios 拦截器）| 🟡 中——错误 toast 机制不统一 |
| **设置菜单项数** | 5 项（model/provider/transcription/screenshot/about） | 2 项（providers/about） | 🟡 中 |
| **@lobehub/icons（AI 品牌图标）** | 已安装，用于模型选择器 | package.json 中未安装 | 低——仅影响视觉还原度 |
| **ThemeSwitcher / LangSwitcher** | 集成到 HomeLayout 顶部栏 | 依赖已装（next-themes/i18next），组件未创建，未集成 | 低 |

---

## 5. 下一步建议（最小可演示版本优先）

### 子任务 1 — 补全 NoteForm（优先级：🔴 最高）

**目标**：让用户能选择模型和提供商、调整输出质量/格式，使核心流程可端到端演示。

**具体工作**：
1. 实现 `modelStore` + `providerStore`（可先用本地硬编码，后接 `/providers` API）
2. 在 NoteForm 中加入 Provider → Model 二级下拉
3. 加入 quality（fast/medium/slow）单选和 format 多选
4. 提交 payload 从 `task_type: 'download'` 改为支持 `analyze`

**验收标准**：表单提交后，后端能接收到带 model_name/provider_id 的 analyze 任务。

---

### 子任务 2 — 补全 MarkdownViewer Tabs + Markmap（优先级：🔴 高）

**目标**：analyze 任务完成后，右栏能展示带格式的笔记和思维导图，实现"最小可演示版本"。

**具体工作**：
1. 将 MarkdownViewer 改为 Tabs 结构（笔记 / 思维导图 / 元信息）
2. 新建 `MarkmapComponent`（`markmap-lib` + `markmap-view`，已在 package.json 中）
3. 添加复制 MD 工具按钮

**验收标准**：SUCCESS 的 analyze 任务右栏展示 Markdown 笔记 + 思维导图 Tab 可切换。

---

### 子任务 3 — zustand persist + configStore（优先级：🟡 中）

**目标**：用户刷新页面后任务历史和偏好设置不丢失。

**具体工作**：
1. 给 `taskStore` 加 `persist` middleware（key: `task-storage`）
2. 新建 `configStore`（默认 model/provider/quality/format 等偏好）
3. NoteForm 从 configStore 读取默认值

**验收标准**：刷新页面后，已提交的任务列表和上次选择的模型配置仍然存在。

