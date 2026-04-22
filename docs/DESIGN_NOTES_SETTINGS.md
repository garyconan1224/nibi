# Settings 复刻 · 阶段 0/1 交付 —— 差异清单 / 风险确认 / 冻结契约 / UI 定稿

> 配套文档：`docs/SETTINGS_REPLICA_PLAN.md`（总体规划）。
> 本文件是 **阶段 0（Kickoff + 代码库审计）** 与 **阶段 1（契约冻结 + UI 定稿）** 的只读交付物，不含任何业务代码改动。
> 审计基准：当前仓库 `/Users/conan/Desktop/nibi`（日期 2026-04-22）。
> 活跃后端入口为 `backend/app/main.py`，仅挂载 `providers / pipeline / transcript / rag / notes` 五个 router；`backend/app/routers/config.py` 与 `BillNote_frontend/` 为 **上游遗产代码**（legacy），**不在活跃链路**，本次规划一律忽略。

---

## 1. 差异清单（代码实测 vs 规划文档 §1.2 / §1.3）

| # | 位置 | 文档描述 | 代码实测 | 差异性质 | 处置建议 |
|---|---|---|---|---|---|
| D1 | §1.3 `/transcriber_config` GET/POST | 声称存在，`TranscriberPage` 已调用 | 活跃后端 **未实现该端点**（`backend/app/routes/` 无对应模块） | 文档失真 / 运行期 404 | 阶段 2 前必须在后端新建 `routes/transcriber_config.py`；否则 `TranscriberPage.handleSave` 的 `updateTranscriberConfig` 始终失败 |
| D2 | §1.3 `/screenshot_config` GET/POST | "本次不动" 但标注存在 | 活跃后端 **未实现** | 文档失真 | 本计划不改，但需在规划说明里注明"延后到截图模块工作流" |
| D3 | §1.3 `DELETE /providers/{id}` 标注 "当前后端缺" + R1 阻塞 | **已存在**（`providers.py:168-180`） | 文档过期 | **R1 解除**；M1-M1.2（新增删除后端）任务降级为"仅前端联调" |
| D4 | §1.3 `/health` | 声称用于健康检查 | 仅返 `{status:"ok"}`，**无** `version / uptime_sec` | 实现不足（对 M4 扩展项） | 阶段 4 扩展返回体时同步 `backend/app/main.py` |
| D5 | §1.3 `/pipeline/tasks/{id}/events` | 声称 SSE 可用，且 R2 指其 `time.sleep` 阻塞 | 已实现，使用 `asyncio.sleep(0.2)` **异步非阻塞** | **R2 过期** | 直接接入即可，无需先修复 |
| D6 | §1.2 `configStore.TranscriberConfig` | 字段 `type/whisperModelSize/language/device/groqApiKey` | 一致 | — | 冻结 |
| D7 | §1.4.2 计划新增 `initial_prompt` | TS 与 Store 均无 | 缺字段 | 扩展项 | 冻结契约中标记为"阶段 2 新增" |
| D8 | §1.4.3 计划新增下载字段 `output_dir/filename_template/concurrency_limit/retry_count` | `configStore` 仅有 `downloadMode/httpProxy/poToken/visitorData/cookieBaseDirs` | 缺字段 | 扩展项 | 冻结契约中标记为"阶段 3 新增"；`shared/video_download_ytdlp.py` 现用硬编码 `%(title)s.%(ext)s` |
| D9 | §1.2 `useModelStore` "待核对" | 存在但头部注释为 `@deprecated`，内含 3 条硬编码模型 | 事实上已废弃 | 清理项 | 冻结契约明确 `useModelStore` **不在 Settings 复刻范围**，与 Home 页耦合另行清理 |
| D10 | §1.2 "`api_key` 为空串=不修改" | `PUT /providers/{id}` 实现为：`api_key is not None` 才写入；空串 `""` 会覆盖 | 语义不符文档 | Bug / 契约漂移 | 阶段 2 后端将"空串"特判为"不修改"，或前端在 `drafts.api_key === ''` 时不下发该字段 |
| D11 | §1.2 `providerStore.providers[].kind` 宽化为 `string` | 后端只接受 `openai_compatible | anthropic`（`providers.py:200` 兜底转 `openai_compatible`） | 前后端类型漂移 | 冻结契约将 TS 收敛为 `'openai_compatible' | 'anthropic'`；未来扩展需同时放开后端白名单 |
| D12 | §1.2 `providerStore.updateProvider` 回写 4 字段 | 实测回写 `name/kind/base_url/enabled`，**丢弃** 后端返回的 `default_models/has_api_key` | 本地状态与服务端漂移 | 扩展 `ProviderItem`，阶段 2 纳入 `has_api_key` 渲染"已配置"徽章 |
| D13 | §1.3 "响应契约 `{code,msg,data}` 或裸对象兼容" | 活跃后端 **全部返回裸对象**（providers/pipeline/transcript/notes/rag） | 协议半活化 | 冻结契约：**活跃后端恒定裸对象**；`{code,msg,data}` 分支仅保留为 legacy 兼容兜底，**新代码禁止依赖其 `data` 字段** |
| D14 | §1.5 `screenshot_config` 落 `settings.json` | `shared/settings_store.AppSettings` **不含** `screenshot` / `transcriber` / `download` 任何字段 | 服务端配置存储缺口 | 阶段 2/3 前在 `AppSettings` 扩展 `TranscriberConfig`、`DownloadConfig` frozen dataclass |
| D15 | §4.2 `frontend/src/hooks/useDirtyGuard.ts` / `services/events.ts` | 标记 NEW | 确认不存在 | 符合计划 | 阶段 2 M0 新建 |

