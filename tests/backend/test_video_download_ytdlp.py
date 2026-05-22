"""run_ytdlp_download 格式降级重试 单元测试。

覆盖：
- 首选格式成功（无需降级）
- 首选格式失败 → 第一个 fallback 成功
- 所有格式都失败 → 错误信息保留完整链路
"""
from __future__ import annotations

import sys
from unittest.mock import MagicMock, patch

import pytest


# ── Mock 辅助 ──────────────────────────────────────────────────────────

def _make_ydl_mock(download_fn=None):
    """创建一个 fake yt_dlp 模块 mock，YoutubeDL 的行为由 download_fn 控制。"""
    fake_module = MagicMock(name="yt_dlp")

    def _ydl_factory(opts):
        """根据 opts 创建 YoutubeDL 实例。"""
        mock = MagicMock(name="YoutubeDL")
        mock.__enter__ = MagicMock(return_value=mock)
        mock.__exit__ = MagicMock(return_value=False)
        if download_fn:
            mock.download = MagicMock(side_effect=download_fn(opts))
        else:
            mock.download = MagicMock(return_value=None)
        return mock

    fake_module.YoutubeDL = MagicMock(side_effect=_ydl_factory)
    return fake_module


def _raise_on_format(fail_formats: set[str], msg: str = "requested format is not available"):
    """返回 download_fn，对 fail_formats 中的格式抛异常，其他成功。"""
    def _fn(opts):
        fmt = opts.get("format", "")
        if fmt in fail_formats:
            raise Exception(msg)
        return None
    return _fn


def _raise_all_with_msgs(format_msgs: dict[str, str]):
    """返回 download_fn，每种格式抛各自的错误信息。"""
    def _fn(opts):
        fmt = opts.get("format", "")
        msg = format_msgs.get(fmt, "unknown error")
        raise Exception(msg)
    return _fn


# ── 测试：格式降级链 ──────────────────────────────────────────────────

