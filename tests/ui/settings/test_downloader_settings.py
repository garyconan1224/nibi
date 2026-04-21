"""下载器配置页面的单元测试。

覆盖范围：
- _validate_proxy: 空值/http/socks5/非法前缀分支
- _init_state: 首次初始化与已保存值的行为
- render_downloader_settings: UI 渲染与保存流程
"""

from __future__ import annotations

import unittest.mock as mock
from typing import Any

import pytest

from src.vidmirror.ui.settings.downloader_settings import (
    SET_DL_BILIBILI_COOKIES_KEY,
    SET_DL_BILIBILI_NO_COOKIE_KEY,
    SET_DL_CONFIG_KEY,
    SET_DL_HTTP_PROXY_KEY,
    SET_DL_LOADED_KEY,
    SET_DL_YT_PO_TOKEN_KEY,
    SET_DL_YT_VISITOR_DATA_KEY,
    _DEFAULT_BILIBILI_COOKIES_PATH,
    _init_state,
    _validate_proxy,
)


# ── _validate_proxy 单元测试 ──────────────────────────────────────


class TestValidateProxy:
    """代理校验函数测试套件。"""

    def test_empty_string_passes(self) -> None:
        """空值应通过校验（返回空字符串）。"""
        assert _validate_proxy("") == ""

    def test_none_value_passes(self) -> None:
        """None 值应通过校验。"""
        assert _validate_proxy(None) == ""  # type: ignore

    def test_whitespace_only_passes(self) -> None:
        """仅空白字符的值应通过校验。"""
        assert _validate_proxy("   \n\t") == ""

    def test_http_prefix_passes(self) -> None:
        """以 http:// 开头的值应通过校验。"""
        assert _validate_proxy("http://127.0.0.1:7890") == ""
        assert _validate_proxy("http://proxy.example.com:8080") == ""

    def test_socks5_prefix_passes(self) -> None:
        """以 socks5:// 开头的值应通过校验。"""
        assert _validate_proxy("socks5://127.0.0.1:1080") == ""
        assert _validate_proxy("socks5://proxy.example.com:1080") == ""

    def test_invalid_prefix_fails(self) -> None:
        """非法前缀应返回错误信息。"""
        error = _validate_proxy("https://127.0.0.1:7890")
        assert error != ""
        assert "http://" in error or "socks5://" in error

    def test_no_scheme_fails(self) -> None:
        """无协议前缀应返回错误信息。"""
        error = _validate_proxy("127.0.0.1:7890")
        assert error != ""

    def test_ftp_prefix_fails(self) -> None:
        """ftp:// 前缀应返回错误信息。"""
        error = _validate_proxy("ftp://127.0.0.1:21")
        assert error != ""

    def test_whitespace_trim_before_check(self) -> None:
        """校验前应先去除前导/后置空白。"""
        # "   http://..." 应通过，因为 strip() 后再检查
        assert _validate_proxy("   http://127.0.0.1:7890  ") == ""

    def test_whitespace_trim_invalid_prefix(self) -> None:
        """去除空白后仍为非法前缀的值应失败。"""
        error = _validate_proxy("   invalid://proxy   ")
        assert error != ""


# ── _init_state 单元测试 ───────────────────────────────────────────


