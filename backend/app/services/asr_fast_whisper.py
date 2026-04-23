from __future__ import annotations

"""Local ASR with faster-whisper."""

import sys
import tempfile
import threading
import time
import traceback
from pathlib import Path
from typing import Any, Callable, List, Optional, Tuple


# 最近一次探活失败的错误信息（类名 + 消息 + Traceback），供调用方获取完整上下文
_last_probe_error: Optional[Tuple[str, str, str]] = None

# 进程内 WhisperModel 缓存，按 (model_name, device, compute_type) 复用；避免多次触发 HF 下载 / 模型再初始化
_MODEL_CACHE: dict[tuple[str, str, str], Any] = {}
_MODEL_LOCK = threading.Lock()


def _install_hint_for_current_interpreter() -> str:
    """根据当前 Python 解释器拼装精确的安装命令（避免用户装错环境）。"""
    py = sys.executable or "python"
    return (
        "本地语音识别引擎未安装或加载失败。请在当前后端解释器环境执行：\n"
        f"  {py} -m pip install 'faster-whisper>=1.0.0' 'ctranslate2>=4.0.0'\n"
        "若提示缺少系统库（如 libomp/libz），macOS 上请 `brew install libomp`；"
        "Linux 上请安装对应 apt/yum 包。首次运行需自动下载模型权重（base ≈ 140MB），"
        "请确保磁盘与网络可用。"
    )


def is_fast_whisper_available() -> bool:
    """轻量级探活：检测 faster-whisper 是否可导入（不加载模型，毫秒级）。

    捕获到异常时会将错误类型、消息与 Traceback 缓存到模块变量 `_last_probe_error`，
    调用方可通过 `get_last_probe_error()` 读取，便于区分：
      - ModuleNotFoundError：依赖未安装或装错解释器
      - ImportError：缺少 libomp / CUDA / libz 等底层动态库
      - 其他加载时异常（如 ctranslate2 binary 与 CPU 架构不匹配）
    """
    global _last_probe_error
    try:
        import faster_whisper  # noqa: F401
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
    """返回最近一次 `is_fast_whisper_available()` 失败的 (错误类型, 消息, Traceback)。"""
    return _last_probe_error


def get_install_hint() -> str:
    """对外暴露安装指引文案（基于当前解释器动态生成）。"""
    return _install_hint_for_current_interpreter()


def _load_model(model_name: str, device: str, compute_type: str) -> Any:
    """按 (model_name, device, compute_type) 加载并缓存 WhisperModel。

    首次加载会触发 HuggingFace 权重下载（base≈140MB / medium≈1.5GB），由上层写日志；
    同一进程内同参数复用，避免在流水线多次转录时反复初始化。
    """
    try:
        from faster_whisper import WhisperModel
    except ImportError as err:
        raise RuntimeError(_install_hint_for_current_interpreter()) from err
    except Exception as err:  # noqa: BLE001
        raise RuntimeError(
            f"本地语音识别引擎加载失败：{err}\n\n{_install_hint_for_current_interpreter()}"
        ) from err

    key = (model_name, device, compute_type)
    with _MODEL_LOCK:
        cached = _MODEL_CACHE.get(key)
        if cached is not None:
            return cached
        model = WhisperModel(model_name, device=device, compute_type=compute_type)
        _MODEL_CACHE[key] = model
        return model


def _default_compute_type(device: str) -> str:
    """CPU 下默认 int8（典型 2~4x 提速、质量几乎无损）；GPU 下默认 float16。"""
    d = (device or "cpu").lower()
    if d.startswith("cuda") or d == "gpu":
        return "float16"
    return "int8"