## 2. R1–R5 风险确认报告

| 编号 | 原文风险描述 | 本仓库实测现状 | 重估结论 | 本阶段冻结结论 |
|---|---|---|---|---|
| **R1** | 后端缺 `DELETE /providers/{id}`，阻塞 M1 | 已实现（`backend/app/routes/providers.py:168-180`），正确移除对应 profile 并 `save_settings` | **已解除** | M1 前端删除链路直接落地；移除"软删除过渡"方案 |
| **R2** | `routes/pipeline.py` SSE 同步 `time.sleep` 阻塞 worker | 使用 `asyncio.sleep(0.2)`；`StreamingResponse` + `async def event_stream` | **已解除**（本仓库不适用，原风险针对上游 BillNote） | Monitor 页可直接订阅，无需预修复 |
| **R3** | `@lobehub/icons` 间接拉入 `antd-style` | 未在活跃 Settings 页引入品牌图标；`package.json` 含依赖但入口路径未规范化 | **仍成立，预防性** | 冻结约定：`import ... from '@lobehub/icons/es/<Brand>/components/Mono'`，禁止 barrel；PR 模板加静态扫描 |
| **R4** | 前后端字段漂移（Transcriber/下载） | `shared/settings_store` 无对应 dataclass；`/transcriber_config` 活跃链路缺失；下载字段仅 localStorage | **加剧**，比文档更严重 | 冻结：凡需跨端生效的字段，**必须** 先落 `AppSettings` + 后端端点，再落前端 store；CI 追加 `settings_schema.json` 快照对比 |
| **R5** | 桌面 vs Web 路径选择差异 | 仓库当前无 Tauri/Electron 壳层；`NetworkSettingsPage` 现仅纯文本输入 | **仍成立** | 冻结：阶段 3 `DownloadSettingsPage` 的 `output_dir` 字段默认走纯文本 + 存在性校验；桌面化另立 ticket |

## 3. 冻结后的 Store / API 契约表（阶段 2+ 开发基线）

### 3.1 Store · `useConfigStore`（`name: 'config-storage'`，全字段 persist）

