from __future__ import annotations

"""Task handlers for pipeline task center."""

import time
from typing import Any, Dict, List, Optional

from backend.app.models.tasks import TaskRecord, TaskStatus
from backend.app.services.task_runner import TaskRunner
from shared.config import get_project_json_dir, get_project_videos_dir
from shared.settings_store import load_settings
from shared.storyboard_generator import run_storyboard_generation
from shared.video_analyzer import (
    find_videos,
    get_output_dir,
    get_safe_name,
    run_batch_analysis,
)
from shared.video_download_ytdlp import run_ytdlp_download
from src.vidmirror.core.providers import ChatRequest
from src.vidmirror.core.providers.registry import create_default_registry


def handle_download_task(record: TaskRecord, runner: TaskRunner) -> Dict[str, Any]:
    """处理视频下载任务"""
    runner.set_progress(record.task_id, 0.05, "Preparing download")
    url = str(record.payload.get("url") or "").strip()
    if not url:
        raise ValueError("download payload.url is required")
    project_video_dir = get_project_videos_dir(record.project_id)
    project_video_dir.mkdir(parents=True, exist_ok=True)

    raw_dirs = record.payload.get("cookie_base_dirs")
    cookie_base_dirs_list: Optional[List[str]] = None
    if isinstance(raw_dirs, list) and raw_dirs:
        cookie_base_dirs_list = [str(x) for x in raw_dirs]

    out = run_ytdlp_download(
        url=url,
        output_dir=str(project_video_dir),
        browser=str(record.payload.get("browser") or "chrome"),
        proxy=str(record.payload.get("proxy") or ""),
        po_token=str(record.payload.get("po_token") or ""),
        visitor_data=str(record.payload.get("visitor_data") or ""),
        format_selector=str(record.payload.get("format_selector") or "best"),
        cookie_base_dirs_list=cookie_base_dirs_list,
        log=lambda m: runner.append_log(record.task_id, m),
        progress_callback=lambda p, msg: runner.set_progress(record.task_id, p, msg),
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
    api_key = str(payload.get("api_key") or "").strip() or load_settings().openai_api_key.strip()
    if not api_key:
        raise ValueError("analyze requires api_key in payload or settings")
    vision_model = str(payload.get("vision_model") or "").strip() or load_settings().vision_model
    text_model = str(payload.get("text_model") or "").strip() or load_settings().text_model
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

    runner.set_progress(record.task_id, 0.1, f"Found {len(videos)} videos")
    state = run_batch_analysis(
        api_key=api_key,
        video_paths=videos,
        vision_model=vision_model,
        text_model=text_model,
        auto_sync_json=True,
        target_json_dir=project_json_dir,
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

    状态机流转（task_runner._run 已将入口置为 DOWNLOADING）：
      各步骤对应状态 → (全部完成) → SUCCESS
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
        runner.store.update(task_id, status=TaskStatus.DOWNLOADING.value)
        runner.set_progress(task_id, 0.02, "开始下载视频...")

        raw_dirs = payload.get("cookie_base_dirs")
        cookie_base_dirs_list: Optional[List[str]] = (
            [str(x) for x in raw_dirs] if isinstance(raw_dirs, list) and raw_dirs else None
        )

        out = run_ytdlp_download(
            url=url,
            output_dir=str(project_video_dir),
            browser=str(payload.get("browser") or "chrome"),
            proxy=str(payload.get("proxy") or ""),
            po_token=str(payload.get("po_token") or ""),
            visitor_data=str(payload.get("visitor_data") or ""),
            format_selector=str(payload.get("format_selector") or "best"),
            cookie_base_dirs_list=cookie_base_dirs_list,
            log=lambda m: runner.append_log(task_id, m),
            progress_callback=lambda p, msg: runner.set_progress(task_id, 0.02 + p * 0.28, msg),
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

    # ── 4. transcribe 步骤 ─────────────────────────────────────
    if "transcribe" in steps:
        # 前置检查：若未执行 download，检查本地是否存在视频文件
        if "download" not in steps:
            videos = find_videos(project_video_dir)
            if not videos:
                raise ValueError("本地视频文件不存在，请先执行下载步骤")

        runner.store.update(task_id, status=TaskStatus.TRANSCRIBING.value)
        runner.set_progress(task_id, 0.32, "开始转录音频...")

        from backend.app.services.transcript_service import get_transcript
        transcript_result = get_transcript(url)
        transcript_text = str(transcript_result.get("text") or "")

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

        runner.store.update(task_id, status=TaskStatus.ANALYZING.value)
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
        runner.store.update(task_id, status=TaskStatus.SUMMARIZING.value)
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


def register_pipeline_handlers(runner: TaskRunner) -> None:
    runner.register("download",  handle_download_task)
    runner.register("analyze",   handle_analyze_task)
    runner.register("create",    handle_create_task)
    runner.register("storyboard", handle_storyboard_task)
    runner.register("note",      handle_note_task)
