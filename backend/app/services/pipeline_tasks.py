from __future__ import annotations

"""Task handlers for pipeline task center."""

import base64
import json
import time
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional

from backend.app.models.tasks import TaskRecord, TaskStatus
from backend.app.services.task_runner import TaskRunner
from shared.config import (
    get_project_json_dir,
    get_project_text_dir,
    get_project_videos_dir,
)
from shared.settings_store import load_settings
from shared.storyboard_generator import run_storyboard_generation
from shared.text_loader import TextDocument, TextLoaderError, load_auto
from shared.video_analyzer import (
    CaptureParams,
    find_videos,
    get_output_dir,
    get_safe_name,
    run_batch_analysis,
)
from shared.video_download_ytdlp import run_ytdlp_download
from src.vidmirror.core.providers import ChatRequest
from src.vidmirror.core.providers.registry import create_default_registry


def _resolve_download_kwargs(payload: Dict[str, Any]) -> Dict[str, Any]:
    """合并 payload 与 AppSettings.download 作为 run_ytdlp_download 的 kwargs。

    规则（M3)：
    - 字符串字段（proxy / po_token / visitor_data) 与 format_selector：payload 非空时用 payload，
      否则回落到 ``AppSettings.download``；
    - cookie_base_dirs：payload 提供非空 list 时用 payload，否则落 settings.cookie_base_dirs；
    - filename_template / retry_count / socket_timeout / concurrent_fragment_downloads：
      payload 不出现 (legacy 链路从不下发) 时直接取 settings；
    - 所有 settings 读取均用 ``isinstance`` 守卫，避免被 MagicMock 覆写时把非预期对象
      透传给 yt-dlp（保持现有 test_pipeline_tasks.py mock 的行为不变）。
    """
    try:
        settings = load_settings()
        dl = getattr(settings, "download", None)
    except Exception:
        dl = None

    def _s(name: str) -> str:
        v = getattr(dl, name, "") if dl is not None else ""
        return v if isinstance(v, str) else ""

    def _i_or_none(name: str) -> Optional[int]:
        v = getattr(dl, name, None) if dl is not None else None
        return v if isinstance(v, int) and not isinstance(v, bool) else None

    def _dirs() -> Optional[List[str]]:
        v = getattr(dl, "cookie_base_dirs", None) if dl is not None else None
        if isinstance(v, (list, tuple)) and v:
            cleaned = [str(x) for x in v if isinstance(x, str) and x.strip()]
            return cleaned or None
        return None

    # 字符串字段：payload 非空优先，否则回落 settings
    proxy = str(payload.get("proxy") or "") or _s("http_proxy")
    po_token = str(payload.get("po_token") or "") or _s("po_token")
    visitor_data = str(payload.get("visitor_data") or "") or _s("visitor_data")
    format_selector = str(payload.get("format_selector") or "") or "best"

    # cookie_base_dirs：payload 的 list 优先
    raw_dirs = payload.get("cookie_base_dirs")
    cookie_dirs: Optional[List[str]] = None
    if isinstance(raw_dirs, list) and raw_dirs:
        cookie_dirs = [str(x) for x in raw_dirs]
    else:
        cookie_dirs = _dirs()

    # filename_template：空串也视为"未提供"（避免前端误传空串）
    filename_template = str(payload.get("filename_template") or "") or _s("filename_template")

    return {
        "browser": str(payload.get("browser") or "chrome"),
        "proxy": proxy,
        "po_token": po_token,
        "visitor_data": visitor_data,
        "format_selector": format_selector,
        "cookie_base_dirs_list": cookie_dirs,
        # 仅在有具体值时传入，避免空串污染 _build_attempts 的默认模板兜底
        **({"filename_template": filename_template} if filename_template else {}),
        "retry_count": _i_or_none("retry_count"),
        "socket_timeout": _i_or_none("socket_timeout"),
        "concurrent_fragment_downloads": _i_or_none("concurrency_limit"),
    }


def handle_download_task(record: TaskRecord, runner: TaskRunner) -> Dict[str, Any]:
    """处理视频下载任务"""
    runner.set_progress(record.task_id, 0.05, "Preparing download")
    url = str(record.payload.get("url") or "").strip()
    if not url:
        raise ValueError("download payload.url is required")
    project_video_dir = get_project_videos_dir(record.project_id)
    project_video_dir.mkdir(parents=True, exist_ok=True)

    dl_kwargs = _resolve_download_kwargs(record.payload)
    out = run_ytdlp_download(
        url=url,
        output_dir=str(project_video_dir),
        log=lambda m: runner.append_log(record.task_id, m),
        progress_callback=lambda p, msg: runner.set_progress(record.task_id, p, msg),
        # 将 yt-dlp 捕获的实时速度写入 task.result["download_speed"]，前端订阅展示
        speed_callback=lambda s: runner.set_download_speed(record.task_id, s),
        **dl_kwargs,
    )
    if not out.get("ok"):
        err = (out.get("error_full") or out.get("error") or "download failed").strip()
        raise RuntimeError(err)
    runner.set_progress(record.task_id, 1.0, "Download finished")
    return {
        "downloaded_files": [out.get("save_path") or ""],
        "file_name": out.get("file_name") or "",
        "save_path": out.get("save_path") or "",
    }


