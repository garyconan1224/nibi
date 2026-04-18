# nibi → VidMirror 重构技术方案（执行版）

> 状态：**执行版，已锁定决策，待用户最终批准后启动 Phase 0**
> 生成时间：2026-04-18（调研版）→ 2026-04-18 更新至执行版
> 作者：Augment Agent

## 决策锁定结果（用户已确认，不可再改）

| 项 | 锁定值 |
|---|---|
| **英文品牌** | `VidMirror`（驼峰显示） |
| **Python 包名 / slug** | `vidmirror`（全小写） |
| **中文副标题** | `VidMirror — AI 视频创作工作台` |
| **顶层目录** | **保持 `nibi/` 不变**（R8 风险规避，不做 `git mv`） |
| **环境变量前缀** | `VIDMIRROR_*`，**同时兼容 `VPS_*`** 至 v0.3（含 deprecation 警告） |
| **前端技术栈** | **保留 Streamlit**（不迁 React，Phase 2-Alt 作废） |
| **Phase 3 选项** | 仅做 **3.1（任务状态机规范化）** + **3.2（Markmap 预览）** |
| **兼容层寿命** | 保留至 v0.3 |
| **外部引用 (Q8)** | ✅ 已扫描，系统内**无残留引用**（crontab/LaunchAgents/Alfred/Raycast/Hammerspoon/Keyboard Maestro/Desktop `.command`/shell profile 均未命中）|
| **`.env` / `local_settings.py`** | 用户自管，方案不改 |
| **PR 策略** | Phase 1 拆两个 PR：**1A 文案 + 1B 包目录** |

## ⚠️ 新发现 & 前置条件

调研期末发现：`/Users/conan/Desktop/nibi` **当前不是 git 仓库**（无 `.git/`，`git status` 报 fatal），但 `.github/workflows/*.yml` 已存在。

**影响**：
- 原方案中所有基于 `git revert` / 独立分支 / 独立 commit 的回滚策略**全部失效**
- 必须新增 **Phase 0: Git 初始化**，为后续所有 Phase 提供回滚基础设施
- "两个 PR" 的叙述在没有 remote 的情况下降级为 "两个独立的 feature 分支 + 本地合并"；若后续用户推到 GitHub 再走 PR 流程

---

## 一、调研结论摘要

### 1.1 当前项目技术栈（nibi）

| 维度 | 事实 |
|---|---|
| 工作目录 | `/Users/conan/Desktop/nibi` |
| 应用类型 | **Streamlit 多页面应用 + FastAPI 任务中心**（双进程） |
| 前端 | Streamlit（`app.py` + `pages/0..3_*.py`，全中文页名） |
| 后端 | FastAPI（`backend/app/main.py`，端口 8010） |
| 新结构骨架 | `src/video_pipeline_studio/{core,ui}/`（Phase-2 英文化产物，已在使用中） |
| 共享层 | `shared/*.py`（config、backend_client、providers、storyboard 等 16 个模块） |
| 包管理 | `pip + requirements.txt`（Python ≥3.10） |
| 启动 | `启动工作台.command`（macOS 双击启动，内部预拉起后端 + `streamlit run`） |
| 测试 | `pytest`，含 `tests/e2e_qa.py` + 3 个 CI workflow（lint / backend-tests / qa-e2e） |
| 环境变量前缀 | `VPS_*`（VPS_BACKEND_URL / VPS_BACKEND_PYTHON） |

### 1.2 "nibi" 字面量影响范围（极小）

本项目**内部品牌名早已迁移为 "Video Pipeline Studio" (VPS)**，"nibi" 仅作为目录名残留：

```
grep -rni "nibi" 结果（排除 __pycache__ / .local/）：
  backend/app/downloaders/test_bilibili_nocookie.py:6   硬编码路径注释 cd /Users/conan/Desktop/nibi
  backend/app/services/note_generator.py:4              中文注释「整合nibi现有能力」
```

仅 **2 处**实际字符串引用。真正有规模的重命名面是「`video_pipeline_studio` / `VPS_*` / `Video Pipeline Studio`」：

```
grep -rn 以上关键词 → 61 处命中，分布于 29 个文件。
```

### 1.3 BiliNote 架构分析（本地 `/Users/conan/Desktop/BiliNote` 可读）

**技术栈**：React 19 + Vite + TypeScript + TailwindCSS 4 + shadcn/ui（Radix 原语） + Zustand + react-hook-form + Zod + react-router-dom v7（HashRouter） + FastAPI 后端。

**路由结构**（`App.tsx`）：