| 字段 | 类型 | 状态 | 说明 |
|---|---|---|---|
| `defaultQuality` | `'fast' \| 'medium' \| 'slow'` | 冻结 | 与 Home 共享 |
| `defaultFormats` | `NoteFormat[]` | 冻结 | Home 专用，Settings 只读展示 |
| `defaultStyle` | `NoteStyle` | 冻结 | Home 专用 |
| `screenshot / link / video_understanding / video_interval / grid_size / extras` | 各原类型 | 冻结 | Home 专用，Settings 不改 |
| `httpProxy` | `string` | 冻结 | Network 页 |
| `textProviderId / textModelId / visionProviderId / videoModelId` | `string` | 冻结 | Models 页"设为默认"写入点 |
| `transcriber` | `TranscriberConfig` | 冻结（阶段 2 新增 `initialPrompt: string`） | 扩展字段加在对象末位以保持 persist 兼容 |
| `screenshotSettings` | `ScreenshotConfig` | 冻结，不在本次改动 | — |
| `downloadMode` | `'balanced' \| 'speed' \| 'quality' \| 'audio'` | 冻结 | — |
| `poToken / visitorData / cookieBaseDirs` | `string` | 冻结 | — |
| **新增（阶段 3）** `outputDir` | `string` | 待加 | 默认空串 → 后端回落 `data/videos/` |
| **新增（阶段 3）** `filenameTemplate` | `string` | 待加 | 默认 `%(title)s-%(id)s.%(ext)s` |
| **新增（阶段 3）** `concurrencyLimit` | `number` | 待加 | 默认 `2`，范围 `1-8` |
| **新增（阶段 3）** `retryCount` | `number` | 待加 | 默认 `3`，范围 `0-10` |
| **新增（阶段 3）** `socketTimeout` | `number` | 待加 | 默认 `30`，单位秒 |

### 3.2 Store · `useProviderStore`（`name: 'provider-storage'`，`partialize` 到 `providers + providerModels`）

| 字段/方法 | 契约 | 变更 |
|---|---|---|
| `providers: ProviderItem[]` | `{ id, name, base_url, enabled, kind, logo? }` | **收敛 `kind` 为 `'openai_compatible' \| 'anthropic'`**（D11） |
| `ProviderItem` 扩展 | 加入 `has_api_key?: boolean`（D12），仅读不写 | 阶段 2 前端加字段；后端已返 |
| `providerModels: Record<id, Model[]>` | `Model = { id, name }` | 不变 |
| `loading / error / modelsLoading` | 不持久化 | 不变 |
| `fetchProviders()` | `GET /providers` → 裸数组；成功后对 enabled providers 并发 `fetchProviderModels` | 不变 |
| `fetchProviderModels(id)` | `GET /providers/{id}/models`；失败静默置空数组 | 不变 |
| `addProvider(data)` | `POST /providers`；返回完整 profile 片段 | 不变 |
| `updateProvider(id, data)` | `PUT /providers/{id}`；**契约修订：`api_key === ''` → 前端 omit**（D10） | 阶段 2 落地 |
| `removeProvider(id)` | `DELETE /providers/{id}`；成功后清理 `providerModels[id]`、`modelsLoading[id]` | 不变（R1 已解） |

### 3.3 Store · `useModelStore`

- 状态：**冻结为 deprecated**，不纳入 Settings 复刻范围；Home 页解耦后另行删除。

### 3.4 API 契约（**活跃后端恒定裸对象**；legacy `{code,msg,data}` 兜底仅兼容旧浏览器缓存）