def handle_analyze_task(record: TaskRecord, runner: TaskRunner) -> Dict[str, Any]:
    payload = record.payload
    task_id = record.task_id
    api_key = str(payload.get("api_key") or "").strip() or load_settings().openai_api_key.strip()
    if not api_key:
        raise ValueError("analyze requires api_key in payload or settings")
    vision_model = str(payload.get("vision_model") or "").strip() or load_settings().vision_model
    text_model = str(payload.get("text_model") or "").strip() or load_settings().text_model
    proxy = str(payload.get("proxy") or "").strip()

    # 日志：记录收到的模型和代理配置
    runner.append_log(
        task_id,
        f"📊 analyze_task 配置 | "
        f"text_model={text_model} | "
        f"vision_model={vision_model} | "
        f"proxy={'✓' if proxy else '✗'}"
    )

    project_video_dir = get_project_videos_dir(record.project_id)
    project_video_dir.mkdir(parents=True, exist_ok=True)   # 确保目录存在，防止 FileNotFoundError
    project_json_dir = get_project_json_dir(record.project_id)
    project_json_dir.mkdir(parents=True, exist_ok=True)
    videos = find_videos(project_video_dir)
    raw_names = payload.get("video_basenames")
    if isinstance(raw_names, list) and raw_names:
        allowed = {str(x) for x in raw_names}
        videos = [v for v in videos if v.name in allowed]
    if not videos:
        raise ValueError(f"no videos found in {project_video_dir}")

    # N7: 从 payload 读 frame_prompts 子参数（截帧模式 / 间隔 / 最大帧数 / 每镜头帧数）
    frame_prompts = payload.get("frame_prompts")
    capture_params = CaptureParams.from_dict(frame_prompts) if frame_prompts is not None else None
    if capture_params is not None:
        runner.append_log(
            task_id,
            f"🎬 capture_params | mode={capture_params.mode} | "
            f"interval={capture_params.interval_sec}s | "
            f"max_frames={capture_params.max_frames} | "
            f"frames_per_shot={capture_params.frames_per_shot}"
        )

    runner.set_progress(record.task_id, 0.1, f"Found {len(videos)} videos")
    state = run_batch_analysis(
        api_key=api_key,
        video_paths=videos,
        vision_model=vision_model,
        text_model=text_model,
        auto_sync_json=True,
        target_json_dir=project_json_dir,
        capture_params=capture_params,
    )
    while not state.finished:
        if runner.is_cancel_requested(record.task_id):
            break
        snaps = state.snapshot()
        if snaps:
            avg = sum(float(s["percent"]) for s in snaps) / max(len(snaps), 1) / 100.0
            runner.set_progress(record.task_id, min(0.95, max(0.1, avg)), "Analyzing video frames")
        live = state.live_frames_snapshot()
        tail = live[-12:] if live else []
        rec = runner.store.get(record.task_id)
        merged = dict(rec.result) if rec and rec.result else {}
        merged["live_preview"] = {"snapshots": snaps, "recent_frames": tail}
        runner.store.update(record.task_id, result=merged)
        time.sleep(0.2)
    runner.set_progress(record.task_id, 1.0, "Analysis finished")
    json_paths = sorted(project_json_dir.glob("*_视觉数据.json"))
    basenames = [p.name for p in json_paths]
    root = str(project_json_dir.resolve())
    # 前端应使用 json_output_dir + basename 拼接，避免依赖服务端绝对路径在浏览器侧失效
    return {
        "json_outputs": [str(p.resolve()) for p in json_paths],
        "json_output_basenames": basenames,
        "json_output_dir": root,
    }


def handle_create_task(record: TaskRecord, runner: TaskRunner) -> Dict[str, Any]:
    """处理创意内容生成任务"""
    payload = record.payload
    query = str(payload.get("prompt") or "").strip()
    if not query:
        raise ValueError("create payload.prompt is required")

    settings = load_settings()
    registry = create_default_registry()
    profile = registry.resolve_default_profile(settings, "chat")
    provider = registry.build(profile)
    model = str(payload.get("model") or profile.default_models.get("chat") or settings.text_model or "").strip()
    if not model:
        raise ValueError("create task model is required")

    runner.set_progress(record.task_id, 0.2, f"Generating via {profile.name}")
    content = provider.chat(
        ChatRequest(
            model=model,
            messages=[
                {"role": "system", "content": "You are a creative storyboard writer."},
                {"role": "user", "content": query},
            ],
            temperature=float(payload.get("temperature") or 0.7),
            max_tokens=int(payload.get("max_tokens") or 2048),
        )
    )
    runner.set_progress(record.task_id, 1.0, "Creative generation finished")

    runtime_dir = get_project_json_dir(record.project_id).parent / "runtime"
    runtime_dir.mkdir(parents=True, exist_ok=True)
    out_file = runtime_dir / f"{record.task_id}.md"
    out_file.write_text(content, encoding="utf-8")
    return {"content": content, "artifact_path": str(out_file)}


