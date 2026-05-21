from __future__ import annotations

"""Task handlers for pipeline task center."""

import base64
import hashlib
import json
import subprocess
import time
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional

from backend.app.models.tasks import TaskRecord, TaskStatus
from backend.app.services.task_runner import TaskRunner
from shared.config import (
    get_workspace_json_dir,
    get_workspace_text_dir,
    get_workspace_videos_dir,
)
from shared.settings_store import load_settings
from shared.storyboard_generator import run_storyboard_generation
from shared.text_loader import TextDocument, TextLoaderError, load_auto
from shared.audio_analyzer import (
    analyze_music,
    assign_speakers_to_segments,
    export_srt,
    export_txt,
    generate_music_prompt,
    run_diarization,
    run_vad,
)
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


# ── N7b 路径 1：视频字幕直接总结 ──────────────────────────────

_VIDEO_TEMPLATE_PROMPTS: Dict[str, str] = {
    "教程": (
        "这是一段教程/课程类视频的转写文本。请按以下结构输出总结：\n"
        "1. 一句话摘要（30字以内）\n"
        "2. 知识点列表（编号，每点一句话）\n"
        "3. 重点概念解释（如有专有术语）\n"
        "4. 学习建议（1-2 条）\n"
    ),
    "Vlog": (
        "这是一段 Vlog/生活记录类视频的转写文本。请按以下结构输出总结：\n"
        "1. 一句话摘要（30字以内）\n"
        "2. 地点与事件亮点（编号列表）\n"
        "3. 情绪氛围描述（1-2 句）\n"
        "4. 金句摘录（如有精彩表达）\n"
    ),
    "访谈": (
        "这是一段访谈类视频的转写文本。请按以下结构输出总结：\n"
        "1. 一句话摘要（30字以内）\n"
        "2. 受访者核心观点（编号列表）\n"
        "3. 金句摘录（直接引用）\n"
        "4. 话题脉络梳理（简要）\n"
    ),
    "影视点评": (
        "这是一段影视点评类视频的转写文本。请按以下结构输出总结：\n"
        "1. 一句话摘要（30字以内）\n"
        "2. 点评要点（编号列表）\n"
        "3. 优缺点分析\n"
        "4. 推荐指数与理由\n"
    ),
    "产品评测": (
        "这是一段产品评测类视频的转写文本。请按以下结构输出总结：\n"
        "1. 一句话摘要（30字以内）\n"
        "2. 产品核心卖点（编号列表）\n"
        "3. 优缺点分析\n"
        "4. 适合人群与购买建议\n"
    ),
    "其它": (
        "请将以下视频转写文本总结为结构化输出：\n"
        "1. 一句话摘要（30字以内）\n"
        "2. 要点列表（3-5 条，每条一句话）\n"
        "3. 金句摘录（如有精彩表达）\n"
    ),
}