```
/ (Index)
├── /                    → HomePage (三栏布局)
└── /settings (SettingPage)
    ├── /settings/model         → Model 列表
    │   └── /settings/model/:id → ProviderForm
    ├── /settings/download      → Downloader
    │   └── /settings/download/:id → DownloaderForm
    └── /settings/about         → AboutPage
```

**首页三栏布局**（`HomeLayout.tsx`，基于 `react-resizable-panels`）：

| 面板 | 默认宽 | 内容 |
|---|---|---|
| 左（`aside`） | 18% | Logo + 「全局配置」齿轮入口 + **NoteForm**（URL、平台、模型、风格、extras） |
| 中（`aside`） | 16% | **History**（任务历史列表，`useTaskStore` 驱动，`useTaskPolling(3000)` 每 3s 拉） |
| 右（`main`） | 55% | **MarkdownViewer / StepBar** 依 `status: idle/loading/success/failed` 切换 |

**设置页两栏**（`SettingLayout.tsx`）：左侧 300px 固定菜单（Menu），右侧 `<Outlet />` 嵌套路由。

**数据流**：`NoteForm.submit → POST /generate → task_id → useTaskPolling 轮询 → taskStore 更新 → MarkdownViewer 渲染 currentTask.markdown`。状态机：`PENDING → PARSING → DOWNLOADING → TRANSCRIBING → SUMMARIZING → SUCCESS|FAILED`。

**后端关键路由**（`backend/app/routers/`）：`note.py`（生成/查询）、`provider.py`、`model.py`、`config.py`。下载器（`downloaders/{bilibili,youtube,douyin,kuaishou,local}_downloader.py`）实现 `base.py` 抽象；转写器（`transcriber/{whisper,groq,bcut,kuaishou,mlx_whisper}.py`）同理。

### 1.4 nibi 当前页面 ↔ BiliNote 区域对照

| nibi（现状） | BiliNote 对应 | 差异 |
|---|---|---|
| `pages/0_系统设置.py` | `/settings/model` + `/settings/download` | nibi 单页 273 行混合 Provider/默认路由/文本后端；BiliNote 拆为嵌套路由 |
| `pages/1_视频下载.py` | `HomePage` 左栏 NoteForm 的下载触发 | nibi 独立页；BiliNote 融合在笔记生成流中 |
| `pages/2_视频分析.py` | （无直接对应，BiliNote 侧重转写+总结而非逐帧视觉） | nibi 特有（Qwen-VL 逐帧） |
| `pages/3_AI导演编剧工作台.py` | （无直接对应，BiliNote 只到 Markdown 笔记） | nibi 特有（分镜 A/B/C + RAG） |

**关键差异**：nibi 的 **视频分析（逐帧）+ 分镜生成（RAG）** 是 BiliNote 没有的；BiliNote 的 **历史面板 + 实时状态流 + Markmap 预览** 是 nibi 没有的。




---

## 二、重命名影响范围清单

### 2.1 品牌标识三层

| 层级 | 当前 | 目标 | 说明 |
|---|---|---|---|
| L0 顶层目录 | `nibi/` | `VidMirror/` 或保持不变 | git 仓库根，改名需同步更新所有绝对路径 |
| L1 用户可见品牌 | `Video Pipeline Studio` / `视频流水线工作台` | `VidMirror` / (中文名待定) | README、app.py 标题、启动脚本 banner、页面标题 |
| L2 代码标识符 | `video_pipeline_studio` / `VPS_*` | `vidmirror` / `VIDMIRROR_*` | Python 包名、环境变量、常量前缀 |

### 2.2 命中文件清单（精确数字）

执行 `grep -rli` 统计（排除 `__pycache__`、`.local/`）：

**含 `VPS_BACKEND` / `video_pipeline_studio` / `Video Pipeline Studio`** — 29 个文件，61 处命中：

- 根目录 & 启动：`README.md`、`app.py`、`requirements.txt`、`启动工作台.command` (4)
- 页面：`pages/0_系统设置.py` ~ `pages/3_AI导演编剧工作台.py` (4)
- 共享层：`shared/config.py`、`shared/backend_launcher.py`、`shared/storyboard_generator.py`、`shared/runtime_llm_config.py` (4)
- 后端：`backend/app/main.py`、`backend/app/routes/providers.py`、`backend/app/services/pipeline_tasks.py`、`backend/app/services/rag_qa_service.py` (4)
- 新结构骨架：`src/video_pipeline_studio/**` (包路径 + 5 个文件内引用)
- 测试：`tests/e2e_qa.py`、`tests/backend/test_provider_registry.py`、`tests/README_QA.md` (3)
- 文档：`docs/ADD_PROVIDER.md`、`docs/PHASE2_RESTRUCTURE.md`、`docs/ENABLE_LOCAL.md` (3)

