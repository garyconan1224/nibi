"""
按硅基流动 GET /v1/models 拉取「当前 API Key 可见」的模型列表，避免硬编码 id 导致 20012。
"""

from __future__ import annotations

from typing import Optional, Sequence, Tuple

import streamlit as st

from shared.config import (
    EMBEDDING_MODEL_CHOICES,
    TEXT_MODEL_CHOICES,
    VISION_MODEL_CHOICES,
    VISION_MODEL_DEFAULT,
)
from shared.model_utils import split_chat_models
from shared.sf_client import SiliconFlowError, get_model_ids


@st.cache_data(ttl=300, show_spinner=False)
def _cached_chat_model_ids(api_key: str) -> Tuple[str, ...]:
    return tuple(get_model_ids(api_key, "chat"))


@st.cache_data(ttl=300, show_spinner=False)
def _cached_embedding_model_ids(api_key: str) -> Tuple[str, ...]:
    return tuple(get_model_ids(api_key, "embedding"))


def clear_model_list_cache() -> None:
    """侧边栏「刷新模型列表」时调用。"""
    _cached_chat_model_ids.clear()
    _cached_embedding_model_ids.clear()


def sidebar_model_options(api_key: str) -> tuple[list[str], list[str], list[str], str]:
    """
    返回 (text_choices, vision_choices, embedding_choices, 状态说明)。
    拉取失败或未配置 Key 时，回退到 config 中的内置列表。
    """
    t_fb = list(TEXT_MODEL_CHOICES)
    v_fb = list(VISION_MODEL_CHOICES)
    e_fb = list(EMBEDDING_MODEL_CHOICES)
    k = (api_key or "").strip()
    if not k:
        return t_fb, v_fb, e_fb, "未配置 API Key，使用内置模型候选（可能与账号不一致，易 20012）。"

    try:
        chats = list(_cached_chat_model_ids(k))
        embs = list(_cached_embedding_model_ids(k))
    except SiliconFlowError as e:
        return t_fb, v_fb, e_fb, f"拉取模型列表失败：{e}（已回退内置候选）"
    except Exception as e:  # noqa: BLE001
        return t_fb, v_fb, e_fb, f"拉取模型列表异常：{e!s}（已回退内置候选）"

    if not chats:
        return t_fb, v_fb, e_fb, "接口返回 0 个 chat 模型，已回退内置候选。"

    text_opts, vision_opts = split_chat_models(chats)
    # 仅保留 API 返回的真实模型 id，不再混入内置候选（避免选到账号下不存在的 id 导致 20012）
    emb_opts = sorted(set(embs)) if embs else e_fb
    msg = (
        f"已从硅基流动同步：文本 **{len(text_opts)}** / 视觉 **{len(vision_opts)}** / 嵌入 **{len(emb_opts)}**。"
        f"侧栏仅显示你账号下可用的模型。"
    )
    return text_opts, vision_opts, emb_opts, msg


def coerce_select_value(key: str, options: Sequence[str], preferred: Optional[str]) -> None:
    """保证 session_state[key] 落在 options 内；否则用 preferred 或首项。"""
    opts = list(options)
    if not opts:
        st.session_state[key] = ""
        return
    cur = st.session_state.get(key)
    if cur in opts:
        return
    if preferred and preferred in opts:
        st.session_state[key] = preferred
    else:
        st.session_state[key] = opts[0]


def preferred_vision_default(vision_opts: Sequence[str]) -> str:
    if VISION_MODEL_DEFAULT in vision_opts:
        return VISION_MODEL_DEFAULT
    return vision_opts[0] if vision_opts else ""
