from __future__ import annotations

"""Phase 1I — 复刻工作包 zip 导出（最简版）。

接口（挂在 /workspaces prefix 下）:
- GET /{workspace_id}/items/{item_id}/export  返回 application/zip

MVP 只导 4 样东西：
  reference_frames/   帧截图（真图片或占位 .txt）
  prompts.json        提示词数据
  subtitles.srt       字幕文件（视频有，图片空）
  README.md           使用说明
"""

import io
import json
import zipfile
from datetime import date
from typing import Any, Dict, List
from urllib.parse import quote

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from shared.audio_analyzer import export_srt, export_vtt, export_ass
from backend.app.models.workspace import ItemType, WorkspaceItem, WorkspaceRecord
from backend.app.services.video_result_demo import build_demo_video_result
from backend.app.routes.workspaces import _store, _sync_item_with_tasks

router = APIRouter(prefix="/workspaces", tags=["export"])


def _find_item(rec: WorkspaceRecord, item_id: str) -> WorkspaceItem:
    target = next((it for it in rec.items if it.item_id == item_id), None)
    if target is None:
        raise HTTPException(status_code=404, detail=f"item not found: {item_id}")
    return target


def _video_result_has_real_data(results: Dict[str, Any]) -> bool:
    if not isinstance(results, dict):
        return False
    frames = results.get("frames")
    transcript = results.get("transcript")
    return bool(frames) and isinstance(frames, list) and isinstance(transcript, list)


def _get_video_data(item: WorkspaceItem) -> Dict[str, Any]:
    """获取视频结果数据（真数据或 demo fixture）。"""
    if _video_result_has_real_data(item.results):
        payload = dict(item.results)
        payload.setdefault("source", "item_results")
        return payload
    return build_demo_video_result(item.item_id, item.name)


def _get_image_data(item: WorkspaceItem) -> Dict[str, Any]:
    """获取图片结果数据（真数据或 demo fixture）。"""
    results = item.results or {}
    has_real = isinstance(results, dict) and results.get("description") and results.get("prompts")
    if has_real:
        payload = dict(results)
        payload.setdefault("source", "item_results")
        return payload
    # 简单 demo fixture
    return {
        "source": "demo_fixture",
        "image": {"item_id": item.item_id, "title": item.name, "image_url": ""},
        "description": "（示例）图片内容描述",
        "ocr_text": "",
        "exif": {"time": "", "location": ""},
        "prompts": {"mj": "", "sd": {"positive": "", "negative": ""}, "json": ""},
        "tags": {},
    }


def _get_audio_data(item: WorkspaceItem) -> Dict[str, Any]:
    """获取音频结果数据（真数据或 demo 提示）。"""
    results = item.results or {}
    has_real = isinstance(results, dict) and (results.get("transcript") or results.get("summary"))
    if has_real:
        payload = dict(results)
        payload.setdefault("source", "item_results")
        # 统一字段名：transcript_segments → segments
        if "transcript_segments" in payload and "segments" not in payload:
            payload["segments"] = payload["transcript_segments"]
        return payload
    return {
        "source": "demo_hint",
        "transcript": "",
        "summary": "（示例）尚未完成音频分析，请先对本条音频执行分析任务。",
        "segments": [],
    }


def _get_text_data(item: WorkspaceItem) -> Dict[str, Any]:
    """获取文本结果数据（真数据或 demo 提示）。"""
    results = item.results or {}
    has_real = isinstance(results, dict) and (results.get("content") or results.get("markdown") or results.get("summary"))
    if has_real:
        payload = dict(results)
        payload.setdefault("source", "item_results")
        return payload
    return {
        "source": "demo_hint",
        "markdown": "",
        "summary": "（示例）尚未完成文本分析，请先对本条文本执行分析任务。",
        "title": item.name,
    }


def _build_transcript_txt(transcript: Any) -> str:
    """把 transcript 转为纯文本字幕。

    transcript 可以是字符串（直接返回）或列表（每行带时间戳）。
    """
    if isinstance(transcript, str):
        return transcript
    lines: list[str] = []
    for entry in transcript:
        t_sec = entry.get("t_sec", 0)
        text = entry.get("text", "")
        m, s = divmod(int(t_sec), 60)
        lines.append(f"[{m:02d}:{s:02d}] {text}")
    return "\n".join(lines)