| 端点 | 方法 | 现状 | 请求体 | 响应（裸对象） | 阶段 |
|---|---|---|---|---|---|
| `/health` | GET | 已实现 | — | `{status:'ok'}` → **阶段 4 扩展** `{status, version, uptime_sec}` | M4 |
| `/providers` | GET | 已实现 | — | `ProviderSummary[]`（`id,name,kind,enabled,capabilities,base_url,has_api_key`） | 冻结 |
| `/providers` | POST | 已实现 | `ProviderCreateRequest {name,kind,api_key?,base_url?}` | `ProviderDetail`（无 `api_key` 明文回传：**实测当前会回传 `api_key`，阶段 2 修订为脱敏**） | 冻结 + 安全修订 |
| `/providers/{id}` | GET | 已实现 | — | `ProviderDetail`（含 `api_key` 明文 —— 同上，阶段 2 改为仅 `has_api_key`） | 冻结 + 安全修订 |
| `/providers/{id}` | PUT | 已实现 | `ProviderUpdateRequest {api_key?,base_url?,enabled?,default_models?}` | `ProviderDetail`；**语义修订**：`api_key === ''` 视为"不修改"（D10） | 阶段 2 |
| `/providers/{id}` | DELETE | 已实现 | — | `{ok:true}` | 冻结（R1 解） |
| `/providers/{id}/models` | GET | 已实现 | — | `{models: Model[], error?}` | 冻结 |
| `/providers/test` | POST | 已实现 | `{provider_id}` | `{status:'ok', message}` 或 400 | 冻结 |
| `/transcriber_config` | GET/POST | **未实现** | (POST) `{transcriber_type, whisper_model_size?, language?, device?, groq_api_key?, initial_prompt?}` | 同结构回显 | **阶段 2 新建**（D1） |
| `/pipeline/tasks` | GET | 已实现 | `?project_id=` | `TaskRecord[]` | 冻结 |
| `/pipeline/tasks/{id}/events` | GET SSE | 已实现（asyncio） | — | `type: 'task' \| 'log' \| 'error'` | 冻结（R2 解） |
| `/pipeline/tasks/{id}/ws` | WS | 已实现 | — | 同上 JSON 帧 | 冻结 |
| `/admin/system/stats` | GET | **未实现** | — | `{cpu_percent, mem_percent, disk_percent, gpu?}` | **阶段 4 新建** |

### 3.5 axios `http`（`services/client.ts`）

- `baseURL = VITE_BACKEND_BASE_URL ?? 'http://127.0.0.1:8010'`，`timeout = 15000`。
- 响应规则：遇 `{code, msg, data}` 且 `code !== 0` 时 reject；否则透传。新代码**禁止**再消费 `res.data.data`；读数据统一 `res.data`。
- 冻结：不新增请求拦截器；不注入 Authorization（当前无鉴权）。

## 4. UI/UX 设计定稿

### 4.1 布局骨架

- `SettingsShell` = Header（`Breadcrumb` + `LangSwitcher` + `SaveBar` 插槽） + **居中 Tab 条**（替代左侧 250px 菜单）+ 12 栅格主内容（`content` span 8，`aside` span 4：锚点目录 + 相关链接）+ 底部粘性 `SaveBar`（`Dirty`/`Save`/`Reset`/`Export` 按钮，含未保存草稿计数徽章）。
- 窄屏（`<lg`）折叠：Tab → 顶部抽屉；`aside` 移至内容下方 `details` 折叠。
- 页内统一 `Section` 组件（左竖线 `border-l-2 border-primary/40` + Icon + 标题 + 可折叠），每 Section 首行保留 2rem 空白，提高呼吸感，拒绝"BiliNote 式扁平卡片流"观感。

### 4.2 视觉语言

| 维度 | 规范 | Tailwind Token |
|---|---|---|
| 主色 | 中性 zinc + 单点强调 violet-500 | `primary: violet-500` / `bg-zinc-50` / `text-zinc-700` |
| 语义色 | 成功 emerald-500、警告 amber-500、危险 rose-500 | 对应 `bg-*/10 text-*-700` |
| 圆角 | Card `rounded-2xl`、Input/Select/Button `rounded-xl`、Pill `rounded-full` | — |
| 阴影 | Card 静态 `shadow-sm`，hover `shadow-md`；Dialog `shadow-xl` | — |
| 字体 | 标题 `text-[28px] tracking-tight font-semibold`；正文 `text-sm`；代码/Token `font-mono text-xs` | — |
| 徽章 | 点 + 文字 `inline-flex gap-1.5 items-center`（替代 pill） | `<span class="size-1.5 rounded-full bg-emerald-500"/>` |
| 图标 | `lucide-react` 统一 `size-4`；Provider 品牌走 `@lobehub/icons/es/<Brand>/components/Mono` 深路径（R3） | — |
| 空态 | `EmptyState` 插画 + 主副标题 + CTA；缺图时 fallback 虚线框 | `assets/empty/*.svg` 阶段 2 补 |
| Dirty 指示 | 字段级：Label 右侧 `DirtyDot`（2px violet）；页面级：`SaveBar` 计数徽章 | — |