**含字面 `nibi`** — 2 个文件，2 处命中（均为注释）：
- `backend/app/downloaders/test_bilibili_nocookie.py:6`
- `backend/app/services/note_generator.py:4`

**未命中但受波及**：
- `data/projects/**`：用户数据目录，改名不影响
- `.github/workflows/*.yml`：当前 3 个 workflow 未引用品牌串，目录改名由 `actions/checkout` 自动处理
- `.env.example`：需人工核对变量前缀
- `local_settings.example.py`：需核对

### 2.3 代码外影响（用户须自行处理）

- **git remote 名**（若已存在）
- **IDE 打开的 workspace 路径**
- **桌面快捷方式 `启动工作台.command`（macOS LaunchServices 缓存）**
- **用户本地 `.env` / `local_settings.py`**（未进版本库，不在本方案改动范围）
- **`data/` 下既有项目数据**（与命名无关，无需迁移）

---

## 三、Phase 分解（执行版）

总体策略：**Phase 0 建仓 → Phase 1 重命名（两个分支）→ Phase 2 UI 重塑 → Phase 3 能力对齐**。每 Phase 有独立验收点；**所有回滚依赖 Phase 0 初始化的 git 仓库**。

### Phase 0 ─ Git 仓库初始化（前置，必做）

> 目标：为整个重构提供回滚基础设施。**不改任何业务代码**。

#### 子任务

| # | 任务 | 说明 | 验收 |
|---|---|---|---|
| 0.1 | `git init` 并设置默认分支为 `main` | `git init -b main` 或 init 后 `git branch -m main` | `git status` 正常返回 |
| 0.2 | 校验 `.gitignore` 已覆盖敏感路径 | 当前 `.gitignore` 已忽略 `local_settings.py / .env / data/{videos,json_data,projects} / .local/` — **不需新增** | `git status` 不出现 `.env` / `data/` / `.local/` |
| 0.3 | 首次全量 commit | `git add -A && git commit -m "chore: baseline snapshot before VidMirror rename"` | `git log --oneline` 显示 1 条记录 |
| 0.4 | 打 baseline tag | `git tag v0.1.0-baseline-nibi` | `git tag -l` 列出该 tag；极端回滚可 `git reset --hard v0.1.0-baseline-nibi` |
| 0.5 | 决定是否创建 GitHub 远端（可选） | 若创建，`git remote add origin ...` 并 `git push -u origin main --tags`；若暂不创建，Phase 1 PR 降级为本地分支合并 | 用户决定：现在推 / 重构完再推 / 不推 |

#### Phase 0 验收标准

- [ ] `git status` 返回 clean working tree
- [ ] `git log --oneline` 至少 1 条 commit
- [ ] `git tag -l` 含 `v0.1.0-baseline-nibi`
- [ ] 回滚演练：`echo x > test.txt && git status` 显示 untracked，`rm test.txt` 清理（证明 git 可工作）

#### Phase 0 回滚

- 不涉及，本 Phase 只增不改

---

### Phase 1 ─ 品牌/标识重命名（两个分支，文案 + 包目录）

> 目标：所有用户可见 & 代码标识符从 VPS/Video Pipeline Studio 切到 VidMirror，**功能零变更**。

#### Phase 1A ─ 文案与环境变量（低风险分支 `refactor/phase-1a-branding`）

| # | 任务 | 改动面 | 验收 |
|---|---|---|---|
| 1A.1 | 顶层入口文案 | `app.py`：`page_title` / `st.title` / `st.markdown` 中文说明；`README.md` 首行与全文；`启动工作台.command` banner（第 2 / 7 / 8 行） | `streamlit run app.py` 页面标题显示 "VidMirror — AI 视频创作工作台" |
| 1A.2 | 环境变量兼容迁移 | `shared/config.py::get_backend_base_url` 按 `VIDMIRROR_BACKEND_URL → VPS_BACKEND_URL → BACKEND_URL → 默认` 顺序读取；`VPS_BACKEND_PYTHON` → `VIDMIRROR_BACKEND_PYTHON` 同策略；读到旧变量时 `warnings.warn("VPS_* deprecated, use VIDMIRROR_*, will be removed in v0.3", DeprecationWarning)` | 单测：设 `VPS_BACKEND_URL=http://x:1` 启动仍生效 + stderr 有 deprecation |
| 1A.3 | 共享层文案 | `shared/{config,backend_launcher,storyboard_generator,runtime_llm_config}.py` 内注释、日志串、docstring 中 "Video Pipeline Studio" → "VidMirror" | `pytest tests/ -x` 全绿；`scripts/preflight_check.py` 通过 |
| 1A.4 | 后端文案 | `backend/app/main.py::FastAPI(title="VidMirror API")`；路由/服务 4 文件内注释 | `curl /health` 200；`curl /openapi.json \| jq .info.title` 返回 "VidMirror API" |
| 1A.5 | 页面文案 | 4 个 `pages/*.py` 内的 st.title / markdown 中品牌串（**不改文件名**，中文文件名保留） | 手动打开 4 个页面无残留旧品牌 |
| 1A.6 | 文档文案 | `docs/{ADD_PROVIDER,PHASE2_RESTRUCTURE,ENABLE_LOCAL}.md`、`README.md`、`tests/README_QA.md` | grep 0 命中 |
| 1A.7 | 清理字面 `nibi` | 2 处注释：`backend/app/downloaders/test_bilibili_nocookie.py:6`（改为相对路径或中性描述）、`backend/app/services/note_generator.py:4`（改为 "复刻 BiliNote 核心逻辑，整合本项目既有能力"） | `grep -rn "nibi" --exclude-dir={__pycache__,.local,.git}` 返回 0 行 |
| 1A.8 | CI/CD 与模板 | `.github/workflows/{lint,backend-tests,qa-e2e}.yml` 内注释、`pull_request_template.md`、3 个 ISSUE 模板 | 静态阅读确认；`.yml` 语法合法 (`python -c "import yaml; yaml.safe_load(open(...))"`) |