def _normalize_transcript_to_lines(
    transcript_text: str,
    transcript_segments: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """将转写文本规范化为 VideoResultTranscriptLine[] 格式。

    优先使用 segments（带时间戳），否则将整段文本包装为单行。
    """
    if transcript_segments:
        return [
            {
                "t_sec": float(seg.get("start", 0)),
                "t_str": _format_sec_short(float(seg.get("start", 0))),
                "text": str(seg.get("text", "")),
            }
            for seg in transcript_segments
            if seg.get("text")
        ]
    if transcript_text and transcript_text.strip():
        return [{"t_sec": 0, "t_str": "00:00", "text": transcript_text.strip()}]
    return []


def _format_sec_short(sec: float) -> str:
    """秒数格式化为 MM:SS。"""
    s = max(0, int(sec))
    return f"{s // 60:02d}:{s % 60:02d}"


def _extract_audio_from_video(
    video_path: Path,
    output_path: Path,
    log_fn: Optional[Any] = None,
) -> Path:
    """用 ffmpeg 从视频中提取音频轨道为 WAV。"""
    cmd = [
        "ffmpeg", "-y", "-i", str(video_path),
        "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
        str(output_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg 音频提取失败: {result.stderr[:500]}")
    if log_fn:
        log_fn(f"🎵 音频提取完成: {output_path.name} ({output_path.stat().st_size // 1024} KB)")
    return output_path


def _build_video_summary_prompt(
    transcript: str,
    video_template: str = "其它",
    depth: str = "normal",
) -> str:
    """根据视频类型模板构建 LLM 总结 prompt。"""
    template_instruction = _VIDEO_TEMPLATE_PROMPTS.get(
        video_template, _VIDEO_TEMPLATE_PROMPTS["其它"]
    )
    depth_hint = {
        "brief": "请简洁输出，总字数控制在 200 字以内。",
        "normal": "请适度展开，总字数 300-500 字。",
        "deep": "请详细分析，总字数 500-800 字。",
    }.get(depth, "请适度展开，总字数 300-500 字。")

    # 超长文本截断（LLM context 保护）
    max_chars = 12000
    truncated = transcript[:max_chars] if len(transcript) > max_chars else transcript
    suffix = "\n\n（注：转写文本过长，已截断前 12000 字符）" if len(transcript) > max_chars else ""

    return (
        f"{template_instruction}\n"
        f"{depth_hint}\n\n"
        f"请用中文输出。\n\n"
        f"---\n转写文本：\n{truncated}{suffix}"
    )


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
    project_video_dir = get_workspace_videos_dir(record.project_id)
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


def _run_subtitle_summary(
    videos: List[Path],
    payload: Dict[str, Any],
    task_id: str,
    text_model: str,
    api_key: str,
    project_video_dir: Path,
    project_json_dir: Path,
    runner: TaskRunner,
) -> Dict[str, Any]:
    """N7b 路径 1：从视频提取音频 → Whisper 转写 → LLM 字幕直接总结。"""
    log = lambda msg: runner.append_log(task_id, msg)  # noqa: E731

    # 1. 选第一个视频文件
    video_path = videos[0]
    log(f"🔊 路径 1 字幕总结 | 视频: {video_path.name}")

    # 2. 提取音频
    audio_hash = hashlib.md5(str(video_path).encode()).hexdigest()[:8]
    audio_path = project_json_dir / f"{video_path.stem}_{audio_hash}.wav"
    try:
        runner.set_progress(task_id, 0.955, "提取音频轨道...")
        _extract_audio_from_video(video_path, audio_path, log_fn=log)
    except Exception as e:
        log(f"⚠️  音频提取失败: {e}")
        return {"summary_path": "subtitle", "summary_error": f"音频提取失败: {e}"}

    # 3. Whisper 转写
    transcript_text = ""
    transcript_segments: List[Dict[str, Any]] = []
    try:
        from backend.app.services.asr_fast_whisper import (
            is_fast_whisper_available,
            transcribe_file_with_fast_whisper,
        )
        if not is_fast_whisper_available():
            log("⚠️  本地 ASR 引擎未就绪，跳过转写")
            return {"summary_path": "subtitle", "transcript": [], "summary_error": "ASR 引擎未就绪"}

        runner.set_progress(task_id, 0.96, "Whisper 转写中...")
        tcfg = load_settings().transcriber
        log(f"📄 Whisper 转写 | model={tcfg.whisper_model_size} device={tcfg.device}")

        def _on_progress(ratio: float, msg: str) -> None:
            mapped = 0.96 + 0.02 * max(0.0, min(1.0, ratio))
            runner.set_progress(task_id, mapped, msg)

        transcript_text = transcribe_file_with_fast_whisper(
            str(audio_path),
            model_name=tcfg.whisper_model_size or "base",
            device=tcfg.device or "cpu",
            language=tcfg.language or "",
            initial_prompt=tcfg.initial_prompt or "",
            log_callback=log,
            progress_callback=_on_progress,
        )
        log(f"✅ 转写完成 | {len(transcript_text)} 字符")
    except Exception as e:
        log(f"⚠️  Whisper 转写失败: {e}")
        return {"summary_path": "subtitle", "transcript": [], "summary_error": f"转写失败: {e}"}

    if not transcript_text.strip():
        log("⚠️  转写结果为空（可能无人声）")
        return {
            "summary_path": "subtitle",
            "transcript": [],
            "summary": "（转写结果为空，可能视频无人声内容）",
        }

    # 4. LLM 总结
    video_template = str(payload.get("video_template") or "其它").strip()
    summary_depth = str(payload.get("summary_depth") or "normal").strip()
    summary = ""

    if api_key:
        try:
            runner.set_progress(task_id, 0.98, "LLM 生成摘要...")
            prompt = _build_video_summary_prompt(transcript_text, video_template, summary_depth)
            log(f"📝 LLM 总结 | template={video_template} | depth={summary_depth}")

            settings = load_settings()
            registry = create_default_registry()
            profile = registry.resolve_default_profile(settings, "chat")
            provider = registry.build(profile)
            chat_model = text_model or str(
                getattr(profile.default_models, "chat", None) or ""
            ).strip()
            if chat_model:
                summary = provider.chat(
                    ChatRequest(
                        model=chat_model,
                        messages=[{"role": "user", "content": prompt}],
                        temperature=0.3,
                        max_tokens=1200,
                    )
                )
                log(f"✅ 摘要生成完成 | {len(summary)} 字符")
            else:
                log("⚠️  未配置 text_model，跳过 LLM 总结")
        except Exception as e:
            log(f"⚠️  LLM 总结失败: {e}")
    else:
        log("⚠️  无 API key，跳过 LLM 总结")

    # 清理临时音频文件
    try:
        audio_path.unlink(missing_ok=True)
    except Exception:
        pass

    # 规范化 transcript 为数组格式（前端 VideoResult.transcript 期望 VideoResultTranscriptLine[]）
    transcript_lines = _normalize_transcript_to_lines(transcript_text, transcript_segments)

    return {
        "summary_path": "subtitle",
        "transcript": transcript_lines,
        "transcript_text": transcript_text,  # 保留原始文本供备用
        "transcript_segments": transcript_segments,
        "summary": summary,
        "video_template": video_template,
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

    project_video_dir = get_workspace_videos_dir(record.project_id)
    project_video_dir.mkdir(parents=True, exist_ok=True)   # 确保目录存在，防止 FileNotFoundError
    project_json_dir = get_workspace_json_dir(record.project_id)
    project_json_dir.mkdir(parents=True, exist_ok=True)
    videos = find_videos(project_video_dir)
    raw_names = payload.get("video_basenames")
    if isinstance(raw_names, list) and raw_names:
        allowed = {str(x) for x in raw_names}
        videos = [v for v in videos if v.name in allowed]
    if not videos:
        raise ValueError(f"no videos found in {project_video_dir}")

    # N7: 从 payload 读 frame_prompt 子参数（截帧模式 / 间隔 / 最大帧数 / 每镜头帧数）
    frame_prompts = payload.get("frame_prompt")
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
    runner.set_progress(record.task_id, 0.95, "Frame analysis finished")
    json_paths = sorted(project_json_dir.glob("*_视觉数据.json"))
    basenames = [p.name for p in json_paths]
    root = str(project_json_dir.resolve())
    result: Dict[str, Any] = {
        "json_outputs": [str(p.resolve()) for p in json_paths],
        "json_output_basenames": basenames,
        "json_output_dir": root,
    }

    # ── N7b 路径 1：字幕直接总结 ──────────────────────────────
    summary_path = str(payload.get("summary_path") or "").strip()
    if summary_path == "subtitle":
        result.update(
            _run_subtitle_summary(
                videos=videos,
                payload=payload,
                task_id=task_id,
                text_model=text_model,
                api_key=api_key,
                project_video_dir=project_video_dir,
                project_json_dir=project_json_dir,
                runner=runner,
            )
        )

    runner.set_progress(record.task_id, 1.0, "Analysis finished")
    return result


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

    runtime_dir = get_workspace_json_dir(record.project_id).parent / "runtime"
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
    project_video_dir = get_workspace_videos_dir(record.project_id)
    project_video_dir.mkdir(parents=True, exist_ok=True)
    project_json_dir = get_workspace_json_dir(record.project_id)
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


def _text_llm_call(
    *,
    content: str,
    title: str,
    sys_prompt: str,
    user_prompt_suffix: str,
    settings,
    payload: Dict[str, Any],
    log: Any,
    max_input_chars: int = 16000,
    max_tokens: int = 1024,
) -> str:
    """通用文本 LLM 调用。失败返回空串。"""
    if not content.strip():
        return ""
    api_key = (
        str(payload.get("api_key") or "").strip()
        or (settings.openai_api_key or "").strip()
    )
    if not api_key:
        log("⚠️  未提供 api_key，跳过 LLM 调用")
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
            log("⚠️  未配置 text_model，跳过 LLM 调用")
            return ""
        body = content[:max_input_chars]
        truncated = len(content) > max_input_chars
        user_prompt = (
            f"# 文档标题\n{title or '(无标题)'}\n\n"
            f"# 正文（{'已截断' if truncated else '完整'}）\n{body}"
            + (f"\n\n{user_prompt_suffix}" if user_prompt_suffix else "")
        )
        return provider.chat(
            ChatRequest(
                model=model,
                messages=[
                    {"role": "system", "content": sys_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=float(payload.get("temperature") or 0.3),
                max_tokens=max_tokens,
            )
        )
    except Exception as err:  # noqa: BLE001
        log(f"⚠️  LLM 调用失败：{err}")
        return ""


def _summarize_text(
    *,
    content: str,
    title: str,
    settings,
    payload: Dict[str, Any],
    log: Any,
) -> str:
    """对正文做一轮 LLM 摘要。支持 preflight summary.length 参数。"""
    summary_params = payload.get("summary") or {}
    length_map = {"short": 50, "medium": 100, "long": 200}
    length = length_map.get(summary_params.get("length", "medium"), 100)

    sys_prompt = (
        f"你是一名严谨的中文文档摘要助手。请基于给定正文，输出 Markdown 格式的摘要，"
        f"摘要约 {length} 字，结构为：1) 一句话摘要；2) 3–6 条要点（项目符号）；3) 关键术语（若有，最多 5 个）。"
        "不要编造文中没有的事实。"
    )
    return _text_llm_call(
        content=content,
        title=title,
        sys_prompt=sys_prompt,
        user_prompt_suffix="",
        settings=settings,
        payload=payload,
        log=log,
        max_tokens=int(payload.get("summary_max_tokens") or 1024),
    )


def _associate_text(
    *,
    content: str,
    title: str,
    directions: list[str],
    settings,
    payload: Dict[str, Any],
    log: Any,
) -> Dict[str, str]:
    """联想归纳（N10）。返回 {方向名: 分析结果}。"""
    if not directions:
        return {}
    dir_str = "、".join(directions)
    sys_prompt = (
        "你是一名深度内容分析师。请基于给定正文，从以下方向进行联想归纳分析：\n"
        f"方向：{dir_str}\n\n"
        "要求：\n"
        "- 每个方向独立输出，用 Markdown 二级标题分隔\n"
        "- 每个方向 100-200 字\n"
        "- 基于原文事实，不要编造\n"
        "- 输出格式：## 方向名\n分析内容\n"
    )
    raw = _text_llm_call(
        content=content,
        title=title,
        sys_prompt=sys_prompt,
        user_prompt_suffix="",
        settings=settings,
        payload=payload,
        log=log,
        max_tokens=1500,
    )
    # 解析各方向结果
    result: Dict[str, str] = {}
    if not raw:
        return result
    current_dir = ""
    current_lines: list[str] = []
    for line in raw.splitlines():
        stripped = line.strip()
        if stripped.startswith("## "):
            if current_dir:
                result[current_dir] = "\n".join(current_lines).strip()
            current_dir = stripped[3:].strip()
            current_lines = []
        else:
            current_lines.append(line)
    if current_dir:
        result[current_dir] = "\n".join(current_lines).strip()
    # 如果解析失败，把整段作为通用结果
    if not result and raw:
        result["联想归纳"] = raw
    return result


def _rewrite_text(
    *,
    content: str,
    title: str,
    style: str,
    settings,
    payload: Dict[str, Any],
    log: Any,
) -> str:
    """改写/润色（N10）。返回改写后的文本。"""
    style_map = {
        "formal": "正式、专业的书面语风格",
        "casual": "轻松、口语化的表达风格",
        "concise": "精简、去冗余的简洁风格",
        "rich": "丰富、生动的文学风格",
    }
    style_desc = style_map.get(style, style)
    sys_prompt = (
        f"你是一名专业的文字改写助手。请将给定正文改写为{style_desc}。\n"
        "要求：\n"
        "- 保持原文核心信息不变\n"
        "- 逐段改写，保留段落结构\n"
        "- 不要添加原文没有的信息\n"
        "- 直接输出改写后的正文，不要加前缀说明"
    )
    return _text_llm_call(
        content=content,
        title=title,
        sys_prompt=sys_prompt,
        user_prompt_suffix="",
        settings=settings,
        payload=payload,
        log=log,
        max_tokens=2048,
    )


def _translate_text(
    *,
    content: str,
    title: str,
    target_lang: str,
    settings,
    payload: Dict[str, Any],
    log: Any,
) -> str:
    """翻译（N10）。返回翻译后的文本。"""
    lang_map = {
        "zh": "中文", "en": "英文", "ja": "日文", "ko": "韩文",
        "es": "西班牙文", "fr": "法文", "de": "德文", "ru": "俄文", "pt": "葡萄牙文",
    }
    lang_name = lang_map.get(target_lang, target_lang)
    sys_prompt = (
        f"你是一名专业的翻译助手。请将给定正文翻译为{lang_name}。\n"
        "要求：\n"
        "- 翻译准确、通顺、自然\n"
        "- 逐段翻译，保留段落结构\n"
        "- 专有名词保留原文并在括号内注明\n"
        "- 直接输出翻译结果，不要加前缀说明"
    )
    return _text_llm_call(
        content=content,
        title=title,
        sys_prompt=sys_prompt,
        user_prompt_suffix="",
        settings=settings,
        payload=payload,
        log=log,
        max_tokens=2048,
    )


def handle_text_task(record: TaskRecord, runner: TaskRunner) -> Dict[str, Any]:
    """文本输入层任务（Phase 2C.1）。

    payload 字段：
      - source_type: "pdf" | "docx" | "url"（可省略，依赖 source 自动推断）
      - source: 必填，URL 或本地文件路径
      - api_key / text_model / temperature / summary_max_tokens / summary_max_input_chars：可选

    状态机：FETCH → PARSE → EXTRACT → SUM → STORE → SUCCESS
    产物：data/workspaces/<pid>/text/<task_id>.md + .json
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

    # ── 3.5 N10: 联想归纳 ──────────────────────────────────
    associations: Dict[str, str] = {}
    assoc_params = payload.get("association") or {}
    if assoc_params.get("enabled") and assoc_params.get("directions"):
        runner.store.update(task_id, status=TaskStatus.ASSOCIATE.value)
        runner.set_progress(task_id, 0.75, "联想归纳分析中...")
        log(f"📄 联想归纳 | directions={assoc_params['directions']}")
        associations = _associate_text(
            content=doc.content,
            title=doc.title,
            directions=assoc_params["directions"],
            settings=settings,
            payload=payload,
            log=log,
        )

    # ── 3.6 N10: 改写/润色 ─────────────────────────────────
    rewrites: Dict[str, str] = {}
    rewrite_params = payload.get("rewrite") or {}
    if rewrite_params.get("enabled") and rewrite_params.get("style"):
        runner.store.update(task_id, status=TaskStatus.REWRITE.value)
        runner.set_progress(task_id, 0.80, f"改写中（{rewrite_params['style']}）...")
        log(f"📄 改写 | style={rewrite_params['style']}")
        result = _rewrite_text(
            content=doc.content,
            title=doc.title,
            style=rewrite_params["style"],
            settings=settings,
            payload=payload,
            log=log,
        )
        if result:
            rewrites[rewrite_params["style"]] = result

    # ── 3.7 N10: 翻译 ──────────────────────────────────────
    translations: Dict[str, str] = {}
    translate_params = payload.get("translate") or {}
    if translate_params.get("enabled") and translate_params.get("target_lang"):
        runner.store.update(task_id, status=TaskStatus.TRANSLATE.value)
        runner.set_progress(task_id, 0.85, f"翻译中（{translate_params['target_lang']}）...")
        log(f"📄 翻译 | target_lang={translate_params['target_lang']}")
        result = _translate_text(
            content=doc.content,
            title=doc.title,
            target_lang=translate_params["target_lang"],
            settings=settings,
            payload=payload,
            log=log,
        )
        if result:
            translations[translate_params["target_lang"]] = result

    # ── 4. STORE ────────────────────────────────────────────
    runner.store.update(task_id, status=TaskStatus.STORE.value)
    runner.set_progress(task_id, 0.90, "归档文本产物...")
    text_dir = get_workspace_text_dir(record.project_id)
    text_dir.mkdir(parents=True, exist_ok=True)
    md_path = text_dir / f"{task_id}.md"
    json_path = text_dir / f"{task_id}.json"

    # 构建 md 正文
    md_parts = [
        f"# {doc.title}\n\n",
        f"> 来源：{doc.source} ｜ 类型：{doc.source_type} ｜ 字符数：{doc.char_count}\n\n",
        f"## 摘要\n\n{summary.strip() if summary else '_（未生成摘要）_'}\n\n",
    ]
    if associations:
        md_parts.append("## 联想归纳\n\n")
        for direction, analysis in associations.items():
            md_parts.append(f"### {direction}\n\n{analysis}\n\n")
    if rewrites:
        md_parts.append("## 改写/润色\n\n")
        for style, text in rewrites.items():
            md_parts.append(f"### {style}\n\n{text}\n\n")
    if translations:
        md_parts.append("## 翻译\n\n")
        for lang, text in translations.items():
            md_parts.append(f"### {lang}\n\n{text}\n\n")
    md_parts.append(f"---\n\n## 正文\n\n{doc.content}\n")

    md_path.write_text("".join(md_parts), encoding="utf-8")
    json_path.write_text(
        json.dumps(
            {
                "task_id": task_id,
                "project_id": record.project_id,
                **doc.to_dict(),
                "summary": summary,
                "associations": associations,
                "rewrites": rewrites,
                "translations": translations,
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
        "associations": associations,
        "rewrites": rewrites,
        "translations": translations,
        "char_count": doc.char_count,
        "source_type": doc.source_type,
        "source": doc.source,
        "meta": doc.meta,
        "markdown_path": str(md_path.resolve()),
        "json_path": str(json_path.resolve()),
    }


def handle_image_task(record: TaskRecord, runner: TaskRunner) -> Dict[str, Any]:
    """图片分析任务（Phase X.4 + N9 扩展）。

    payload 字段：
      - source: 必填，HTTP(S) URL 或本地文件路径
      - source_type: "url" | "local"（可省略，依赖 source 自动判断）
      - vision_model / text_model / api_key：可选，从 settings 兜底
      - ocr: {enabled, ...} N9 PaddleOCR 开关
      - assoc: {enabled, directions: [...]} N9 联想方向
      - prompt: {enabled, format} N9 提示词格式

    状态机：FETCH → OCR → VLM → ASSOCIATION → STORE → SUCCESS
    产物：data/workspaces/<pid>/image/<task_id>.json
    """
    import re as _re

    payload = record.payload
    task_id = record.task_id
    log = lambda msg: runner.append_log(task_id, msg)  # noqa: E731

    source = str(payload.get("source") or "").strip()
    if not source:
        raise ValueError("image task 需要 payload.source（URL 或文件路径）")
    source_type = str(payload.get("source_type") or "").strip().lower() or (
        "url" if source.startswith(("http://", "https://")) else "local"
    )

    # N9: 读取 preflight 子参数
    ocr_params = payload.get("ocr") or {}
    ocr_enabled = isinstance(ocr_params, dict) and ocr_params.get("enabled", False)
    assoc_params = payload.get("assoc") or {}
    assoc_enabled = isinstance(assoc_params, dict) and assoc_params.get("enabled", False)
    assoc_directions = assoc_params.get("directions", ["usage"]) if assoc_enabled else []
    fp_params = payload.get("prompt") or {}
    prompt_format = fp_params.get("format", "mj") if isinstance(fp_params, dict) else "mj"

    log(f"🖼 image_task | source_type={source_type} | source={source[:80]}")
    if ocr_enabled:
        log("🔤 OCR 已启用（PaddleOCR）")
    if assoc_enabled:
        log(f"🔗 联想分析已启用 | directions={assoc_directions}")

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

    # ── 1.5 OCR（N9: PaddleOCR，独立于 VLM） ───────────────
    ocr_text = ""
    if ocr_enabled:
        runner.set_progress(task_id, 0.15, "PaddleOCR 文字提取中...")
        try:
            from shared.ocr_service import extract_text

            ocr_text = extract_text(image_bytes)
            if ocr_text:
                log(f"🔤 OCR 提取 {len(ocr_text)} 字")
            else:
                log("🔤 OCR 未检测到文字")
        except Exception as err:
            log(f"⚠️  PaddleOCR 失败，回退 VLM OCR：{err}")
            ocr_text = ""  # 回退：VLM prompt 里也会提取 ocr_text

    # ── 2. VLM ──────────────────────────────────────────────
    runner.store.update(task_id, status=TaskStatus.VLM.value)
    runner.set_progress(task_id, 0.35, "视觉模型分析中...")

    settings = load_settings()
    api_key = (
        str(payload.get("api_key") or "").strip()
        or (settings.openai_api_key or "").strip()
    )

    # 构造 VLM prompt——如果 PaddleOCR 已成功提取文字，则不在 prompt 里要求 ocr_text
    ocr_json_line = (
        "" if ocr_text
        else '"ocr_text": "图中可见文字（无则空字符串）",\n'
    )
    # N9: 根据 prompt_format 调整提示词部分
    if prompt_format == "sd":
        prompt_block = (
            '"prompts": {\n'
            '   "sd": {"positive": "Stable Diffusion 正向提示词（英文）", "negative": "负向提示词"}\n'
            ' }'
        )
    elif prompt_format == "json":
        prompt_block = '"prompts": {\n   "json": "结构化场景描述（英文 JSON 字符串）"\n }'
    else:
        prompt_block = (
            '"prompts": {\n'
            '   "mj": "Midjourney 提示词（英文，50-80词）",\n'
            '   "sd": {"positive": "Stable Diffusion 正向提示词（英文）", "negative": "负向提示词"},\n'
            '   "json": "结构化场景描述（英文 JSON 字符串）"\n'
            ' }'
        )

    if not api_key:
        log("⚠️  未提供 api_key，跳过视觉分析")
        description = ""
        prompts: Dict[str, Any] = {"mj": "", "sd": {"positive": "", "negative": ""}, "json": ""}
        tags: Dict[str, List[str]] = {}
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
        else:
            log(f"🔍 调用 vision model={vision_model}")
            analysis_prompt = (
                "你是一名专业的图像分析助手。请分析这张图片并以纯 JSON 格式输出，不要有 markdown 代码块。\n"
                "JSON 结构如下：\n"
                '{"description": "中文详细描述（100-200字）",\n'
                f' {ocr_json_line}'
                f' {prompt_block},\n'
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
                m = _re.search(r"\{[\s\S]*\}", raw)
                parsed: Dict[str, Any] = json.loads(m.group()) if m else {}
            except Exception as err:
                log(f"⚠️  视觉分析失败：{err}")
                parsed = {}

            description = str(parsed.get("description") or "")
            # PaddleOCR 优先；仅当 PaddleOCR 无结果时用 VLM 的 ocr_text
            if not ocr_text:
                ocr_text = str(parsed.get("ocr_text") or "")
            prompts = parsed.get("prompts") or {"mj": "", "sd": {"positive": "", "negative": ""}, "json": ""}
            tags = parsed.get("tags") or {}

    log(f"📊 分析完成 | description={description[:40]}...")

    # ── 2.5 联想分析（N9: 多方向 VLM 调用） ────────────────
    associations: Dict[str, str] = {}
    if assoc_enabled and assoc_directions and api_key:
        runner.set_progress(task_id, 0.70, "联想分析中...")
        direction_prompts: Dict[str, str] = {
            "usage": "从用途角度分析这张图片：它适合用在什么场景？（如社交媒体、印刷、UI 设计、广告等）给出 3-5 个具体用途建议。",
            "design": "从设计角度分析这张图片：构图、配色、排版、视觉层次各有什么特点？哪些设计手法值得借鉴？",
            "competitor": "从竞品角度分析这张图片：同类型内容中，这种风格/手法的优劣势是什么？有哪些改进空间？",
            "emotion": "从情绪角度分析这张图片：它传达了什么情绪和氛围？目标受众会产生什么感受？如何强化或调整情绪表达？",
        }
        # 确保有可用的 vision model
        if not vision_model:
            log("⚠️  未配置 vision_model，跳过联想分析")
        else:
            for direction in assoc_directions:
                d_prompt = direction_prompts.get(direction)
                if not d_prompt:
                    continue
                try:
                    resp = provider.chat(
                        ChatRequest(
                            model=vision_model,
                            messages=[{
                                "role": "user",
                                "content": [
                                    {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{img_b64}"}},
                                    {"type": "text", "text": d_prompt + "\n请用中文回答，200-400字。"},
                                ],
                            }],
                            temperature=0.5,
                            max_tokens=800,
                        )
                    )
                    associations[direction] = resp.strip()
                    log(f"🔗 联想 [{direction}] 完成，{len(resp)}字")
                except Exception as err:
                    log(f"⚠️  联想 [{direction}] 失败：{err}")
                    associations[direction] = ""

    # ── 3. STORE ────────────────────────────────────────────
    runner.store.update(task_id, status=TaskStatus.STORE.value)
    runner.set_progress(task_id, 0.90, "归档图片产物...")

    from shared.config import get_workspace_root
    image_dir = get_workspace_root(record.project_id) / "image"
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
    if associations:
        result["associations"] = associations
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
    产物：data/workspaces/<pid>/audio/<task_id>.json
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

    # N8: 读 audio 子参数（兼容老 boolean / 缺字段）
    def _task_enabled(key: str, default: bool) -> bool:
        v = payload.get(key)
        if isinstance(v, dict):
            return bool(v.get("enabled", default))
        if isinstance(v, bool):
            return v
        return default

    asr_params = payload.get("asr") if isinstance(payload.get("asr"), dict) else {}
    music_params = payload.get("music") if isinstance(payload.get("music"), dict) else {}
    subtitle_params = payload.get("srt") if isinstance(payload.get("srt"), dict) else {}

    whisper_lang = str(asr_params.get("whisper_lang") or "auto").strip().lower()
    asr_enabled = _task_enabled("asr", True)
    diarization_enabled = _task_enabled("voiceprint", False)
    music_enabled = _task_enabled("music", False)
    subtitle_enabled = _task_enabled("srt", True)

    log(
        f"🎵 audio_task | source_type={source_type} | source={source[:80]} | "
        f"lang={whisper_lang} | diarize={diarization_enabled} | music={music_enabled} | "
        f"subtitle={subtitle_enabled}"
    )

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

    # N8: 写入磁盘供 VAD / pyannote / librosa 读（这些库都需要文件路径）
    from shared.config import get_workspace_root
    audio_dir = get_workspace_root(record.project_id) / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)
    audio_local_path = audio_dir / f"{task_id}_{audio_filename}"
    if not (source_type == "local" and Path(source).is_file()):
        audio_local_path.write_bytes(audio_bytes)
    else:
        audio_local_path = Path(source)  # 本地源直接用原路径

    # ── 1.5 VAD（N8）─────────────────────────────────────────
    runner.set_progress(task_id, 0.15, "VAD 人声活动检测...")
    vad_result = run_vad(audio_local_path)
    log(
        f"🔍 VAD | has_speech={vad_result.has_speech} | "
        f"speech={vad_result.total_speech_duration:.1f}s / total={vad_result.total_duration:.1f}s"
    )
    # 无人声 + 用户没勾音乐分析 → 仅日志告警（不主动改 preflight，弹窗交互推迟到 N8b）
    if not vad_result.has_speech and not music_enabled:
        log("⚠️  未检测到人声，且未启用音乐分析。可在 Preflight 抽屉勾选「音乐分析」后重跑")

    # 若无人声 + ASR 仍开启，按 spec 跳过 ASR（避免空 LLM 调用）
    skip_asr = (not vad_result.has_speech) or (not asr_enabled)

    # ── 2. TRANSCRIBE ────────────────────────────────────────
    runner.store.update(task_id, status=TaskStatus.VLM.value)  # 借用 VLM 状态表示「模型推理中」
    runner.set_progress(task_id, 0.30, "语音转文字中...")

    settings = load_settings()
    api_key = str(payload.get("api_key") or "").strip() or (getattr(settings, "openai_api_key", "") or "").strip()
    base_url = str(payload.get("base_url") or "").strip() or (getattr(settings, "openai_base_url", "") or "https://api.siliconflow.cn/v1").strip()
    audio_model = str(payload.get("audio_model") or "").strip() or "FunAudioLLM/SenseVoiceSmall"

    transcript_text = ""
    transcript_segments: List[Dict[str, Any]] = []

    if skip_asr:
        log("⏭️  跳过 ASR（无人声或未启用）")
    elif not api_key:
        log("⚠️  未提供 api_key，跳过转写")
    else:
        # 用 multipart/form-data POST 到 /audio/transcriptions（OpenAI 兼容）
        log(f"🔊 调用 audio model={audio_model} | language={whisper_lang}")
        boundary = "----PythonFormBoundary"
        body_parts = []
        body_parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"model\"\r\n\r\n{audio_model}\r\n".encode())
        body_parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"response_format\"\r\n\r\njson\r\n".encode())
        if whisper_lang and whisper_lang != "auto":
            body_parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"language\"\r\n\r\n{whisper_lang}\r\n".encode())
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

    # ── 3.5 说话人分离（N8）──────────────────────────────────
    diarization_dict: Optional[Dict[str, Any]] = None
    if diarization_enabled and vad_result.has_speech:
        runner.set_progress(task_id, 0.75, "说话人分离（pyannote）...")
        log("🎤 说话人分离中（pyannote.audio）")
        diar = run_diarization(audio_local_path)
        if diar is None:
            log("⚠️  说话人分离未执行（缺 HF_TOKEN / 模型协议未同意 / 包不可用）")
        else:
            diarization_dict = diar.to_dict()
            log(f"✅ 检测到 {diar.num_speakers} 个说话人，{len(diar.segments)} 段")
            if transcript_segments:
                transcript_segments = assign_speakers_to_segments(transcript_segments, diar)

    # ── 3.6 音乐分析（N8）──────────────────────────────────
    music_dict: Optional[Dict[str, Any]] = None
    if music_enabled:
        runner.set_progress(task_id, 0.82, "音乐特征分析（librosa）...")
        music_features = analyze_music(audio_local_path)
        if music_features is None:
            log("⚠️  音乐分析未执行（librosa 不可用或文件读取失败）")
        else:
            log(
                f"🎼 BPM={music_features.bpm:.1f} | key={music_features.key} | "
                f"duration={music_features.duration:.1f}s"
            )
            # LLM 生成 Suno/Udio 提示词（若有 api_key）
            if api_key:
                runner.set_progress(task_id, 0.86, "生成音乐提示词...")
                registry = create_default_registry()
                profile = registry.resolve_default_profile(settings, "chat")
                provider = registry.build(profile)
                music_chat_model = (
                    str(payload.get("text_model") or "").strip()
                    or (getattr(settings, "text_model", "") or "").strip()
                    or "Qwen/Qwen2.5-7B-Instruct"
                )

                def _music_llm(system: str, user: str) -> str:
                    return provider.chat(
                        ChatRequest(
                            model=music_chat_model,
                            messages=[
                                {"role": "system", "content": system},
                                {"role": "user", "content": user},
                            ],
                            temperature=0.5,
                            max_tokens=400,
                        )
                    )

                music_features = generate_music_prompt(music_features, _music_llm)
            music_dict = music_features.to_dict()

    # ── 3.7 字幕导出（N8）──────────────────────────────────
    subtitle_paths: Dict[str, str] = {}
    if subtitle_enabled and transcript_segments:
        srt_text = export_srt(transcript_segments)
        txt_text = export_txt(transcript_segments, with_speaker=bool(diarization_dict))
        srt_path = audio_dir / f"{task_id}.srt"
        txt_path = audio_dir / f"{task_id}.txt"
        srt_path.write_text(srt_text, encoding="utf-8")
        txt_path.write_text(txt_text, encoding="utf-8")
        subtitle_paths = {"srt": str(srt_path.resolve()), "txt": str(txt_path.resolve())}
        log(f"📄 字幕已导出 .srt / .txt（{len(transcript_segments)} 段）")

    # ── 4. STORE ─────────────────────────────────────────────
    runner.store.update(task_id, status=TaskStatus.STORE.value)
    runner.set_progress(task_id, 0.92, "归档音频产物...")

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
        "vad": vad_result.to_dict(),
        "diarization": diarization_dict,
        "music": music_dict,
        "subtitle_paths": subtitle_paths,
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