### 4.3 交互模式（去克隆要点）

| 模块 | 交互模型 |
|---|---|
| Providers | 左列表（可搜索 + `enabled` toggle 切换点即生效+toast 可撤销）+ 右 Master-Detail 详情；删除走 `AlertDialog` 输入 provider 名二次确认；新增从右侧空态 CTA 或左列表底部"+"按钮触发 `Dialog` |
| Models | 网格卡片 + 顶部搜索 + `capability` 过滤 chip；卡片右上角 ⭐ 菜单设为"默认文本/视觉"（写入 `configStore` 对应字段，立即 toast） |
| Transcriber | **引擎卡片选择器**（5 卡横向排列，选中态描边 + 左上角 ⭐）；下方动态子区：`fast-whisper`→模型大小；`groq`→API Key（`type=password, autoComplete=new-password`）；`bcut/kuaishou`→ToS 提示条；通用字段：语言、设备、`initial_prompt`（textarea，2 行） |
| Download | 两个 Section：① "存储与命名"（`output_dir`/`filename_template` + 4 个预设 chip + 实时预览）② "网络与凭据"（`httpProxy`/`poToken`/`visitorData`/`cookieBaseDirs`）；`concurrency_limit/retry_count` 为 `Slider` |
| DeployMonitor | 4 × `StatCard`（backend health sparkline、任务计数、CPU%、MEM%）+ 任务表格（筛选 chip + 行内"查看日志"打开右侧 `Sheet`）+ `LogConsole`（`react-window` 虚拟滚动 + 搜索 + 暂停 + 导出 .log） |
| About | Hero（AppLogo + AppName + 版本徽章 + "检查更新"按钮）+ 元数据栅格（前端版本/后端版本/构建时间/License）+ 依赖 Accordion（`package.json` 白名单 + 后端 `/admin/deps` 或预生成 JSON）+ 外链按钮 |

### 4.4 通用组件清单（`components/ui/` 新增）

| 组件 | 职责 | 依赖 |
|---|---|---|
| `SettingsShell` | 顶部 Tab + 粘性 SaveBar + DirtyGuard 注入 | Radix Tabs / 自建 SaveBar |
| `Section` | 左竖线 + Icon + 标题 + 可选折叠 | Radix Collapsible |
| `FieldRow` | Label / Control / Hint / Error 四栏 | — |
| `DirtyDot` | 2px 彩色圆点 | — |
| `StatCard` | title / value / delta / sparkline | 轻量自绘 SVG |
| `LogConsole` | 虚拟滚动 + 搜索 + 暂停 + 导出 | `react-window` |
| `EmptyState` | 插画 + 标题 + CTA | `assets/empty` |
| `ProviderLogo` | 按 `kind/name` 匹配 `@lobehub/icons` Mono 图标 | `@lobehub/icons` 深路径 |

### 4.5 i18n 与可访问性约束

- 所有新增文案双语落 `locales/{zh-CN,en-US}/settings.json`（CI 应快照校验 key 对齐）。
- 所有 `Dialog/Sheet` 必须可用 ESC 关闭；`AlertDialog` 二次确认删除时焦点默认落在"取消"。
- `role="status"` + `aria-live="polite"` 用于 Save 成功/失败轻提示；`sonner` 统一出口。

---

## 5. 阶段 0 / 1 交付清单

- [x] 六处核心文件代码审计（router / configStore / providerStore / client / providers.py / settings_store.py）
- [x] 差异清单 D1–D15（本文 §1）
- [x] R1–R5 风险重估（本文 §2，R1/R2 已解除，R3–R5 维持）
- [x] Store / API 冻结契约表（本文 §3）
- [x] UI/UX 设计定稿：布局 / 视觉 / 交互 / 组件清单（本文 §4）
- [x] 不动业务代码：仅新增本设计说明文件

> 阶段 2 起（M0 基础设施）方可动代码；启动前建议先基于本文 §3 的"阶段 2 新建/修订"项提 PR，合入 `AppSettings` 的 `TranscriberConfig / DownloadConfig` dataclass 与 `/transcriber_config` 后端端点，避免 R4 扩散。

