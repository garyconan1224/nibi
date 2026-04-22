# BiliNote 设置页 1:1 功能复刻与差异化 UI 重构计划

> **阶段 0 / 1 已交付**（2026-04-22）：差异清单、R1–R5 风险确认、冻结后的 Store/API 契约表、UI/UX 设计定稿见 [`docs/DESIGN_NOTES_SETTINGS.md`](./DESIGN_NOTES_SETTINGS.md)。本文档自阶段 2 起进入实现阶段；本文 §1.3 / §3.9 中与实测不符的条目（如 R1 `DELETE /providers/{id}` 已存在、R2 SSE 已非阻塞、`/transcriber_config` 在活跃后端未实现）以设计说明为准。
>
> 作用域：**仅 Settings 页**。目标是在 **State / API / 持久化** 层做到与 BiliNote 风格实现 1:1 对齐，同时在 **布局 / 视觉 / 交互** 层重新设计，使成品呈现为“同类产品”而非“视觉克隆”。
>
> 参考基线：本仓库 `frontend/src/pages/SettingPage/*`（已部分复刻 BiliNote 结构）+ `backend/app/routes/providers.py` + `shared/settings_store.py` + `docs/OUTSTANDING_TASKS.md` 中“Phase D 设置页仅 2/5 完成”。
>
> 技术栈基线（不变动）：React 19 + Vite 6 + TypeScript、React Router v7、Zustand + `persist`、axios、`shadcn/ui`（Radix + Tailwind）、`sonner`、`react-i18next`、`lucide-react`、`@lobehub/icons`。

---

## 0. 执行摘要（TL;DR）

| 模块 | 现状 | 复刻对象（逻辑层） | 差异化 UI 重构重点 |
| --- | --- | --- | --- |
| AI 模型设置 | `ProvidersManagementPage` + `ModelManagementPage` 已就绪 | API Key 管理、Provider CRUD、模型发现、连接测试、默认双模型绑定 | 两页合并为“单页分栏 + 抽屉编辑”；新增“默认文本/视觉模型”徽章 |
| 音频转写配置 | `TranscriberPage` 基本就绪 | 引擎选择 / Whisper 尺寸 / 语言 / 设备 / Groq Key + 后端 `/transcriber_config` | 改为“引擎卡片选择器”（纵向 Tabs→ 卡片组），动态表单分区 |
| 下载配置 | 散落在 `NetworkSettingsPage`（代理 + PO Token + Cookie 目录）+ `configStore.downloadMode` | 代理、PO Token、Visitor Data、Cookie 目录、下载模式、并发 | 新建独立「下载配置」页，增加“命名模板 / 并发上限 / 存储路径”字段 |
| 部署监控 | **缺失**，仅 `useBackendHealth`（一次性 `/health`） | 后端在线检测、任务中心状态、日志流、系统资源 | 新建「部署监控」页；复用 SSE/WebSocket（`/pipeline/tasks/{id}/events`） |
| 关于页面 | `AboutPage` 骨架就绪 | 版本号、项目名、简介 | 增加版本校验（GitHub release 对比）、依赖声明、日志导出入口 |

> 规划 3 阶段执行：**① 数据流分析与契约冻结 → ② UI 框架差异化设计 → ③ 分模块实现与接入**。

---

## 1. 第一阶段：数据流与组件结构深度分析

### 1.1 路由与布局拓扑

路由定义位于 `frontend/src/router.tsx`：

```
/settings                         → SettingLayout（shell）
├── /providers                    → ProvidersManagementPage
├── /models                       → ModelManagementPage
├── /network                      → NetworkSettingsPage（当前承载下载相关）
├── /transcriber                  → TranscriberPage
├── /screenshot                   → ScreenshotPage（本次计划不改动）
└── /about                        → AboutPage
```

`SettingLayout` 结构：顶部 Header（Logo + LangSwitcher + 返回首页）+ 左侧 250px 菜单 + 右侧 `<Outlet />`。**这是被差异化重构的首要对象**（见 §2.2）。

