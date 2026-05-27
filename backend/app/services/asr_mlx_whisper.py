"""Local ASR with mlx-whisper (Apple Silicon only).

签名对齐 asr_fast_whisper.transcribe_file_with_fast_whisper，
使 asr_router 可以用统一接口调用两者。
"""

from __future__ import annotations

import os
import platform
import time
import traceback
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

_last_probe_error: Optional[Tuple[str, str, str]] = None

# mlx-community Whisper 仓库命名不统一：常规版本是 'whisper-{size}-mlx'，
# turbo 例外没有 -mlx 后缀。
MLX_MODEL_MAP: dict[str, str] = {
    "tiny": "mlx-community/whisper-tiny-mlx",
    "base": "mlx-community/whisper-base-mlx",
    "small": "mlx-community/whisper-small-mlx",
    "medium": "mlx-community/whisper-medium-mlx",
    "large-v1": "mlx-community/whisper-large-v1-mlx",
    "large-v2": "mlx-community/whisper-large-v2-mlx",
    "large-v3": "mlx-community/whisper-large-v3-mlx",
    "large-v3-turbo": "mlx-community/whisper-large-v3-turbo",
}


def resolve_mlx_repo_id(model_size: str) -> str:
    if model_size not in MLX_MODEL_MAP:
        raise ValueError(
            f"不支持的 MLX Whisper 模型大小: {model_size}。"
            f"可选: {', '.join(MLX_MODEL_MAP)}"
        )
    return MLX_MODEL_MAP[model_size]


def is_mlx_whisper_available() -> bool:
    """轻量级探活：检测 mlx_whisper 是否可导入（不加载模型）。"""
    global _last_probe_error
    if platform.system() != "Darwin" or platform.machine() != "arm64":
        _last_probe_error = ("PlatformError", "mlx-whisper 仅支持 macOS arm64", "")
        return False
    try:
        import mlx_whisper  # noqa: F401
        _last_probe_error = None
        return True
    except Exception as err:  # noqa: BLE001
        _last_probe_error = (
            type(err).__name__,
            str(err),
            traceback.format_exc(),
        )
        return False


def get_last_probe_error() -> Optional[Tuple[str, str, str]]:
    return _last_probe_error


def _ensure_model_downloaded(
    repo_id: str,
    *,
    log_callback: Optional[Callable[[str], None]] = None,
    progress_callback: Optional[Callable[[float, str], None]] = None,
) -> str:
    """确保模型已下载到本地缓存，返回本地路径。

    使用 huggingface_hub.snapshot_download，首次下载时通过 progress_callback 报进度。
    """
    from huggingface_hub import snapshot_download

    def _emit(msg: str) -> None:
        if log_callback:
            try:
                log_callback(msg)
            except Exception:  # noqa: BLE001
                pass

    def _emit_progress(ratio: float, msg: str) -> None:
        if progress_callback:
            try:
                progress_callback(max(0.0, min(1.0, ratio)), msg)
            except Exception:  # noqa: BLE001
                pass

    _emit(f"📥 下载 mlx-whisper 模型 | repo={repo_id}")
    _emit_progress(0.0, "开始下载...")

    local_dir = snapshot_download(
        repo_id,
        local_dir_use_symlinks=False,
    )

    _emit_progress(1.0, "模型下载完成")
    _emit(f"✅ 模型已就绪 | path={local_dir}")
    return local_dir


def transcribe_file_with_mlx_whisper(
    file_path: str | Path,
    *,
    model_name: str = "base",
    language: str = "",
    initial_prompt: str = "",
    log_callback: Optional[Callable[[str], None]] = None,
    progress_callback: Optional[Callable[[float, str], None]] = None,
    return_segments: bool = False,
) -> "str | tuple[str, list[dict[str, Any]], float]":
    """用 mlx-whisper 转录本地音/视频文件。

    签名对齐 asr_fast_whisper.transcribe_file_with_fast_whisper。
    """
    import mlx_whisper

    def _emit(msg: str) -> None:
        if log_callback:
            try:
                log_callback(msg)
            except Exception:  # noqa: BLE001
                pass

    def _emit_progress(ratio: float, msg: str) -> None:
        if progress_callback:
            try:
                progress_callback(max(0.0, min(1.0, ratio)), msg)
            except Exception:  # noqa: BLE001
                pass

    path = Path(file_path)
    if not path.is_file():
        raise FileNotFoundError(f"转录文件不存在: {path}")

    repo_id = resolve_mlx_repo_id(model_name)

    # 确保模型已下载（带进度回调）
    _ensure_model_downloaded(
        repo_id,
        log_callback=log_callback,
        progress_callback=progress_callback,
    )

    _emit(f"🧠 mlx-whisper 开始转录 | model={model_name} lang={language or 'auto'}")
    _emit_progress(0.0, "转录中...")
    t0 = time.perf_counter()

    transcribe_kwargs: dict[str, Any] = {}
    if language:
        transcribe_kwargs["language"] = language
    if initial_prompt:
        transcribe_kwargs["initial_prompt"] = initial_prompt

    result = mlx_whisper.transcribe(
        str(path),
        path_or_hf_repo=repo_id,
        **transcribe_kwargs,
    )

    elapsed = time.perf_counter() - t0
    segments_raw = result.get("segments", [])
    detected_lang = result.get("language", "unknown")

    parts: List[str] = []
    seg_dicts: List[Dict[str, Any]] = []
    for seg in segments_raw:
        text = str(seg.get("text", "")).strip()
        if text:
            parts.append(text)
            seg_dicts.append({
                "start": float(seg.get("start", 0.0)),
                "end": float(seg.get("end", 0.0)),
                "text": text,
            })

    total_duration = seg_dicts[-1]["end"] if seg_dicts else 0.0
    _emit_progress(1.0, "转录完成")
    _emit(f"✅ mlx-whisper 转录完成 | {len(seg_dicts)} 段 | {elapsed:.1f}s | lang={detected_lang}")

    text_out = "\n".join(parts).strip()
    if return_segments:
        return text_out, seg_dicts, total_duration
    return text_out