def handle_storyboard_task(record: TaskRecord, runner: TaskRunner) -> Dict[str, Any]:
    payload = record.payload
    runner.set_progress(record.task_id, 0.02, "Storyboard pipeline starting")
    raw_paths = payload.get("image_paths") or []
    image_paths = [str(x) for x in raw_paths] if isinstance(raw_paths, list) else []
    raw_bn = payload.get("rag_json_basenames")
    rag_basenames = [str(x) for x in raw_bn] if isinstance(raw_bn, list) else None
    rag_kpid = str(payload.get("rag_knowledge_project_id") or "").strip() or None

    result = run_storyboard_generation(
        project_id=record.project_id,
        product_name=str(payload.get("product_name") or ""),
        core_features=str(payload.get("core_features") or ""),
        web_enrichment_md=str(payload.get("web_enrichment_md") or ""),
        api_key=str(payload.get("api_key") or "").strip() or load_settings().openai_api_key,
        anthropic_key=str(payload.get("anthropic_key") or "").strip() or load_settings().anthropic_api_key,
        vision_model=str(payload.get("vision_model") or ""),
        text_model=str(payload.get("text_model") or ""),
        embedding_model=str(payload.get("embedding_model") or ""),
        text_backend=str(payload.get("text_backend") or ""),
        anthropic_model=str(payload.get("anthropic_model") or ""),
        image_paths=image_paths,
        rag_knowledge_project_id=rag_kpid,
        rag_json_basenames=rag_basenames,
        log=lambda m: runner.append_log(record.task_id, m),
    )
    runner.set_progress(record.task_id, 1.0, "Storyboard finished")
    return result


def _persist_intermediate(runner: TaskRunner, task_id: str, result_patch: Dict[str, Any]) -> None:
    """将中间结果合并写入 task.result，保留已有字段。"""
    rec = runner.store.get(task_id)
    merged = dict(rec.result) if rec and rec.result else {}
    merged.update(result_patch)
    runner.store.update(task_id, result=merged)