**Phase 1A 验收（硬门）**：
- [ ] `grep -rn "Video Pipeline Studio\|VPS_BACKEND_URL\|VPS_BACKEND_PYTHON\|nibi" --exclude-dir={__pycache__,.local,.git}` 仅命中：`shared/config.py` 兼容层代码 + `shared/backend_launcher.py` 兼容层代码
- [ ] `pytest tests/ -x` 全绿；`python3 scripts/preflight_check.py` 通过
- [ ] 同时设 `VIDMIRROR_BACKEND_URL=http://127.0.0.1:8011` 与 `VPS_BACKEND_URL=http://127.0.0.1:8010`，`get_backend_base_url()` 返回前者
- [ ] 双终端端到端：下载 1 条测试 URL（B 站或 YouTube）成功落盘到 `data/projects/<pid>/videos/`
- [ ] `git diff main...refactor/phase-1a-branding --stat` 改动文件数 ≤ 22（22 个文案文件 + `.github/`），**无** `src/` 包目录改名

#### Phase 1B ─ 包目录改名（中风险分支 `refactor/phase-1b-package`，基于 1A 合并后）

| # | 任务 | 改动面 | 验收 |
|---|---|---|---|
| 1B.1 | 预扫：列出所有 import 点 | `grep -rn "from src.video_pipeline_studio\|import src.video_pipeline_studio" --include="*.py"` 归档清单 | 生成临时清单文件记录所有行号 |
| 1B.2 | git mv 包目录 | `git mv src/video_pipeline_studio src/vidmirror` **单独一个 commit** | `pytest` 此刻应该**红**（import 失效，预期） |
| 1B.3 | 批量替换 import | 按 1B.1 清单逐文件改 `from src.video_pipeline_studio.` → `from src.vidmirror.`；同时改 `session_keys.py` 内 `SET_*` 键值如有 `vps_`/`VPS_` 前缀 | `pytest tests/ -x` 全绿 |
| 1B.4 | session_state key 兼容兜底 | 若存在 `VPS_*_KEY = "vps_..."` 常量，值保持不变（避免清空用户当前会话），仅改变量名 | 重启 Streamlit 旧 session 不崩溃 |
| 1B.5 | `backend/app/__init__.py` 及 `src/vidmirror/__init__.py` docstring 更新 | 中文/英文品牌串同步 | — |

**Phase 1B 验收（硬门）**：
- [ ] `grep -rn "video_pipeline_studio" --exclude-dir={__pycache__,.local,.git}` 返回 0 行
- [ ] `pytest tests/ -x` 全绿（含 `tests/backend/test_provider_registry.py`）
- [ ] `python3 tests/e2e_qa.py` 全绿
- [ ] 双终端端到端：完整走 "下载 → 分析 → 生成分镜"（至少 3 帧分析 + 1 个 Plan 产出），**成功**
- [ ] 打 tag `v0.2.0-vidmirror-phase1`

**Phase 1 回滚**：
- 1A 回滚：`git checkout main && git branch -D refactor/phase-1a-branding`
- 1B 回滚：1B 内部每个子任务独立 commit，粒度可回退单一 commit；整体回退 `git reset --hard v0.1.0-baseline-nibi`（注意会丢 1A，需先确认）


### Phase 2 ─ UI 结构重塑（基于 Streamlit，借鉴 BiliNote 布局）

