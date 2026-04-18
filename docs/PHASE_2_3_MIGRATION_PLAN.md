# Phase 2.3 主工作区合并 — 迁移计划（第 1 阶段：调研）

> 状态：**待用户审阅**，审阅通过后进入 2.3.a 编码
> 生成时间：2026-04-18
> 对应前置：`docs/UI_LAYOUT.md`（2.1）、`src/vidmirror/ui/sidebar.py`（2.2）
> 本阶段纪律：**不写 Python，不改任何现有文件**，仅产出此计划文档

---

## 一、现状扫描

### 页面 1：视频下载

- **文件路径**：`pages/1_视频下载.py`（439 行）
- **主要业务逻辑**：URL 表单收集 → `POST /pipeline/tasks`（task_type=download）→ 会话内维护后端 task_id 列表 → 同 URL 归组展示 → 进度条轮询（`time.sleep(0.45)` + `st.rerun()`）+ 活跃任务查重 + 手动去重/清理按钮 + 项目视频目录列表。
- **关键函数**：`_is_valid_http_url` / `_init_state` / `_get_backend_ids` / `_append_backend_id` / `_canonical_url_for_group` / `_bilibili_bv_group_key` / `_download_group_key` / `_dedupe_session_ids_keep_latest_per_url` / `_has_active_task_for_url`（均为模块级纯函数，无类）。
- **调用的后端 API**：`GET /health`（via `backend_health`）、`POST /pipeline/tasks`（via `create_pipeline_task`）、`GET /pipeline/tasks/{id}`（via `get_pipeline_task`）、`POST /pipeline/tasks/{id}/cancel`（via `cancel_pipeline_task`）、`DELETE /pipeline/tasks`（via `purge_pipeline_tasks`）、`DELETE /pipeline/tasks/{id}`（via `delete_pipeline_task`，未实际调用但已导入）。
- **使用的 `st.session_state` keys**：
  - `DOWNLOAD_TASKS_BY_PROJECT_KEY` = `"download_tasks_by_project"` — **仅在 `_init_state()` 初始化为 `{}`，业务代码未读写**（遗留键，可疑）
  - `DOWNLOAD_BACKEND_TASK_IDS_KEY` = `"download_backend_task_ids_by_project"` — R/W，per-project task_id 列表
  - `"dl_tasks_by_project"` — 旧键，`_init_state()` 中自动迁移
  - `"current_project_id"` / `"current_project_name"` — 通过 `ensure_current_project()` 间接 R/W
  - Widget keys（`key=` 参数隐式写入）：`cancel_dl_{id}_{hash}`、`dl_prune_finished`、`dl_purge_failed`、`dl_dedupe_urls`
- **渲染的 UI 块**：`st.set_page_config` → 页面标题/副标题 → 侧栏后端地址与健康状态 → 当前项目切换器（`st.selectbox` + 新建项目）→ `st.form("download_form")`（URL/浏览器/代理/PO Token/Visitor Data）→ 后端不可达时的启动按钮 → 任务列表管理按钮行（移除已结束 / 去重 / 清理）→ 同 URL 分组任务卡片（`st.container(border=True)` + `st.progress` + 取消按钮 + 日志 expander）→ 项目视频文件列表。

### 页面 2：视频分析