### 1.2 状态管理拓扑

| Store | 文件 | 持久化 | 关键字段（对 Settings 相关） |
| --- | --- | --- | --- |
| `useConfigStore` | `store/configStore.ts` | `persist`（`name: 'config-storage'`） | `httpProxy` / `poToken` / `visitorData` / `cookieBaseDirs` / `downloadMode` / `transcriber{type, whisperModelSize, language, device, groqApiKey}` / `screenshotSettings` / `textProviderId` / `textModelId` / `visionProviderId` / `videoModelId` |
| `useProviderStore` | `store/providerStore.ts` | `persist`（仅 `providers` + `providerModels`） | `providers[]` / `providerModels[id]` / `fetchProviders` / `addProvider` / `updateProvider` / `removeProvider` / `fetchProviderModels` |
| `useModelStore` | `store/modelStore.ts` | 待核对 | 模型选择缓存（与 Home 页共享） |

**数据流范式**（BiliNote 风格，必须 1:1 保留）：

1. 页面组件维护 **本地草稿 state**（form drafts），避免键入即持久化；
2. 显式“保存”按钮触发 `http.put/post`；
3. 成功后调用 `configStore.setConfig({...})` 或 `providerStore.updateProvider(...)` 同步全局；
4. `sonner` 的 `toast.success/error` 统一反馈；
5. 全局错误 Banner + 内联错误双层呈现；错误文案来自 `i18n`（`settings.json` / `providers.json` / `common.json`）。

### 1.3 API 契约清单（复刻边界）

| 端点 | 方法 | 用途 | 调用方 |
| --- | --- | --- | --- |
| `/providers` | GET/POST | 列表 / 新增 | Providers + Models 页 |
| `/providers/{id}` | GET/PUT/DELETE | 详情 / 更新 / 删除 | Providers 页（`DELETE` 当前后端缺，见 §5.3 风险） |
| `/providers/{id}/models` | GET | 从上游 `{base_url}/models` 拉取 | Models 页 |
| `/providers/test` | POST | 连接测试（body: `{provider_id}`） | Providers 页 |
| `/transcriber_config` | GET/POST | 读/写 ASR 配置 | Transcriber 页 |
| `/screenshot_config` | GET/POST | 读/写截图配置 | Screenshot 页（本次不动） |
| `/health` | GET | 健康检查 | `useBackendHealth` + 新「部署监控」页 |
| `/pipeline/tasks` | GET | 任务清单 | 新「部署监控」页 |
| `/pipeline/tasks/{id}/events` | SSE | 任务日志流 | 新「部署监控」页 |
| `/pipeline/tasks/{id}/ws` | WS | 任务日志流（备选） | 新「部署监控」页 |

> 响应契约统一：axios 拦截器（`services/client.ts`）默认兼容 `{code, msg, data}` 与裸对象；`code !== 0` 时 reject。**新增模块必须走 `http.*`，禁止裸 `fetch`**（对齐 `OUTSTANDING_TASKS` 一致性要求）。

### 1.4 五大模块逻辑拆解

#### 1.4.1 AI 模型设置（Providers + Models）

- **字段契约**（后端 `ProviderProfile` @ `shared/settings_store.py`）：`id / name / kind(openai_compatible|anthropic|...) / enabled / api_key / base_url / capabilities / default_models / rate_limit_rpm / timeout_sec`。
- **列表接口**透出的是 `has_api_key: bool`（不回传明文 key）；更新时 `api_key` 为空串=不修改。
- **BiliNote 交互范式**（`ProvidersManagementPage.tsx`）：
  - 列表行 `Card` → 点击折叠切换；详情首次展开 **懒加载** `/providers/{id}`；
  - 编辑态维护 `drafts[id]: {api_key, base_url, enabled, name}`；保存成功后清空 `api_key` 输入、保留展开态、同步列表项；
  - 连接测试：`POST /providers/test { provider_id }`，结果以行内 ✓/✗ + `toast` 双通道展示；
  - 新增 Provider：`Dialog`，`kind` 枚举 `openai_compatible | anthropic`，图标来自 `@lobehub/icons` 单色版（Mono 最深子路径 import，避免 barrel 引入 `antd-style`）。
