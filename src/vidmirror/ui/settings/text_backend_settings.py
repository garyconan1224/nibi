"""分镜文本后端切换设置。"""

from __future__ import annotations

import streamlit as st

from shared.config import ANTHROPIC_TEXT_MODEL_CHOICES, TEXT_BACKEND_ANTHROPIC, TEXT_BACKEND_OPENAI_COMPAT

# session_state key 常量（字符串值严格保持不变）
SET_TEXT_BACKEND_KEY = "set_text_backend_for_storyboard"
SET_ANTHROPIC_MODEL_KEY = "set_anthropic_model_for_storyboard"


def render_text_backend_settings() -> None:
    """渲染分镜文本后端切换表单。"""
    st.subheader("分镜文本后端（创作工作台）")
    st.caption("分镜生成使用的聊天 API 类型；密钥与模型仍由上方 Provider 与默认路由决定。")
    st.radio(
        "默认文本后端",
        options=[TEXT_BACKEND_OPENAI_COMPAT, TEXT_BACKEND_ANTHROPIC],
        format_func=lambda x: "OpenAI 兼容" if x == TEXT_BACKEND_OPENAI_COMPAT else "Anthropic",
        key=SET_TEXT_BACKEND_KEY,
        horizontal=True,
    )
    _am_opts = list(ANTHROPIC_TEXT_MODEL_CHOICES)
    _am_cur = str(st.session_state.get(SET_ANTHROPIC_MODEL_KEY) or "")
    if _am_cur and _am_cur not in _am_opts:
        _am_opts = [_am_cur] + _am_opts
    st.selectbox(
        "Anthropic 文本模型（仅当分镜后端为 Anthropic 时使用）",
        options=_am_opts,
        key=SET_ANTHROPIC_MODEL_KEY,
    )