- **文件路径**：`pages/2_视频分析.py`（378 行）
- **主要业务逻辑**：列出当前项目 `videos/` 目录下可分析视频 → 复选勾选 → `POST /pipeline/tasks`（task_type=analyze）→ 轮询 task 进度（`sleep(0.45)`+`rerun`）→ 进度条 + 实时帧预览（snapshots/recent_frames）→ 完成后解析 `json_output_basenames` 渲染结构化 JSON 结果卡片 + 下载按钮。
- **关键函数**：`_analysis_result_paths` / `_render_visual_json_result` / `_init_state` / `_get_analyze_task_id` / `_set_analyze_task_id` / `_clear_analyze_task_id`（均为模块级函数）。
- **调用的后端 API**：`GET /health`、`POST /pipeline/tasks`（analyze）、`GET /pipeline/tasks/{id}`、`POST /pipeline/tasks/{id}/cancel`。
- **使用的 `st.session_state` keys**：
  - `ANALYZE_BACKEND_TASK_BY_PROJECT_KEY` = `"analyze_backend_task_by_project"` — R/W，单任务（per-project 一个 task_id）
  - `ANALYSIS_EXPAND_FIRST_JSON_KEY` = `"_analysis_expand_first_json_basename"` — W/pop，仅本页局部 flag，**模块级常量未写进 `session_keys.py`**
  - `ANALYZE_STATE_BY_PROJECT_KEY`、`ANALYZE_RUNNING_BY_PROJECT_KEY`（在 `session_keys.py` 中已定义，但本页**根本未引用**——遗留键，需判定是否废弃）
  - `"current_project_id"` / `"current_project_name"` — 间接 R/W
  - Widget keys：`analyze_{project_id}_{video_name}`（复选框）、`dl_json_{name}_{id}` / `dl_md_{name}_{id}`（下载按钮）
- **渲染的 UI 块**：`st.set_page_config` → 标题/副标题 → 侧栏后端状态 → 当前项目切换器 → 后端任务进度区（条件渲染：进度条 + 各视频进度 metric + 近帧 JSON/图像 + 成功时 JSON 结果卡片 + 日志 expander）→ 项目信息 info → 左右分栏：左（复选列表），右（启动按钮、取消按钮）→ 项目 JSON 结果归档列表（`st.expander`）。

### 页面 3：AI 导演编剧工作台

- **文件路径**：`pages/3_AI导演编剧工作台.py`（488 行）
- **主要业务逻辑**：项目信息/产品信息/卖点/参考图 → 可选联网补全（`enrich_product`）→ 知识库来源选择（可跨项目）+ JSON 子集挑选 → 加载知识库向量化（`load_folder_as_knowledge`）→ 保存/加载项目快照 → `POST /pipeline/tasks`（task_type=storyboard）生成方案 A/B/C → Tabs 展示 + 导出 Markdown（完整/单方案）。
- **关键函数**：`_init_session`（含旧键迁移）/ `_get_storyboard_task_id` / `_set_storyboard_task_id` / `_clear_storyboard_task_id` / `_now_local_str` / `_log_pipeline_event` / `_build_project_payload`。
- **调用的后端 API**：`GET /health`、`POST /pipeline/tasks`（storyboard）、`GET /pipeline/tasks/{id}`。
- **使用的 `st.session_state` keys**（CREATOR_* 系列全部在用）：
  - `CREATOR_KNOWLEDGE_KEY`、`CREATOR_SAVED_PROJECT_ID_KEY`、`CREATOR_PROJECT_CREATED_AT_KEY`、`CREATOR_WEB_ENRICHMENT_MD_KEY`、`CREATOR_WEB_ENRICHMENT_IMAGES_KEY`、`CREATOR_VISION_REPORT_KEY`、`CREATOR_WEB_CONTEXT_USED_KEY`、`CREATOR_PLAN_A_KEY` / `B` / `C`、`CREATOR_PROJECT_NAME_KEY`、`CREATOR_STORYBOARD_TASK_BY_PROJECT_KEY`（R/W）
  - 旧键自动迁移：`knowledge` / `project_id` / `project_created_at` / `web_enrichment_md` / `web_enrichment_images` / `vision_report` / `web_context_used` / `plan_a` / `plan_b` / `plan_c` / `project_name_input` → 对应 CREATOR_* 常量
  - Widget keys（同时占用 session_state）：`creator_product_name`、`creator_core_features`、`creator_web_hint`、`creator_kb_project_label`、`creator_kb_only_vision_json`、`creator_kb_json_basenames`、`creator_export_plan`、`creator_start_backend_task_poll`、`creator_start_backend_on_submit`
  - `"current_project_id"` / `"current_project_name"` — 间接
