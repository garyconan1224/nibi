"""`run_ytdlp_download` 参数装配回归测试(M3 阶段 3)。

覆盖:
- 默认调用(不传 filename_template / retry_count / socket_timeout / concurrent_fragment_downloads):
  opts 中保留旧硬编码 ``outtmpl=<output_dir>/%(title)s.%(ext)s``,无 ``retries`` / ``socket_timeout`` 键,
  ``concurrent_fragment_downloads=5``(旧默认)。
- 全量自定义:四个新参数被正确组装进 opts 的 ``outtmpl`` / ``retries`` / ``socket_timeout`` /
  ``concurrent_fragment_downloads``。
- 空串 filename_template 回落为旧硬编码(防止调用方误传空串把 outtmpl 降级为目录路径)。

策略:``patch("yt_dlp.YoutubeDL")`` 拦截下载上下文管理器,``__enter__`` 返回一个 no-op ydl;
捕获第一个 attempt 的 opts 字典即可。
"""

from __future__ import annotations

import os
from unittest.mock import MagicMock, patch

import pytest

# yt-dlp 未安装则整个模块 skip
yt_dlp = pytest.importorskip("yt_dlp")

from shared.video_download_ytdlp import run_ytdlp_download


# ── 公共 fixture:捕获 YoutubeDL 首次实例化的 opts ─────────────────────────────


def _make_ytdlp_cls_mock() -> tuple[MagicMock, list[dict]]:
    """返回 (mock_class, captured_opts_list)。

    - mock_class 模拟 ``yt_dlp.YoutubeDL`` 构造器;
    - 构造返回一个 context manager,``__enter__`` → 一个 download 为 no-op 的 ydl;
    - 每次构造都把传入的 opts 追加进 captured。
    """
    captured: list[dict] = []

    def _factory(opts: dict):
        captured.append(opts)
        ydl = MagicMock()
        ydl.download = MagicMock(return_value=None)
        ctx = MagicMock()
        ctx.__enter__ = MagicMock(return_value=ydl)
        ctx.__exit__ = MagicMock(return_value=False)
        return ctx

    cls = MagicMock(side_effect=_factory)
    return cls, captured


# ── 默认调用:旧行为零变化 ──────────────────────────────────────────────────


def test_default_call_preserves_legacy_opts(tmp_path) -> None:
    cls_mock, captured = _make_ytdlp_cls_mock()

    with patch("yt_dlp.YoutubeDL", cls_mock):
        result = run_ytdlp_download(
            url="https://example.com/video.mp4",
            output_dir=str(tmp_path),
            cookie_base_dirs_list=[],
        )

    assert result["ok"] is True
    assert len(captured) >= 1
    opts = captured[0]

    # 旧行为:硬编码 %(title)s.%(ext)s
    assert opts["outtmpl"] == os.path.join(str(tmp_path), "%(title)s.%(ext)s")
    # 未传 retry_count / socket_timeout → opts 不包含这两个键
    assert "retries" not in opts
    assert "socket_timeout" not in opts
    # 未传 concurrent_fragment_downloads → 旧默认 5
    assert opts["concurrent_fragment_downloads"] == 5


# ── 全量自定义:四个新参数透传 ──────────────────────────────────────────────


def test_full_custom_params_are_wired_into_opts(tmp_path) -> None:
    cls_mock, captured = _make_ytdlp_cls_mock()

    with patch("yt_dlp.YoutubeDL", cls_mock):
        result = run_ytdlp_download(
            url="https://example.com/video.mp4",
            output_dir=str(tmp_path),
            cookie_base_dirs_list=[],
            filename_template="%(uploader)s/%(title)s-%(id)s.%(ext)s",
            retry_count=7,
            socket_timeout=45,
            concurrent_fragment_downloads=3,
        )

    assert result["ok"] is True
    opts = captured[0]

    assert opts["outtmpl"] == os.path.join(str(tmp_path), "%(uploader)s/%(title)s-%(id)s.%(ext)s")
    assert opts["retries"] == 7
    assert opts["socket_timeout"] == 45
    assert opts["concurrent_fragment_downloads"] == 3


# ── 空串 filename_template 回落旧硬编码 ───────────────────────────────────


def test_empty_filename_template_falls_back_to_legacy(tmp_path) -> None:
    cls_mock, captured = _make_ytdlp_cls_mock()

    with patch("yt_dlp.YoutubeDL", cls_mock):
        run_ytdlp_download(
            url="https://example.com/video.mp4",
            output_dir=str(tmp_path),
            cookie_base_dirs_list=[],
            filename_template="",  # 空串:应回落为 %(title)s.%(ext)s 避免 outtmpl 降级为目录
        )

    opts = captured[0]
    assert opts["outtmpl"] == os.path.join(str(tmp_path), "%(title)s.%(ext)s")


# ── 部分自定义:仅 retry_count 生效,其他保留旧默认 ─────────────────────────


def test_partial_custom_only_retry_count(tmp_path) -> None:
    cls_mock, captured = _make_ytdlp_cls_mock()

    with patch("yt_dlp.YoutubeDL", cls_mock):
        run_ytdlp_download(
            url="https://example.com/video.mp4",
            output_dir=str(tmp_path),
            cookie_base_dirs_list=[],
            retry_count=4,
        )

    opts = captured[0]
    assert opts["retries"] == 4
    assert "socket_timeout" not in opts
    assert opts["concurrent_fragment_downloads"] == 5
    assert opts["outtmpl"] == os.path.join(str(tmp_path), "%(title)s.%(ext)s")