> 目标：将现有 4 个平铺页面改造为「左侧项目/历史导航 + 中间主操作区 + 右上设置入口」的工作台式体验，复用 BiliNote 的**信息架构**。
>
> 基线分支：`refactor/phase-2-ui`，基于 Phase 1B 合并后的 `main`。

#### 信息架构（目标态）

```
VidMirror
├── 首页工作台（app.py，单页应用式）
│   ├── 左栏（侧边栏 st.sidebar，220~260px）
│   │   ├── Logo + 品牌
│   │   ├── 项目切换（当前 project_id 下拉 + 新建）
│   │   ├── 主流程 Tab 切换：下载 / 分析 / 创作
│   │   └── 历史任务面板（SSE 订阅 + 最近 10 条）
│   ├── 主操作区（右侧 st.container + st.tabs 或条件渲染）
│   │   ├── "下载" 视图：URL 输入 + 任务卡片
│   │   ├── "分析" 视图：视频勾选 + 分析进度
│   │   └── "创作" 视图：知识库选择 + 分镜 A/B/C 预览
│   └── 顶部右侧：⚙️ 全局配置按钮（st.page_link → 设置页）
└── 设置页（pages/0_Settings.py，保留为独立页）
    ├── Provider 管理（左菜单：Models / Download / Text Backend / About）
    └── 右侧为对应配置表单（用 st.radio + 条件渲染模拟 Outlet）
```

#### 关键 Streamlit 映射（BiliNote 组件 → Streamlit 方案）

| BiliNote | Streamlit 替代 |
|---|---|
| `HashRouter + Routes` | `app.py` 作为单页 + `st.session_state["view"]` 驱动条件渲染；设置仍走 `pages/` |
| `react-resizable-panels` 三栏 | `st.sidebar`（左固定）+ `st.columns([2,5])`（中右） |
| `useTaskStore`（Zustand） | `st.session_state["tasks"]`（列表）+ 后端 SSE 拉取 |
| `useTaskPolling(3000)` | `st.experimental_fragment(run_every="3s")` 或 `st_autorefresh` |
| `MarkdownViewer` | `st.markdown(..., unsafe_allow_html=True)` |
| `StepBar`（状态机） | `st.progress` + `st.status` 块 |
| `shadcn/ui Form + zod` | `st.form` + pydantic 手动校验 |

#### 子任务

| # | 任务 | 改动面 | 验收 |
|---|---|---|---|
| 2.1 | 画线框图并确认 | 用户侧确认 | mermaid/截图存入 `docs/UI_LAYOUT.md` |
| 2.2 | 抽离共用侧边栏组件 | 新增 `src/vidmirror/ui/sidebar.py`（ProjectSwitcher / HistoryPanel / NavTabs） | 在 `app.py` 引入可渲染 |
| 2.3 | 合并主工作区为单页 | `app.py` 接管 `pages/1..3` 主流程；旧 `pages/1_视频下载.py` 等改为瘦 wrapper 或删除 | 从首页可完成"下载 → 分析 → 创作"端到端 |
| 2.4 | HistoryPanel 对接 SSE | 复用 `backend/app/routes/pipeline.py::/events`（已存在） | 历史面板实时出现新任务 |
| 2.5 | 设置页两栏化 | `pages/0_系统设置.py` 改为左侧 `st.radio` 菜单 + 右侧表单条件渲染 | 四个子页（Model/Downloader/TextBackend/About）可切换 |
| 2.6 | 引入 logo 与主题 | 新增 `assets/logo.svg`；`st.set_page_config(page_icon=...)`；统一主色（可选 `.streamlit/config.toml`） | 视觉上品牌一致 |
| 2.7 | 保留向后兼容路径 | 旧 `pages/1..3` 保留为 stub，`st.switch_page` 跳回主页 | 用户从浏览器历史回旧 URL 不 404 |
| 2.8 | e2e_qa 用例适配 | `tests/e2e_qa.py` 更新选择器/路径 | `python3 tests/e2e_qa.py` 绿 |

#### Phase 2 验收标准

- [ ] 首页单页即可完成：选项目 → 下载 → 分析 → 生成分镜
- [ ] HistoryPanel 能在 ≤5s 内反映后端新任务
- [ ] 设置页保持独立，从首页右上 ⚙️ 进入、返回不丢 session
- [ ] `tests/e2e_qa.py` 全绿；人工走查 4 个场景无回归
- [ ] Streamlit 启动无 Deprecation Warning（针对新版 API）

> **Phase 2-Alt (迁 React/Vite) 已作废** — 用户 Q5 确认保留 Streamlit。

### Phase 3 ─ 能力对齐（已锁定：仅 3.1 + 3.2）