- **模型发现**（`ModelManagementPage.tsx`）：展开提供商时懒加载 `/providers/{id}/models`，按 Provider 分组；支持单个 Provider 的手动刷新按钮（`refreshModels`）。
- **默认双模型绑定**（来自 `configStore`）：`textProviderId / textModelId / visionProviderId / videoModelId` — 目前在 Home 页设置，**复刻计划中需在 Models 页上沉淀“设为默认文本/视觉模型”的快捷操作**。

#### 1.4.2 音频转写配置

- **字段契约**（`configStore.TranscriberConfig`）：`type: 'fast-whisper' | 'bcut' | 'kuaishou' | 'groq' | 'mlx-whisper'`、`whisperModelSize: tiny|base|small|medium|large-v3|large-v3-turbo`、`language`（zh/en/ja/ko/auto）、`device`（cpu/cuda/mps）、`groqApiKey`。
- **后端联动**：`services/transcriber.ts` 只将 `type` 和 `whisper_model_size` 同步到 `/transcriber_config`（POST）；其余字段仅落 `configStore`（localStorage）。**这是一个现存的逻辑不对齐点**，计划中需确认是否扩展后端接口，或显式在 UI 标注“仅前端生效”。
- **条件渲染**：`type === 'fast-whisper'` 时显示模型大小；`type === 'groq'` 时显示 API Key 字段；其他引擎只保留语言 + 设备。
- **提示词设置**：BiliNote 原生有 ASR 前置提示词（`initial_prompt`）；当前仓库 **未暴露**，本次计划补齐（配合 `backend/app/services/asr_fast_whisper.py` 的 `initial_prompt` 参数）。

#### 1.4.3 下载配置

当前逻辑分散在 3 处，需在复刻时 **聚合为独立「下载配置」页**：

- `NetworkSettingsPage`：`httpProxy / poToken / visitorData / cookieBaseDirs`（落 `configStore`，无后端端点）；
- `configStore.downloadMode`: `'balanced' | 'speed' | 'quality' | 'audio'`（目前仅在 Home 的下载表单里消费）；
- `shared/video_download_ytdlp.py` 消费上述字段构造 `yt-dlp` 参数；Cookie 目录默认 `data/cookies/`，兼容 `1/YouTubeDownloader/`。
- **复刻需补齐字段**（对标同类产品，后端需同步）：
  - `concurrency_limit: int`（并发上限，默认 2）；
  - `output_dir: str`（存储路径自定义，默认 `data/videos/`）；
  - `filename_template: str`（文件命名，默认 `%(title)s-%(id)s.%(ext)s`）；
  - `retry_count / socket_timeout`（可选，高级折叠）。

#### 1.4.4 部署监控（**新增模块**）

当前无对应页面，唯一入口是 `hooks/useBackendHealth.ts` 的一次性 `/health` 检查。复刻目标是落地一个运维面板：

- **服务状态**：每 5s 轮询 `/health`；展示绿色/红色状态灯 + 最近 N 次探测延迟折线（轻量 sparkline）。
- **任务中心**：`GET /pipeline/tasks` 列出；按 `status`（pending/running/success/failed）分组计数。
- **日志流**：点击任一任务 → 打开抽屉，订阅 SSE `/pipeline/tasks/{id}/events`（`services/pipeline.ts` 已有同步能力，需扩展 EventSource 封装）；自动滚动 + 暂停 + 清屏 + 下载 `.log`。
- **系统资源**：后端 **新增** `/admin/system/stats` 返回 `{cpu_percent, mem_percent, disk_percent, gpu?}`（`psutil`），页面以卡片 + 进度条展示；该端点为 **新增项**，详见 §5.1。