class TestInitState:
    """状态初始化函数测试套件。"""

    def _clear_session_state(self) -> None:
        """清空 session_state（测试间隔）。"""
        with mock.patch("streamlit.session_state", {}):
            pass

    def test_init_state_first_time_sets_defaults(self) -> None:
        """首次初始化时应设置所有默认值。"""
        mock_state: dict[str, Any] = {}

        with mock.patch("streamlit.session_state", mock_state):
            _init_state()

        # 检查所有字段是否已初始化
        assert SET_DL_LOADED_KEY in mock_state
        assert mock_state[SET_DL_LOADED_KEY] is True

        assert SET_DL_BILIBILI_COOKIES_KEY in mock_state
        assert mock_state[SET_DL_BILIBILI_COOKIES_KEY] == _DEFAULT_BILIBILI_COOKIES_PATH

        assert SET_DL_BILIBILI_NO_COOKIE_KEY in mock_state
        assert mock_state[SET_DL_BILIBILI_NO_COOKIE_KEY] is True  # 默认开启

        assert SET_DL_YT_PO_TOKEN_KEY in mock_state
        assert mock_state[SET_DL_YT_PO_TOKEN_KEY] == ""

        assert SET_DL_YT_VISITOR_DATA_KEY in mock_state
        assert mock_state[SET_DL_YT_VISITOR_DATA_KEY] == ""

        assert SET_DL_HTTP_PROXY_KEY in mock_state
        assert mock_state[SET_DL_HTTP_PROXY_KEY] == ""

    def test_init_state_idempotent_does_not_overwrite(self) -> None:
        """第二次调用 _init_state 不应覆盖已有值。"""
        mock_state: dict[str, Any] = {
            SET_DL_LOADED_KEY: True,
            SET_DL_BILIBILI_COOKIES_KEY: "custom/path",
            SET_DL_BILIBILI_NO_COOKIE_KEY: False,
            SET_DL_YT_PO_TOKEN_KEY: "custom_token",
            SET_DL_YT_VISITOR_DATA_KEY: "custom_visitor",
            SET_DL_HTTP_PROXY_KEY: "http://custom:8888",
        }

        with mock.patch("streamlit.session_state", mock_state):
            _init_state()  # 第二次调用

        # 所有值应保持不变
        assert mock_state[SET_DL_BILIBILI_COOKIES_KEY] == "custom/path"
        assert mock_state[SET_DL_BILIBILI_NO_COOKIE_KEY] is False
        assert mock_state[SET_DL_YT_PO_TOKEN_KEY] == "custom_token"
        assert mock_state[SET_DL_YT_VISITOR_DATA_KEY] == "custom_visitor"
        assert mock_state[SET_DL_HTTP_PROXY_KEY] == "http://custom:8888"

    def test_init_state_restores_from_config_key(self) -> None:
        """若 SET_DL_CONFIG_KEY 已存在，应从其中恢复值。"""
        saved_config = {
            "bilibili_cookies_path": "restored/cookies.txt",
            "bilibili_no_cookie_mode": False,
            "youtube_po_token": "restored_token",
            "youtube_visitor_data": "restored_visitor",
            "http_proxy": "socks5://restored:1080",
        }
        mock_state: dict[str, Any] = {SET_DL_CONFIG_KEY: saved_config}

        with mock.patch("streamlit.session_state", mock_state):
            _init_state()

        assert mock_state[SET_DL_BILIBILI_COOKIES_KEY] == "restored/cookies.txt"
        assert mock_state[SET_DL_BILIBILI_NO_COOKIE_KEY] is False
        assert mock_state[SET_DL_YT_PO_TOKEN_KEY] == "restored_token"
        assert mock_state[SET_DL_YT_VISITOR_DATA_KEY] == "restored_visitor"
        assert mock_state[SET_DL_HTTP_PROXY_KEY] == "socks5://restored:1080"

    def test_init_state_partial_config_restoration(self) -> None:
        """若 SET_DL_CONFIG_KEY 仅包含部分字段，应以默认值补全。"""
        partial_config = {
            "bilibili_cookies_path": "custom/path",
            # 其他字段缺失，应用默认值
        }
        mock_state: dict[str, Any] = {SET_DL_CONFIG_KEY: partial_config}

        with mock.patch("streamlit.session_state", mock_state):
            _init_state()

        assert mock_state[SET_DL_BILIBILI_COOKIES_KEY] == "custom/path"
        # 缺失字段应用默认值
        assert mock_state[SET_DL_BILIBILI_NO_COOKIE_KEY] is True
        assert mock_state[SET_DL_YT_PO_TOKEN_KEY] == ""
        assert mock_state[SET_DL_HTTP_PROXY_KEY] == ""

    def test_init_state_empty_config_key(self) -> None:
        """若 SET_DL_CONFIG_KEY 为空字典或 None，应使用全部默认值。"""
        mock_state: dict[str, Any] = {SET_DL_CONFIG_KEY: None}

        with mock.patch("streamlit.session_state", mock_state):
            _init_state()

        assert mock_state[SET_DL_BILIBILI_COOKIES_KEY] == _DEFAULT_BILIBILI_COOKIES_PATH
        assert mock_state[SET_DL_BILIBILI_NO_COOKIE_KEY] is True


# ── render_downloader_settings 集成测试 ──────────────────────────