> 基线分支：`refactor/phase-3-capabilities`（可拆两个子分支独立合并）。
>
> **用户已锁定只做 3.1 + 3.2**，其余 3.3~3.7 不在本次重构范围（可后续独立立项）。

#### 锁定子任务

##### 3.1 ─ 任务状态机规范化

| 步骤 | 说明 | 验收 |
|---|---|---|
| 3.1.a | 在 `backend/app/models/tasks.py` 定义 `TaskStatus` 枚举：`PENDING / PARSING / DOWNLOADING / TRANSCRIBING / ANALYZING / SUMMARIZING / SUCCESS / FAILED / CANCELLED`（比 BiliNote 多两个：`ANALYZING` 对应视频分析、`CANCELLED` 已有） | `from backend.app.models.tasks import TaskStatus` 可 import |
| 3.1.b | 迁移 `backend/app/services/{pipeline_tasks,task_store,task_runner}.py` 中所有裸字符串状态为枚举值；保留字符串序列化以兼容前端与 JSON 持久化 | `pytest tests/backend/ -x` 全绿；历史 `.local/backend_tasks.json` 可正常加载 |
| 3.1.c | 前端步骤条：`src/vidmirror/ui/` 新增 `step_bar.py`（对应 BiliNote 的 StepBar），在 Phase 2 的主操作区和 HistoryPanel 中调用 | 提交下载任务后，UI 步骤条随后端状态流转（≤3s 滞后） |
| 3.1.d | 兼容旧状态值（若 `.local/backend_tasks.json` 已有任务）：加载时映射 `running → DOWNLOADING`、`done → SUCCESS`、`error → FAILED`、`queued → PENDING` | 存量 JSON 数据 100% 正确映射 |

**3.1 验收标准**：
- [ ] `pytest tests/ -x` 全绿；新增 `tests/backend/test_task_status_enum.py`（至少 5 个断言）
- [ ] 旧 JSON 任务数据加载后所有状态落入合法枚举值
- [ ] `tests/e2e_qa.py` 全绿
- [ ] UI 步骤条在下载任务中至少显示 3 次状态跃迁

##### 3.2 ─ Markmap 预览

| 步骤 | 说明 | 验收 |
|---|---|---|
| 3.2.a | 技术选型：通过 `st.components.v1.html` 内联 markmap-autoloader（CDN：`https://cdn.jsdelivr.net/npm/markmap-autoloader`） | 本地可加载，无 CSP 拦截 |
| 3.2.b | 在 `src/vidmirror/ui/` 新增 `markmap_view.py`，提供 `render_markmap(markdown: str, height: int = 600) -> None` | `streamlit run app.py` 能渲染 |
| 3.2.c | 接入分镜输出：`pages/3_AI导演编剧工作台.py`（Phase 2 后可能已被合并到主页）中，把 Plan A/B/C markdown 添加"思维导图"切换选项（tab 或 toggle） | 生成分镜后切到 Markmap tab 可视化 |
| 3.2.d | 接入笔记输出（若 `backend/app/services/note_generator.py` 产出 markdown） | 笔记页同样可切 Markmap |
| 3.2.e | 离线兜底：若 CDN 不可达，退化到纯 `st.markdown`（try/except 包裹 html 组件加载逻辑） | 断网情况下页面不崩溃 |

**3.2 验收标准**：
- [ ] 分镜生成后能在同一页切换 Markdown / Markmap 两种预览
- [ ] 离线模式下优雅降级无异常
- [ ] 新增 `tests/test_markmap_view.py` smoke test（至少测试 `render_markmap("# a\n## b")` 不抛异常）

**Phase 3 整体验收（3.1 + 3.2 合并后）**：
- [ ] `pytest tests/ -x` 全绿
- [ ] `python3 tests/e2e_qa.py` 全绿
- [ ] 打 tag `v0.3.0-vidmirror`，同时在 `shared/config.py` 等处清理 `VPS_*` 兼容层（Q7 承诺）

> 候选子任务 3.3（多下载器插件化）、3.4（多转写器）、3.5（SQLite 持久化）、3.6（Prompt 管理 UI）、3.7（笔记风格）**已用户确认不做**，作为后续 backlog 保留说明，不展开细节。

**Phase 3 回滚**：
- 3.1 和 3.2 独立 commit；任一失败单独 revert
- 3.1 状态机回滚要点：兼容层（旧字符串映射）在先，即使 revert 枚举枚举代码，前端仍能读取旧 JSON


---

## 四、风险点与回滚策略（执行版）

### 4.1 风险清单（已按决策锁定更新）