#### 1.4.5 关于页面

- 现有字段来源：`settings.json` → `about.{title,subtitle,appName,appDescription,version,versionNumber,projectName,appSummary}`。
- **复刻需补齐**：
  - **版本校验**：前端 `versionNumber` vs GitHub Release（`https://api.github.com/repos/<owner>/<repo>/releases/latest`）比对，显示“已是最新 / 发现新版本 vX.Y.Z”；失败静默降级。
  - **依赖声明**：分区展示 `package.json` 与 `requirements.txt` 的核心依赖；构建期通过 Vite 插件或 `import.meta.glob` 注入只读清单（避免运行期 IO）。
  - **其他**：后端版本（`/health` 扩展返回 `version`）、构建时间（`import.meta.env.VITE_BUILD_TIME`）、License、GitHub / 文档 / Issue 外链。

### 1.5 持久化与一致性约束

| 层 | 介质 | 写入时机 | 注意 |
| --- | --- | --- | --- |
| 前端偏好 | `localStorage`（zustand `persist`） | 保存按钮点击 | 勿每次 keypress 写；key 名冻结为 `config-storage` / `provider-storage` |
| 服务端配置 | `shared/settings_store.py` → JSON（`data/json_data/settings.json`） | POST/PUT 端点 | API Key **不回传明文**；写入时以 `has_api_key` 标识 |
| 敏感凭据 | 同上；未加密 | — | 本次计划不引入加密，但 UI 需在 API Key 字段使用 `type="password"` + `autoComplete="new-password"` |

---

## 2. 第二阶段：UI/UX 差异化重构方案

### 2.1 设计原则（避免“视觉克隆”）

1. **功能对标，形态差异**：所有字段、校验、交互路径与 BiliNote 风格保持 1:1；但组件组合、层次结构、色彩系统完全重构。
2. **信息密度分级**：高频（Providers / Models / 下载）使用高密度双栏；低频（关于 / 部署监控）使用宽松卡片流。
3. **状态可见性**：任一模块都必须有“未保存草稿”视觉标记（顶部固定 sticky bar + 字段级 `dot` 指示）。
4. **可逆性**：所有编辑支持“撤销到已保存值”；对 Providers 的 `enabled` 切换给出 `toast` + 撤销操作。

### 2.2 布局骨架重构

| 维度 | 现状（BiliNote 风） | 差异化新方案 |
| --- | --- | --- |
| 菜单位置 | 左侧垂直 250px 列表 | **顶部 Tab 条 + 右侧内容 + 页内锚点次级导航**；窄屏折叠为抽屉 |
| Shell | `SettingLayout` Header + Sidebar + Outlet | `SettingsShell`：顶部面包屑 + 居中 Tab + 右侧 `<Save/Reset/ExportConfig>` 粘性操作区 |
| 页面容器 | `max-w-3xl` 单列 | 统一 **12 栅格**：`content` 跨 8 列、`aside`（模块内锚点 + 相关链接）跨 4 列 |
| Card | `shadcn` `Card` + `CardHeader/Content` | 沿用，但引入 **“Section”** 组件：带左侧竖线 + Icon + 可折叠 |
| 空状态 | 虚线边框文案 | **插画式** 空状态（`assets/empty/*.svg`），保留虚线作为次级 fallback |

### 2.3 视觉语言体系

- **色板**：主色由现状的 `slate-*` 灰阶切换为 **`zinc` 中性 + 单点强调色**（建议 `violet-500` 或 `teal-500`）；启用/禁用徽章保留语义色（绿/灰），但改为“点 + 文字”而非 pill。
- **字体**：页面标题由 `text-2xl` 升到 `text-[28px]` 且 `tracking-tight`；正文改 14px；等宽字段（Token / Cookie 目录）继续使用 `font-mono`。
- **圆角与阴影**：Card 由 `rounded-lg` 改为 `rounded-2xl` + 双层阴影（`shadow-sm` hover→`shadow-md`）；输入框同步 `rounded-xl`。
- **图标**：保留 `lucide-react`；Provider 品牌标使用 `@lobehub/icons` 单色版（已踩坑点：**必须** 从 `es/<Brand>/components/Mono` 最深子路径 import，不得走 barrel）。