def handle_note_task(record: TaskRecord, runner: TaskRunner) -> Dict[str, Any]:
    """复合笔记任务：按 payload.steps 动态编排执行步骤。

    支持的步骤：download / transcribe / analyze / note
    未指定 steps 时默认全量执行。

    状态机流转（对齐 v1.1 §11）：
      DOWNLOAD → PROBE → FRAMES → ASR → VLM → SUM → STORE → SUCCESS
    """
    payload = record.payload
    task_id = record.task_id

    # ── 0. 解析步骤列表 ────────────────────────────────────────
    steps: List[str] = payload.get("steps") or ["download", "transcribe", "analyze", "note"]
    completed_steps: List[str] = []

    # ── 1. 取 payload 字段 ─────────────────────────────────────
    url = str(payload.get("url") or payload.get("video_url") or "").strip()
    if not url:
        raise ValueError("note task 需要 payload.url 或 payload.video_url")

    settings = load_settings()
    api_key = (
        str(payload.get("api_key") or "").strip()
        or settings.openai_api_key.strip()
    )
    vision_model = str(payload.get("vision_model") or "").strip() or settings.vision_model
    text_model = str(payload.get("text_model") or "").strip() or settings.text_model
    proxy = str(payload.get("proxy") or "").strip()

    # 日志：记录收到的文本/视觉模型和代理配置（音频模型已弃用，改用本地 faster-whisper）
    runner.append_log(
        task_id,
        f"📋 note_task 配置 | "
        f"text_model={text_model} | "
        f"vision_model={vision_model} | "
        f"proxy={'✓' if proxy else '✗'} | "
        f"steps={steps}"
    )

    # ── 2. 准备项目目录 ────────────────────────────────────────
    project_video_dir = get_project_videos_dir(record.project_id)
    project_video_dir.mkdir(parents=True, exist_ok=True)
    project_json_dir = get_project_json_dir(record.project_id)
    project_json_dir.mkdir(parents=True, exist_ok=True)

    # 中间产出容器
    transcript_text = ""
    analysis_text = ""
    markdown = ""
    download_save_path = ""

    # ── 3. download 步骤 ───────────────────────────────────────
    if "download" in steps:
        runner.store.update(task_id, status=TaskStatus.DOWNLOAD.value)
        runner.set_progress(task_id, 0.02, "开始下载视频...")

        dl_kwargs = _resolve_download_kwargs(payload)
        out = run_ytdlp_download(
            url=url,
            output_dir=str(project_video_dir),
            log=lambda m: runner.append_log(task_id, m),
            progress_callback=lambda p, msg: runner.set_progress(task_id, 0.02 + p * 0.28, msg),
            # note 流水线下载阶段同样上报实时速度
            speed_callback=lambda s: runner.set_download_speed(task_id, s),
            **dl_kwargs,
        )
        if not out.get("ok"):
            err = (out.get("error_full") or out.get("error") or "download failed").strip()
            raise RuntimeError(f"下载失败: {err}")

        download_save_path = str(out.get("save_path") or "")
        completed_steps.append("download")
        _persist_intermediate(runner, task_id, {
            "completed_steps": completed_steps[:],
            "video_file": download_save_path,
        })

    # ── 3.5. PROBE 阶段（pipeline 框架级，对齐 v1.1 §11）─────────
    # 探测：标记任务进入探测期。位置：download 之后、各处理步骤之前。
    # 当前仅做轻量级状态推进 + 进度条占位；未来可接入 ffprobe 媒体嗅探、
    # 字幕轨检测、媒体合法性校验等。
    runner.store.update(task_id, status=TaskStatus.PROBE.value)
    runner.set_progress(task_id, 0.30, "探测媒体元数据...")

    # ── 4. transcribe 步骤 ─────────────────────────────────────
    if "transcribe" in steps:
        # 预检查 A：本地 ASR 引擎是否就绪（轻量探活，避免先读大文件再崩溃）
        import sys as _sys
        from backend.app.services.asr_fast_whisper import (
            is_fast_whisper_available,
            get_install_hint,
            get_last_probe_error,
            transcribe_file_with_fast_whisper,
        )
        if not is_fast_whisper_available():
            hint = get_install_hint()
            probe = get_last_probe_error()
            # 首行写关键上下文：解释器路径 + 错误类型，便于一眼定位是路径还是动态库问题
            header = f"❌ 本地转录引擎未就绪 | python={_sys.executable}"
            if probe is not None:
                err_type, err_msg, err_tb = probe
                runner.append_log(task_id, f"{header}\n错误类型: {err_type}\n错误信息: {err_msg}\nTraceback:\n{err_tb}\n{hint}")
            else:
                runner.append_log(task_id, f"{header}\n{hint}")
            raise RuntimeError(f"本地转录引擎未安装。{hint}")

        # 预检查 B：本地是否存在可转录的视频文件
        # 优先用 download 步骤返回的 save_path；若路径失效（多流合并/清理）则回退到目录扫描（按 mtime 取最新）
        video_file = ""
        if download_save_path and Path(download_save_path).is_file():
            video_file = download_save_path
        else:
            if download_save_path:
                runner.append_log(
                    task_id,
                    f"⚠️  download_save_path 失效: {download_save_path!r}，回退到目录扫描",
                )
            videos = find_videos(project_video_dir)
            if videos:
                # 按修改时间取最新（find_videos 返回字典序，最新文件未必在首位）
                videos_sorted = sorted(videos, key=lambda p: p.stat().st_mtime, reverse=True)
                video_file = str(videos_sorted[0])

        if not video_file or not Path(video_file).is_file():
            raise ValueError(
                f"无可用的本地视频文件进行转录 (project_video_dir={project_video_dir})"
            )

        runner.store.update(task_id, status=TaskStatus.ASR.value)
        runner.set_progress(task_id, 0.32, "开始转录音频...")

        # 从 TranscriberConfig 读取用户偏好（模型尺寸/设备/语言/前置提示词），
        # 替代早期硬编码 base+cpu+zh；这样用户在设置页切换 medium/large 或指定 cuda 才会真正生效。
        tcfg = load_settings().transcriber
        runner.append_log(
            task_id,
            f"📄 本地转录 | 文件={Path(video_file).name} "
            f"model={tcfg.whisper_model_size} device={tcfg.device} language={tcfg.language or 'auto'}",
        )

        # 进度回调：将转录内部 0~1 的完成度压缩到 pipeline 的 0.32~0.50 区间，与 analyze/note 阶段衔接
        def _on_progress(ratio: float, msg: str) -> None:
            mapped = 0.32 + 0.18 * max(0.0, min(1.0, ratio))
            runner.set_progress(task_id, mapped, msg)

        def _on_log(msg: str) -> None:
            runner.append_log(task_id, msg)

        try:
            transcript_text = transcribe_file_with_fast_whisper(
                video_file,
                model_name=tcfg.whisper_model_size or "base",
                device=tcfg.device or "cpu",
                language=tcfg.language or "",
                initial_prompt=tcfg.initial_prompt or "",
                log_callback=_on_log,
                progress_callback=_on_progress,
            )
        except Exception as e:
            # 保留原异常链（from e），便于前端/日志看到完整 traceback 定位动态库 / ffmpeg / 权限问题
            raise RuntimeError(f"本地转录失败: {e}") from e

        completed_steps.append("transcribe")
        _persist_intermediate(runner, task_id, {
            "transcript": transcript_text,
            "completed_steps": completed_steps[:],
        })

    # ── 5. analyze 步骤 ────────────────────────────────────────
    if "analyze" in steps:
        if not api_key:
            raise ValueError("analyze 步骤需要 api_key（payload 或 settings）")

        # 前置检查：需确保本地存在视频文件
        videos = find_videos(project_video_dir)
        if not videos:
            raise ValueError("本地视频文件不存在，请先执行下载步骤")

        runner.store.update(task_id, status=TaskStatus.FRAMES.value)
        runner.set_progress(task_id, 0.50, "开始视觉帧分析...")

        state = run_batch_analysis(
            api_key=api_key,
            video_paths=videos,
            vision_model=vision_model,
            text_model=text_model,
            auto_sync_json=True,
            target_json_dir=project_json_dir,
        )

        while not state.finished:
            if runner.is_cancel_requested(task_id):
                break
            snaps = state.snapshot()
            if snaps:
                avg = sum(float(s["percent"]) for s in snaps) / max(len(snaps), 1) / 100.0
                runner.set_progress(task_id, min(0.85, 0.50 + avg * 0.35), "视觉帧分析中...")
            time.sleep(0.2)

        # 收集分析产出的 markdown 文件
        md_parts: List[str] = []
        for video_path in videos:
            safe_name = get_safe_name(video_path)
            output_dir = get_output_dir(video_path)
            md_file = output_dir / (safe_name + "_图文分镜.md")
            if md_file.exists():
                md_parts.append(md_file.read_text(encoding="utf-8"))
        analysis_text = "\n\n---\n\n".join(md_parts) if md_parts else ""

        completed_steps.append("analyze")
        _persist_intermediate(runner, task_id, {
            "analysis": analysis_text,
            "completed_steps": completed_steps[:],
        })

    # ── 6. note 步骤（汇总 markdown）──────────────────────────
    if "note" in steps:
        runner.store.update(task_id, status=TaskStatus.SUM.value)
        runner.set_progress(task_id, 0.90, "整理笔记内容...")

        # 数据源优先级：analyze 产出 > transcribe 文本 > 空字符串
        source_text = analysis_text or transcript_text or ""
        if source_text:
            markdown = source_text
        else:
            markdown = "（未找到可用的分析或转录内容，请检查前置步骤是否已执行）"

        completed_steps.append("note")
        _persist_intermediate(runner, task_id, {
            "markdown": markdown,
            "completed_steps": completed_steps[:],
        })

    # ── 6.5. STORE 阶段（pipeline 框架级，对齐 v1.1 §11）─────────
    # 入库：标记进入持久化阶段。当前流水线中间产物已通过
    # _persist_intermediate 即时落盘，此处为最终一次性确认 + UI 收尾。
    runner.store.update(task_id, status=TaskStatus.STORE.value)
    runner.set_progress(task_id, 0.95, "归档任务结果...")

    # ── 7. 构建最终返回结果 ────────────────────────────────────
    runner.set_progress(task_id, 0.98, "任务完成")

    json_paths = sorted(project_json_dir.glob("*_视觉数据.json"))

    return {
        "transcript":            transcript_text,
        "analysis":              analysis_text,
        "markdown":              markdown,
        "completed_steps":       completed_steps,
        "video_file":            download_save_path,
        "json_outputs":          [str(p.resolve()) for p in json_paths],
        "json_output_basenames": [p.name for p in json_paths],
        "json_output_dir":       str(project_json_dir.resolve()),
    }