| # | 风险 | 等级 | 缓解措施 | 当前状态 |
|---|---|---|---|---|
| R1 | `VPS_BACKEND_URL` 在用户 shell profile / `.env` 中硬编码，改名后后端启动地址漂移 | 中（由高降级） | Phase 1A.2 实现双变量兼容读取至 v0.3；读到旧变量时 stderr 输出 deprecation 警告 | Q8 扫描结果：shell profile **无** `VPS_*`，风险实际低；但 `.env` 内容未知（用户自管） |
| R2 | Streamlit `pages/` 中文文件名被 URL 依赖 | 中 | Phase 1 **不改** `pages/*.py` 文件名；Phase 2 合并后旧文件保留为 `st.switch_page` stub 一个 Phase | — |
| R3 | 包路径 `src/video_pipeline_studio → src/vidmirror` 改名漏改 import | 中 | Phase 1B.1 先做全量 grep 清单；1B.2 `git mv` 单独 commit（允许 pytest 红）；1B.3 批量替换后回绿 | — |
| R4 | `data/projects/**` 历史任务 JSON 含旧品牌串被代码强匹配 | 低 | 用户数据仅靠 `project_id` 检索，不读品牌字段；仍会在 1A.1 前 grep 一次 `data/` 兜底 | — |
| R5 | CI workflow 因路径改名失败 | **已规避** | Q3 决定不改顶层目录，workflow 无需改 | ✅ |
| R6 | `启动工作台.command` macOS LaunchServices 缓存 | **已规避** | Q3 决定不改顶层目录；仅改文件内 banner 文本 | ✅ |
| R7 | Phase 2 重构破坏 session_state key | 中 | 1B.4 session_state key 值保持不变（只改常量名）；Phase 2 若需重构 key，在 `app.py` 启动时做一次性迁移 | — |
| R8 | 多设备同步冲突 | **已规避** | Q3 决定不改顶层目录 | ✅ |
| R9 | 兼容层污染代码库 | 低 | 兼容代码集中在 `shared/config.py` 与 `shared/backend_launcher.py`，统一 `# TODO(VidMirror v0.3): remove VPS_* fallback` 注释；Phase 3 完成后批量清理 | — |
| **R10（新）** | **无 git 仓库 → 无回滚基础设施** | **高** | **Phase 0 必做**：`git init + baseline commit + tag` | ⚠️ 新增 |
| **R11（新）** | `.env` 用户自管，Phase 1A.2 切变量名后用户原有 `.env` 里 `VPS_BACKEND_URL=...` 仍生效但产生 deprecation 噪音 | 低 | README 的"迁移说明"小节（新增）告知用户手动改；保留兼容至 v0.3 | ⚠️ 新增 |
| **R12（新）** | `启动工作台.command` 用 `#!/bin/bash`，未锁 `set -euo pipefail`；Phase 1A.1 改 banner 时若手滑改坏语法，macOS 双击失败 | 低 | 改动最小化（仅 echo 文本），改后本地 `bash -n 启动工作台.command` 语法检查 | ⚠️ 新增 |

### 4.2 回滚策略（基于 Phase 0 建仓后的 git）

**全 Phase 通用**：
- 每个 Phase 使用独立分支：`refactor/phase-1a-branding` / `refactor/phase-1b-package` / `refactor/phase-2-ui` / `refactor/phase-3-capabilities`
- 每个子任务对应独立 commit（小步），便于 `git revert <sha>`
- 合并主分支前强制通过 `pytest` + `e2e_qa.py`
- 极端核弹按钮：`git reset --hard v0.1.0-baseline-nibi`

**Phase 1A 专属**：
- 回退：`git checkout main && git branch -D refactor/phase-1a-branding`
- 合并后发现问题：`git revert -m 1 <merge-sha>`（若用 merge commit）
- 兼容层保证：即使 1A 代码 revert，用户已改用 `VIDMIRROR_BACKEND_URL` 的新配置**无需改回**

**Phase 1B 专属**：
- `git mv` 与 import 替换分 commit → 单独 revert 即可
- 兜底：`git reset --hard v0.2.0-vidmirror-phase1` 回到 1A 刚合并态

**Phase 2 专属**：
- 重构分两阶段 commit：`step-a: 新增 src/vidmirror/ui/*` / `step-b: app.py 切换入口`
- 回退 step-b 即恢复原多页 UI；step-a 新组件保留作为将来重用底座
- 旧 `pages/1..3_*.py` 备份至 `pages/_legacy/`，保留至 Phase 3 结束再清理

**Phase 3 专属**：
- 3.1 和 3.2 各自独立 commit，互不依赖
- 3.1 状态机：即使回退，兼容层（旧字符串映射）保证前端仍可读旧 JSON
- 3.2 Markmap：纯新增功能，回退不影响主流程

