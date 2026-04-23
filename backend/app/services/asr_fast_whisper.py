from __future__ import annotations

"""Local ASR with faster-whisper."""

import os
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

# HuggingFace hub 缓存根目录；用于下载期间扫描 .incomplete 文件估算进度
# 遵循官方优先级：HF_HUB_CACHE > HF_HOME/hub > ~/.cache/huggingface/hub
def _hf_hub_cache_dir() -> Path:
    env_hub = os.getenv("HF_HUB_CACHE")
    if env_hub:
        return Path(env_hub).expanduser()
    hf_home = os.getenv("HF_HOME")
    if hf_home:
        return Path(hf_home).expanduser() / "hub"
    return Path.home() / ".cache" / "huggingface" / "hub"


def _hf_repo_dir(model_name: str) -> Path:
    """按 faster-whisper 约定拼 HF repo 缓存目录（Systran/faster-whisper-<size>）。"""
    # 允许用户直接传仓库全名（如 "Systran/faster-whisper-large-v3"），否则按 size 自动补前缀
    repo = model_name if "/" in model_name else f"Systran/faster-whisper-{model_name}"
    return _hf_hub_cache_dir() / f"models--{repo.replace('/', '--')}"


def _scan_model_cache_bytes(model_name: str) -> Tuple[int, int]:
    """扫描指定模型在 HF 缓存里的 (已完成字节数, 下载中字节数)。

    用于下载心跳：已完成 = blobs 下非 .incomplete 的 weight 文件；下载中 = .incomplete 文件当前大小。
    缓存目录或文件不存在时返回 (0, 0)，不抛异常。
    """
    repo_dir = _hf_repo_dir(model_name)
    blobs = repo_dir / "blobs"
    if not blobs.is_dir():
        return 0, 0
    done = 0
    pending = 0
    try:
        for p in blobs.iterdir():
            if not p.is_file():
                continue
            if p.name.endswith(".incomplete"):
                pending += p.stat().st_size
            else:
                done += p.stat().st_size
    except OSError:
        pass
    return done, pending


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


def _load_model(
    model_name: str,
    device: str,
    compute_type: str,
    *,
    log_callback: Optional[Callable[[str], None]] = None,
    progress_callback: Optional[Callable[[float, str], None]] = None,
) -> Any:
    """按 (model_name, device, compute_type) 加载并缓存 WhisperModel。

    首次加载会触发 HuggingFace 权重下载（base≈140MB / medium≈1.5GB / large≈3GB）。
    为了避免"无反馈静默"假死体验（HF 下载本身不透出 tqdm 到我们的回调链），
    这里起一个看门狗线程：每 3 秒扫一次缓存目录，把已下载 / .incomplete 字节数
    以日志 + progress 的形式回推给上层。同参数模型仅加载一次，后续调用直接命中缓存。
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

    # 命中缓存直接返回；避免在持锁路径中启动无意义的看门狗
    cached = _MODEL_CACHE.get(key)
    if cached is not None:
        return cached

    with _MODEL_LOCK:
        # double-checked locking：进入临界区后复查，避免并发重复构造
        cached = _MODEL_CACHE.get(key)
        if cached is not None:
            return cached

        stop_evt = threading.Event()

        def _watcher() -> None:
            """周期性上报下载 / 加载进度，直到主线程完成 WhisperModel 构造。"""
            start_ts = time.perf_counter()
            last_total = -1
            # 启动延迟：短下载（缓存已命中等）不要刷无谓日志
            if stop_evt.wait(3.0):
                return
            while not stop_evt.is_set():
                done, pending = _scan_model_cache_bytes(model_name)
                total_mb = (done + pending) / 1024 / 1024
                elapsed = time.perf_counter() - start_ts
                if pending > 0 and (done + pending) != last_total:
                    # 正在下载：输出当前已就绪大小 + 历时
                    if log_callback is not None:
                        try:
                            log_callback(
                                f"⏳ 下载模型中 | {total_mb:.0f} MB 已就绪 | 已用 {elapsed:.0f}s"
                            )
                        except Exception:  # noqa: BLE001
                            pass
                    last_total = done + pending
                elif pending == 0 and done > 0:
                    # 下载完成但仍在初始化（ctranslate2 mmap 权重）：仅心跳
                    if log_callback is not None:
                        try:
                            log_callback(
                                f"⏳ 初始化模型中 | 权重 {done / 1024 / 1024:.0f} MB 已就绪 | 已用 {elapsed:.0f}s"
                            )
                        except Exception:  # noqa: BLE001
                            pass
                else:
                    # 缓存目录尚未出现（HF hub 还在解析 metadata）：通用心跳
                    if log_callback is not None:
                        try:
                            log_callback(f"⏳ 加载模型中 | 已用 {elapsed:.0f}s")
                        except Exception:  # noqa: BLE001
                            pass
                # 让进度条在模型加载期间缓慢爬升，避免长时间冻结造成死锁错觉
                # 上层 pipeline 把 ratio ∈ [0,1] 映射到 0.32~0.50；这里给出 ratio ≤ 0.15，
                # 映射后对应 UI 进度 ≤ 0.347，留足空间给真正的解码阶段。
                if progress_callback is not None:
                    smooth = elapsed / (elapsed + 60.0)  # 60s→0.5, 300s→0.83, 始终 < 1
                    try:
                        progress_callback(smooth * 0.15, f"加载模型中 | {elapsed:.0f}s")
                    except Exception:  # noqa: BLE001
                        pass
                stop_evt.wait(3.0)

        watcher = threading.Thread(target=_watcher, name="whisper-load-watcher", daemon=True)
        watcher.start()
        try:
            model = WhisperModel(model_name, device=device, compute_type=compute_type)
        finally:
            stop_evt.set()
            watcher.join(timeout=1.0)
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
    # 把 log/progress 回调下推到 _load_model：HF 首次下载期间会由看门狗线程回推 .incomplete 大小 + 心跳
    model = _load_model(
        model_name,
        device,
        ct,
        log_callback=log_callback,
        progress_callback=progress_callback,
    )
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