def _summarize_text(
    *,
    content: str,
    title: str,
    settings,
    payload: Dict[str, Any],
    log: Any,
) -> str:
    """对正文做一轮 LLM 摘要。失败时返回空串（不抛异常，由调用方决定是否阻断）。"""
    if not content.strip():
        return ""
    api_key = (
        str(payload.get("api_key") or "").strip()
        or (settings.openai_api_key or "").strip()
    )
    if not api_key:
        log("⚠️  未提供 api_key，跳过 LLM 摘要")
        return ""

    try:
        registry = create_default_registry()
        profile = registry.resolve_default_profile(settings, "chat")
        provider = registry.build(profile)
        model = (
            str(payload.get("text_model") or "").strip()
            or profile.default_models.get("chat")
            or (settings.text_model or "").strip()
        )
        if not model:
            log("⚠️  未配置 text_model，跳过 LLM 摘要")
            return ""

        # 控制传入 LLM 的正文长度，避免 token 超限（粗略字符截断，留给 Phase 3 上 chunk）
        max_chars = int(payload.get("summary_max_input_chars") or 16000)
        body = content[:max_chars]
        truncated = len(content) > max_chars

        sys_prompt = (
            "你是一名严谨的中文文档摘要助手。请基于给定正文，输出 Markdown 格式的摘要，"
            "结构为：1) 一句话摘要；2) 3–6 条要点（项目符号）；3) 关键术语（若有，最多 5 个）。"
            "不要编造文中没有的事实。"
        )
        user_prompt = (
            f"# 文档标题\n{title or '(无标题)'}\n\n"
            f"# 正文（{'已截断' if truncated else '完整'}）\n{body}"
        )

        return provider.chat(
            ChatRequest(
                model=model,
                messages=[
                    {"role": "system", "content": sys_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=float(payload.get("temperature") or 0.3),
                max_tokens=int(payload.get("summary_max_tokens") or 1024),
            )
        )
    except Exception as err:  # noqa: BLE001
        log(f"⚠️  LLM 摘要失败：{err}")
        return ""


def handle_text_task(record: TaskRecord, runner: TaskRunner) -> Dict[str, Any]:
    """文本输入层任务（Phase 2C.1）。

    payload 字段：
      - source_type: "pdf" | "docx" | "url"（可省略，依赖 source 自动推断）
      - source: 必填，URL 或本地文件路径
      - api_key / text_model / temperature / summary_max_tokens / summary_max_input_chars：可选

    状态机：FETCH → PARSE → EXTRACT → SUM → STORE → SUCCESS
    产物：data/projects/<pid>/text/<task_id>.md + .json
    """
    payload = record.payload
    task_id = record.task_id

    source = str(payload.get("source") or "").strip()
    if not source:
        raise ValueError("text task 需要 payload.source（URL 或文件路径）")
    source_type = str(payload.get("source_type") or "").strip().lower() or None

    log = lambda msg: runner.append_log(task_id, msg)  # noqa: E731
    log(f"📄 text_task 配置 | source_type={source_type or 'auto'} | source={source[:80]}")

    # ── 1. FETCH ────────────────────────────────────────────
    runner.store.update(task_id, status=TaskStatus.FETCH.value)
    runner.set_progress(task_id, 0.05, "拉取素材...")

    # ── 2. PARSE + EXTRACT（loader 内部一次完成；分两个进度点对外展示）─
    runner.store.update(task_id, status=TaskStatus.PARSE.value)
    runner.set_progress(task_id, 0.30, "解析文档...")
    try:
        doc: TextDocument = load_auto(source, source_type)
    except TextLoaderError as err:
        raise RuntimeError(str(err)) from err

    runner.store.update(task_id, status=TaskStatus.EXTRACT.value)
    runner.set_progress(task_id, 0.55, f"正文提取完成（{doc.char_count} 字符）")
    log(f"📄 正文抽取 | title={doc.title!r} chars={doc.char_count} type={doc.source_type}")
    if doc.char_count == 0:
        log("⚠️  抽取到的正文为空，跳过摘要（PDF 可能为扫描件）")

    _persist_intermediate(runner, task_id, {
        "title": doc.title,
        "content": doc.content,
        "char_count": doc.char_count,
        "source_type": doc.source_type,
        "source": doc.source,
        "meta": doc.meta,
    })

    # ── 3. SUM ──────────────────────────────────────────────
    runner.store.update(task_id, status=TaskStatus.SUM.value)
    runner.set_progress(task_id, 0.70, "生成 LLM 摘要...")
    settings = load_settings()
    summary = _summarize_text(
        content=doc.content,
        title=doc.title,
        settings=settings,
        payload=payload,
        log=log,
    )

    # ── 4. STORE ────────────────────────────────────────────
    runner.store.update(task_id, status=TaskStatus.STORE.value)
    runner.set_progress(task_id, 0.90, "归档文本产物...")
    text_dir = get_project_text_dir(record.project_id)
    text_dir.mkdir(parents=True, exist_ok=True)
    md_path = text_dir / f"{task_id}.md"
    json_path = text_dir / f"{task_id}.json"

    md_body = (
        f"# {doc.title}\n\n"
        f"> 来源：{doc.source} ｜ 类型：{doc.source_type} ｜ 字符数：{doc.char_count}\n\n"
        f"## 摘要\n\n{summary.strip() if summary else '_（未生成摘要）_'}\n\n"
        f"---\n\n## 正文\n\n{doc.content}\n"
    )
    md_path.write_text(md_body, encoding="utf-8")
    json_path.write_text(
        json.dumps(
            {
                "task_id": task_id,
                "project_id": record.project_id,
                **doc.to_dict(),
                "summary": summary,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    runner.set_progress(task_id, 1.0, "文本任务完成")

    return {
        "title": doc.title,
        "content": doc.content,
        "summary": summary,
        "char_count": doc.char_count,
        "source_type": doc.source_type,
        "source": doc.source,
        "meta": doc.meta,
        "markdown_path": str(md_path.resolve()),
        "json_path": str(json_path.resolve()),
    }


def handle_image_task(record: TaskRecord, runner: TaskRunner) -> Dict[str, Any]:
    """图片分析任务（Phase X.4）。

    payload 字段：
      - source: 必填，HTTP(S) URL 或本地文件路径
      - source_type: "url" | "local"（可省略，依赖 source 自动判断）
      - vision_model / text_model / api_key：可选，从 settings 兜底

    状态机：FETCH → VLM → STORE → SUCCESS
    产物：data/projects/<pid>/image/<task_id>.json
    """
    payload = record.payload
    task_id = record.task_id
    log = lambda msg: runner.append_log(task_id, msg)  # noqa: E731

    source = str(payload.get("source") or "").strip()
    if not source:
        raise ValueError("image task 需要 payload.source（URL 或文件路径）")
    source_type = str(payload.get("source_type") or "").strip().lower() or (
        "url" if source.startswith(("http://", "https://")) else "local"
    )

    log(f"🖼 image_task | source_type={source_type} | source={source[:80]}")

    # ── 1. FETCH ────────────────────────────────────────────
    runner.store.update(task_id, status=TaskStatus.FETCH.value)
    runner.set_progress(task_id, 0.05, "拉取图片...")

    if source_type == "url":
        req = urllib.request.Request(source, headers={"User-Agent": "Mozilla/5.0"})
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                image_bytes = resp.read()
        except Exception as err:
            raise RuntimeError(f"图片下载失败：{err}") from err
    else:
        local = Path(source)
        if not local.is_file():
            raise RuntimeError(f"本地图片不存在：{source}")
        image_bytes = local.read_bytes()

    # 通过文件头简单判断格式
    if image_bytes[:4] == b"\x89PNG":
        mime = "image/png"
    elif image_bytes[:2] == b"\xff\xd8":
        mime = "image/jpeg"
    elif image_bytes[:4] == b"RIFF" and image_bytes[8:12] == b"WEBP":
        mime = "image/webp"
    else:
        mime = "image/jpeg"  # 兜底

    img_b64 = base64.b64encode(image_bytes).decode()
    log(f"📦 图片已加载，{len(image_bytes)//1024} KB，mime={mime}")

    # ── 2. VLM ──────────────────────────────────────────────
    runner.store.update(task_id, status=TaskStatus.VLM.value)
    runner.set_progress(task_id, 0.35, "视觉模型分析中...")

    settings = load_settings()
    api_key = (
        str(payload.get("api_key") or "").strip()
        or (settings.openai_api_key or "").strip()
    )
    if not api_key:
        log("⚠️  未提供 api_key，跳过视觉分析")
        description = ""
        prompts: Dict[str, Any] = {"mj": "", "sd": {"positive": "", "negative": ""}, "json": ""}
        tags: Dict[str, List[str]] = {}
        ocr_text = ""
    else:
        registry = create_default_registry()
        profile = registry.resolve_default_profile(settings, "vision")
        provider = registry.build(profile)
        vision_model = (
            str(payload.get("vision_model") or "").strip()
            or profile.default_models.get("vision")
            or (settings.vision_model or "").strip()
        )
        if not vision_model:
            log("⚠️  未配置 vision_model，跳过视觉分析")
            description = ""
            prompts = {"mj": "", "sd": {"positive": "", "negative": ""}, "json": ""}
            tags = {}
            ocr_text = ""
        else:
            log(f"🔍 调用 vision model={vision_model}")
            analysis_prompt = (
                "你是一名专业的图像分析助手。请分析这张图片并以纯 JSON 格式输出，不要有 markdown 代码块。\n"
                "JSON 结构如下：\n"
                '{"description": "中文详细描述（100-200字）",\n'
                ' "ocr_text": "图中可见文字（无则空字符串）",\n'
                ' "prompts": {\n'
                '   "mj": "Midjourney 提示词（英文，50-80词）",\n'
                '   "sd": {"positive": "Stable Diffusion 正向提示词（英文）", "negative": "负向提示词"},\n'
                '   "json": "结构化场景描述（英文 JSON 字符串）"\n'
                ' },\n'
                ' "tags": {"subject": [], "scene": [], "style": [], "lighting": [], "color": [], "composition": []}}'
            )
            try:
                raw = provider.chat(
                    ChatRequest(
                        model=vision_model,
                        messages=[{
                            "role": "user",
                            "content": [
                                {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{img_b64}"}},
                                {"type": "text", "text": analysis_prompt},
                            ],
                        }],
                        temperature=0.3,
                        max_tokens=1200,
                    )
                )
                import re as _re
                m = _re.search(r"\{[\s\S]*\}", raw)
                parsed: Dict[str, Any] = json.loads(m.group()) if m else {}
            except Exception as err:
                log(f"⚠️  视觉分析失败：{err}")
                parsed = {}

            description = str(parsed.get("description") or "")
            ocr_text = str(parsed.get("ocr_text") or "")
            prompts = parsed.get("prompts") or {"mj": "", "sd": {"positive": "", "negative": ""}, "json": ""}
            tags = parsed.get("tags") or {}

    log(f"📊 分析完成 | description={description[:40]}...")

    # ── 3. STORE ────────────────────────────────────────────
    runner.store.update(task_id, status=TaskStatus.STORE.value)
    runner.set_progress(task_id, 0.90, "归档图片产物...")

    image_dir = Path(settings.data_dir) / "projects" / record.project_id / "image" \
        if hasattr(settings, "data_dir") and settings.data_dir \
        else Path(__file__).resolve().parents[4] / "data" / "projects" / record.project_id / "image"

    # 保险兜底：通过 config 拿 project root
    from shared.config import get_project_root
    image_dir = get_project_root(record.project_id) / "image"
    image_dir.mkdir(parents=True, exist_ok=True)

    result: Dict[str, Any] = {
        "task_id": task_id,
        "project_id": record.project_id,
        "source": source,
        "source_type": source_type,
        "description": description,
        "ocr_text": ocr_text,
        "prompts": prompts,
        "tags": tags,
    }
    json_path = image_dir / f"{task_id}.json"
    json_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

    runner.set_progress(task_id, 1.0, "图片任务完成")
    log(f"✅ 产物已归档：{json_path}")

    return {**result, "json_path": str(json_path.resolve())}


def handle_audio_task(record: TaskRecord, runner: TaskRunner) -> Dict[str, Any]:
    """音频分析任务（Phase X.A）。

    payload 字段：
      - source: 必填，HTTP(S) URL 或本地文件路径
      - source_type: "url" | "local"（可省略，依 source 前缀自动判断）
      - audio_model: 可选，默认 FunAudioLLM/SenseVoiceSmall

    状态机：FETCH → TRANSCRIBE → SUMMARIZE → STORE → SUCCESS
    产物：data/projects/<pid>/audio/<task_id>.json
    """
    import mimetypes

    payload = record.payload
    task_id = record.task_id
    log = lambda msg: runner.append_log(task_id, msg)  # noqa: E731

    source = str(payload.get("source") or "").strip()
    if not source:
        raise ValueError("audio task 需要 payload.source（URL 或文件路径）")
    source_type = str(payload.get("source_type") or "").strip().lower() or (
        "url" if source.startswith(("http://", "https://")) else "local"
    )

    log(f"🎵 audio_task | source_type={source_type} | source={source[:80]}")

    # ── 1. FETCH ────────────────────────────────────────────
    runner.store.update(task_id, status=TaskStatus.FETCH.value)
    runner.set_progress(task_id, 0.05, "拉取音频文件...")

    if source_type == "url":
        req = urllib.request.Request(source, headers={"User-Agent": "Mozilla/5.0"})
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                audio_bytes = resp.read()
                content_type = resp.headers.get("Content-Type", "")
        except Exception as err:
            raise RuntimeError(f"音频下载失败：{err}") from err
        # 从 URL 推断文件名
        url_path = source.split("?")[0]
        audio_filename = url_path.split("/")[-1] or "audio.mp3"
    else:
        local = Path(source)
        if not local.is_file():
            raise RuntimeError(f"本地音频不存在：{source}")
        audio_bytes = local.read_bytes()
        audio_filename = local.name
        content_type = ""

    # 推断 MIME
    guessed, _ = mimetypes.guess_type(audio_filename)
    audio_mime = guessed or content_type.split(";")[0].strip() or "audio/mpeg"
    log(f"📦 音频已加载，{len(audio_bytes)//1024} KB，mime={audio_mime}，filename={audio_filename}")

    # ── 2. TRANSCRIBE ────────────────────────────────────────
    runner.store.update(task_id, status=TaskStatus.VLM.value)  # 借用 VLM 状态表示「模型推理中」
    runner.set_progress(task_id, 0.30, "语音转文字中...")

    settings = load_settings()
    api_key = str(payload.get("api_key") or "").strip() or (getattr(settings, "openai_api_key", "") or "").strip()
    base_url = str(payload.get("base_url") or "").strip() or (getattr(settings, "openai_base_url", "") or "https://api.siliconflow.cn/v1").strip()
    audio_model = str(payload.get("audio_model") or "").strip() or "FunAudioLLM/SenseVoiceSmall"

    transcript_text = ""
    transcript_segments: List[Dict[str, Any]] = []

    if not api_key:
        log("⚠️  未提供 api_key，跳过转写")
    else:
        # 用 multipart/form-data POST 到 /audio/transcriptions（OpenAI 兼容）
        log(f"🔊 调用 audio model={audio_model}")
        boundary = "----PythonFormBoundary"
        body_parts = []
        body_parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"model\"\r\n\r\n{audio_model}\r\n".encode())
        body_parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"response_format\"\r\n\r\njson\r\n".encode())
        body_parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{audio_filename}\"\r\nContent-Type: {audio_mime}\r\n\r\n".encode())
        body_parts.append(audio_bytes)
        body_parts.append(f"\r\n--{boundary}--\r\n".encode())
        body = b"".join(body_parts)

        transcribe_url = base_url.rstrip("/") + "/audio/transcriptions"
        transcribe_req = urllib.request.Request(
            transcribe_url,
            data=body,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": f"multipart/form-data; boundary={boundary}",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(transcribe_req, timeout=120) as resp:
                resp_data = json.loads(resp.read())
            transcript_text = resp_data.get("text") or ""
            transcript_segments = resp_data.get("segments") or []
            log(f"✅ 转写完成，{len(transcript_text)} 字符")
        except Exception as err:
            log(f"⚠️  转写失败：{err}")
            transcript_text = ""

    # ── 3. SUMMARIZE ─────────────────────────────────────────
    runner.set_progress(task_id, 0.70, "生成摘要中...")
    summary = ""

    if transcript_text and api_key:
        log("📝 调用 chat model 生成摘要...")
        registry = create_default_registry()
        profile = registry.resolve_default_profile(settings, "chat")
        provider = registry.build(profile)
        chat_model = (
            str(payload.get("text_model") or "").strip()
            or getattr(profile.default_models, "chat", None)
            or (getattr(settings, "text_model", "") or "").strip()
        )
        if chat_model:
            try:
                summary = provider.chat(
                    ChatRequest(
                        model=chat_model,
                        messages=[{
                            "role": "user",
                            "content": (
                                f"请将以下音频转写内容总结为 100-200 字的中文摘要：\n\n{transcript_text[:3000]}"
                            ),
                        }],
                        temperature=0.3,
                        max_tokens=400,
                    )
                )
                log(f"📋 摘要生成完成，{len(summary)} 字符")
            except Exception as err:
                log(f"⚠️  摘要生成失败：{err}")

    # ── 4. STORE ─────────────────────────────────────────────
    runner.store.update(task_id, status=TaskStatus.STORE.value)
    runner.set_progress(task_id, 0.90, "归档音频产物...")

    from shared.config import get_project_root
    audio_dir = get_project_root(record.project_id) / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)

    result: Dict[str, Any] = {
        "task_id": task_id,
        "project_id": record.project_id,
        "source": source,
        "source_type": source_type,
        "transcript": transcript_text,
        "transcript_segments": transcript_segments,
        "summary": summary,
        "audio": {
            "filename": audio_filename,
            "mime": audio_mime,
            "size_bytes": len(audio_bytes),
        },
    }
    json_path = audio_dir / f"{task_id}.json"
    json_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

    runner.set_progress(task_id, 1.0, "音频任务完成")
    log(f"✅ 产物已归档：{json_path}")

    return {**result, "json_path": str(json_path.resolve())}


def register_pipeline_handlers(runner: TaskRunner) -> None:
    runner.register("download",  handle_download_task)
    runner.register("analyze",   handle_analyze_task)
    runner.register("create",    handle_create_task)
    runner.register("storyboard", handle_storyboard_task)
    runner.register("note",      handle_note_task)
    runner.register("text",      handle_text_task)
    runner.register("image",     handle_image_task)
    runner.register("audio",     handle_audio_task)
