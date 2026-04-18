"""
yt-dlp 下载逻辑（与 Streamlit / 后端任务共用）。
"""

from __future__ import annotations

import os
import re
import subprocess
from collections.abc import Callable
from typing import Any

from shared.config import ROOT_DIR


def cookie_base_dirs() -> list[str]:
    dirs = [
        str(ROOT_DIR / "data" / "cookies"),
        str(ROOT_DIR / "YouTubeDownloader"),
    ]
    out: list[str] = []
    for d in dirs:
        if d not in out:
            out.append(d)
    return out


def _existing_cookie_files(base_dirs: list[str]) -> list[str]:
    out: list[str] = []
    for base_dir in base_dirs:
        candidates = (
            os.path.join(base_dir, "cookies.txt"),
            os.path.join(base_dir, "www.youtube.com_cookies.txt"),
        )
        for p in candidates:
            if os.path.isfile(p) and p not in out:
                out.append(p)
    return out


def _existing_bili_cookie_files(base_dirs: list[str]) -> list[str]:
    out: list[str] = []
    for base_dir in base_dirs:
        candidates = (
            os.path.join(base_dir, "bilibili_cookies.txt"),
            os.path.join(base_dir, "www.bilibili.com_cookies.txt"),
        )
        for p in candidates:
            if os.path.isfile(p) and p not in out:
                out.append(p)
    return out


def _normalize_proxy(proxy: str) -> str:
    val = (proxy or "").strip()
    if not val:
        return ""
    if "://" not in val:
        return f"http://{val}"
    return val


def _is_youtube_url(url: str) -> bool:
    u = (url or "").lower()
    return "youtube.com" in u or "youtu.be" in u


def _is_bilibili_url(url: str) -> bool:
    u = (url or "").lower()
    return "bilibili.com" in u or "b23.tv" in u


def _bilibili_yt_dlp_extras() -> dict[str, Any]:
    ua = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    )
    return {
        "http_headers": {
            "User-Agent": ua,
            "Referer": "https://www.bilibili.com/",
            "Origin": "https://www.bilibili.com",
        },
        "retries": 5,
        "fragment_retries": 5,
        "extractor_retries": 3,
        "socket_timeout": 40,
    }


def _retryable_download_error(err: Exception) -> bool:
    msg = str(err).lower()
    needles = (
        "unable to download webpage",
        "http error",
        "timed out",
        "timeout",
        "connection refused",
        "connection reset",
        "ssl",
        "403",
        "412",
        "429",
        "503",
        "certificate",
        "temporary failure",
    )
    return any(x in msg for x in needles)


def _clean_ansi(text: str) -> str:
    ansi_escape = re.compile(r"\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])")
    return ansi_escape.sub("", text)


def _transcode_to_mp4_if_needed(path: str) -> str:
    src = (path or "").strip()
    if not src or not os.path.isfile(src):
        return src
    root, ext = os.path.splitext(src)
    if ext.lower() == ".mp4":
        return src
    dst = root + ".mp4"
    try:
        cmd = [
            "ffmpeg",
            "-y",
            "-i",
            src,
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "20",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            dst,
        ]
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        os.remove(src)
    except Exception:
        return src
    return os.path.abspath(dst)


def _build_attempts(
    *,
    url: str,
    browser: str,
    proxy: str,
    po_token: str,
    visitor_data: str,
    format_selector: str,
    output_dir: str,
    cookie_base_dirs_list: list[str],
    progress_hook: Any,
) -> list[dict[str, Any]]:
    base_opts: dict[str, Any] = {
        "outtmpl": os.path.join(output_dir, "%(title)s.%(ext)s"),
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "nocheckcertificate": True,
        "ignoreconfig": True,
        "concurrent_fragment_downloads": 5,
        "progress_hooks": [progress_hook],
    }
    if format_selector:
        base_opts["format"] = format_selector
    normalized_proxy = _normalize_proxy(proxy)

    attempts: list[dict[str, Any]] = []
    if _is_youtube_url(url):
        extractor_args: dict[str, Any] = {
            "youtube": {"player_client": ["android_vr", "mweb", "web_safari", "web"]}
        }
        if (po_token or "").strip():
            extractor_args["youtube"]["po_token"] = [f"web+{po_token.strip()}"]
        if (visitor_data or "").strip():
            extractor_args["youtube"]["visitor_data"] = [visitor_data.strip()]
        if normalized_proxy:
            base_opts["proxy"] = normalized_proxy
        for cookie_path in _existing_cookie_files(cookie_base_dirs_list):
            attempts.append({**base_opts, "cookiefile": cookie_path, "cookiesfrombrowser": (browser,), "extractor_args": extractor_args})
            attempts.append({**base_opts, "cookiefile": cookie_path, "extractor_args": extractor_args})
        attempts.append({**base_opts, "cookiesfrombrowser": (browser,), "extractor_args": extractor_args})
        attempts.append({**base_opts, "extractor_args": extractor_args})
    else:
        direct_opts = {k: v for k, v in base_opts.items() if k != "proxy"}
        bili_extras = _bilibili_yt_dlp_extras() if _is_bilibili_url(url) else {}

        def _append_bili_variants(core: dict[str, Any]) -> None:
            if bili_extras:
                attempts.append({**core, **bili_extras})
            attempts.append({**core})

        for cookie_path in _existing_bili_cookie_files(cookie_base_dirs_list):
            _append_bili_variants({**direct_opts, "cookiefile": cookie_path})
        _append_bili_variants({**direct_opts})
        _append_bili_variants({**direct_opts, "cookiesfrombrowser": (browser,)})

        proxied: dict[str, Any] | None = None
        if normalized_proxy:
            proxied = {**direct_opts, "proxy": normalized_proxy}
            for cookie_path in _existing_bili_cookie_files(cookie_base_dirs_list):
                _append_bili_variants({**proxied, "cookiefile": cookie_path})
            _append_bili_variants({**proxied})
            _append_bili_variants({**proxied, "cookiesfrombrowser": (browser,)})

        if _is_bilibili_url(url) and format_selector:
            stripped = {k: v for k, v in direct_opts.items() if k != "format"}
            for cookie_path in _existing_bili_cookie_files(cookie_base_dirs_list):
                _append_bili_variants({**stripped, "cookiefile": cookie_path})
            _append_bili_variants({**stripped})
            if proxied is not None:
                ps = {k: v for k, v in proxied.items() if k != "format"}
                for cookie_path in _existing_bili_cookie_files(cookie_base_dirs_list):
                    _append_bili_variants({**ps, "cookiefile": cookie_path})
                _append_bili_variants({**ps})
    return attempts