- **渲染的 UI 块**：`set_page_config` → 标题 → 项目切换器 → 分镜任务轮询进度区（条件）→ 项目信息 info → 侧栏后端状态 → 左右分栏：左（项目/产品/卖点/上传图 + 联网检索），右（知识库项目+JSON 挑选+加载按钮、保存/加载快照、生成分镜按钮）→ 提交分支（含预检：alive / kb / key / 产品名）→ 三 Tabs 展示分镜方案 + 导出按钮。

---

## 二、Session State Keys 迁移表

说明：**"去向"默认 `保留原样`**（字符串值不变，多 view 共享同名 key；迁移风险最低）。只有明确有冲突或冗余时才标记其他去向。

| 旧 Key（字符串值） | 当前常量名 | 去向 | 新常量名 | 迁移兜底 | 备注 |
|---|---|---|---|---|---|
| `"download_tasks_by_project"` | `DOWNLOAD_TASKS_BY_PROJECT_KEY` | **废弃候选** | —（无） | 兜底只做 `setdefault({})` 保持兼容 | 页面仅初始化，业务未读写；建议 2.3.b 保留常量定义+默认值，2.4 或后续清理 |
| `"download_backend_task_ids_by_project"` | `DOWNLOAD_BACKEND_TASK_IDS_KEY` | **保留原样** | 不变 | `setdefault({})` | 下载 view 核心状态，每项目一个 task_id 列表 |
| `"dl_tasks_by_project"` | —（旧字符串） | **保留原样迁移逻辑** | 不变 | `_init_state()` 中迁移到 DOWNLOAD_TASKS_BY_PROJECT_KEY | 已有兜底，迁移到 download view 时原样保留 |
| `"analyze_state_by_project"` | `ANALYZE_STATE_BY_PROJECT_KEY` | **废弃候选** | —（无） | 不做任何初始化 | **页面未使用**，疑似历史遗留；2.3.b 保留常量定义不写入默认值 |
| `"analyze_running_by_project"` | `ANALYZE_RUNNING_BY_PROJECT_KEY` | **废弃候选** | —（无） | 不做任何初始化 | 同上 |
| `"analyze_backend_task_by_project"` | `ANALYZE_BACKEND_TASK_BY_PROJECT_KEY` | **保留原样** | 不变 | `setdefault({})` | 分析 view 唯一核心状态 |
| `"_analysis_expand_first_json_basename"` | `ANALYSIS_EXPAND_FIRST_JSON_KEY`（页面内局部常量） | **保留原样** | 不变；**不**提升为 `session_keys.py` 常量 | 无需初始化（W/pop 模式） | 纯局部 UI flag，不泄漏到其他 view |
| `"creator_knowledge"` | `CREATOR_KNOWLEDGE_KEY` | **保留原样** | 不变 | `setdefault(None)` | 知识库对象 |
| `"creator_saved_project_id"` | `CREATOR_SAVED_PROJECT_ID_KEY` | **保留原样** | 不变 | `setdefault("")` | |
| `"creator_project_created_at"` | `CREATOR_PROJECT_CREATED_AT_KEY` | **保留原样** | 不变 | `setdefault("")` | |
| `"creator_web_enrichment_md"` | `CREATOR_WEB_ENRICHMENT_MD_KEY` | **保留原样** | 不变 | 无 | |
| `"creator_web_enrichment_images"` | `CREATOR_WEB_ENRICHMENT_IMAGES_KEY` | **保留原样** | 不变 | 无 | |
| `"creator_vision_report"` | `CREATOR_VISION_REPORT_KEY` | **保留原样** | 不变 | 无 | |
| `"creator_web_context_used"` | `CREATOR_WEB_CONTEXT_USED_KEY` | **保留原样** | 不变 | 无 | |
| `"creator_plan_a"` / `b` / `c` | `CREATOR_PLAN_{A,B,C}_KEY` | **保留原样** | 不变 | 无 | |
| `"creator_project_name"` | `CREATOR_PROJECT_NAME_KEY` | **保留原样** | 不变 | 无 | 同时是 widget key |
| `"creator_storyboard_task_by_project"` | `CREATOR_STORYBOARD_TASK_BY_PROJECT_KEY` | **保留原样** | 不变 | `setdefault({})` | |
| `"knowledge"` / `"project_id"` / `"project_created_at"` / `"web_enrichment_md"` / `"web_enrichment_images"` / `"vision_report"` / `"web_context_used"` / `"plan_a"` / `"plan_b"` / `"plan_c"` / `"project_name_input"` | —（旧字符串） | **保留原样迁移逻辑** | 不变 | 沿用 `_init_session` 中的 `migration_pairs` 逐项 `pop` 到 CREATOR_* | 搬到 `create` view 的 `_init_session()` 时原样保留 |
| `"current_project_id"` | `CURRENT_PROJECT_ID_KEY`（字符串值一致） | **保留原样** | 不变 | 由 `shared.project_context.ensure_current_project()` 负责初始化 | **无需改 `shared/project_context.py`**；`CURRENT_PROJECT_ID_KEY` 只作为 `app.py` 侧的读写入口常量 |
| `"current_project_name"` | —（仅字符串字面量） | **保留原样** | 新增常量 `CURRENT_PROJECT_NAME_KEY`？**暂不新增** | 由 `ensure_current_project()` 负责 | 保持现状，避免超出本阶段范围 |
| `"view"` | `VIEW_KEY`（新） | **新增** | 同 | `setdefault("download")` | app.py 初始化默认值 `"download"` |
| `"tasks_cache"` | `TASKS_CACHE_KEY`（新） | **新增** | 同 | `setdefault([])` | 供 `HistoryPanel` 消费；2.3 阶段仅初始化，**不做轮询**（轮询留给 2.4） |
| `"selected_task_id"` | `SELECTED_TASK_ID_KEY`（新） | **新增** | 同 | `setdefault("")` | `HistoryPanel.on_select` 的写入目标，view 侧现阶段可暂不消费 |
| `"set_settings_loaded"` | `SET_SETTINGS_LOADED_KEY` | **保留原样** | 不变 | 由 `pages/0_系统设置.py` 管理 | 与本阶段无关 |