### 2.4 交互模式重构（核心“去克隆”手法）

| 模块 | BiliNote 风 | 差异化方案 |
| --- | --- | --- |
| Providers | 整卡展开的 Accordion | **左侧列表 + 右侧详情双栏**（Master-Detail）；删除走 `AlertDialog` 二次确认；新增由右侧空态 CTA 触发而非顶部按钮 |
| Models | 展开式列表 | **网格卡片 + 顶部搜索 + `capability` 过滤芯片**；双模型默认绑定用 ⭐ 徽章 |
| Transcriber | 单卡单列 Select | **引擎卡片选择器**（5 个引擎以卡片呈现，点击切换）；动态子表单在下方折叠展开，带左竖线 |
| 下载配置 | 零散在 Network 页 | **独立页 + 两个 Section**：① 存储与命名 ② 网络与凭据；并发/重试作为 Slider |
| 部署监控 | 无 | **Grid Dashboard**：4 个指标卡（后端/任务/CPU/内存）+ 任务表格 + 日志抽屉 |
| 关于 | 纯文字 Card | **Hero 区 + 元数据栅格 + 依赖 Accordion**；版本徽章带“检查更新”按钮 |

### 2.5 通用组件增量（新增到 `components/ui/`）

- `SettingsShell.tsx`：顶部 Tab + 粘性 SaveBar（消费 `useDirtyGuard`）；
- `Section.tsx`：竖线 + Icon + 标题 + 可选折叠；
- `FieldRow.tsx`：统一 `Label | Control | Hint | Error` 四栏栅格；
- `DirtyDot.tsx`：未保存圆点（脏数据视觉提示）；
- `StatCard.tsx`：部署监控页的指标卡（`title / value / delta / trend`）；
- `LogConsole.tsx`：虚拟滚动 + 行着色 + 搜索 + 暂停 + 导出（基于 `react-window`，已在依赖中或按需 `pnpm add`）；
- `EmptyState.tsx`：插画 + 主副标题 + CTA。

> 仅当 `components/ui/` 中无现成实现时新增；Radix 基础组件（Dialog / Select / Switch / Tooltip / Tabs）继续复用。

---

## 3. 第三阶段：功能实现路径（可同步到 tasks）

> 本节以 **任务清单格式** 组织，可直接拷贝进 `docs/OUTSTANDING_TASKS.md` 或任务管理器。每条 `- [ ]` 任务都标注 **优先级（P0/P1/P2）**、**模块**、**预计工时（0.5d/1d/2d）**、**影响文件**。

### 3.1 M0 — 基础设施与通用组件（先行，阻塞后续）

- [ ] **P0 · 通用 · 1d** 新建 `SettingsShell`：顶部 Tab + 粘性 SaveBar + DirtyGuard（`layouts/SettingLayout.tsx` 重构）
- [ ] **P0 · 通用 · 0.5d** 新建 `Section / FieldRow / DirtyDot / EmptyState`：`components/ui/section.tsx` 等
- [ ] **P0 · 通用 · 0.5d** 新建 `useDirtyGuard` hook：监听 `beforeunload` + React Router `useBlocker`，已脏时弹确认
- [ ] **P1 · 通用 · 0.5d** 统一 `sonner` toast 语义（success/error/info），替换散落的字面量
- [ ] **P1 · 通用 · 0.5d** 路由调整：`/settings/network` → 拆分为 `/settings/download` 与（可选）`/settings/network-advanced`；保留 301-like redirect