### 4.3 数据安全

- `data/` 与 `.local/` 在 `.gitignore` 中已被忽略，不进仓库
- `local_settings.py` / `.env` 同上
- Phase 0 commit 前务必确认 `git status` 不包含以上敏感目录/文件
- **不做**任何 `data/projects/**` 下的数据格式迁移（状态机兼容层在加载期做映射）

---

## 五、用户确认结果（已锁定）

已在文档开头"决策锁定结果"表中汇总，此处不再重复。

**Q8 (外部引用扫描) 实测结果**（脚本已运行并清理）：

| 检查项 | 结果 |
|---|---|
| `crontab -l` | [none] |
| `~/Library/LaunchAgents` | [none] |
| Alfred / Raycast / Hammerspoon / Keyboard Maestro | 未安装 |
| 桌面 `.command`（排除 nibi 本身） | [none] |
| Shell profiles (`.zshrc` / `.bashrc` / etc.) 中 `VPS_*` 或 `nibi` | [none] |
| `git remote -v` | 不是 git 仓库（触发 R10） |

→ **结论**：除代码库内部引用（已计入方案）外，系统层面**无外部依赖**，R5/R6/R8 风险全部规避。

---

## 六、工时估算（执行版）

| Phase | 子任务数 | 预估工时（Agent 实施，含自测） | 备注 |
|---|---|---|---|
| **Phase 0** | 5 | 10~20 min | 首次 `git init` + baseline commit + tag |
| **Phase 1A** | 8 | 1.5 ~ 2.5 h | 文案替换 + 环境变量兼容 + 测试 |
| **Phase 1B** | 5 | 0.5 ~ 1 h | 纯包目录改名 + import 替换 |
| **Phase 2** | 8 | 4 ~ 7 h | UI 重构 + 手动 QA 走查 |
| **Phase 3.1** | 4 | 1.5 ~ 2.5 h | 状态机枚举 + 兼容层 + 步骤条 |
| **Phase 3.2** | 5 | 1 ~ 1.5 h | Markmap 组件 + 接入 + 离线兜底 |
| **合计** | 35 | **8.5 ~ 14.5 h** | Phase 间有暂停点，实际日历时间可能跨多天 |

---

## 七、下一步（等待用户批准后执行）

**准备就绪**。一旦用户说"开始 Phase 0"（或等价指令），Agent 将：

1. **Phase 0** 立即执行（低风险，5 分钟内完成）：
   - `git init -b main`
   - 确认 `.gitignore` 已覆盖敏感路径（现有 `.gitignore` 已足够）
   - `git add -A && git commit -m "chore: baseline snapshot before VidMirror rename"`
   - `git tag v0.1.0-baseline-nibi`
   - 可选：用户是否现在要推到 GitHub？（若是请提供 remote URL）
   - **停下等用户确认 Phase 0 完成**

2. **Phase 1A** 提交前需用户二次确认：
   - 创建分支 `refactor/phase-1a-branding`
   - 按 1A.1 ~ 1A.8 顺序执行（共 8 个子任务，每个独立 commit）
   - 每完成一个子任务 Agent 输出一条进度，用户可随时喊停
   - 全部完成后合并到 `main`，打 tag `v0.1.5-phase1a`
   - **停下等用户验收**

3. **Phase 1B** 同理，分支 `refactor/phase-1b-package`，5 个子任务

4. **Phase 2** 开始前 Agent 先出 `docs/UI_LAYOUT.md`（mermaid 线框图），用户确认后再写代码

5. **Phase 3.1 / 3.2** 依序执行（可合并为一个分支或拆两个，Agent 推荐拆两个）

---

## 附：本次确认前后对比（Changelog）

| 条目 | 调研版 (v1) | 执行版 (v2) |
|---|---|---|
| 顶层目录 | 标注"可选" | **锁定不改** |
| Phase 2-Alt | 列为备选 | **已作废** |
| Phase 3 | 7 个候选 | **锁定 3.1 + 3.2** |
| 工时估算 | 模糊"按选 2~3" | 精确到每 Phase |
| Phase 0 | — | **新增（git init 前置）** |
| 风险 R5/R6/R8 | 标注高/中 | **因 Q3 决定全部规避** |
| 风险 R10 | — | **新增（无 git 仓库，高风险，由 Phase 0 解决）** |
| 风险 R11/R12 | — | **新增（用户 .env + 启动脚本语法）** |
| Q8 扫描 | 待用户手动确认 | **Agent 已扫描，结果 clean** |
| 1A / 1B 分拆 | Phase 1 单体 10 任务 | **拆成 1A 文案 + 1B 包目录，共 13 个细化任务** |

