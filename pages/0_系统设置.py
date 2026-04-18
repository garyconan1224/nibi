"""系统设置：Provider 与全局模型路由。"""

from __future__ import annotations

import time
from dataclasses import asdict
from typing import Any

import streamlit as st
from src.vidmirror.core.providers.registry import create_default_registry
from src.vidmirror.ui.session_keys import SET_SETTINGS_LOADED_KEY

from shared.config import ANTHROPIC_TEXT_MODEL_CHOICES, TEXT_BACKEND_ANTHROPIC, TEXT_BACKEND_OPENAI_COMPAT
from shared.settings_store import AppSettings, ProviderProfile, clear_settings, load_settings, save_settings

SET_PROVIDER_ROWS_KEY = "set_provider_rows"
SET_PROVIDER_SELECTED_ID_KEY = "set_provider_selected_id"
SET_DEFAULT_PROVIDER_CHAT_KEY = "set_default_provider_for_chat"
SET_DEFAULT_PROVIDER_VISION_KEY = "set_default_provider_for_vision"
SET_DEFAULT_PROVIDER_EMBED_KEY = "set_default_provider_for_embedding"
SET_DEFAULT_PROVIDER_RERANK_KEY = "set_default_provider_for_rerank"
SET_TEXT_BACKEND_KEY = "set_text_backend_for_storyboard"
SET_ANTHROPIC_MODEL_KEY = "set_anthropic_model_for_storyboard"


def _init_state() -> None:
    if SET_SETTINGS_LOADED_KEY in st.session_state:
        return
    s = load_settings()
    st.session_state[SET_PROVIDER_ROWS_KEY] = [asdict(p) for p in s.providers]
    st.session_state[SET_PROVIDER_SELECTED_ID_KEY] = s.providers[0].id if s.providers else "__new__"
    st.session_state[SET_DEFAULT_PROVIDER_CHAT_KEY] = s.default_provider_for_chat
    st.session_state[SET_DEFAULT_PROVIDER_VISION_KEY] = s.default_provider_for_vision
    st.session_state[SET_DEFAULT_PROVIDER_EMBED_KEY] = s.default_provider_for_embedding
    st.session_state[SET_DEFAULT_PROVIDER_RERANK_KEY] = s.default_provider_for_rerank
    st.session_state[SET_TEXT_BACKEND_KEY] = s.text_backend or TEXT_BACKEND_OPENAI_COMPAT
    st.session_state[SET_ANTHROPIC_MODEL_KEY] = s.anthropic_model or (
        ANTHROPIC_TEXT_MODEL_CHOICES[0] if ANTHROPIC_TEXT_MODEL_CHOICES else ""
    )
    st.session_state[SET_SETTINGS_LOADED_KEY] = True


def _provider_rows() -> list[dict[str, Any]]:
    raw = st.session_state.get(SET_PROVIDER_ROWS_KEY)
    if not isinstance(raw, list):
        return []
    return [r for r in raw if isinstance(r, dict)]


def _upsert_provider(row: dict[str, Any]) -> None:
    rows = _provider_rows()
    pid = str(row.get("id") or "").strip()
    if not pid:
        return
    for i, r in enumerate(rows):
        if str(r.get("id") or "") == pid:
            rows[i] = row
            st.session_state[SET_PROVIDER_ROWS_KEY] = rows
            return
    rows.append(row)
    st.session_state[SET_PROVIDER_ROWS_KEY] = rows


def _remove_provider(provider_id: str) -> None:
    st.session_state[SET_PROVIDER_ROWS_KEY] = [r for r in _provider_rows() if str(r.get("id") or "") != provider_id]