### 3.2 M1 — AI 模型设置（Providers + Models 合并视图）

- [ ] **P0 · Providers · 1d** 改造为 Master-Detail：左列表 + 右详情；复用现有 `drafts / detailCache / testResult` state 机
- [ ] **P0 · Providers · 0.5d** 新增「删除 Provider」UI + 后端 `DELETE /providers/{id}`（阻塞项，见 `OUTSTANDING_TASKS` §2.1-2.2）
- [ ] **P0 · Models · 1d** 网格卡片 + 搜索 + capability 过滤；懒加载策略保持 1:1
- [ ] **P1 · Models · 0.5d** 「设为默认文本/视觉模型」按钮：写入 `configStore.textProviderId/textModelId/visionProviderId/videoModelId`
- [ ] **P1 · Providers · 0.5d** 迁移 `ProvidersManagementPage` 中的裸 `fetch`（若仍存在）至 `http.*`
- [ ] **P2 · Providers · 0.5d** 新增 kind 枚举扩展（`siliconflow` / `ollama`）时的图标映射占位

### 3.3 M2 — 音频转写配置

- [ ] **P0 · Transcriber · 0.5d** 引擎卡片选择器（替换 Select）；移植现有条件渲染
- [ ] **P0 · Transcriber · 0.5d** 新增 `initial_prompt` 字段（UI + `configStore.transcriber.initialPrompt`）
- [ ] **P0 · Backend · 0.5d** 扩展 `POST /transcriber_config` 接收 `language / device / groq_api_key / initial_prompt`；持久化到 `settings_store`
- [ ] **P1 · Transcriber · 0.5d** 显式标注“本地/在线”胶囊，并对在线引擎（bcut/kuaishou/groq）增加 ToS 提示
- [ ] **P1 · Transcriber · 0.5d** `mlx-whisper` 引擎仅在 `navigator.platform.includes('Mac')` 或后端 `mlx_whisper_available: true` 时可选

### 3.4 M3 — 下载配置（独立新页）

- [ ] **P0 · Download · 1d** 新建 `DownloadSettingsPage.tsx`；从 `NetworkSettingsPage` 迁出下载相关字段
- [ ] **P0 · Download · 0.5d** 新增 `output_dir / filename_template / concurrency_limit / retry_count` 到 `configStore`
- [ ] **P0 · Backend · 1d** `shared/video_download_ytdlp.py` 消费上述新字段；补充单测
- [ ] **P1 · Download · 0.5d** 存储路径选择：优先走 Tauri/electron API；Web 环境降级为纯文本输入 + 校验
- [ ] **P1 · Download · 0.5d** 文件命名模板内置 4 个预设 + 实时预览
- [ ] **P2 · Download · 0.5d** 下载协议处理的只读矩阵（HTTP/HTTPS/HLS/DASH 支持情况）作为信息卡展示

### 3.5 M4 — 部署监控（新建）

- [ ] **P0 · Backend · 1d** 新增 `GET /admin/system/stats`（`psutil`）；`requirements.txt` 加入 `psutil`
- [ ] **P0 · Backend · 0.5d** `/health` 扩展返回 `{status, version, uptime_sec}`
- [ ] **P0 · Monitor · 1d** 新建 `DeployMonitorPage.tsx`：`StatCard` x4 + 任务表格
- [ ] **P0 · Monitor · 0.5d** `useHealthPulse`（每 5s 轮询 `/health`，保留最近 60 个数据点）替换/扩展 `useBackendHealth`
- [ ] **P0 · Monitor · 1d** `LogConsole` 组件 + SSE 订阅封装（`services/events.ts`）
- [ ] **P1 · Monitor · 0.5d** 任务表格支持状态过滤、重试（调用现有 pipeline API）
- [ ] **P2 · Monitor · 0.5d** 失败告警：连续 N 次 `/health` 失败触发 `toast` + 顶部红条

### 3.6 M5 — 关于页面

