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

from backend.app.models.workspace import ItemType, WorkspaceItem, WorkspaceRecord
from backend.app.services.video_result_demo import build_demo_video_result
from backend.app.routes.workspaces import _store

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


def _build_readme(title: str, item_type: str) -> str:
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

    is_video = item.type == ItemType.VIDEO.value
    is_image = item.type == ItemType.IMAGE.value

    if not is_video and not is_image:
        raise HTTPException(
            status_code=400,
            detail=f"item type {item.type!r} not supported for export (only video/image)",
        )

    # 获取结果数据
    if is_video:
        data = _get_video_data(item)
        frames = data.get("frames", [])
        transcript = data.get("transcript", [])
        title = data.get("video", {}).get("title", item.name)
        prompts_data: Any = _build_prompts_json_video(frames)
        srt_content = _build_srt(transcript)
    else:
        data = _get_image_data(item)
        frames = []
        transcript = []
        title = data.get("image", {}).get("title", item.name)
        prompts_data = _build_prompts_json_image(data)
        srt_content = ""

    # 在内存中构建 zip
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        # 1. reference_frames/
        if is_video and frames:
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
        elif is_image:
            # 图片素材：尝试从 image_url 下载（MVP 跳过，写占位说明）
            img_url = data.get("image", {}).get("image_url", "")
            zf.writestr(
                "reference_frames/source_image.txt",
                f"原始图片 URL: {img_url}\n标题: {title}\n",
            )

        # 2. prompts.json
        zf.writestr("prompts.json", json.dumps(prompts_data, ensure_ascii=False, indent=2))

        # 3. subtitles.srt
        zf.writestr("subtitles.srt", srt_content)

        # 4. README.md
        item_type_str = "视频" if is_video else "图片"
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