def _build_srt(transcript: List[Dict[str, Any]]) -> str:
    """把 transcript 列表转为 SRT 格式字符串。"""
    lines: list[str] = []
    for i, entry in enumerate(transcript, start=1):
        t_sec = entry.get("t_sec", 0)
        text = entry.get("text", "")
        # SRT 时间格式: HH:MM:SS,mmm --> HH:MM:SS,mmm
        h = t_sec // 3600
        m = (t_sec % 3600) // 60
        s = t_sec % 60
        start_ts = f"{h:02d}:{m:02d}:{s:02d},000"
        # 结束时间 = 开始 + 3 秒（粗略）
        end_sec = t_sec + 3
        eh = end_sec // 3600
        em = (end_sec % 3600) // 60
        es = end_sec % 60
        end_ts = f"{eh:02d}:{em:02d}:{es:02d},000"
        lines.append(f"{i}\n{start_ts} --> {end_ts}\n{text}\n")
    return "\n".join(lines)


def _build_prompts_json_video(frames: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """从视频帧提取提示词数据。"""
    out: list[Dict[str, Any]] = []
    for f in frames:
        out.append({
            "idx": f.get("idx"),
            "ts": f.get("ts", ""),
            "shot_type": f.get("shot_type", ""),
            "title": f.get("title", ""),
            "prompt_mj": f.get("prompt_mj", ""),
            "prompt_sd": f.get("prompt_sd", {}),
            "prompt_video": f.get("prompt_video", ""),
        })
    return out


def _build_prompts_json_image(data: Dict[str, Any]) -> Dict[str, Any]:
    """从图片结果提取提示词数据。"""
    return {
        "title": data.get("image", {}).get("title", ""),
        "description": data.get("description", ""),
        "prompt_mj": data.get("prompts", {}).get("mj", ""),
        "prompt_sd": data.get("prompts", {}).get("sd", {}),
        "tags": data.get("tags", {}),
    }


def _build_prompts_json_audio(data: Dict[str, Any]) -> Dict[str, Any]:
    """从音频结果提取 prompts 数据。"""
    return {
        "summary": data.get("summary", ""),
        "segments_count": len(data.get("segments", [])),
    }


def _build_prompts_json_text(data: Dict[str, Any]) -> Dict[str, Any]:
    """从文本结果提取 prompts 数据。"""
    return {
        "title": data.get("title", ""),
        "summary": data.get("summary", ""),
        "prompts": data.get("prompts", {}),
    }


def _build_readme(title: str, item_type: str) -> str:
    if item_type == "音频":
        return f"""# 复刻工作包

## 基本信息
- 素材名称：{title}
- 素材类型：音频
- 导出日期：{date.today().isoformat()}

## 包内文件说明

### transcript.txt
纯文本字幕，按时间顺序排列。

### summary.md
音频内容摘要。

### segments.json
带时间戳的分段数据，可用于：
- 定位特定片段
- 按章节浏览内容

### prompts.json
元数据信息（摘要、分段数等）。

## 使用建议
1. 先看 summary.md 了解整体内容
2. 用 segments.json 定位感兴趣的片段
3. 结合 transcript.txt 做进一步编辑

---
由 Nibi / VidMirror 自动生成
"""
    if item_type == "文本":
        return f"""# 复刻工作包

## 基本信息
- 素材名称：{title}
- 素材类型：文本
- 导出日期：{date.today().isoformat()}

## 包内文件说明

### source.md
原始文本内容。

### summary.md
文本内容摘要。

### prompts.json
分析结果元数据（标题、摘要、提示词等）。

## 使用建议
1. 先看 summary.md 了解整体内容
2. 需要原文时查阅 source.md
3. 根据 prompts.json 中的提示词进行二次创作

---
由 Nibi / VidMirror 自动生成
"""
    return f"""# 复刻工作包

## 基本信息
- 素材名称：{title}
- 素材类型：{item_type}
- 导出日期：{date.today().isoformat()}

## 包内文件说明

### reference_frames/
参考帧截图。每张图片的文件名包含时间戳和镜头类型，可用于：
- 作为 AI 图片/视频生成的参考图
- 分析构图、光影、色调

### prompts.json
所有提示词数据，按时间顺序排列。包含：
- `prompt_mj`：Midjourney 格式提示词
- `prompt_sd`：Stable Diffusion 格式（positive + negative）
- `prompt_video`：视频生成提示词（仅视频素材）

### subtitles.srt
字幕文件（SRT 格式），仅视频素材包含内容。
可导入剪辑软件用于字幕对齐。

## 使用建议
1. 先浏览 reference_frames/ 找到你喜欢的镜头
2. 打开 prompts.json 查看对应提示词
3. 将提示词粘贴到 Midjourney / Stable Diffusion / 可灵等工具中生成
4. 根据需要微调提示词中的关键词

---
由 Nibi / VidMirror 自动生成
"""


@router.get("/{workspace_id}/items/{item_id}/export")
def export_workspace_item(workspace_id: str, item_id: str) -> StreamingResponse:
    """导出复刻工作包 zip（Phase 1I 最简版）。"""
    rec = _store.get(workspace_id)
    if rec is None:
        raise HTTPException(status_code=404, detail=f"workspace not found: {workspace_id}")
    item = _find_item(rec, item_id)

    # 同步 task 产物到 item.results（X.1 状态桥拉模式）
    overlay = _sync_item_with_tasks(item)
    if overlay and overlay.get("results") and not item.results:
        item.results = overlay["results"]

    item_type = item.type

    # 获取结果数据
    if item_type == ItemType.VIDEO.value:
        data = _get_video_data(item)
        frames = data.get("frames", [])
        transcript = data.get("transcript", [])
        title = data.get("video", {}).get("title", item.name)
        prompts_data: Any = _build_prompts_json_video(frames)
        srt_content = _build_srt(transcript)
    elif item_type == ItemType.IMAGE.value:
        data = _get_image_data(item)
        frames = []
        transcript = []
        title = data.get("image", {}).get("title", item.name)
        prompts_data = _build_prompts_json_image(data)
        srt_content = ""
    elif item_type == ItemType.AUDIO.value:
        data = _get_audio_data(item)
        frames = []
        transcript = data.get("transcript", [])
        title = item.name
        prompts_data = _build_prompts_json_audio(data)
        srt_content = ""
    elif item_type == ItemType.TEXT.value:
        data = _get_text_data(item)
        frames = []
        transcript = []
        title = data.get("title", item.name) or item.name
        prompts_data = _build_prompts_json_text(data)
        srt_content = ""
    else:
        raise HTTPException(
            status_code=400,
            detail=f"item type {item_type!r} not supported for export",
        )

    # 在内存中构建 zip
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        if item_type == ItemType.VIDEO.value:
            # video: reference_frames/
            if frames:
                for f in frames:
                    ts = f.get("ts", "00-00").replace(":", "-")
                    shot = f.get("shot_type", "frame")
                    fname = f"reference_frames/frame_{ts}_{shot}.txt"
                    content = (
                        f"镜头: {f.get('title', '')}\n"
                        f"时间: {f.get('ts', '')}\n"
                        f"类型: {f.get('shot_type', '')}\n"
                        f"描述: {f.get('description', '')}\n"
                        f"\nMidjourney 提示词:\n{f.get('prompt_mj', '')}\n"
                    )
                    zf.writestr(fname, content)
            zf.writestr("subtitles.srt", srt_content)
            zf.writestr("prompts.json", json.dumps(prompts_data, ensure_ascii=False, indent=2))

        elif item_type == ItemType.IMAGE.value:
            # image: reference_frames/ + subtitles.srt（空）
            img_url = data.get("image", {}).get("image_url", "")
            zf.writestr(
                "reference_frames/source_image.txt",
                f"原始图片 URL: {img_url}\n标题: {title}\n",
            )
            zf.writestr("prompts.json", json.dumps(prompts_data, ensure_ascii=False, indent=2))
            zf.writestr("subtitles.srt", srt_content)

        elif item_type == ItemType.AUDIO.value:
            # audio: transcript.txt + summary.md + segments.json
            zf.writestr("transcript.txt", _build_transcript_txt(transcript))
            zf.writestr("summary.md", data.get("summary", ""))
            zf.writestr("segments.json", json.dumps(data.get("segments", []), ensure_ascii=False, indent=2))
            zf.writestr("prompts.json", json.dumps(prompts_data, ensure_ascii=False, indent=2))

        elif item_type == ItemType.TEXT.value:
            # text: source.md + summary.md + prompts.json
            zf.writestr("source.md", data.get("content") or data.get("markdown", ""))
            zf.writestr("summary.md", data.get("summary", ""))
            zf.writestr("prompts.json", json.dumps(prompts_data, ensure_ascii=False, indent=2))

        # README.md（所有类型通用）
        item_type_str = {"video": "视频", "image": "图片", "audio": "音频", "text": "文本"}.get(item_type, item_type)
        zf.writestr("README.md", _build_readme(title, item_type_str))

    buf.seek(0)

    # 文件名：复刻工作包_{title}_{YYYY-MM-DD}.zip
    safe_title = title.replace("/", "_").replace("\\", "_").replace(" ", "_")[:50]
    today = date.today().isoformat()
    filename = f"复刻工作包_{safe_title}_{today}.zip"
    # RFC5987 编码
    filename_star = f"UTF-8''{quote(filename)}"

    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={
            "Content-Disposition": f"attachment; filename*= {filename_star}",
        },
    )