def run_ytdlp_download(
    *,
    url: str,
    output_dir: str,
    browser: str = "chrome",
    proxy: str = "",
    po_token: str = "",
    visitor_data: str = "",
    format_selector: str = "best",
    cookie_base_dirs_list: list[str] | None = None,
    log: Callable[[str], None] | None = None,
    progress_callback: Callable[[float, str], None] | None = None,
) -> dict[str, Any]:
    """
    执行多策略 yt-dlp 下载。
    返回: ok, save_path, file_name, error, error_full, percent(最后)
    """
    try:
        import yt_dlp
    except ImportError:
        return {
            "ok": False,
            "save_path": "",
            "file_name": "",
            "error": "未安装 yt-dlp，请运行：pip install yt-dlp",
            "error_full": "",
            "percent": 0.0,
        }

    dirs = cookie_base_dirs_list if cookie_base_dirs_list is not None else cookie_base_dirs()
    task_state: dict[str, Any] = {
        "status": "starting",
        "percent": 0.0,
        "speed": "0KiB/s",
        "eta": "N/A",
        "save_path": "",
        "file_name": "",
    }

    def _hook(d: dict[str, Any]) -> None:
        if d.get("status") == "downloading":
            pct = _clean_ansi(d.get("_percent_str", "0%")).strip()
            speed = _clean_ansi(d.get("_speed_str", "N/A")).strip()
            eta = _clean_ansi(d.get("_eta_str", "N/A")).strip()
            try:
                percent = float(pct.replace("%", ""))
            except ValueError:
                percent = 0.0
            task_state.update({"status": "downloading", "percent": percent, "speed": speed, "eta": eta})
            if progress_callback:
                progress_callback(min(0.99, max(0.02, percent / 100.0)), f"{percent:.0f}% {speed} ETA {eta}")
        elif d.get("status") == "finished":
            filename = d.get("filename", "")
            save_path = os.path.abspath(filename) if filename else ""
            task_state.update(
                {
                    "status": "finished",
                    "percent": 100.0,
                    "save_path": save_path,
                    "file_name": os.path.basename(save_path),
                }
            )

    attempts = _build_attempts(
        url=url,
        browser=browser,
        proxy=proxy,
        po_token=po_token,
        visitor_data=visitor_data,
        format_selector=format_selector,
        output_dir=output_dir,
        cookie_base_dirs_list=dirs,
        progress_hook=_hook,
    )

    last_exc: Exception | None = None
    for i, opts in enumerate(attempts):
        if log:
            log(f"尝试策略 {i + 1}/{len(attempts)}…")
        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                ydl.download([url])
            final_path = task_state.get("save_path", "")
            converted = _transcode_to_mp4_if_needed(final_path)
            task_state["save_path"] = converted
            task_state["file_name"] = os.path.basename(converted) if converted else ""
            if log:
                log(f"下载成功：{task_state['file_name']}")
            return {
                "ok": True,
                "save_path": converted,
                "file_name": task_state.get("file_name", ""),
                "error": "",
                "error_full": "",
                "percent": 100.0,
            }
        except Exception as err:  # noqa: BLE001
            last_exc = err
            low = str(err).lower()
            if log:
                log(f"策略失败：{str(err)[:200]}")
            if "requested format is not available" in low:
                continue
            if _retryable_download_error(err):
                continue
            break

    full = _clean_ansi(str(last_exc if last_exc else "未知错误"))
    return {
        "ok": False,
        "save_path": "",
        "file_name": "",
        "error": full.split("\n")[0],
        "error_full": full,
        "percent": float(task_state.get("percent") or 0.0),
    }
