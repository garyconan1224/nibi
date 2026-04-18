"""Phase 2.2 — 可复用侧边栏组件。

所有组件均为纯函数：
- 不直接写 st.session_state（状态通过 props 传入）
- 可读 st.session_state 作为默认值回退
- 仅依赖 streamlit，不引入第三方库
"""

from __future__ import annotations

from typing import Callable

import streamlit as st

from shared.backend_client import get_recent_tasks

# 导航视图常量（与 session_keys.VIEW_KEY 取值对齐）
NAV_VIEW_DOWNLOAD = "download"
NAV_VIEW_ANALYZE = "analyze"
NAV_VIEW_CREATE = "create"

# 导航选项（key, 展示文案）
_NAV_OPTIONS: list[tuple[str, str]] = [
    (NAV_VIEW_DOWNLOAD, "⬇ 下载"),
    (NAV_VIEW_ANALYZE, "🔍 分析"),
    (NAV_VIEW_CREATE, "✍️ 创作"),
]

# 任务状态 → 展示徽章（emoji + 中文）
_STATUS_BADGES: dict[str, str] = {
    "pending": "⏳ 等待中",
    "queued": "⏳ 排队中",
    "running": "🔵 进行中",
    "success": "🟢 成功",
    "succeeded": "🟢 成功",
    "done": "🟢 完成",
    "failed": "🔴 失败",
    "error": "🔴 失败",
    "cancelled": "⚪ 已取消",
    "canceled": "⚪ 已取消",
}


def render_logo_brand() -> None:
    """渲染顶部 Logo + 品牌名 + 副标题。"""
    st.markdown("## 🎬 VidMirror")
    st.caption("AI 视频创作工作台")
    st.divider()


def render_project_switcher(
    current_project_id: Optional[str],
    project_list: list[dict],
    on_change: Callable[[str], None],
    on_create: Callable[[str], None],
) -> None:
    """渲染项目切换下拉 + 新建项目按钮。

    project_list 每项需包含 "id" 与 "name" 字段。
    """
    st.markdown("**项目**")

    if not project_list:
        st.info("暂无项目，点击下方「+ 新建项目」创建。")
    else:
        ids = [str(p.get("id", "")) for p in project_list]
        name_by_id = {str(p.get("id", "")): str(p.get("name", "")) for p in project_list}

        try:
            current_idx = ids.index(str(current_project_id)) if current_project_id else 0
        except ValueError:
            current_idx = 0

        selected = st.selectbox(
            "当前项目",
            options=ids,
            index=current_idx,
            format_func=lambda pid: name_by_id.get(pid, pid),
            label_visibility="collapsed",
            key="_sidebar_project_select",
        )
        if selected and selected != current_project_id:
            on_change(selected)

    # 新建项目对话框（Streamlit ≥ 1.33 原生 st.dialog）
    @st.dialog("新建项目")
    def _create_dialog() -> None:
        name = st.text_input("项目名称", placeholder="如：春日短片拍摄计划")
        cols = st.columns(2)
        with cols[0]:
            if st.button("创建", type="primary", use_container_width=True):
                if name.strip():
                    on_create(name.strip())
                    st.rerun()
                else:
                    st.warning("项目名称不能为空")
        with cols[1]:
            if st.button("取消", use_container_width=True):
                st.rerun()

    if st.button("+ 新建项目", use_container_width=True, key="_sidebar_new_project_btn"):
        _create_dialog()

    st.divider()


def render_nav_tabs(
    current_view: str,
    on_change: Callable[[str], None],
) -> None:
    """渲染主流程导航（下载 / 分析 / 创作）。"""
    st.markdown("**主流程**")

    keys = [k for k, _ in _NAV_OPTIONS]
    label_by_key = dict(_NAV_OPTIONS)

    try:
        idx = keys.index(current_view)
    except ValueError:
        idx = 0

    selected = st.radio(
        "主流程导航",
        options=keys,
        index=idx,
        format_func=lambda k: label_by_key.get(k, k),
        label_visibility="collapsed",
        key="_sidebar_nav_radio",
    )
    if selected and selected != current_view:
        on_change(selected)

    st.divider()


def render_history_panel(
    on_select: Callable[[str], None],
) -> None:
    """渲染历史任务面板（Phase 2.4：每 3 秒自动轮询后端）。

    on_select：点击「查看详情」时的回调，接收 task_id 字符串。
    后端不可达时静默降级，仅显示「暂无任务记录」。
    """
    st.markdown("**最近任务**")

    @st.fragment(run_every="3s")
    def _poll_and_render() -> None:
        """片段函数：每 3 秒独立重跑，拉取并渲染最新任务列表。"""
        try:
            tasks = get_recent_tasks(limit=10)
        except Exception:
            # 后端不可达或返回异常 → 静默降级
            tasks = []

        if not tasks:
            st.caption("暂无任务记录")
            return

        for task in tasks[:10]:
            task_id = str(task.get("id", ""))
            title = str(task.get("title", "(无标题)"))
            status = str(task.get("status", ""))
            time_str = str(task.get("time", ""))
            badge = _STATUS_BADGES.get(status.lower(), f"• {status}" if status else "")

            with st.container(border=True):
                st.markdown(f"**{title}**")
                meta_parts = [p for p in (badge, time_str) if p]
                if meta_parts:
                    st.caption("　".join(meta_parts))
                if st.button(
                    "查看详情",
                    key=f"_sidebar_task_btn_{task_id}",
                    use_container_width=True,
                ):
                    on_select(task_id)

    _poll_and_render()