- [ ] **P0 · About · 0.5d** Hero 重构 + 元数据栅格（前端版本 / 后端版本 / 构建时间 / License）
- [ ] **P1 · About · 0.5d** `useLatestRelease` hook：比对 GitHub API；静默降级；缓存 1h（`sessionStorage`）
- [ ] **P1 · About · 0.5d** 依赖声明：Vite 构建期注入 `package.json.dependencies` 白名单子集；后端依赖通过 `/admin/deps` 或预生成 JSON
- [ ] **P2 · About · 0.5d** 日志/配置导出入口（调用 `/admin/system/stats` + 前端 `configStore` 合并为 `.zip`）

### 3.7 M6 — 回归与质量

- [ ] **P0 · Test · 1d** 单测：`configStore` setConfig 分片、`providerStore` fetch/update/remove、`useDirtyGuard`
- [ ] **P0 · Test · 1d** 组件测试：`SettingsShell` Tab 切换 + Dirty 守卫；`LogConsole` SSE mock
- [ ] **P1 · Test · 0.5d** i18n 覆盖核查：新增键必须同时存在 `zh-CN` 与 `en-US`
- [ ] **P1 · E2E · 1d** 扩展 `tests/e2e_qa.py` 的 Settings 流：Providers CRUD + Transcriber 保存 + Monitor 渲染
- [ ] **P2 · Perf · 0.5d** 懒加载审计：确认 `router.tsx` 中所有新页面 `lazy()`

### 3.8 技术选型确认

| 需求 | 选型 | 理由 |
| --- | --- | --- |
| 表单管理 | 保持当前 **受控 state + 显式保存**；不引入 RHF | 与现有实现一致，避免大范围重写；DirtyGuard 自行实现 |
| 校验 | 轻量 `zod` schema（可选） | 仅对 `filename_template / output_dir` 复杂校验启用 |
| SSE | 原生 `EventSource` + abort 包装 | 已在 `services/pipeline.ts` 存在类似模式，统一抽象到 `services/events.ts` |
| 图表 | 轻量 SVG sparkline（自写 20 行） | 避免引入 `recharts` 膨胀包体；后续需要时再评估 |
| 虚拟滚动 | `react-window`（日志行） | 仅日志控制台需要，单处引入 |

### 3.9 里程碑与风险

**里程碑**（建议两周节奏）：

1. W1 · D1–D2：M0 通用基座 + 路由调整（阻塞全部）
2. W1 · D3–D5：M1 AI 模型 + M2 转写（并行）
3. W2 · D1–D2：M3 下载配置（含后端字段）
4. W2 · D3–D4：M4 部署监控（含后端 `psutil`）
5. W2 · D5：M5 关于 + M6 回归

**风险与缓释**：

- **R1 · 后端缺 `DELETE /providers/{id}`**：阻塞 M1；先补后端再做前端，或暂用 `enabled=false` 逻辑软删除作为过渡。
- **R2 · SSE 同步 `time.sleep`**：`routes/pipeline.py` 已知阻塞 worker（见 `OUTSTANDING_TASKS` §2.2）；本计划的 Monitor 页接入前 **必须先修复**，否则高并发订阅会拖垮后端。
- **R3 · `@lobehub/icons` 间接拉入 `antd-style`**：任何新增 Provider 图标都必须走 `es/<Brand>/components/Mono` 最深子路径（已有踩坑）。
- **R4 · 前后端字段漂移**：Transcriber/下载新增字段需后端同步，否则保存后读取回来会丢；建议在 CI 加一个 `settings_schema` snapshot 测试。
- **R5 · 桌面端 vs Web 端差异**：存储路径选择在 Web 下只能纯文本；文档与 UI 必须显式标注。

---

## 4. 附录

### 4.1 API 端点速查（Settings 相关）