**冲突检查**：所有旧 key 在三个页面间**无同名冲突**。`current_project_id` 为三页面共用、语义一致（同是当前项目 ID 字符串），非冲突而是已有共享。Widget keys 前缀命名空间清晰（`creator_*` / `analyze_*` / `dl_*` / `_sidebar_*`），无碰撞。

---

## 三、代码迁移计划

### 3.1 新建文件清单

| 文件路径 | 导出符号 | 职责 |
|---|---|---|
| `src/vidmirror/ui/views/__init__.py` | `render_download_view`、`render_analyze_view`、`render_create_view`（re-export） | 包入口，聚合三个 view |
| `src/vidmirror/ui/views/download.py` | `def render_download_view(project_id: str) -> None` | 承接 `pages/1_视频下载.py` 除 `set_page_config` / 页面级项目切换器以外的全部正文逻辑 |
| `src/vidmirror/ui/views/analyze.py` | `def render_analyze_view(project_id: str) -> None` | 承接 `pages/2_视频分析.py` 同上 |
| `src/vidmirror/ui/views/create.py` | `def render_create_view(project_id: str) -> None` | 承接 `pages/3_AI导演编剧工作台.py` 同上 |

**命名原则**：每个 view 文件内的辅助函数（如 `_download_group_key`、`_analysis_result_paths`、`_init_session` 等）原样搬运，保持私有（下划线前缀）；**不提升为跨 view 公共工具**，以便迁移 diff 干净。

**签名约定**：
- 输入：`project_id: str`（由 `app.py` 从 `st.session_state[CURRENT_PROJECT_ID_KEY]` 读出后传入，或 view 内部再调一次 `ensure_current_project()` 作为兜底——**推荐后者**，保持与原页面行为一致）
- 返回：`None`，所有输出走 `st` 上下文

**不搬的东西**：
- `st.set_page_config(...)` — 由 `app.py` 统一调用一次
- `st.sidebar.caption/markdown(...)` 后端地址 — 由 `app.py` 主 sidebar 或 `render_history_panel` 上方统一展示
- 项目切换器 UI（现有三个页面各有一份重复实现）— 由 sidebar 的 `render_project_switcher` 替代