class TestFormatFallback:
    """格式降级重试行为测试。"""

    def test_primary_format_succeeds_no_fallback(self, tmp_path):
        """首选格式成功时不会触发降级。"""
        from shared.video_download_ytdlp import run_ytdlp_download

        output_dir = str(tmp_path)
        fake_ytdlp = _make_ydl_mock(download_fn=_raise_on_format(set()))

        with patch.dict(sys.modules, {"yt_dlp": fake_ytdlp}):
            result = run_ytdlp_download(
                url="https://example.com/video.mp4",
                output_dir=output_dir,
                format_selector="best",
            )

        assert result["ok"] is True
        assert result["error"] == ""

    def test_primary_format_fails_fallback_succeeds(self, tmp_path):
        """首选格式 'best' 不可用时，降级到 'bv*+ba/b' 成功。"""
        from shared.video_download_ytdlp import run_ytdlp_download

        output_dir = str(tmp_path)
        logs: list[str] = []
        fake_ytdlp = _make_ydl_mock(download_fn=_raise_on_format({"best"}))

        with patch.dict(sys.modules, {"yt_dlp": fake_ytdlp}):
            result = run_ytdlp_download(
                url="https://example.com/video.mp4",
                output_dir=output_dir,
                format_selector="best",
                log=logs.append,
            )

        assert result["ok"] is True
        assert result["error"] == ""
        fallback_logs = [m for m in logs if "格式降级" in m]
        assert len(fallback_logs) >= 1, f"未找到降级日志，日志: {logs}"

    def test_primary_format_fails_second_fallback_succeeds(self, tmp_path):
        """前两个格式都不可用，第三个格式成功。"""
        from shared.video_download_ytdlp import run_ytdlp_download

        output_dir = str(tmp_path)
        logs: list[str] = []
        fake_ytdlp = _make_ydl_mock(download_fn=_raise_on_format({"best", "bv*+ba/b"}))

        with patch.dict(sys.modules, {"yt_dlp": fake_ytdlp}):
            result = run_ytdlp_download(
                url="https://example.com/video.mp4",
                output_dir=output_dir,
                format_selector="best",
                log=logs.append,
            )

        assert result["ok"] is True
        fallback_logs = [m for m in logs if "格式降级" in m]
        assert len(fallback_logs) >= 2, f"应有 2 次降级日志，日志: {logs}"

    def test_all_formats_fail_preserves_errors(self, tmp_path):
        """所有格式都失败时，error_full 包含每个格式的错误信息。"""
        from shared.video_download_ytdlp import run_ytdlp_download

        output_dir = str(tmp_path)
        logs: list[str] = []
        fake_ytdlp = _make_ydl_mock(download_fn=_raise_all_with_msgs({
            "best": "requested format is not available",
            "bv*+ba/b": "HTTP Error 403: Forbidden",
            "bestvideo+bestaudio/best": "Unable to download webpage",
            "worst": "connection reset by peer",
        }))

        with patch.dict(sys.modules, {"yt_dlp": fake_ytdlp}):
            result = run_ytdlp_download(
                url="https://example.com/video.mp4",
                output_dir=output_dir,
                format_selector="best",
                log=logs.append,
            )

        assert result["ok"] is False
        error_full = result["error_full"]
        assert "best:" in error_full
        assert "bv*+ba/b:" in error_full
        assert "requested format is not available" in error_full
        assert "403" in error_full
        fallback_logs = [m for m in logs if "格式降级" in m]
        assert len(fallback_logs) == 3

    def test_fallback_chain_does_not_duplicate_primary(self, tmp_path):
        """当首选格式就是 fallback 链中的值时，fallback 不重复该格式。"""
        from shared.video_download_ytdlp import run_ytdlp_download

        output_dir = str(tmp_path)
        logs: list[str] = []

        # 首选格式是 chain 的第一个 fallback "bv*+ba/b"
        # 正确链：["bv*+ba/b", "bestvideo+bestaudio/best", "worst"]（3 个）
        # 错误链：["bv*+ba/b", "bv*+ba/b", "bestvideo+bestaudio/best", "worst"]（4 个）
        fail_formats = {"bv*+ba/b", "bestvideo+bestaudio/best"}
        fake_ytdlp = _make_ydl_mock(download_fn=_raise_on_format(fail_formats))

        with patch.dict(sys.modules, {"yt_dlp": fake_ytdlp}):
            result = run_ytdlp_download(
                url="https://example.com/video.mp4",
                output_dir=output_dir,
                format_selector="bv*+ba/b",
                log=logs.append,
            )

        assert result["ok"] is True  # "worst" 成功
        fallback_logs = [m for m in logs if "格式降级" in m]
        # 恰好 2 次降级：bv*+ba/b → bestvideo+bestaudio/best → worst
        # 如果 bv*+ba/b 重复，会有 3 次降级日志
        assert len(fallback_logs) == 2, f"应有 2 次降级，实际 {len(fallback_logs)}，日志: {logs}"

    def test_non_retryable_error_triggers_format_fallback(self, tmp_path):
        """非可重试错误（如 500 Internal Server Error）也应触发格式降级。"""
        from shared.video_download_ytdlp import run_ytdlp_download

        output_dir = str(tmp_path)
        logs: list[str] = []

        def _fn(opts):
            fmt = opts.get("format", "")
            if fmt == "best":
                raise Exception("HTTP Error 500: Internal Server Error")
            return None

        fake_ytdlp = _make_ydl_mock(download_fn=_fn)

        with patch.dict(sys.modules, {"yt_dlp": fake_ytdlp}):
            result = run_ytdlp_download(
                url="https://example.com/video.mp4",
                output_dir=output_dir,
                format_selector="best",
                log=logs.append,
            )

        # HTTP 500 不是可重试错误，会 break 退出当前格式 → 触发格式降级
        assert result["ok"] is True
        fallback_logs = [m for m in logs if "格式降级" in m]
        assert len(fallback_logs) >= 1