```
GET    /health                              → 健康
GET    /admin/system/stats (NEW)            → CPU/MEM/DISK
GET    /providers                           → 列表
POST   /providers                           → 新增
GET    /providers/{id}                      → 详情
PUT    /providers/{id}                      → 更新
DELETE /providers/{id}    (NEW, 阻塞项)      → 删除
GET    /providers/{id}/models               → 模型
POST   /providers/test                      → 连接测试
GET    /transcriber_config                  → ASR 读
POST   /transcriber_config                  → ASR 写（扩展入参）
GET    /pipeline/tasks                      → 任务列表
GET    /pipeline/tasks/{id}/events (SSE)    → 日志流
WS     /pipeline/tasks/{id}/ws              → 日志流（备选）
```

### 4.2 文件变更矩阵（概览）

| 路径 | 操作 |
| --- | --- |
| `frontend/src/layouts/SettingLayout.tsx` | 重构为 `SettingsShell` |
| `frontend/src/pages/SettingPage/index.tsx` | 保持薄入口 |
| `frontend/src/pages/SettingPage/ProvidersManagementPage.tsx` | 重构为 Master-Detail |
| `frontend/src/pages/SettingPage/ModelManagementPage.tsx` | 重构为网格卡片 |
| `frontend/src/pages/SettingPage/TranscriberPage.tsx` | 引擎卡片选择器 + `initial_prompt` |
| `frontend/src/pages/SettingPage/NetworkSettingsPage.tsx` | 缩减为高级网络项（或废弃） |
| `frontend/src/pages/SettingPage/DownloadSettingsPage.tsx` | **NEW** |
| `frontend/src/pages/SettingPage/DeployMonitorPage.tsx` | **NEW** |
| `frontend/src/pages/SettingPage/AboutPage.tsx` | Hero + 依赖声明 + 版本校验 |
| `frontend/src/components/ui/section.tsx` 等 | **NEW** 通用组件 |
| `frontend/src/hooks/useBackendHealth.ts` | 扩展为 `useHealthPulse` |
| `frontend/src/hooks/useDirtyGuard.ts` | **NEW** |
| `frontend/src/services/events.ts` | **NEW**（SSE 封装） |
| `frontend/src/store/configStore.ts` | 新增 `transcriber.initialPrompt` / 下载字段 |
| `frontend/src/router.tsx` | 新增 `/settings/download` + `/settings/monitor` |
| `frontend/src/locales/{zh-CN,en-US}/settings.json` | 同步新增文案 |
| `backend/app/main.py` | 新路由挂载；`/health` 扩展 |
| `backend/app/routes/providers.py` | 新增 `DELETE /providers/{id}` |
| `backend/app/routes/admin.py` | **NEW**（`/admin/system/stats`） |
| `shared/settings_store.py` | 扩展 `TranscriberConfig / DownloadConfig` 字段 |
| `shared/video_download_ytdlp.py` | 消费新下载字段 |
| `requirements.txt` | `+psutil` |

### 4.3 测试矩阵（最低要求）

| 层 | 用例 |
| --- | --- |
| Store | `configStore.setConfig` 局部合并；`providerStore.fetchProviders` 成功/失败；`updateProvider` 的乐观更新回滚 |
| Hook | `useDirtyGuard` 在编辑/保存/离开三态切换；`useHealthPulse` 模拟 200/500/网络错误 |
| 组件 | `SettingsShell` Tab 切换拦截；`LogConsole` 大量行（10k）不掉帧；`Section` 折叠状态记忆 |
| 端到端 | Providers CRUD 全链路；Transcriber 保存后后端返回一致；Monitor 至少 3 个指标卡渲染 |

### 4.4 非目标（本计划明确不做）

- 截图设置页（`ScreenshotPage`）的 UI 重构 — 字段已稳定，仅做风格同步（Section 化）。
- 鉴权体系、RBAC、审计日志。
- API Key 加密存储（仅改善前端遮罩，后端加密另立 ticket）。
- Streamlit 旧前端的设置页同步（对齐 `docs/DEPRECATION.md`，v0.4 移除）。