def _build_settings_from_state() -> AppSettings:
    prev = load_settings()
    providers: list[ProviderProfile] = [ProviderProfile.from_dict(r) for r in _provider_rows()]
    tb = str(st.session_state.get(SET_TEXT_BACKEND_KEY) or prev.text_backend or TEXT_BACKEND_OPENAI_COMPAT).strip()
    if tb not in (TEXT_BACKEND_OPENAI_COMPAT, TEXT_BACKEND_ANTHROPIC):
        tb = TEXT_BACKEND_OPENAI_COMPAT
    am = str(st.session_state.get(SET_ANTHROPIC_MODEL_KEY) or prev.anthropic_model or "").strip()
    return AppSettings(
        openai_api_key=prev.openai_api_key,
        openai_base_url=prev.openai_base_url,
        anthropic_api_key=prev.anthropic_api_key,
        anthropic_base_url=prev.anthropic_base_url,
        text_backend=tb,
        text_model=prev.text_model,
        vision_model=prev.vision_model,
        embedding_model=prev.embedding_model,
        anthropic_model=am,
        providers=tuple(providers),
        default_provider_for_chat=str(st.session_state.get(SET_DEFAULT_PROVIDER_CHAT_KEY) or "").strip(),
        default_provider_for_vision=str(st.session_state.get(SET_DEFAULT_PROVIDER_VISION_KEY) or "").strip(),
        default_provider_for_embedding=str(st.session_state.get(SET_DEFAULT_PROVIDER_EMBED_KEY) or "").strip(),
        default_provider_for_rerank=str(st.session_state.get(SET_DEFAULT_PROVIDER_RERANK_KEY) or "").strip(),
    )


def _provider_report(provider_id: str) -> dict[str, Any]:
    rows = _provider_rows()
    row = next((r for r in rows if str(r.get("id") or "") == provider_id), None)
    if row is None:
        raise ValueError("provider not found")
    profile = ProviderProfile.from_dict(row)
    provider = create_default_registry().build(profile)
    started = time.perf_counter()
    msg = provider.test_connection()
    elapsed = int((time.perf_counter() - started) * 1000)
    model_count = 0
    failure_reason = ""
    try:
        model_count = len(provider.list_models("chat"))
    except Exception as err:  # noqa: BLE001
        failure_reason = str(err)
    return {
        "provider_id": profile.id,
        "provider_name": profile.name,
        "kind": profile.kind,
        "latency_ms": elapsed,
        "chat_model_count": model_count,
        "message": msg,
        "failure_reason": failure_reason,
    }


st.set_page_config(page_title="系统设置", page_icon="⚙️", layout="wide")
_init_state()

st.title("⚙️ 系统设置")
st.caption("在此管理 Provider 配置与能力路由；设置保存在 `.local/settings.json`。")

rows = _provider_rows()
provider_ids = [str(r.get("id") or "") for r in rows if str(r.get("id") or "").strip()]
_pid_opts = provider_ids + ["__new__"]
selected_provider_id = st.selectbox(
    "选择 Provider 配置",
    options=_pid_opts,
    index=(provider_ids.index(st.session_state.get(SET_PROVIDER_SELECTED_ID_KEY)) if st.session_state.get(SET_PROVIDER_SELECTED_ID_KEY) in provider_ids else len(provider_ids)),
    format_func=lambda x: "＋ 新建 Provider" if x == "__new__" else str(x),
    key=SET_PROVIDER_SELECTED_ID_KEY,
)
selected_provider = next((r for r in rows if str(r.get("id") or "") == selected_provider_id), {}) if selected_provider_id != "__new__" else {}

st.subheader("Provider 档案")
pid_val = st.text_input("Provider ID", value=str(selected_provider.get("id") or ""), placeholder="例如 siliconflow-main")
name_val = st.text_input("显示名称", value=str(selected_provider.get("name") or ""), placeholder="例如 硅基流动主账号")
kind_val = st.selectbox(
    "类型",
    options=["openai_compatible", "anthropic"],
    format_func=lambda x: "OpenAI 兼容" if x == "openai_compatible" else "Anthropic",
    index=0 if str(selected_provider.get("kind") or "openai_compatible") != "anthropic" else 1,
)
enabled_val = st.checkbox("启用", value=bool(selected_provider.get("enabled", True)))
api_key_val = st.text_input("API Key", value=str(selected_provider.get("api_key") or ""), type="password")
base_url_val = st.text_input("Base URL（可留空使用默认）", value=str(selected_provider.get("base_url") or ""))
caps_default = selected_provider.get("capabilities") or ["chat"]
caps_val = st.multiselect(
    "能力（chat 对话 / vision 视觉 / embedding 嵌入 / rerank 重排序）",
    options=["chat", "vision", "embedding", "rerank"],
    default=[str(c) for c in caps_default],
)

