"""系统设置页：两栏布局，左侧菜单 + 右侧子模块渲染。"""

from __future__ import annotations

import streamlit as st
from src.vidmirror.ui.session_keys import SETTINGS_MENU_KEY
from src.vidmirror.ui.settings.model_settings import _init_state, render_model_settings
from src.vidmirror.ui.settings.downloader_settings import render_downloader_settings
from src.vidmirror.ui.settings.text_backend_settings import render_text_backend_settings
from src.vidmirror.ui.settings.about import render_about_settings

# 菜单选项（顺序固定）
_MENU_OPTIONS = ["模型 Provider", "下载器", "文本后端", "关于"]

st.set_page_config(page_title="系统设置", page_icon="⚙️", layout="wide")

# 初始化全局设置状态（幂等，只在首次加载时执行）
_init_state()

# 初始化菜单选择记忆
if SETTINGS_MENU_KEY not in st.session_state:
    st.session_state[SETTINGS_MENU_KEY] = _MENU_OPTIONS[0]

st.title("⚙️ 系统设置")
st.caption("在此管理 Provider 配置与能力路由；设置保存在 `.local/settings.json`。")

# 两栏布局：左侧 1 份宽 / 右侧 3 份宽
left_col, right_col = st.columns([1, 3])

with left_col:
    st.radio(
        "设置菜单",
        options=_MENU_OPTIONS,
        key=SETTINGS_MENU_KEY,
    )

with right_col:
    _menu = st.session_state[SETTINGS_MENU_KEY]
    if _menu == "模型 Provider":
        render_model_settings()
    elif _menu == "下载器":
        render_downloader_settings()
    elif _menu == "文本后端":
        render_text_backend_settings()
    elif _menu == "关于":
        render_about_settings()
