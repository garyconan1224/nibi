"""Phase 2.2 — 侧边栏组件最小可运行 demo。

启动方式：
    streamlit run src/vidmirror/ui/demo_sidebar.py

演示内容：
- 在 st.sidebar 中渲染 4 个组件（Logo、项目切换、主流程导航、历史任务）
- 用假数据（3 个项目、5 个任务）喂给组件
- 用 st.session_state 模拟 on_change / on_create / on_select 回调落地
- 右侧主区打印当前 view / project_id / 选中任务，证明回调生效
"""

from __future__ import annotations

import sys
from pathlib import Path

# demo 脚本作为独立入口运行时，手动把项目根目录加入 sys.path
PROJECT_ROOT = Path(__file__).resolve().parents[3]  # src/vidmirror/ui/demo.py → nibi/
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import streamlit as st  # noqa: E402

from src.vidmirror.ui.session_keys import (  # noqa: E402
    CURRENT_PROJECT_ID_KEY,
    SELECTED_TASK_ID_KEY,
    VIEW_KEY,
)
from src.vidmirror.ui.sidebar import (  # noqa: E402
    NAV_VIEW_DOWNLOAD,
    render_history_panel,
    render_logo_brand,
    render_nav_tabs,
    render_project_switcher,
)

# 假数据 -----------------------------------------------------------------
_FAKE_PROJECTS: list[dict] = [
    {"id": "proj_001", "name": "春日短片拍摄计划"},
    {"id": "proj_002", "name": "毕业 Vlog"},
    {"id": "proj_003", "name": "产品宣传片 v2"},
]

_FAKE_TASKS: list[dict] = [
    {"id": "task_01", "title": "下载 B 站视频 BV1xxxxxx", "status": "running", "time": "10:23"},
    {"id": "task_02", "title": "分析 sample_01.mp4", "status": "success", "time": "10:15"},
    {"id": "task_03", "title": "生成分镜方案 A", "status": "pending", "time": "10:02"},
    {"id": "task_04", "title": "下载 YouTube 视频", "status": "failed", "time": "09:48"},
    {"id": "task_05", "title": "分析 sample_02.mp4", "status": "success", "time": "09:30"},
]

# 回调：仅写 demo 自身持有的 session_state（组件内部不写）
_DEMO_NEW_PROJECT_KEY = "_demo_last_new_project_name"


def _on_project_change(project_id: str) -> None:
    st.session_state[CURRENT_PROJECT_ID_KEY] = project_id


def _on_project_create(name: str) -> None:
    # demo 中仅记录新建项目名称，不实际创建
    st.session_state[_DEMO_NEW_PROJECT_KEY] = name


def _on_view_change(view: str) -> None:
    st.session_state[VIEW_KEY] = view


def _on_task_select(task_id: str) -> None:
    st.session_state[SELECTED_TASK_ID_KEY] = task_id


# 页面配置 ---------------------------------------------------------------
st.set_page_config(
    page_title="VidMirror Sidebar Demo",
    page_icon="🎬",
    layout="wide",
)

# 初始化 demo 全局状态（仅在 demo 文件中处理，组件本身不写 session）
if VIEW_KEY not in st.session_state:
    st.session_state[VIEW_KEY] = NAV_VIEW_DOWNLOAD
if CURRENT_PROJECT_ID_KEY not in st.session_state:
    st.session_state[CURRENT_PROJECT_ID_KEY] = _FAKE_PROJECTS[0]["id"]
if SELECTED_TASK_ID_KEY not in st.session_state:
    st.session_state[SELECTED_TASK_ID_KEY] = None

# 侧边栏渲染 -------------------------------------------------------------
with st.sidebar:
    render_logo_brand()
    render_project_switcher(
        current_project_id=st.session_state[CURRENT_PROJECT_ID_KEY],
        project_list=_FAKE_PROJECTS,
        on_change=_on_project_change,
        on_create=_on_project_create,
    )
    render_nav_tabs(
        current_view=st.session_state[VIEW_KEY],
        on_change=_on_view_change,
    )
    render_history_panel(
        tasks=_FAKE_TASKS,
        on_select=_on_task_select,
        refresh_callback=None,
    )

# 主区：回显回调落地情况 -------------------------------------------------
st.title("🎬 VidMirror — 侧边栏组件 Demo")
st.caption("用于验证 Phase 2.2 侧边栏组件的回调契约。")

col_l, col_r = st.columns(2)

with col_l:
    st.subheader("当前状态")
    st.write({
        "view": st.session_state.get(VIEW_KEY),
        "current_project_id": st.session_state.get(CURRENT_PROJECT_ID_KEY),
        "selected_task_id": st.session_state.get(SELECTED_TASK_ID_KEY),
    })

with col_r:
    st.subheader("最近一次「新建项目」输入")
    last_new = st.session_state.get(_DEMO_NEW_PROJECT_KEY)
    if last_new:
        st.success(f"on_create 回调收到：{last_new}")
    else:
        st.info("点击侧边栏「+ 新建项目」按钮并提交名称，即可在这里看到回调结果。")

st.divider()
st.markdown(
    """
    ### 验证清单
    - 切换侧边栏「主流程」→ 左上「view」字段变化
    - 切换侧边栏「项目」下拉 → 左上「current_project_id」字段变化
    - 点击任一任务的「查看详情」→ 左上「selected_task_id」字段变化
    - 点击「+ 新建项目」输入名称 → 右上出现 on_create 回调结果
    """
)