### 3.2 `app.py` 重构骨架（伪代码，≤50 行）

```python
# app.py（Phase 2.3 重构后骨架）
import streamlit as st
from shared.config import ensure_data_dirs
from shared.project_context import ensure_current_project, set_current_project
from shared.project_store import list_projects, make_project_id
from src.vidmirror.ui.session_keys import (
    VIEW_KEY, CURRENT_PROJECT_ID_KEY, TASKS_CACHE_KEY, SELECTED_TASK_ID_KEY,
    DOWNLOAD_BACKEND_TASK_IDS_KEY, DOWNLOAD_TASKS_BY_PROJECT_KEY,
    ANALYZE_BACKEND_TASK_BY_PROJECT_KEY, CREATOR_STORYBOARD_TASK_BY_PROJECT_KEY,
)
from src.vidmirror.ui.sidebar import (
    render_logo_brand, render_project_switcher, render_nav_tabs, render_history_panel,
    NAV_VIEW_DOWNLOAD, NAV_VIEW_ANALYZE, NAV_VIEW_CREATE,
)
from src.vidmirror.ui.views import render_download_view, render_analyze_view, render_create_view

ensure_data_dirs()
st.set_page_config(page_title="VidMirror", page_icon="🎬", layout="wide")

# 1. session_state 默认值（含新/旧 key 兜底）
st.session_state.setdefault(VIEW_KEY, NAV_VIEW_DOWNLOAD)
st.session_state.setdefault(TASKS_CACHE_KEY, [])
st.session_state.setdefault(SELECTED_TASK_ID_KEY, "")
st.session_state.setdefault(DOWNLOAD_BACKEND_TASK_IDS_KEY, {})
st.session_state.setdefault(DOWNLOAD_TASKS_BY_PROJECT_KEY, {})
st.session_state.setdefault(ANALYZE_BACKEND_TASK_BY_PROJECT_KEY, {})
st.session_state.setdefault(CREATOR_STORYBOARD_TASK_BY_PROJECT_KEY, {})

project = ensure_current_project()  # 写入 CURRENT_PROJECT_ID_KEY / current_project_name

# 2. 侧边栏（4 个组件 + 设置页链接）
def _on_project_change(pid: str) -> None:
    metas = {m.project_id: m.project_name for m in list_projects()}
    set_current_project(pid, metas.get(pid, pid))
    st.rerun()

def _on_project_create(name: str) -> None:
    pid = make_project_id(name)
    set_current_project(pid, name)
    st.rerun()

def _on_view_change(view: str) -> None:
    # 依赖 st.radio 自动 rerun，不显式触发避免 double-rerun
    st.session_state[VIEW_KEY] = view

def _on_task_select(task_id: str) -> None:
    st.session_state[SELECTED_TASK_ID_KEY] = task_id

with st.sidebar:
    render_logo_brand()
    render_project_switcher(project.project_id, [{"id": m.project_id, "name": m.project_name} for m in list_projects()], _on_project_change, _on_project_create)
    render_nav_tabs(st.session_state[VIEW_KEY], _on_view_change)
    render_history_panel(st.session_state[TASKS_CACHE_KEY], _on_task_select)
    st.divider()
    st.page_link("pages/0_系统设置.py", label="⚙️ 系统设置")

# 3. 主区：按 VIEW_KEY 条件渲染
view = st.session_state[VIEW_KEY]
if view == NAV_VIEW_ANALYZE:
    render_analyze_view(project.project_id)
elif view == NAV_VIEW_CREATE:
    render_create_view(project.project_id)
else:
    render_download_view(project.project_id)
```

（约 48 行；实际实现时可抽 `_register_defaults()` 等微函数。）

### 3.3 `pages/1..3` 处理

**本阶段（2.3.a / 2.3.b）：不动。** 三个旧页面文件原样保留，仍可通过 Streamlit 多页面路由访问（即老路径不失效，双轨并行，降低回归风险）。