default_models_raw = selected_provider.get("default_models") or {}
chat_model_default = st.text_input("默认对话模型", value=str(default_models_raw.get("chat") or ""))
vision_model_default = st.text_input("默认视觉模型", value=str(default_models_raw.get("vision") or ""))
embed_model_default = st.text_input("默认嵌入模型", value=str(default_models_raw.get("embedding") or ""))
rerank_model_default = st.text_input("默认重排序模型", value=str(default_models_raw.get("rerank") or ""))
rate_limit_rpm = st.number_input("每分钟请求上限（RPM）", min_value=1, max_value=100000, value=int(selected_provider.get("rate_limit_rpm") or 60), step=1)
timeout_sec = st.number_input("请求超时（秒）", min_value=10, max_value=3600, value=int(selected_provider.get("timeout_sec") or 120), step=5)

action_col, delete_col = st.columns(2)
with action_col:
    if st.button("保存/更新 Provider", use_container_width=True):
        if not pid_val.strip():
            st.warning("Provider ID 不能为空")
        else:
            _upsert_provider(
                {
                    "id": pid_val.strip(),
                    "name": name_val.strip() or pid_val.strip(),
                    "kind": kind_val,
                    "enabled": enabled_val,
                    "api_key": api_key_val.strip(),
                    "base_url": base_url_val.strip(),
                    "capabilities": list(caps_val) or ["chat"],
                    "default_models": {
                        "chat": chat_model_default.strip(),
                        "vision": vision_model_default.strip(),
                        "embedding": embed_model_default.strip(),
                        "rerank": rerank_model_default.strip(),
                    },
                    "rate_limit_rpm": int(rate_limit_rpm),
                    "timeout_sec": int(timeout_sec),
                }
            )
            st.success("已保存当前 Provider")
            st.rerun()
with delete_col:
    if st.button("删除当前 Provider", use_container_width=True, disabled=selected_provider_id == "__new__"):
        _remove_provider(selected_provider_id)
        st.success("已删除该 Provider")
        st.rerun()

st.subheader("能力一览")
matrix_rows: list[dict[str, Any]] = []
for r in _provider_rows():
    matrix_rows.append(
        {
            "标识": r.get("id"),
            "名称": r.get("name"),
            "启用": r.get("enabled", True),
            "对话": "chat" in (r.get("capabilities") or []),
            "视觉": "vision" in (r.get("capabilities") or []),
            "嵌入": "embedding" in (r.get("capabilities") or []),
            "重排序": "rerank" in (r.get("capabilities") or []),
            "RPM": r.get("rate_limit_rpm", 60),
            "超时秒": r.get("timeout_sec", 120),
        }
    )
if matrix_rows:
    st.dataframe(matrix_rows, use_container_width=True)
else:
    st.info("暂无 Provider，请先新增。")

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

default_options = [""] + [str(r.get("id") or "") for r in _provider_rows() if bool(r.get("enabled", True))]
fmt_route = lambda x: "（未指定则自动选首个可用）" if not x else x
route_col1, route_col2 = st.columns(2)
with route_col1:
    st.selectbox("默认对话 Provider", options=default_options, format_func=fmt_route, key=SET_DEFAULT_PROVIDER_CHAT_KEY)
    st.selectbox("默认视觉 Provider", options=default_options, format_func=fmt_route, key=SET_DEFAULT_PROVIDER_VISION_KEY)
with route_col2:
    st.selectbox("默认嵌入 Provider", options=default_options, format_func=fmt_route, key=SET_DEFAULT_PROVIDER_EMBED_KEY)
    st.selectbox("默认重排序 Provider", options=default_options, format_func=fmt_route, key=SET_DEFAULT_PROVIDER_RERANK_KEY)

report_col, report_result_col = st.columns(2)
with report_col:
    if st.button("测试当前 Provider 并生成报告", use_container_width=True):
        try:
            report = _provider_report(selected_provider_id)
            st.session_state["set_provider_report"] = report
            st.success("测试完成")
        except Exception as err:  # noqa: BLE001
            st.error(f"测试失败：{err}")
with report_result_col:
    report = st.session_state.get("set_provider_report")
    if isinstance(report, dict):
        st.json(report)

save_col, clear_col = st.columns(2)
with save_col:
    if st.button("保存所有设置", type="primary", use_container_width=True):
        settings = _build_settings_from_state()
        save_settings(settings)
        st.success("设置已保存。")
with clear_col:
    if st.button("清空本地设置（发布前建议）", use_container_width=True):
        clear_settings()
        st.session_state.pop(SET_SETTINGS_LOADED_KEY, None)
        st.success("本地设置已清空。")
