"""VidMirror — AI 视频创作工作台（Phase 2.3.b 单页工作台入口）。

本入口统一装配侧边栏（Logo / 项目切换 / 主流程导航 / 历史任务 / 系统设置链接），
并按 VIEW_KEY 条件渲染下载 / 分析 / 创作三视图。

本地配置：复制 .env.example 为 .env 并填写密钥（勿提交 .env）。
"""

from __future__ import annotations

import streamlit as st

from shared.config import ensure_data_dirs
from shared.project_context import ensure_current_project, set_current_project
from shared.project_store import list_projects, make_project_id
from src.vidmirror.ui.session_keys import (
    ANALYZE_BACKEND_TASK_BY_PROJECT_KEY,
    CREATOR_STORYBOARD_TASK_BY_PROJECT_KEY,
    DOWNLOAD_BACKEND_TASK_IDS_KEY,
    DOWNLOAD_TASKS_BY_PROJECT_KEY,
    SELECTED_TASK_ID_KEY,
    TASKS_CACHE_KEY,
    VIEW_KEY,
)
from src.vidmirror.ui.sidebar import (
    NAV_VIEW_ANALYZE,
    NAV_VIEW_CREATE,
    NAV_VIEW_DOWNLOAD,
    render_history_panel,
    render_logo_brand,
    render_nav_tabs,
    render_project_switcher,
)
from src.vidmirror.ui.views import render_analyze_view, render_create_view, render_download_view

ensure_data_dirs()

st.set_page_config(
    page_title="VidMirror — AI 视频创作工作台",
    page_icon="🎬",
    layout="wide",
)

# 1. session_state 默认值（含新/旧 key 兜底）
st.session_state.setdefault(VIEW_KEY, NAV_VIEW_DOWNLOAD)
st.session_state.setdefault(TASKS_CACHE_KEY, [])
st.session_state.setdefault(SELECTED_TASK_ID_KEY, "")
st.session_state.setdefault(DOWNLOAD_BACKEND_TASK_IDS_KEY, {})
st.session_state.setdefault(DOWNLOAD_TASKS_BY_PROJECT_KEY, {})
st.session_state.setdefault(ANALYZE_BACKEND_TASK_BY_PROJECT_KEY, {})
st.session_state.setdefault(CREATOR_STORYBOARD_TASK_BY_PROJECT_KEY, {})

project = ensure_current_project()


# 2. 侧边栏回调
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
    render_project_switcher(
        current_project_id=project.project_id,
        project_list=[{"id": m.project_id, "name": m.project_name} for m in list_projects()],
        on_change=_on_project_change,
        on_create=_on_project_create,
    )
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