**Phase 2.7：**将 `pages/1..3` 改写为 8~10 行的 stub（仅 `st.switch_page("app.py")` 或提示「入口已迁至首页」），并在侧边栏隐藏。

---

## 四、风险 checklist

| # | 检查项 | 结论 | 位置与简述 |
|---|---|---|---|
| 1 | session_state key 名冲突（不同页同名不同类型）？ | **N** | 三页面 key 已按前缀 `download_` / `analyze_` / `creator_` 做命名空间隔离；`current_project_*` 三页共用且类型一致。 |
| 2 | 裸全局变量（模块级可变状态）？ | **N** | 三个 pages 模块内只有 `ANALYSIS_EXPAND_FIRST_JSON_KEY` 字符串常量（不可变），无模块级 list/dict。 |
| 3 | 硬编码 `st.switch_page("pages/...")`？ | **N** | `grep` 扫描 `pages/` 与 `app.py` 未命中。 |
| 4 | 依赖 `st.experimental_get_query_params` 等多页路由特性？ | **N** | 未发现。 |
| 5 | view 之间隐式状态依赖（某 view 必须先执行过）？ | **Y（弱依赖）** | `create` view 读取的 `CREATOR_WEB_ENRICHMENT_MD_KEY` / `CREATOR_VISION_REPORT_KEY` 是该 view 自己写的，不跨 view；但 `analyze` 完成后产出的 `*_视觉数据.json` 会被 `create` view 的"知识库加载"流程读取——这是**文件系统级弱依赖**，不是 session_state 依赖。迁移后行为不变，无风险。 |
| 6（额外） | 轮询 `time.sleep + st.rerun` 在新架构下是否干扰侧边栏？ | **风险：中等** | 原页面每 0.45s rerun 会刷全页，迁入 view 后同样触发整页 rerun（含 sidebar）。UI 闪烁风险存在；**Phase 2.4 用 `st.fragment(run_every=...)` 替换**，本阶段保持原逻辑搬运。 |
| 7（额外） | `shared/project_context.py` 使用字面量 `"current_project_id"` 而非常量 | **N（非阻塞）** | 字符串值与 `CURRENT_PROJECT_ID_KEY` 一致，无需改动；后续可作为清理项。 |

---

## 五、提交策略预告

- **本阶段（2.3 调研）**：仅本文件 `docs/PHASE_2_3_MIGRATION_PLAN.md` 一次独立 commit。
- **2.3.a** — 新建 `src/vidmirror/ui/views/` 骨架（4 个文件），从三个 pages 复制正文到对应 view，**不改任何 pages**，此时 app.py 仍为老入口（页面不可用，仅验证 view 函数能 import）。Commit message: `feat(2.3.a): add views package with logic copied from pages`.
- **2.3.b** — 重写 `app.py` 为新骨架，连通 sidebar + views，双轨运行（老 pages 仍可访问）。手动冒烟测试三 view 与 sidebar 交互。Commit message: `feat(2.3.b): wire sidebar + views in app.py single-page workbench`.

> 原先设想的 2.3.c（为 3 个废弃候选 key 加注释标记）**已取消**。3 个 key 本阶段完全不动，日后确认真无用时再单独清理。

---

## 六、用户已确认事项

1. **`ANALYZE_STATE_BY_PROJECT_KEY` / `ANALYZE_RUNNING_BY_PROJECT_KEY` / `DOWNLOAD_TASKS_BY_PROJECT_KEY` 三个"废弃候选"**：✅ **完全不动**（取消 2.3.c，连注释也不加）。
2. **`CURRENT_PROJECT_NAME_KEY`**：✅ **不在 `session_keys.py` 新增常量**，`shared/project_context.py` 保持现状负责。
3. **轮询策略**：✅ Phase 2.3 **保持 `time.sleep(0.45)+st.rerun()` 原样**，Phase 2.4 再重构为 `st.fragment(run_every=...)`。
4. **老 pages 处理**：✅ **双轨并行**（不隐藏、不改 stub），Phase 2.7 再改 stub。

以上 4 项确认后，进入 2.3.a 编码。