def transcribe_file_with_fast_whisper(
    file_path: str | Path,
    *,
    model_name: str = "base",
    device: str = "cpu",
    compute_type: str = "",
    language: str = "",
    initial_prompt: str = "",
    log_callback: Optional[Callable[[str], None]] = None,
    progress_callback: Optional[Callable[[float, str], None]] = None,
) -> str:
    """转录本地音/视频文件（直接交给 ffmpeg 解码，免去读整段二进制进内存）。

    参数：
        file_path：音频或视频文件绝对/相对路径
        model_name：Whisper 模型尺寸（tiny/base/small/medium/large-v3/large-v3-turbo 等）
        device：计算设备（cpu/cuda）
        compute_type：ctranslate2 量化类型；空串表示按 device 自动挑选（cpu=int8, gpu=float16）
        language：ISO-639-1 语言码；空串表示交给 whisper 自动检测
        initial_prompt：转录前置提示词，提升专有名词识别率
        log_callback：可选日志回调，会在模型加载/首段落/每 5 秒进度点回推 message
        progress_callback：可选进度回调 (ratio, message)，ratio ∈ [0, 1]

    返回：拼接后的转录文本（段落以 \\n 连接）
    """
    def _emit_log(msg: str) -> None:
        if log_callback is not None:
            try:
                log_callback(msg)
            except Exception:  # noqa: BLE001 -- 上层回调不应影响转录主链
                pass

    def _emit_progress(ratio: float, msg: str) -> None:
        if progress_callback is not None:
            try:
                progress_callback(max(0.0, min(1.0, float(ratio))), msg)
            except Exception:  # noqa: BLE001
                pass

    ct = compute_type or _default_compute_type(device)
    path = Path(file_path)
    if not path.is_file():
        raise FileNotFoundError(f"转录文件不存在: {path}")

    _emit_log(f"🧠 加载 Whisper 模型 | size={model_name} device={device} compute_type={ct}")
    t0 = time.perf_counter()
    model = _load_model(model_name, device, ct)
    _emit_log(f"✅ 模型就绪 | 耗时 {time.perf_counter() - t0:.1f}s")

    # 允许 initial_prompt 为空字符串时不传；language 为空字符串时让 whisper 自动检测
    transcribe_kwargs: dict[str, Any] = {}
    if language:
        transcribe_kwargs["language"] = language
    if initial_prompt:
        transcribe_kwargs["initial_prompt"] = initial_prompt

    segments, info = model.transcribe(str(path), **transcribe_kwargs)

    total = float(getattr(info, "duration", 0.0) or 0.0)
    detected_lang = getattr(info, "language", "") or ""
    _emit_log(f"🎙️ 开始解码 | duration={total:.1f}s language={detected_lang or 'auto'}")

    parts: List[str] = []
    last_log_ts = 0.0
    for idx, seg in enumerate(segments):
        text = str(getattr(seg, "text", "")).strip()
        if text:
            parts.append(text)
        end = float(getattr(seg, "end", 0.0) or 0.0)
        # 节流：每 5 秒 wall-clock 最多推一次进度/日志，避免刷爆 task.log
        now = time.perf_counter()
        if total > 0 and now - last_log_ts >= 5.0:
            ratio = min(0.99, end / total) if total > 0 else 0.0
            _emit_progress(ratio, f"转录中 {end:.1f}/{total:.1f}s")
            _emit_log(f"… {idx + 1} 段 | {end:.1f}/{total:.1f}s")
            last_log_ts = now

    _emit_progress(1.0, "转录完成")
    return "\n".join(parts).strip()


def transcribe_with_fast_whisper(
    audio_bytes: bytes,
    *,
    model_name: str = "base",
    device: str = "cpu",
    initial_prompt: str = "",
) -> str:
    """兼容旧调用方：字节流版本（`transcript_service` 的 URL 转录链路使用）。

    内部落 tempfile 后转调 `transcribe_file_with_fast_whisper`，避免两套实现漂移。
    新代码请优先使用 `transcribe_file_with_fast_whisper` 以跳过 bytes 中转。
    """
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as tmp:
        tmp.write(audio_bytes)
        tmp_path = Path(tmp.name)
    try:
        return transcribe_file_with_fast_whisper(
            tmp_path,
            model_name=model_name,
            device=device,
            language="zh",
            initial_prompt=initial_prompt,
        )
    finally:
        tmp_path.unlink(missing_ok=True)
