"""Subtitle-first extraction via yt-dlp metadata."""

from __future__ import annotations

from typing import Any


def fetch_best_subtitle_text(url: str) -> tuple[str, dict[str, Any]] | None:
    """Try extracting subtitle text metadata-first. Returns (text, metadata)."""
    try:
        import yt_dlp
    except Exception:
        return None

    opts = {
        "quiet": True,
        "skip_download": True,
        "no_warnings": True,
        "ignoreconfig": True,
    }
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=False)
    if not isinstance(info, dict):
        return None

    subtitles = info.get("subtitles") or {}
    auto_subs = info.get("automatic_captions") or {}
    chosen = subtitles if subtitles else auto_subs
    if not isinstance(chosen, dict) or not chosen:
        return None

    # choose first language and first subtitle track url
    lang = next(iter(chosen.keys()))
    tracks = chosen.get(lang) or []
    if not isinstance(tracks, list) or not tracks:
        return None
    track = tracks[0] if isinstance(tracks[0], dict) else {}
    subtitle_url = str(track.get("url") or "").strip()
    if not subtitle_url:
        return None
    # lightweight path: return url as transcript source marker when direct parsing unavailable
    # production parsers can parse vtt/srt/xml here.
    pseudo_text = f"[subtitle:{lang}] {subtitle_url}"
    return pseudo_text, {"lang": lang, "subtitle_url": subtitle_url}