class TestRenderDownloaderSettings:
    """下载器配置渲染函数集成测试。"""

    def test_render_calls_init_state(self) -> None:
        """render_downloader_settings 应在开始时调用 _init_state。"""
        mock_state: dict[str, Any] = {}

        with mock.patch("streamlit.session_state", mock_state):
            with mock.patch("streamlit.subheader"):
                with mock.patch("streamlit.text_input"):
                    with mock.patch("streamlit.caption"):
                        with mock.patch("streamlit.toggle"):
                            with mock.patch("streamlit.button", return_value=False):
                                from src.vidmirror.ui.settings.downloader_settings import (
                                    render_downloader_settings,
                                )

                                render_downloader_settings()

        # 验证 session_state 已初始化
        assert SET_DL_LOADED_KEY in mock_state

    def test_render_creates_all_ui_components(self) -> None:
        """render_downloader_settings 应创建所有预期的 UI 组件。"""
        mock_state: dict[str, Any] = {}

        with mock.patch("streamlit.session_state", mock_state):
            with mock.patch("streamlit.subheader") as mock_subheader:
                with mock.patch("streamlit.text_input") as mock_text_input:
                    with mock.patch("streamlit.caption"):
                        with mock.patch("streamlit.toggle"):
                            with mock.patch("streamlit.button", return_value=False):
                                from src.vidmirror.ui.settings.downloader_settings import (
                                    render_downloader_settings,
                                )

                                render_downloader_settings()

        # 验证调用了 3 个子标题（B 站、YouTube、通用）
        assert mock_subheader.call_count == 3
        # 验证创建了 4 个输入框（1 个 text_input for B 站 cookies + 2 个 for YouTube + 1 个 for proxy）
        assert mock_text_input.call_count == 4

    def test_render_button_validation_on_invalid_proxy(self) -> None:
        """保存按钮被点击且代理无效时应显示错误。"""
        mock_state: dict[str, Any] = {
            SET_DL_HTTP_PROXY_KEY: "https://invalid:8888",  # 无效的前缀
        }

        with mock.patch("streamlit.session_state", mock_state):
            with mock.patch("streamlit.subheader"):
                with mock.patch("streamlit.text_input", return_value="https://invalid:8888"):
                    with mock.patch("streamlit.caption"):
                        with mock.patch("streamlit.toggle", return_value=True):
                            with mock.patch("streamlit.button", return_value=True):  # 点击保存
                                with mock.patch("streamlit.error") as mock_error:
                                    from src.vidmirror.ui.settings.downloader_settings import (
                                        render_downloader_settings,
                                    )

                                    render_downloader_settings()

        # 应调用 st.error（输出错误信息）
        mock_error.assert_called_once()
        error_msg = mock_error.call_args[0][0]
        assert "http://" in error_msg or "socks5://" in error_msg

    def test_render_button_success_on_valid_proxy(self) -> None:
        """保存按钮被点击且代理有效时应显示成功提示。"""
        mock_state: dict[str, Any] = {
            SET_DL_BILIBILI_COOKIES_KEY: "data/cookies/bilibili_cookies.txt",
            SET_DL_BILIBILI_NO_COOKIE_KEY: True,
            SET_DL_YT_PO_TOKEN_KEY: "token123",
            SET_DL_YT_VISITOR_DATA_KEY: "visitor456",
            SET_DL_HTTP_PROXY_KEY: "http://127.0.0.1:7890",
        }

        with mock.patch("streamlit.session_state", mock_state):
            with mock.patch("streamlit.subheader"):
                with mock.patch("streamlit.text_input", side_effect=lambda label, **kwargs: mock_state.get(
                    kwargs.get("key"), ""
                )):
                    with mock.patch("streamlit.caption"):
                        with mock.patch("streamlit.toggle", return_value=True):
                            with mock.patch("streamlit.button", return_value=True):
                                with mock.patch("streamlit.error"):
                                    with mock.patch("streamlit.success") as mock_success:
                                        from src.vidmirror.ui.settings.downloader_settings import (
                                            render_downloader_settings,
                                        )

                                        render_downloader_settings()

        # 应调用 st.success
        mock_success.assert_called_once()
        assert "已保存" in mock_success.call_args[0][0]

    def test_render_button_saves_config_dict(self) -> None:
        """保存时应将所有字段聚合为字典并存入 SET_DL_CONFIG_KEY。"""
        mock_state: dict[str, Any] = {
            SET_DL_BILIBILI_COOKIES_KEY: "custom/cookies.txt",
            SET_DL_BILIBILI_NO_COOKIE_KEY: False,
            SET_DL_YT_PO_TOKEN_KEY: "po_token_123",
            SET_DL_YT_VISITOR_DATA_KEY: "visitor_data_456",
            SET_DL_HTTP_PROXY_KEY: "socks5://proxy:1080",
        }

        with mock.patch("streamlit.session_state", mock_state):
            with mock.patch("streamlit.subheader"):
                with mock.patch("streamlit.text_input", side_effect=lambda label, **kwargs: mock_state.get(
                    kwargs.get("key"), ""
                )):
                    with mock.patch("streamlit.caption"):
                        with mock.patch("streamlit.toggle", return_value=False):
                            with mock.patch("streamlit.button", return_value=True):
                                with mock.patch("streamlit.error"):
                                    with mock.patch("streamlit.success"):
                                        from src.vidmirror.ui.settings.downloader_settings import (
                                            render_downloader_settings,
                                        )

                                        render_downloader_settings()

        # 验证 SET_DL_CONFIG_KEY 已保存
        assert SET_DL_CONFIG_KEY in mock_state
        config = mock_state[SET_DL_CONFIG_KEY]
        assert config["bilibili_cookies_path"] == "custom/cookies.txt"
        assert config["bilibili_no_cookie_mode"] is False
        assert config["youtube_po_token"] == "po_token_123"
        assert config["youtube_visitor_data"] == "visitor_data_456"
        assert config["http_proxy"] == "socks5://proxy:1080"