_SUBTITLE_MIME: dict[str, str] = {
    "srt": "text/plain; charset=utf-8",
    "vtt": "text/vtt; charset=utf-8",
    "ass": "text/plain; charset=utf-8",
}


def _get_transcript_segments(item: WorkspaceItem) -> list[dict[str, Any]]:
    """从 item.results 中提取 transcript segments（兼容多种字段名 + 字段名归一化）。"""
    results = item.results or {}
    raw = results.get("segments") or results.get("transcript_segments") or results.get("transcript") or []
    if isinstance(raw, str):
        return []
    if not (isinstance(raw, list) and raw and isinstance(raw[0], dict)):
        return []

    normalized: list[dict[str, Any]] = []
    for seg in raw:
        if not isinstance(seg, dict):
            continue
        # 归一化字段名：display 格式用 t_sec，whisper 原始格式用 start/end
        start = seg.get("start") if "start" in seg else seg.get("t_sec", 0)
        end = seg.get("end", start)
        text = str(seg.get("text") or "").strip()
        if not text:
            continue
        entry: dict[str, Any] = {"start": float(start), "end": float(end), "text": text}
        if seg.get("speaker"):
            entry["speaker"] = seg["speaker"]
        normalized.append(entry)
    return normalized


@router.get("/{workspace_id}/items/{item_id}/subtitles")
def export_subtitles(
    workspace_id: str,
    item_id: str,
    format: str = "srt",
) -> StreamingResponse:
    """导出字幕文件（独立 .srt / .vtt / .ass 下载）。"""
    if format not in ("srt", "vtt", "ass"):
        raise HTTPException(status_code=400, detail=f"unsupported format: {format!r}, use srt/vtt/ass")

    rec = _store.get(workspace_id)
    if rec is None:
        raise HTTPException(status_code=404, detail=f"workspace not found: {workspace_id}")
    item = _find_item(rec, item_id)

    overlay = _sync_item_with_tasks(item)
    if overlay and overlay.get("results") and not item.results:
        item.results = overlay["results"]

    segments = _get_transcript_segments(item)
    if not segments:
        raise HTTPException(status_code=404, detail="no transcript segments found for this item")

    title = item.name or "untitled"

    if format == "srt":
        content = export_srt(segments)
        ext = "srt"
    elif format == "vtt":
        content = export_vtt(segments)
        ext = "vtt"
    else:
        content = export_ass(segments, title=title)
        ext = "ass"

    safe_title = title.replace("/", "_").replace("\\", "_").replace(" ", "_")[:50]
    filename = f"{safe_title}.{ext}"

    return StreamingResponse(
        io.BytesIO(content.encode("utf-8")),
        media_type=_SUBTITLE_MIME[format],
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}",
        },
    )
