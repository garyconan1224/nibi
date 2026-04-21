"""下载器配置面板：B 站 Cookies / YouTube PO Token / HTTP 代理。"""

from __future__ import annotations

import streamlit as st

# session_state key 常量（字符串值严格保持不变，供其他模块读取）
SET_DL_LOADED_KEY = "set_downloader_loaded"
SET_DL_BILIBILI_COOKIES_KEY = "set_dl_bilibili_cookies_path"
SET_DL_BILIBILI_NO_COOKIE_KEY = "set_dl_bilibili_no_cookie_mode"
SET_DL_YT_PO_TOKEN_KEY = "set_dl_youtube_po_token"
SET_DL_YT_VISITOR_DATA_KEY = "set_dl_youtube_visitor_data"
SET_DL_HTTP_PROXY_KEY = "set_dl_http_proxy"
# 聚合存储：点击保存后将所有字段写入此键，供下载器模块统一读取
SET_DL_CONFIG_KEY = "downloader_settings"

# 默认值
_DEFAULT_BILIBILI_COOKIES_PATH = "data/cookies/bilibili_cookies.txt"
_PROXY_ALLOWED_PREFIXES = ("http://", "socks5://")


def _init_state() -> None:
    """初始化下载器设置页 session_state（每次页面加载只执行一次）。"""
    if SET_DL_LOADED_KEY in st.session_state:
        return
    # 若此前已保存过（同一进程内），以已保存值回填；否则使用默认值
    prev = st.session_state.get(SET_DL_CONFIG_KEY) or {}
    st.session_state.setdefault(
        SET_DL_BILIBILI_COOKIES_KEY,
        str(prev.get("bilibili_cookies_path") or _DEFAULT_BILIBILI_COOKIES_PATH),
    )
    st.session_state.setdefault(
        SET_DL_BILIBILI_NO_COOKIE_KEY,
        bool(prev.get("bilibili_no_cookie_mode", True)),
    )
    st.session_state.setdefault(SET_DL_YT_PO_TOKEN_KEY, str(prev.get("youtube_po_token") or ""))
    st.session_state.setdefault(SET_DL_YT_VISITOR_DATA_KEY, str(prev.get("youtube_visitor_data") or ""))
    st.session_state.setdefault(SET_DL_HTTP_PROXY_KEY, str(prev.get("http_proxy") or ""))
    st.session_state[SET_DL_LOADED_KEY] = True


def _validate_proxy(value: str) -> str:
    """校验代理地址格式；返回错误信息字符串，空串表示通过。"""
    v = (value or "").strip()
    if not v:
        return ""
    if not v.startswith(_PROXY_ALLOWED_PREFIXES):
        return "HTTP 代理必须以 http:// 或 socks5:// 开头"
    return ""


def render_downloader_settings() -> None:
    """渲染下载器配置表单：B 站 / YouTube / 通用三段，支持校验与保存。"""
    _init_state()

    # ── B 站配置 ─────────────────────────────────────────────
    st.subheader("B 站配置")
    st.text_input(
        "Cookies 路径",
        key=SET_DL_BILIBILI_COOKIES_KEY,
        placeholder=_DEFAULT_BILIBILI_COOKIES_PATH,
    )
    st.caption("请将导出的 cookies 文件放入该路径")
    st.toggle(
        "无 Cookie 模式",
        key=SET_DL_BILIBILI_NO_COOKIE_KEY,
        help="开启后将尝试通过 WBI 签名获取低清直链",
    )

    # ── YouTube 配置 ─────────────────────────────────────────
    st.subheader("YouTube 配置")
    st.text_input(
        "PO Token",
        key=SET_DL_YT_PO_TOKEN_KEY,
        placeholder="选填，用于绕过部分地区限制",
    )
    st.text_input(
        "Visitor Data",
        key=SET_DL_YT_VISITOR_DATA_KEY,
        placeholder="选填",
    )

    # ── 通用配置 ─────────────────────────────────────────────
    st.subheader("通用配置")
    st.text_input(
        "HTTP 代理",
        key=SET_DL_HTTP_PROXY_KEY,
        placeholder="http://127.0.0.1:7890",
    )

    # ── 保存按钮 ─────────────────────────────────────────────
    if st.button("保存下载器配置", type="primary"):
        # 代理格式校验
        proxy_value = str(st.session_state.get(SET_DL_HTTP_PROXY_KEY) or "").strip()
        proxy_error = _validate_proxy(proxy_value)
        if proxy_error:
            st.error(proxy_error)
            return

        # 聚合为字典并写回 session_state
        payload = {
            "bilibili_cookies_path": str(st.session_state.get(SET_DL_BILIBILI_COOKIES_KEY) or "").strip(),
            "bilibili_no_cookie_mode": bool(st.session_state.get(SET_DL_BILIBILI_NO_COOKIE_KEY, True)),
            "youtube_po_token": str(st.session_state.get(SET_DL_YT_PO_TOKEN_KEY) or "").strip(),
            "youtube_visitor_data": str(st.session_state.get(SET_DL_YT_VISITOR_DATA_KEY) or "").strip(),
            "http_proxy": proxy_value,
        }
        st.session_state[SET_DL_CONFIG_KEY] = payload

        # shared/config.py 当前未提供 save_settings / update_config 等持久化入口，
        # 故暂存入 st.session_state；待该模块提供落盘函数后再接入。
        st.success("配置已保存")
