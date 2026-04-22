from __future__ import annotations

"""Local ASR with faster-whisper."""

import sys
import tempfile
import traceback
from pathlib import Path
from typing import List, Optional, Tuple


# 最近一次探活失败的错误信息（类名 + 消息 + Traceback），供调用方获取完整上下文
_last_probe_error: Optional[Tuple[str, str, str]] = None


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


def transcribe_with_fast_whisper(
    audio_bytes: bytes,
    *,
    model_name: str = "base",
    device: str = "cpu",
    initial_prompt: str = "",
) -> str:
    """转录音频字节流为文本。

    参数：
        audio_bytes：音频二进制数据
        model_name：Whisper 模型尺寸（tiny/base/small/medium/large-v3/large-v3-turbo 等）
        device：计算设备（cpu/cuda/mps）
        initial_prompt：转录前置提示词；用于提高识别精准性（仅 fast-whisper 支持）

    返回：转录后的文本（多行段落用 \n 连接）
    """
    try:
        from faster_whisper import WhisperModel
    except ImportError as err:
        raise RuntimeError(_install_hint_for_current_interpreter()) from err
    except Exception as err:  # noqa: BLE001
        raise RuntimeError(
            f"本地语音识别引擎加载失败：{err}\n\n{_install_hint_for_current_interpreter()}"
        ) from err

    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as tmp:
        tmp.write(audio_bytes)
        tmp_path = Path(tmp.name)
    try:
        model = WhisperModel(model_name, device=device)
        # 若提供前置提示词，传入 transcribe 方法以提升识别精准性
        transcribe_kwargs = {"language": "zh"} if not initial_prompt else {"language": "zh", "initial_prompt": initial_prompt}
        segments, _info = model.transcribe(str(tmp_path), **transcribe_kwargs)
        parts: List[str] = []
        for seg in segments:
            text = str(getattr(seg, "text", "")).strip()
            if text:
                parts.append(text)
        return "\n".join(parts).strip()
    finally:
        tmp_path.unlink(missing_ok=True)
