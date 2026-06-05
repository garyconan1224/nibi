from __future__ import annotations

"""Workspace 路由——多媒体内容分析系统的「工作空间」CRUD。

路由前缀 /workspaces，与 /pipeline、/providers 等并列。
存储委托给 backend.app.services.workspace_store.WorkspaceStore，
持久化文件位于 data/workspaces/<workspace_id>.json。

接口清单（最小可用集，后续按设计文档增补）：
  POST   /workspaces                     创建工作空间
  GET    /workspaces                     列表（默认排除 trashed；trashed_only/include_trashed 可切换视图）
  GET    /workspaces/{ws_id}             详情
  PATCH  /workspaces/{ws_id}             更新名称 / 状态 / 背景信息
  DELETE /workspaces/{ws_id}             软删除（标记 trashed=True）
  POST   /workspaces/{ws_id}/restore     从垃圾桶恢复
  DELETE /workspaces/{ws_id}/permanent   彻底删除（必须先软删）
  DELETE /workspaces/trash               清空垃圾桶
  POST   /workspaces/{ws_id}/items       添加素材
  DELETE /workspaces/{ws_id}/items/{id}  移除素材
  POST   /workspaces/{ws_id}/favorites/{id}    收藏素材
  DELETE /workspaces/{ws_id}/favorites/{id}    取消收藏
"""

import io
import json
import logging
import re
import shutil
import threading
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

from backend.app.models.tasks import TERMINAL_STATUS_VALUES, TaskStatus

# 项目根目录（backend/app/routes/workspaces.py → routes → app → backend → root）
_ROOT_DIR: Path = Path(__file__).resolve().parent.parent.parent.parent

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from backend.app.models.workspace import (
    InlineFrame,
    ItemStatus,
    ItemSummary,
    ItemType,
    PreflightConfig,
    WorkspaceBackground,
    WorkspaceItem,
    WorkspaceRecord,
    WorkspaceStatus,
)
from backend.app.services.audio_result_demo import build_demo_audio_result
from backend.app.services.note_assembler import assemble_item_note, note_dir
from backend.app.services.summary_generator import generate_summary
from backend.app.services.summary_templates import list_template_ids
from backend.app.services.video_result_demo import build_demo_video_result
from backend.app.services.workspace_search_service import search_one_workspace
from backend.app.services.workspace_store import WorkspaceStore
from shared.config import DATA_DIR
from shared.url_sniffer import sniff_url

# 复用 pipeline 路由的 runner / store 单例，避免重复初始化任务引擎
from backend.app.routes.pipeline import _runner as _pipeline_runner
from backend.app.models.tasks import TaskRecord

router = APIRouter(prefix="/workspaces", tags=["workspaces"])

# 进程级单例 store（与 pipeline 路由的 _store 同模式）
_store = WorkspaceStore()


def _task_config_value(tasks: Dict[str, Any], *keys: str) -> Any:
    """Return the first present task config, preserving False boolean values."""
    for key in keys:
        if key in tasks:
            value = tasks.get(key)
            if isinstance(value, (dict, bool)):
                return value
    return None


def _copy_task_config(
    payload: Dict[str, Any],
    payload_key: str,
    tasks: Dict[str, Any],
    *task_keys: str,
) -> None:
    value = _task_config_value(tasks, *task_keys)
    if value is not None:
        payload[payload_key] = value


def normalize_video_summary_path(raw: str) -> str:
    """规范化前端 summary_path 值为 pipeline 可识别的 canonical 值。"""
    if not raw:
        return ""
    mapping: Dict[str, str] = {
        # 字幕路径
        "字幕直接总结": "subtitle",
        "只听字幕/音频转写": "subtitle",
        "subtitle": "subtitle",
        # 音视频综合路径
        "音视频合并 · 最详细": "av_combined",
        "音视频综合": "av_combined",
        "detailed": "av_combined",
        "av_combined": "av_combined",
        # 只看画面路径
        "只看画面": "visual_only",
        "visual_only": "visual_only",
        # 视频模型直传（保留未来项）
        "视频模型直接分析": "video_model",
        "video_model": "video_model",
    }
    return mapping.get(raw.strip(), raw.strip())


def _adapt_r8_frame_prompt(frame_prompt: Dict[str, Any]) -> Dict[str, Any]:
    """R8 preflightTasks 字段名 -> CaptureParams 可读字段名。"""
    adapted = dict(frame_prompt)
    if "frame_mode" in adapted and "mode" not in adapted:
        raw_mode = str(adapted.pop("frame_mode"))
        mode_map = {"按秒截帧": "interval", "AI 镜头分析": "ai_shot"}
        adapted["mode"] = mode_map.get(raw_mode, raw_mode)
    if "sec_per_frame" in adapted and "interval_sec" not in adapted:
        adapted["interval_sec"] = adapted.pop("sec_per_frame")
    if "shot_frames" in adapted and "frames_per_shot" not in adapted:
        raw = str(adapted.pop("shot_frames"))
        # "2 帧 · 首+尾" -> 2, "3 帧 · 首+中+尾" -> 3
        try:
            adapted["frames_per_shot"] = int(raw[0])
        except (ValueError, IndexError):
            pass
    return adapted


def _augment_video_analyze_payload(payload: Dict[str, Any], item: WorkspaceItem) -> None:
    """Copy video preflight params used by the current analyze pipeline."""
    tasks = item.preflight.tasks or {}
    preflight_params = tasks.get("preflight")
    if isinstance(preflight_params, dict):
        if preflight_params.get("intent"):
            payload["intent"] = preflight_params["intent"]
        if preflight_params.get("background_for_recognition"):
            payload["background_for_recognition"] = preflight_params[
                "background_for_recognition"
            ]

    frame_prompts_params = tasks.get("frame_prompt")
    if isinstance(frame_prompts_params, dict):
        payload["frame_prompt"] = _adapt_r8_frame_prompt(frame_prompts_params)

    summary_params = tasks.get("summary")
    if isinstance(summary_params, dict):
        # 兼容 R8 summary.summary_path 和旧 summary.path
        raw_path = summary_params.get("summary_path") or summary_params.get("path")
        if raw_path:
            payload["summary_path"] = normalize_video_summary_path(str(raw_path))
        if summary_params.get("video_template"):
            payload["video_template"] = summary_params["video_template"]
        if summary_params.get("output_format"):
            payload["output_format"] = summary_params["output_format"]

    # 布尔标志兜底：preflight 中 transcribe + summarize 都为 true 时，
    # 默认走 N7b 路径 1（字幕直接总结），不触发 VLM 逐帧分析
    if tasks.get("transcribe") and tasks.get("summarize"):
        if "summary_path" not in payload:
            payload["summary_path"] = "subtitle"


def _on_download_success(completed_task: TaskRecord, runner) -> None:  # type: ignore[type-arg]
    """X.5 任务链：download 成功后自动 enqueue analyze，并把 analyze task_id 写回 item。

    逻辑：
    1. 从 download 产物拿 save_path（视频本地路径）
    2. enqueue 一个 analyze task，payload 带 video_basenames
    3. 扫描所有 workspace items，找引用了此 download task_id 的 item
    4. 追加 analyze task_id 到 item.related_task_ids（持久化）
    """
    save_path = str(completed_task.result.get("save_path") or "").strip()
    if not save_path:
        return  # download 没有产出文件（可能被取消），不起 analyze

    video_basename = Path(save_path).name
    project_id = completed_task.project_id
    refs: list[tuple[WorkspaceRecord, WorkspaceItem]] = []
    for ws in _store.list_all():
        for item in ws.items:
            if completed_task.task_id in item.related_task_ids:
                refs.append((ws, item))

    analyze_payload: Dict[str, Any] = {"video_basenames": [video_basename]}
    if refs:
        _augment_video_analyze_payload(analyze_payload, refs[0][1])

    # R13.1 继承 download 阶段 yt-dlp 抽取的视频元数据，供 ProcessingPage 在 analyze 阶段展示
    _dl_result = completed_task.result or {}
    for _key in ("video_title", "video_duration", "video_uploader", "video_thumbnail_url"):
        if _dl_result.get(_key):
            analyze_payload[_key] = _dl_result[_key]
    if completed_task.payload.get("url"):
        analyze_payload["source_url"] = completed_task.payload["url"]

    try:
        analyze_task = runner.create_task(project_id, "analyze", analyze_payload)
    except Exception:
        return  # analyze enqueue 失败不影响 download 本身

    # 从下载产物文件名里提取视频真实标题（yt-dlp 模板: %(title)s-%(id)s.%(ext)s）
    import re as _re
    _title = _re.sub(r'-[^-]+\.[^.]+$', '', video_basename) if video_basename else ""

    # 把 analyze task_id + 视频标题写回所有关联此 download task 的 workspace items
    for ws, item in refs:
        new_ids = list(item.related_task_ids) + [analyze_task.task_id]
        try:
            _update_kwargs: Dict[str, Any] = {"related_task_ids": new_ids}
            if _title and (not item.name or item.name in (item.source_value, item.source_value.split("/")[-1])):
                _update_kwargs["name"] = _title
            _store.update_item(ws.workspace_id, item.item_id, **_update_kwargs)
        except Exception:
            pass  # 写失败不阻断（X.1 桥仍能通过 download task 显示最终状态）

    # R13.6.1 用共享工具触发 workspace 改名（替代 R13.4 内联逻辑）
    _meta = dict(completed_task.result or {})
    if not _meta.get("video_title") and _title:
        _meta["video_title"] = _title
    _maybe_rename_workspace_from_video_title(completed_task, _meta)


_pipeline_runner.register_success_callback("download", _on_download_success)


# ── Phase 3C.4：分析任务 SUCCESS 后自动打标 ──────────────────────


def _autotag_items_for_task(task: TaskRecord, runner) -> None:  # type: ignore[type-arg]
    """对引用 task.task_id 的所有 workspace items 调 LLM 自动打标（同步逻辑）。

    跳过已经有 tags 的 item，避免重复消耗 LLM 配额；任何异常都不阻塞主流程。
    """
    # 延迟 import 避免与 settings/provider 链路的初始化顺序冲突
    from backend.app.services.tag_generator import generate_tags  # noqa: PLC0415

    for ws in _store.list_all():
        for item in ws.items:
            if task.task_id not in item.related_task_ids:
                continue
            if item.tags:
                continue
            try:
                tags = generate_tags(item, ws, task_store=runner.store)
            except Exception:
                tags = {}
            if not tags:
                continue
            try:
                _store.update_item(ws.workspace_id, item.item_id, tags=tags)
            except Exception:
                pass


def _on_analysis_success_autotag(completed_task: TaskRecord, runner) -> None:  # type: ignore[type-arg]
    """task SUCCESS 后异步触发自动打标（不阻塞 task worker 线程）。"""
    threading.Thread(
        target=_autotag_items_for_task,
        args=(completed_task, runner),
        daemon=True,
        name=f"autotag-{completed_task.task_id}",
    ).start()


for _tt in ("analyze", "text", "audio", "image"):
    _pipeline_runner.register_success_callback(_tt, _on_analysis_success_autotag)


def _assemble_note_for_task(task: TaskRecord, runner) -> None:  # type: ignore[type-arg]
    """对引用 task.task_id 的所有 workspace items 触发 note 惰性组装（同步逻辑）。

    只在 notes/<item_id>/ 不存在时组装（幂等：已组装的跳过）。
    任何异常都不阻塞主流程。
    """
    for ws in _store.list_all():
        for item in ws.items:
            if task.task_id not in item.related_task_ids:
                continue
            nd = note_dir(ws.workspace_id, item.item_id)
            if (nd / "note.md").exists():
                continue
            # 从 task store 回填 results（与 get_item_note 同逻辑）
            merged = dict(item.results or {})
            if task.result:
                merged.update(task.result)
            item.results = merged
            try:
                assemble_item_note(ws.workspace_id, item.item_id, _item=item)
            except Exception:
                pass


def _on_analysis_success_assemble(completed_task: TaskRecord, runner) -> None:  # type: ignore[type-arg]
    """task SUCCESS 后异步触发 note 组装（不阻塞 task worker 线程）。"""
    threading.Thread(
        target=_assemble_note_for_task,
        args=(completed_task, runner),
        daemon=True,
        name=f"assemble-{completed_task.task_id}",
    ).start()


for _tt in ("analyze", "text", "audio", "image"):
    _pipeline_runner.register_success_callback(_tt, _on_analysis_success_assemble)

WORKSPACE_UPLOAD_ROOT: Path = DATA_DIR / "workspaces"
MAX_UPLOAD_BYTES = 500 * 1024 * 1024
UPLOAD_CHUNK_BYTES = 1024 * 1024
_SAFE_UPLOAD_NAME_RE = re.compile(r"[^A-Za-z0-9._\u4e00-\u9fff\-]+")
_EXTENSION_TYPE_MAP: Dict[str, str] = {
    ".mp4": ItemType.VIDEO.value,
    ".mov": ItemType.VIDEO.value,
    ".avi": ItemType.VIDEO.value,
    ".mkv": ItemType.VIDEO.value,
    ".flv": ItemType.VIDEO.value,
    ".wmv": ItemType.VIDEO.value,
    ".webm": ItemType.VIDEO.value,
    ".mp3": ItemType.AUDIO.value,
    ".wav": ItemType.AUDIO.value,
    ".m4a": ItemType.AUDIO.value,
    ".aac": ItemType.AUDIO.value,
    ".flac": ItemType.AUDIO.value,
    ".ogg": ItemType.AUDIO.value,
    ".jpg": ItemType.IMAGE.value,
    ".jpeg": ItemType.IMAGE.value,
    ".png": ItemType.IMAGE.value,
    ".gif": ItemType.IMAGE.value,
    ".webp": ItemType.IMAGE.value,
    ".txt": ItemType.TEXT.value,
    ".md": ItemType.TEXT.value,
    ".srt": ItemType.TEXT.value,
    ".vtt": ItemType.TEXT.value,
    ".json": ItemType.TEXT.value,
    # Phase 2C.1：文本输入层支持的额外扩展名
    ".pdf": ItemType.TEXT.value,
    ".docx": ItemType.TEXT.value,
    ".html": ItemType.TEXT.value,
    ".htm": ItemType.TEXT.value,
}


# ── Pydantic 请求/响应模型 ─────────────────────────────────


class WorkspaceCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120, description="工作空间名称")
    background: Dict[str, Any] = Field(default_factory=dict)


class WorkspaceUpdateRequest(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = Field(default=None, description="active|processing|analyzed|archived")
    background: Optional[Dict[str, Any]] = None


class ItemAddRequest(BaseModel):
    type: str = Field(description="video|audio|image|text")
    source: str = Field(description="url|local")
    source_value: str = Field(description="URL 或本地路径")
    name: str = Field(default="", description="可选显示名，未填则从 source_value 推导")


class PreflightSaveRequest(BaseModel):
    """前置配置保存请求体（设计文档第 4 章）。"""

    intent: str = Field(default="", description='"learning" | "replica" | ""')
    background_overrides: Dict[str, Any] = Field(default_factory=dict)
    models: Dict[str, str] = Field(
        default_factory=dict,
        description="键: vision|text|video，值: provider_id",
    )
    tasks: Dict[str, Any] = Field(
        default_factory=dict,
        description="勾选项及子参数；结构按 item.type 区分",
    )


class AutoCreateRequest(BaseModel):
    """自动创建工作空间请求体。"""

    hint_url: Optional[str] = Field(default=None, description="提示 URL，用于推导名称")
    hint_text: Optional[str] = Field(default=None, description="提示文本，用于推导名称")


class SniffUrlRequest(BaseModel):
    """URL 内容类型嗅探请求体。"""

    url: str = Field(min_length=1, description="待嗅探的 URL")


class PromptVersionRequest(BaseModel):
    """提示词版本新增请求体。"""

    content: str = Field(min_length=1, description="提示词内容")


# ── 内部小工具 ────────────────────────────────────────────


def _ensure_valid_item_type(t: str) -> None:
    try:
        ItemType(t)
    except ValueError as err:
        raise HTTPException(
            status_code=400,
            detail=f"invalid item type: {t}; expected one of video|audio|image|text",
        ) from err


def _ensure_valid_status(s: Optional[str]) -> None:
    if s is None:
        return
    try:
        WorkspaceStatus(s)
    except ValueError as err:
        raise HTTPException(
            status_code=400,
            detail=f"invalid status: {s}",
        ) from err


# ── URL 规整（F1.7）──────────────────────────────────────────────────

_BILIBILI_BV_RE = re.compile(r"^BV[a-zA-Z0-9]+$")

# 抖音短链模式——用于从分享文案中提取纯 URL
_DOUYIN_URL_RE = re.compile(
    r"https?://(?:v\.douyin\.com|www\.douyin\.com|www\.iesdouyin\.com|dy\.com)/\S+",
    re.IGNORECASE,
)

# 通用 URL 提取——从任意分享文案中提取第一个 https?:// 开头的 URL（去除尾部中文标点）
_GENERIC_URL_RE = re.compile(r"https?://[^\s，。！？；：“”‘’（）【】《》]+")

_TRACKING_PARAMS = frozenset({
    "spm_id_from", "vd_source", "share_source", "share_medium",
    "bbid", "ts", "unique_k", "p", "vd_source_2",
})


def _normalize_media_url(raw: str) -> str:
    """规整用户粘入的 URL，确保同一视频的不同变体收敛为同一字符串。

    处理：
    ① 从分享文案中提取纯 URL（抖音短链优先，否则通用提取）
    ② 纯 BV 号 → 拼完整 B 站 URL
    ③ 缺 scheme → 补 https://
    ④ 去掉追踪参数（spm_id_from / vd_source 等）
    ⑤ 去掉尾斜杠
    """
    s = raw.strip()

    # ① 从分享文案中提取纯 URL
    dy_match = _DOUYIN_URL_RE.search(s)
    if dy_match:
        s = dy_match.group(0)
    else:
        generic_match = _GENERIC_URL_RE.search(s)
        if generic_match:
            s = generic_match.group(0)

    # ② 纯 BV 号
    if _BILIBILI_BV_RE.match(s):
        s = f"https://www.bilibili.com/video/{s}"

    # ③ 缺 scheme（没有任何 :// 的才补 https://）
    if "://" not in s:
        s = f"https://{s}"

    # ④⑤ 解析并清理
    try:
        u = urlparse(s)
        if u.query:
            qs_parts = [
                f"{k}={v}"
                for k, v in (p.split("=", 1) for p in u.query.split("&") if "=" in p)
                if k not in _TRACKING_PARAMS
            ]
            qs = "&".join(qs_parts)
        else:
            qs = ""
        clean = u.scheme + "://" + u.netloc + u.path.rstrip("/")
        if qs:
            clean += "?" + qs
        return clean
    except Exception:
        return s.rstrip("/")


def _validate_network_url(raw: str) -> str:
    """校验并规整网络链接。

    Why: source=url 直接交给下游 yt-dlp / 下载器，空白或畸形字符串会在
    pipeline 深处才报错，对用户不友好。这里在入口阻断。
    """
    value = _normalize_media_url(raw)
    if not value:
        raise HTTPException(status_code=400, detail="URL cannot be empty")
    try:
        parsed = urlparse(value)
    except ValueError as err:
        raise HTTPException(status_code=400, detail=f"invalid URL: {err}") from err
    if parsed.scheme.lower() not in ("http", "https"):
        raise HTTPException(
            status_code=400,
            detail="URL must start with http:// or https://",
        )
    if not parsed.netloc:
        raise HTTPException(status_code=400, detail="URL host cannot be empty")
    return value


def _derive_item_name(source_value: str) -> str:
    """从 URL/路径里挑一个可读名字。"""
    raw = source_value.strip()
    if not raw:
        return "未命名素材"
    # 取最后一段（path 的 basename 或 URL 的 last segment）
    seg = raw.replace("\\", "/").rstrip("/").split("/")[-1]
    return seg or raw[:40]


def _sanitize_upload_name(name: str) -> str:
    """保留文件名本体，替换危险字符，避免跨目录写入。"""
    raw = Path(name or "").name or "upload.bin"
    safe = _SAFE_UPLOAD_NAME_RE.sub("_", raw).strip("._")
    return safe or "upload.bin"


def _unique_upload_path(upload_dir: Path, safe_name: str) -> Path:
    """避免同名上传覆盖已有文件。"""
    candidate = upload_dir / safe_name
    if not candidate.exists():
        return candidate

    stem = candidate.stem or "upload"
    suffix = candidate.suffix
    for idx in range(1, 10_000):
        candidate = upload_dir / f"{stem}_{idx}{suffix}"
        if not candidate.exists():
            return candidate
    raise HTTPException(status_code=500, detail="failed to allocate upload filename")


def _cleanup_workspace_uploads(workspace_id: str) -> None:
    """删除本服务为该 workspace 管理的上传目录。"""
    upload_dir = (WORKSPACE_UPLOAD_ROOT / workspace_id).resolve()
    root = WORKSPACE_UPLOAD_ROOT.resolve()
    try:
        upload_dir.relative_to(root)
    except ValueError:
        return
    shutil.rmtree(upload_dir, ignore_errors=True)


def _infer_upload_item_type(filename: str, content_type: Optional[str]) -> str:
    """按扩展名优先、MIME 兜底推断素材类型。"""
    ext = Path(filename or "").suffix.lower()
    if ext in _EXTENSION_TYPE_MAP:
        return _EXTENSION_TYPE_MAP[ext]

    mime = (content_type or "").lower()
    if mime.startswith("video/"):
        return ItemType.VIDEO.value
    if mime.startswith("audio/"):
        return ItemType.AUDIO.value
    if mime.startswith("image/"):
        return ItemType.IMAGE.value
    if mime.startswith("text/"):
        return ItemType.TEXT.value

    raise HTTPException(
        status_code=400,
        detail=(
            "unsupported upload file type; expected video/audio/image/text "
            "extension or MIME type"
        ),
    )


# ── 派生字段计算（Phase 1A，v1.1 §2.2）────────────────────


def _cover_thumbnail(rec: WorkspaceRecord) -> Optional[str]:
    """从第一个 video item 的结果里提取封面缩略图路径，找不到返回 None。

    按优先级尝试四个路径：
      item.results.cover_thumbnail
      item.results.frames[0].thumbnail
      item.results.frames[0].frame_image_path
      item.results.frames[0].frame_image
    """
    for item in rec.items:
        r = item.results or {}
        if r.get("cover_thumbnail"):
            return str(r["cover_thumbnail"])
        # item.results 未同步时，从 task store 回填 cover_thumbnail（与 create_summary 同思路）
        for _tid in reversed(item.related_task_ids or []):
            _t = _pipeline_runner.store.get(_tid)
            if _t and _t.result and _t.result.get("cover_thumbnail"):
                return str(_t.result["cover_thumbnail"])
        if item.type != "video":
            continue
        frames = r.get("frames") or []
        if frames and isinstance(frames[0], dict):
            f0 = frames[0]
            for key in ("thumbnail", "frame_image_path", "frame_image"):
                if f0.get(key):
                    return str(f0[key])
    return None


def _current_step(rec: WorkspaceRecord) -> Optional[str]:
    """取 workspace 内最新一个非终结任务的 status 字符串，没有则返回 None。

    遍历所有 item.related_task_ids，在 pipeline task_store 里查状态，
    排除 SUCCESS / FAILED / CANCELLED，取 updated_at 最大的那条。
    """
    best_status: Optional[str] = None
    best_updated: str = ""

    for item in rec.items:
        for tid in item.related_task_ids:
            task = _pipeline_runner.store.get(tid)
            if task is None:
                continue
            if task.status in TERMINAL_STATUS_VALUES:
                continue
            if task.updated_at > best_updated:
                best_updated = task.updated_at
                best_status = task.status

    return best_status


def _items_count_by_type(rec: WorkspaceRecord) -> Dict[str, int]:
    """统计 workspace 内各类素材数量，四类全返回（无则为 0）。"""
    counts: Dict[str, int] = {"video": 0, "audio": 0, "image": 0, "text": 0}
    for item in rec.items:
        t = item.type
        if t in counts:
            counts[t] += 1
    return counts


def _sync_item_with_tasks(item: WorkspaceItem) -> Optional[Dict[str, Any]]:
    """Phase X.1 状态桥（拉模式）：根据 related_task_ids 推导 item 当前应有的状态/产物。

    - status：最新一条 task 决定。SUCCESS→done / FAILED|CANCELLED→failed / 其它非终结→processing
    - results：最新一条 SUCCESS 任务的 result，作为 overlay 返回（item.results 已有则不覆盖）
    只读 task_store；返回 None 表示无需 overlay。**不修改** item 本身，避免污染 store 缓存。
    """
    if not item.related_task_ids:
        return None

    latest: Optional[Any] = None
    latest_success: Optional[Any] = None
    for tid in item.related_task_ids:
        task = _pipeline_runner.store.get(tid)
        if task is None:
            continue
        if latest is None or task.updated_at > latest.updated_at:
            latest = task
        if task.status == TaskStatus.SUCCESS.value and (
            latest_success is None or task.updated_at > latest_success.updated_at
        ):
            latest_success = task

    if latest is None:
        return None

    overlay: Dict[str, Any] = {}
    if latest.status == TaskStatus.SUCCESS.value:
        overlay["status"] = ItemStatus.DONE.value
    elif latest.status in (TaskStatus.FAILED.value, TaskStatus.CANCELLED.value):
        overlay["status"] = ItemStatus.FAILED.value
    else:
        overlay["status"] = ItemStatus.PROCESSING.value

    if latest_success is not None and latest_success.result:
        merged = dict(item.results or {})
        merged.update(latest_success.result)
        # 若最新 task 没提供 cover_thumbnail，从更早的 SUCCESS task 补（下载封面优先）
        if not merged.get("cover_thumbnail"):
            for tid in item.related_task_ids:
                task = _pipeline_runner.store.get(tid)
                if task is None or task is latest_success:
                    continue
                if task.status == TaskStatus.SUCCESS.value and task.result:
                    ct = task.result.get("cover_thumbnail")
                    if ct:
                        merged["cover_thumbnail"] = ct
                        break
        overlay["results"] = merged

    return overlay


def _task_failed_response(item: WorkspaceItem) -> Optional[Dict[str, Any]]:
    """R18.1.2: 若 item 最新任务已 FAILED，返回 task_failed 响应；否则返回 None。"""
    if not item.related_task_ids:
        return None
    latest_tid = item.related_task_ids[-1]
    task = _pipeline_runner.store.get(latest_tid)
    if task is not None and task.status == TaskStatus.FAILED.value:
        return {"source": "task_failed", "task_id": task.task_id, "error": task.error or "未知错误"}
    return None


def _enrich_workspace(rec: WorkspaceRecord) -> Dict[str, Any]:
    """把 WorkspaceRecord.to_dict() 合并上 Phase 1A 派生字段后返回。

    派生字段在路由层计算，不写回 WorkspaceStore。
    """
    d = rec.to_dict()
    items_out = d.get("items") or []
    for item_obj, item_dict in zip(rec.items, items_out):
        overlay = _sync_item_with_tasks(item_obj)
        if overlay:
            item_dict.update(overlay)
    d["current_step"] = _current_step(rec)
    d["items_count_by_type"] = _items_count_by_type(rec)
    d["cover_thumbnail"] = _cover_thumbnail(rec)
    d["last_active_at"] = rec.updated_at
    return d


# ── Workspace CRUD ───────────────────────────────────────


@router.post("")
def create_workspace(req: WorkspaceCreateRequest) -> Dict[str, Any]:
    """新建一个工作空间。"""
    bg = WorkspaceBackground.from_dict(req.background or {})
    rec = WorkspaceRecord(
        workspace_id=str(uuid.uuid4()),
        name=req.name.strip(),
        background=bg,
    )
    _store.create(rec)
    return rec.to_dict()


_AUTO_CREATE_LOGGER = logging.getLogger(f"{__name__}.auto_create")


def _generate_workspace_name(hint_url: str | None, hint_text: str | None) -> str:
    """根据 hint URL/text 生成工作空间名称。

    不调用 LLM（同步 LLM 调用可能耗时 20s+，触发 axios 15s 超时）。
    以 hostname + 时间戳作为确定性 fallback。
    """
    hint = (hint_url or hint_text or "").strip()
    hostname = ""
    if hint_url:
        try:
            hostname = urlparse(hint_url).hostname or ""
        except Exception:
            pass
    # 取 hostname 第一段（如 www.bilibili.com → bilibili）
    if hostname:
        parts = hostname.split(".")
        hostname = parts[-2] if len(parts) >= 2 else parts[0]
        hostname = hostname.capitalize()
    ts = datetime.now(timezone.utc).strftime("%m%d-%H%M")
    return f"{hostname} · {ts}" if hostname else f"工作空间 · {ts}"


def _maybe_rename_workspace_from_video_title(
    record,
    meta: Dict[str, Any],
) -> None:
    """R13.6.1 把 yt-dlp 拿到的视频标题回写到关联的自动建空间。

    任何 handler（download/audio/note）拿到 metadata 后都能调这个工具。
    """
    video_title = (meta or {}).get("video_title") or ""
    if not video_title:
        return
    url = record.payload.get("url") or record.payload.get("source") or ""
    platform = _platform_prefix_from_url(url) if url else ""
    new_ws_name = f"{platform} · {video_title}" if platform else video_title

    for ws in _store.list_all():
        if not _is_auto_generated_workspace_name(ws.name):
            continue
        for item in ws.items:
            if record.task_id in item.related_task_ids:
                try:
                    _store.update(ws.workspace_id, name=new_ws_name)
                except Exception:
                    pass
                break


def _is_auto_generated_workspace_name(name: str) -> bool:
    """判断 workspace name 是否是自动生成的 hostname + 时间戳格式（R13.4 用）。

    匹配 _generate_workspace_name 产出的模式：Xxx · MMDD-HHMM 或 工作空间 · MMDD-HHMM。
    """
    return bool(re.match(r"^(?:[A-Za-z一-龥]+ · \d{4}-\d{4}|工作空间 · \d{4}-\d{4})$", name or ""))


_PLATFORM_HOST_MAP: list[tuple[tuple[str, ...], str]] = [
    (("bilibili.com",), "bilibili"),
    (("youtube.com", "youtu.be"), "youtube"),
    (("xiaohongshu.com", "xhslink.com"), "xiaohongshu"),
    (("douyin.com", "iesdouyin.com"), "douyin"),
    (("kuaishou.com",), "kuaishou"),
    (("mp.weixin.qq.com",), "weixin"),
]


def _platform_prefix_from_url(url: str) -> str:
    """与前端 platformPrefixFromUrl 同语义，返回小写平台名或 ''."""
    if not url:
        return ""
    try:
        host = (urlparse(url).hostname or "").lower()
    except Exception:
        return ""
    for hosts, name in _PLATFORM_HOST_MAP:
        if any(host.endswith(h) for h in hosts):
            return name
    parts = host.replace("www.", "").split(".")
    return parts[-2] if len(parts) >= 2 else host


@router.post("/auto-create")
def auto_create_workspace(req: AutoCreateRequest) -> Dict[str, Any]:
    """根据 hint URL/text 用 LLM 生成名字，自动建空间。"""
    name = _generate_workspace_name(req.hint_url, req.hint_text)
    rec = WorkspaceRecord(
        workspace_id=str(uuid.uuid4()),
        name=name,
    )
    _store.create(rec)
    return rec.to_dict()


@router.post("/sniff-url")
def sniff_media_url(req: SniffUrlRequest) -> dict:
    """嗅探 URL 的内容类型（不下载实际文件）。

    策略三层：已知平台路径匹配 → HTTP Content-Type →
    fallback。始终返回 200，嗅探失败时返回 primary_type='video'
    并附带 error 字段供前端展示/降级。
    """
    try:
        result = sniff_url(req.url)
        d = result.to_dict()
        if not result.platform and not result.content_type_header:
            # 完全 fallback 场景——没有任何可识别的信号
            d["error"] = "无法识别内容类型，已按「视频」处理"
        return d
    except Exception:
        logger.warning("sniff_url failed for %s", req.url, exc_info=True)
        return {
            "primary_type": "video",
            "possible_types": ["video"],
            "platform": None,
            "title": None,
            "thumbnail": None,
            "content_type_header": None,
            "error": "嗅探服务异常，已按「视频」降级处理",
        }


@router.get("")
def list_workspaces(
    trashed_only: bool = False,
    include_trashed: bool = False,
) -> List[Dict[str, Any]]:
    """列出工作空间。

    默认排除 trashed（软删除后的"垃圾桶"内容）。
    trashed_only=true：仅返回垃圾桶；include_trashed=true：返回全部。
    """
    recs = _store.list_all(
        trashed_only=trashed_only,
        include_trashed=include_trashed,
    )
    return [_enrich_workspace(r) for r in recs]


# ── Phase L1：资料库聚合端点 ──────────────────────────────


def _item_duration_seconds(
    item: WorkspaceItem,
    results: Optional[Dict[str, Any]] = None,
) -> Optional[float]:
    """从 item.results（或传入的 merged results）提取时长。"""
    results = results or item.results or {}
    dur = results.get("duration_sec")
    if dur is None:
        dur = (results.get("tracks_meta") or {}).get("total_sec")
    if dur is not None:
        try:
            return float(dur)
        except (ValueError, TypeError):
            return None
    return None


def _item_thumbnail(item: WorkspaceItem, results: dict = None) -> Optional[str]:
    """从 item.results（或传入的 merged results）提取缩略图路径，转为 /static/ URL。"""
    results = results or item.results or {}
    path = None
    if results.get("cover_thumbnail"):
        path = str(results["cover_thumbnail"])
    else:
        frames = results.get("frames") or []
        if frames and isinstance(frames[0], dict):
            for key in ("thumbnail", "frame_image_path", "frame_image"):
                if frames[0].get(key):
                    path = str(frames[0][key])
                    break
    if not path and item.type == "audio":
        audio = results.get("audio") if isinstance(results.get("audio"), dict) else {}
        audio_filename = str(audio.get("filename") or "").strip()
        project_id = str(results.get("project_id") or "").strip()
        if audio_filename and project_id:
            stem = Path(audio_filename).stem
            audio_dir = DATA_DIR / "workspaces" / project_id / "audio"
            for ext in (".jpg", ".jpeg", ".webp", ".png"):
                candidate = audio_dir / f"{stem}{ext}"
                if candidate.is_file():
                    path = str(candidate)
                    break
    if path:
        # HTTP URL 直接返回（如图片源地址）
        if path.startswith(("http://", "https://")):
            return path
        try:
            data_root = (_ROOT_DIR / "data").resolve()
            abs_path = Path(path).resolve()
            if abs_path.is_relative_to(data_root):
                return "/static/" + str(abs_path.relative_to(data_root))
            return path
        except (ValueError, OSError):
            return path
    # 第三级：yt-dlp 拿到的远端封面 URL（audio 任务 / video 任务都可能有）
    vt = results.get("video_thumbnail_url")
    if vt and isinstance(vt, str) and vt.startswith(("http://", "https://")):
        return vt
    return None


def _item_display_name(
    rec: WorkspaceRecord,
    item: WorkspaceItem,
    results: dict,
) -> str:
    """从最新结果里取资料库卡片标题，兼容旧 audio 结果只存 filename 的情况。"""
    video_title = str(results.get("video_title") or "").strip()
    if video_title:
        return video_title

    audio = results.get("audio") if isinstance(results.get("audio"), dict) else {}
    audio_filename = str(audio.get("filename") or "").strip()
    if audio_filename:
        return Path(audio_filename).stem

    raw_name = item.name or ""
    source_tail = item.source_value.split("/")[-1] if item.source_value else ""
    if raw_name and raw_name not in (item.source_value, source_tail):
        return raw_name

    if rec.name:
        return rec.name
    return raw_name


def _item_primary_task_status(item: WorkspaceItem) -> Optional[str]:
    """返回 item.related_task_ids 里最新 task 的 status。"""
    if not item.related_task_ids:
        return None
    latest = None
    for tid in item.related_task_ids:
        task = _pipeline_runner.store.get(tid)
        if task is None:
            continue
        if latest is None or task.updated_at > latest.updated_at:
            latest = task
    return latest.status if latest else None


@router.get("/library")
def get_library(include_trashed: bool = False) -> Dict[str, Any]:
    """聚合端点：摊平所有 workspace items + workspace 摘要，供「资料库」页使用。"""
    recs = _store.list_all(
        include_trashed=include_trashed,
        trashed_only=False,
    )

    items_out: List[Dict[str, Any]] = []
    workspaces_out: List[Dict[str, Any]] = []

    for rec in recs:
        # workspace 摘要卡片
        workspaces_out.append({
            "workspace_id": rec.workspace_id,
            "name": rec.name,
            "items_count": len(rec.items),
            "items_count_by_type": _items_count_by_type(rec),
            "cover_thumbnail": _cover_thumbnail(rec),
            "updated_at": rec.updated_at,
            "status": rec.status,
        })

        for item in rec.items:
            # X.1 bridge：用 task 状态覆盖 item status
            item_status = item.status
            overlay = _sync_item_with_tasks(item)
            if overlay and "status" in overlay:
                item_status = overlay["status"]

            results = (overlay.get("results") if overlay else None) or item.results or {}
            display_name = _item_display_name(rec, item, results)
            audio_nature = None
            if item.type == "audio":
                music_mode = results.get("music_mode")
                has_music = results.get("music")
                has_speech = (results.get("vad") or {}).get("has_speech")
                if music_mode or (has_music and not has_speech):
                    audio_nature = "music"
                elif has_speech:
                    audio_nature = "speech"
            items_out.append({
                "item_id": item.item_id,
                "workspace_id": rec.workspace_id,
                "workspace_name": rec.name,
                "type": item.type,
                "source": item.source,
                "source_value": item.source_value,
                "name": display_name,
                "status": item_status,
                "created_at": item.created_at,
                "updated_at": item.updated_at,
                "duration_seconds": _item_duration_seconds(item, results),
                "thumbnail": _item_thumbnail(item, results),
                "results_summary": {
                    "has_summary": bool(results.get("summary")),
                    "has_transcript": bool(results.get("transcript")),
                },
                "primary_task_status": _item_primary_task_status(item),
                "uploader": str(results.get("video_uploader") or "") or None,
                "has_subtitle": bool(results.get("subtitle_paths")),
                "has_chapters": bool(results.get("chapters") or (results.get("av_synthesis") or {}).get("chapters")),
                "frames_count": len(results.get("frames") or []) if item.type == "video" else 0,
                "audio_nature": audio_nature,
            })

    return {"items": items_out, "workspaces": workspaces_out}


class BatchDeleteRequest(BaseModel):
    items: list[dict]  # [{"workspace_id": "...", "item_id": "..."}, ...]


@router.post("/items/batch-delete")
def batch_delete_items(req: BatchDeleteRequest) -> Dict[str, Any]:
    """批量删除素材。"""
    removed: list[str] = []
    failed: list[dict] = []
    for entry in req.items:
        ws_id = str(entry.get("workspace_id") or "")
        item_id = str(entry.get("item_id") or "")
        if not ws_id or not item_id:
            failed.append({**entry, "reason": "missing workspace_id or item_id"})
            continue
        try:
            _store.remove_item(ws_id, item_id)
            removed.append(item_id)
        except KeyError as err:
            failed.append({"workspace_id": ws_id, "item_id": item_id, "reason": str(err)})
    return {"removed": len(removed), "failed": len(failed), "removed_ids": removed, "failures": failed}


@router.get("/{workspace_id}")
def get_workspace(workspace_id: str) -> Dict[str, Any]:
    rec = _store.get(workspace_id)
    if rec is None:
        raise HTTPException(status_code=404, detail=f"workspace not found: {workspace_id}")
    return _enrich_workspace(rec)


@router.patch("/{workspace_id}")
def update_workspace(workspace_id: str, req: WorkspaceUpdateRequest) -> Dict[str, Any]:
    _ensure_valid_status(req.status)
    payload: Dict[str, Any] = {}
    if req.name is not None:
        if not req.name.strip():
            raise HTTPException(status_code=400, detail="name cannot be empty")
        payload["name"] = req.name.strip()
    if req.status is not None:
        payload["status"] = req.status
    if req.background is not None:
        payload["background"] = req.background
    if not payload:
        raise HTTPException(status_code=400, detail="no fields to update")
    try:
        rec = _store.update(workspace_id, **payload)
    except KeyError as err:
        raise HTTPException(status_code=404, detail=str(err)) from err
    return rec.to_dict()


def _cleanup_workspace_chat(workspace_id: str) -> None:
    """删除该 workspace 的聊天 jsonl。"""
    from shared.chat_store import CHATS_DIR

    safe = workspace_id.replace("/", "_").replace("\\", "_").strip()
    if not safe:
        return
    fp = (CHATS_DIR / f"{safe}.jsonl").resolve()
    try:
        fp.relative_to(CHATS_DIR.resolve())
    except ValueError:
        return
    if fp.exists():
        try:
            fp.unlink()
        except OSError:
            pass


def _permanently_delete_workspace(workspace_id: str) -> None:
    """物理删除 workspace：JSON 记录 + 上传目录 + 聊天文件。

    不递归扫描全局共享目录（data/videos / data/json_data）——那些目录按 item 维度
    组织且可能与其它 workspace 共享，由 item 级删除路径独立处理。
    """
    ok = _store.delete(workspace_id)
    if not ok:
        raise HTTPException(
            status_code=500,
            detail=(
                "failed to delete workspace file on disk "
                "(check filesystem permissions on data/workspaces/)"
            ),
        )
    _cleanup_workspace_uploads(workspace_id)
    _cleanup_workspace_chat(workspace_id)


# 注意：路径 /trash 必须在 /{workspace_id} 之前注册，否则会被 path param 吞掉
@router.delete("/trash")
def empty_trash() -> Dict[str, Any]:
    """清空垃圾桶：物理删除所有 trashed=True 的 workspace 及关联文件。"""
    trashed = _store.list_all(trashed_only=True)
    deleted: List[str] = []
    for rec in trashed:
        try:
            _permanently_delete_workspace(rec.workspace_id)
            deleted.append(rec.workspace_id)
        except HTTPException:
            # 单条失败不阻塞其它，前端可重试
            continue
    return {"deleted": deleted, "count": len(deleted)}


@router.delete("/{workspace_id}")
def delete_workspace(workspace_id: str) -> Dict[str, Any]:
    """软删除：标记 trashed=True，不删 JSON 记录与素材文件。

    通过 POST /workspaces/{id}/restore 恢复；
    通过 DELETE /workspaces/{id}/permanent 彻底删除。
    """
    rec = _store.get(workspace_id)
    if rec is None:
        raise HTTPException(status_code=404, detail=f"workspace not found: {workspace_id}")
    if rec.trashed:
        # 已经在垃圾桶里，幂等返回
        return {"trashed": True, "workspace_id": workspace_id, "already": True}
    _store.update(workspace_id, trashed=True)
    return {"trashed": True, "workspace_id": workspace_id}


@router.post("/{workspace_id}/restore")
def restore_workspace(workspace_id: str) -> Dict[str, Any]:
    """从垃圾桶恢复：trashed=False，原 status 保留。"""
    rec = _store.get(workspace_id)
    if rec is None:
        raise HTTPException(status_code=404, detail=f"workspace not found: {workspace_id}")
    if not rec.trashed:
        return {"restored": True, "workspace_id": workspace_id, "already": True}
    _store.update(workspace_id, trashed=False)
    return {"restored": True, "workspace_id": workspace_id}


@router.delete("/{workspace_id}/permanent")
def permanently_delete_workspace(workspace_id: str) -> Dict[str, Any]:
    """彻底删除：物理删除 JSON 记录 + 上传目录 + 聊天文件。

    必须先经过软删除（trashed=True）才能彻底删除——避免误操作。
    """
    rec = _store.get(workspace_id)
    if rec is None:
        raise HTTPException(status_code=404, detail=f"workspace not found: {workspace_id}")
    if not rec.trashed:
        raise HTTPException(
            status_code=400,
            detail="workspace must be trashed before permanent deletion",
        )
    _permanently_delete_workspace(workspace_id)
    return {"deleted": True, "workspace_id": workspace_id}


# ── Item 操作 ────────────────────────────────────────────


@router.post("/{workspace_id}/items")
def add_item(workspace_id: str, req: ItemAddRequest) -> Dict[str, Any]:
    """向工作空间添加一个素材。"""
    _ensure_valid_item_type(req.type)
    if req.source not in ("url", "local"):
        raise HTTPException(status_code=400, detail="source must be 'url' or 'local'")
    if not req.source_value.strip():
        raise HTTPException(status_code=400, detail="source_value cannot be empty")

    if req.source == "url":
        normalized_value = _validate_network_url(req.source_value)
    else:
        normalized_value = req.source_value.strip()

    item = WorkspaceItem(
        item_id=str(uuid.uuid4()),
        type=req.type,
        source=req.source,
        source_value=normalized_value,
        name=(req.name.strip() or _derive_item_name(normalized_value)),
    )
    try:
        rec = _store.add_item(workspace_id, item)
    except KeyError as err:
        raise HTTPException(status_code=404, detail=str(err)) from err
    return rec.to_dict()


@router.post("/{workspace_id}/items/upload")
async def upload_item(
    workspace_id: str,
    file: UploadFile = File(...),
    name: str = Form(default=""),
    item_type: Optional[str] = Form(default=None, alias="type"),
) -> Dict[str, Any]:
    """上传本地文件并登记为工作空间素材。"""
    if _store.get(workspace_id) is None:
        raise HTTPException(status_code=404, detail=f"workspace not found: {workspace_id}")

    explicit_type = (item_type or "").strip()
    if explicit_type:
        _ensure_valid_item_type(explicit_type)
        resolved_type = explicit_type
    else:
        resolved_type = _infer_upload_item_type(file.filename or "", file.content_type)

    upload_dir = WORKSPACE_UPLOAD_ROOT / workspace_id
    upload_dir.mkdir(parents=True, exist_ok=True)
    safe_name = _sanitize_upload_name(file.filename or "upload.bin")
    dest = _unique_upload_path(upload_dir, safe_name)

    total_bytes = 0
    try:
        with dest.open("wb") as out:
            while True:
                chunk = await file.read(UPLOAD_CHUNK_BYTES)
                if not chunk:
                    break
                total_bytes += len(chunk)
                if total_bytes > MAX_UPLOAD_BYTES:
                    raise HTTPException(status_code=413, detail="uploaded file exceeds 500MB limit")
                out.write(chunk)
        if total_bytes == 0:
            raise HTTPException(status_code=400, detail="uploaded file cannot be empty")
    except HTTPException:
        try:
            dest.unlink(missing_ok=True)
        except OSError:
            pass
        raise
    except Exception as err:  # noqa: BLE001
        try:
            dest.unlink(missing_ok=True)
        except OSError:
            pass
        raise HTTPException(status_code=500, detail=f"upload failed: {err}") from err
    finally:
        await file.close()

    item = WorkspaceItem(
        item_id=str(uuid.uuid4()),
        type=resolved_type,
        source="local",
        source_value=str(dest.resolve()),
        name=(name.strip() or safe_name),
    )
    try:
        rec = _store.add_item(workspace_id, item)
    except KeyError as err:
        try:
            dest.unlink(missing_ok=True)
        except OSError:
            pass
        raise HTTPException(status_code=404, detail=str(err)) from err
    return rec.to_dict()


@router.delete("/{workspace_id}/items/{item_id}")
def remove_item(workspace_id: str, item_id: str) -> Dict[str, Any]:
    try:
        rec = _store.remove_item(workspace_id, item_id)
    except KeyError as err:
        raise HTTPException(status_code=404, detail=str(err)) from err
    return rec.to_dict()


# ── Favorites（复刻收藏夹）──────────────────────────────


@router.post("/{workspace_id}/favorites/{item_id}")
def favorite_item(workspace_id: str, item_id: str) -> Dict[str, Any]:
    rec = _store.get(workspace_id)
    if rec is None:
        raise HTTPException(status_code=404, detail=f"workspace not found: {workspace_id}")
    if not any(it.item_id == item_id for it in rec.items):
        raise HTTPException(status_code=404, detail=f"item not found: {item_id}")
    if item_id in rec.favorites:
        return rec.to_dict()
    new_favs = list(rec.favorites) + [item_id]
    rec = _store.update(workspace_id, favorites=new_favs)
    return rec.to_dict()


@router.delete("/{workspace_id}/favorites/{item_id}")
def unfavorite_item(workspace_id: str, item_id: str) -> Dict[str, Any]:
    rec = _store.get(workspace_id)
    if rec is None:
        raise HTTPException(status_code=404, detail=f"workspace not found: {workspace_id}")
    if item_id not in rec.favorites:
        return rec.to_dict()
    new_favs = [fid for fid in rec.favorites if fid != item_id]
    rec = _store.update(workspace_id, favorites=new_favs)
    return rec.to_dict()


# ── Preflight 配置 + 触发分析 ───────────────────────────


def _find_item(rec: WorkspaceRecord, item_id: str) -> WorkspaceItem:
    """工具：在 workspace 内查找 item，找不到抛 404。"""
    target = next((it for it in rec.items if it.item_id == item_id), None)
    if target is None:
        raise HTTPException(status_code=404, detail=f"item not found: {item_id}")
    return target


@router.put("/{workspace_id}/items/{item_id}/preflight")
def save_preflight(
    workspace_id: str, item_id: str, req: PreflightSaveRequest
) -> Dict[str, Any]:
    """保存某素材的前置配置。

    说明：保存与触发解耦——可以先保存（用户调参），稍后再调 /start 真正执行分析。
    """
    rec = _store.get(workspace_id)
    if rec is None:
        raise HTTPException(status_code=404, detail=f"workspace not found: {workspace_id}")
    target = _find_item(rec, item_id)
    target.preflight = PreflightConfig(
        intent=req.intent,
        background_overrides=req.background_overrides,
        models=req.models,
        tasks=req.tasks,
    )
    try:
        rec = _store.update_item(workspace_id, item_id, preflight=target.preflight)
    except KeyError as err:
        raise HTTPException(status_code=404, detail=str(err)) from err
    return rec.to_dict()


def _bridge_to_pipeline_payload(
    item: WorkspaceItem, workspace: WorkspaceRecord
) -> tuple[str, Dict[str, Any]]:
    """把 workspace item + preflight 翻译成现有 pipeline task 的 (task_type, payload)。

    当前只处理 video 分支（MVP 范围）：
      - source=url  → task_type='download'
      - source=local→ task_type='analyze'（视频已在本地）

    audio / image / text 分支需对应的 pipeline handler，后续阶段实现，
    目前抛 501 让前端展示「即将上线」提示。
    """
    if item.type == ItemType.TEXT.value:
        payload: Dict[str, Any] = {
            "source": item.source_value,
            "source_type": item.source,  # "url" or "local"
        }
        # N10: 透传 text 子参数 + 全局模型/key
        models = item.preflight.models or {}
        if models.get("text"):
            payload["text_model"] = models["text"]
        tasks = item.preflight.tasks or {}
        for task_id in ("summary", "assoc", "rewrite", "translate", "multi"):
            params = tasks.get(task_id)
            if isinstance(params, dict):
                payload[task_id] = params
        # T3.2: 前端 assoc_dirs[] → pipeline association.directions
        assoc_task = tasks.get("assoc")
        if isinstance(assoc_task, dict) and assoc_task.get("on"):
            dirs = assoc_task.get("assoc_dirs") or assoc_task.get("assoc_dir")
            if isinstance(dirs, str):
                dirs = [dirs]
            if isinstance(dirs, list) and dirs:
                payload["association"] = {"enabled": True, "directions": dirs}
        return "text", payload

    if item.type == ItemType.IMAGE.value:
        payload = {
            "source": item.source_value,
            "source_type": item.source,  # "url" or "local"
        }
        # N9: 透传 image 子参数 + 全局模型/key
        models = item.preflight.models or {}
        if models.get("vision"):
            payload["vision_model"] = models["vision"]
        if models.get("text"):
            payload["text_model"] = models["text"]
        tasks = item.preflight.tasks or {}
        for task_id in ("ocr", "prompt", "assoc", "compare"):
            params = tasks.get(task_id)
            if isinstance(params, dict):
                payload[task_id] = params
        # T3.2: 前端 assoc_dirs[] → pipeline assoc.directions
        assoc_task = tasks.get("assoc")
        if isinstance(assoc_task, dict):
            dirs = assoc_task.get("assoc_dirs") or assoc_task.get("assoc_dir")
            if isinstance(dirs, str):
                dirs = [dirs]
            if isinstance(dirs, list):
                payload["assoc"] = {**assoc_task, "directions": dirs}
        # R21.P3.S1: 透传 preflight 新字段（image_mode / background_for_recognition）
        _preflight = tasks.get("preflight")
        if isinstance(_preflight, dict):
            if _preflight.get("image_mode"):
                payload["image_mode"] = _preflight["image_mode"]
            if _preflight.get("background_for_recognition"):
                payload["background_for_recognition"] = _preflight["background_for_recognition"]
        return "image", payload

    if item.type == ItemType.AUDIO.value:
        payload = {
            "source": item.source_value,
            "source_type": item.source,  # "url" or "local"
        }
        # N8: 透传 audio 子参数 + 全局模型/key（与 video analyze 路径对齐）
        # IP.9.2: 前端 6 任务 ID → 后端 bridge 兼容映射
        models = item.preflight.models or {}
        if models.get("text"):
            payload["text_model"] = models["text"]
        tasks = item.preflight.tasks or {}
        # R18: 新结构 transcribe_summary 包含所有转写+总结子项
        ts = tasks.get("transcribe_summary")
        if isinstance(ts, dict):
            # 映射子项到后端期望的 payload key
            _copy_task_config(payload, "voiceprint", ts, "speaker_diarize")
            _copy_task_config(payload, "srt", ts, "subtitle_export")
            # 顶层参数直接透传
            for k in ("proper_nouns", "include_timestamps", "summary_template"):
                v = ts.get(k)
                if v is not None and v != "":
                    payload[k] = v
            # asr 整体开关
            if "on" in ts:
                payload["asr"] = {"enabled": bool(ts["on"])}
        else:
            # 兼容旧结构
            _copy_task_config(payload, "asr", tasks, "asr_summary", "asr")
            _copy_task_config(payload, "voiceprint", tasks, "voiceprint")
            _copy_task_config(payload, "srt", tasks, "subtitle_file", "srt")
        _copy_task_config(payload, "music", tasks, "music_analysis", "music")
        # 以下三个前端任务 ID 透传到 payload，Tier B 后端未实现
        _copy_task_config(payload, "vocal_separation", tasks, "vocal_separation")
        _copy_task_config(payload, "music_transcribe", tasks, "music_transcribe")
        _copy_task_config(payload, "prompt_generation", tasks, "prompt_generation")
        # R21.P3.S1: 透传 preflight 新字段（background_for_recognition）
        _preflight = tasks.get("preflight")
        if isinstance(_preflight, dict):
            if _preflight.get("background_for_recognition"):
                payload["background_for_recognition"] = _preflight["background_for_recognition"]
        return "audio", payload

    if item.type not in (ItemType.VIDEO.value,):
        raise HTTPException(
            status_code=501,
            detail=f"暂不支持触发 {item.type} 分支的分析",
        )

    if item.source == "url":
        # download 任务最小 payload：url 必填，其余从 preflight 透传可选项
        payload: Dict[str, Any] = {"url": item.source_value}
        # TODO: quality 等高级参数目前 _resolve_download_kwargs 不消费，
        # 等 download handler 支持 format_selector 映射后再启用。
        bg = item.preflight.background_overrides or {}
        for k in ("quality", "frame_mode", "frame_interval_sec", "max_frames", "enabled_steps", "prompt_style"):
            if k in bg:
                payload[k] = bg[k]
        # R21.P3.S1: 透传 preflight 新字段（intent / background_for_recognition）
        tasks = item.preflight.tasks or {}
        _preflight = tasks.get("preflight")
        if isinstance(_preflight, dict):
            if _preflight.get("intent"):
                payload["intent"] = _preflight["intent"]
            if _preflight.get("background_for_recognition"):
                payload["background_for_recognition"] = _preflight["background_for_recognition"]
        return "download", payload

    # local：直接走 analyze
    # analyze 需要：api_key（后端从 settings 拿）、vision_model、text_model、
    # video_basenames（限定要分析的本地视频）
    # 本地文件必须用实际文件名，不能使用 item 显示名（显示名≠文件名会找不到视频）
    _local_fname = item.source_value.split("/")[-1]
    payload = {
        "video_basenames": [_local_fname or item.name],
    }
    # 把 preflight 选的模型作为字符串透传——后端 handler 会做兜底
    models = item.preflight.models or {}
    if models.get("vision"):
        payload["vision_model"] = models["vision"]
    if models.get("text"):
        payload["text_model"] = models["text"]
    # N7/IP.9.3: 透传截帧子参数、视频文案总结路径和视频类型模板
    _augment_video_analyze_payload(payload, item)
    return "analyze", payload


@router.post("/{workspace_id}/items/{item_id}/start")
def start_item_pipeline(workspace_id: str, item_id: str) -> Dict[str, Any]:
    """根据已保存的 preflight 触发对应的 pipeline 任务。

    动作：
      1. 校验 workspace + item 存在
      2. 翻译 item + preflight → pipeline (task_type, payload)
      3. 调 _pipeline_runner.create_task 创建任务
      4. 写 task_id 回 item.related_task_ids，状态置 processing
      5. 返回更新后的 workspace + 新建 task_id
    """
    rec = _store.get(workspace_id)
    if rec is None:
        raise HTTPException(status_code=404, detail=f"workspace not found: {workspace_id}")
    item = _find_item(rec, item_id)

    # N1.4 移除 WorkspaceRecord.project_id 后，统一用 default_project 兜底。
    # N1b 磁盘布局已迁移至 data/workspaces/<id>/。
    project_id = "default_project"

    task_type, payload = _bridge_to_pipeline_payload(item, rec)

    try:
        task_rec = _pipeline_runner.create_task(project_id, task_type, payload)
    except ValueError as err:
        # 例如「同 URL 已有正在执行的下载任务」
        raise HTTPException(status_code=409, detail=str(err)) from err

    # 写回 item：追加 task_id + 状态 processing
    new_task_ids = list(item.related_task_ids) + [task_rec.task_id]
    rec = _store.update_item(
        workspace_id,
        item_id,
        related_task_ids=new_task_ids,
        status=ItemStatus.PROCESSING.value,
    )

    return {
        "workspace": rec.to_dict(),
        "task_id": task_rec.task_id,
        "task_type": task_type,
    }


# ── Phase 1G: 视频结果页聚合接口 ───────────────────────


def _video_result_has_real_data(results: Dict[str, Any]) -> bool:
    """判断 item.results 里是否已经有可用的数据。

    四种路径的真数据判定：
    1. subtitle：summary_path='subtitle' 且 summary 或 transcript 非空
    2. visual_only：frames 非空 list（无需 transcript）
    3. av_combined：frames 非空 list + (transcript 非空 list 或 summary 非空)
    4. 默认（detailed / VLM）：frames list + transcript list 都存在
    """
    if not isinstance(results, dict):
        return False
    summary_path = results.get("summary_path", "")
    # N7b 路径 1：字幕直接总结
    if summary_path == "subtitle":
        transcript = results.get("transcript")
        has_transcript = (
            bool(transcript.strip()) if isinstance(transcript, str) else bool(transcript)
        )
        return bool(results.get("summary") or has_transcript)
    # visual_only：只看画面，只需 frames
    if summary_path == "visual_only":
        frames = results.get("frames")
        return bool(frames) and isinstance(frames, list) and len(frames) > 0
    # av_combined：音视频综合，需要 frames + (transcript 或 summary)
    if summary_path == "av_combined":
        frames = results.get("frames")
        transcript = results.get("transcript")
        has_frames = bool(frames) and isinstance(frames, list) and len(frames) > 0
        has_transcript = isinstance(transcript, list) and len(transcript) > 0
        return has_frames and (has_transcript or bool(results.get("summary")))
    # 默认路径（detailed / VLM）：帧分析 + 转写
    frames = results.get("frames")
    transcript = results.get("transcript")
    return bool(frames) and isinstance(frames, list) and isinstance(transcript, list)


def _parse_ts_to_sec(ts: str) -> float:
    """把 'MM:SS' 或 'HH:MM:SS' 或纯数字字符串转成秒数。"""
    parts = ts.strip().split(":")
    try:
        if len(parts) == 1:
            return float(parts[0])
        if len(parts) == 2:
            return int(parts[0]) * 60 + int(parts[1])
        if len(parts) == 3:
            return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
    except (ValueError, IndexError):
        pass
    return 0.0


def _locate_analyze_report_dir(
    json_outputs: list,
    preferred_basenames: Optional[List[str]] = None,
) -> Optional[Dict[str, Any]]:
    """从 json_outputs 定位「分析报告」目录。

    返回 {"report_dir": Path, "json_stem": str, "target_path": Path} 或 None。
    """
    from pathlib import Path as _Path

    candidates = list(json_outputs)
    if preferred_basenames:
        def _norm(s: str) -> str:
            return s.replace("-", "_").replace(".", "_")
        stems = [_norm(_Path(b).stem) for b in preferred_basenames if b]
        matched = [p for p in candidates if any(stem and stem in _norm(p) for stem in stems)]
        if matched:
            candidates = matched

    target_path = None
    for p in candidates:
        if _Path(p).exists():
            target_path = p
            break
    if not target_path:
        return None

    json_stem = _Path(target_path).stem.replace("_视觉数据", "")
    parent_dir = _Path(target_path).parent

    for candidate_dir in [
        parent_dir / f"{json_stem}_分析报告",
        parent_dir.parent / "videos" / f"{json_stem}_分析报告",
    ]:
        if candidate_dir.is_dir():
            return {"report_dir": candidate_dir, "json_stem": json_stem, "target_path": target_path}

    # 有些旧产物：分析报告目录就是 parent_dir 本身（frames 在同级）
    if (parent_dir / "frames").is_dir():
        return {"report_dir": parent_dir, "json_stem": json_stem, "target_path": target_path}

    return None


def _is_target_frame_format(frames: list) -> bool:
    """检查 frames 是否已经是目标格式（包含 image_path, sec, ts, prompt_mj 等字段）。
    只检查第一帧，因为所有帧应该格式一致。
    """
    if not frames:
        return False
    first = frames[0]
    # 目标格式必须包含这些字段
    required_fields = ("image_path", "sec", "ts", "prompt_mj")
    return all(field in first for field in required_fields)


def _convert_absolute_to_static_url(abs_path: str, data_root: Path) -> str:
    """把绝对路径转成前端可用的 /static/... URL。"""
    if not abs_path or abs_path.startswith("/static/"):
        return abs_path
    try:
        from pathlib import Path as _Path
        p = _Path(abs_path).resolve()
        return "/static/" + str(p.relative_to(data_root)).replace("\\", "/")
    except (ValueError, OSError):
        return abs_path


def _materialize_video_results_from_analyze(
    results: Dict[str, Any],
    preferred_basenames: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """把 analyze task 产出的 json_outputs 文件转成 frames+transcript 结构。

    analyze 任务 result 形如：
        {"json_outputs": ["/path/to/xxx_视觉数据.json", ...]}
    json 文件里有 frames[{timestamp, description_zh, ...}] 和 global_visual_summary。

    当 preferred_basenames 给出（来自 analyze task.payload.video_basenames）时，
    优先选 path 名里包含其中任一 basename 词干的文件；防止 analyze 批处理
    project 下多视频时 result 含多份 json_outputs，端点拿错文件。
    """
    if not isinstance(results, dict):
        return results
    # C-0 fix: 只有 frames 已具备目标字段（image_path, sec, ts, prompt_mj）才可以提前返回
    if results.get("frames") and _is_target_frame_format(results["frames"]):
        return results  # 已是目标格式
    # N7b 路径 1：字幕直接总结结果，无需从 JSON 文件物化
    if results.get("summary_path") == "subtitle":
        results.setdefault("frames", [])
        results.setdefault("transcript", results.get("transcript") or [])
        return results
    # visual_only：只看画面，transcript 始终为空
    if results.get("summary_path") == "visual_only":
        results.setdefault("frames", [])
        results.setdefault("transcript", [])
    json_outputs = results.get("json_outputs") or []
    if not json_outputs:
        return results
    import json as _json
    from pathlib import Path as _Path

    located = _locate_analyze_report_dir(json_outputs, preferred_basenames)
    if not located:
        return results
    target_path = located["target_path"]
    json_stem = located["json_stem"]
    report_dir = located["report_dir"]

    try:
        with open(target_path, "r", encoding="utf-8") as f:
            visual = _json.load(f)
    except Exception:
        return results
    raw_frames = visual.get("frames") or []

    data_root = _ROOT_DIR / "data"
    frames_dir = report_dir / "frames" if (report_dir / "frames").is_dir() else None

    # C-0: 支持合并 raw frames（来自 results.frames）和视觉 JSON frames
    # raw frames 可能只有 frame_image/frame_image_path，需要与视觉 JSON 按顺序合并
    existing_raw_frames = results.get("frames") or []

    frames = []
    for idx, fr in enumerate(raw_frames):
        # C-0: 优先用 raw frame 的真实图片路径（如果存在且有效）
        img_path = ""
        if idx < len(existing_raw_frames):
            raw_img = existing_raw_frames[idx].get("frame_image_path") or existing_raw_frames[idx].get("frame_image") or ""
            if raw_img:
                # 把绝对路径转成 /static/... URL
                img_path = _convert_absolute_to_static_url(raw_img, data_root)
        # 如果 raw frame 没有图片路径，尝试从视觉 JSON 获取
        if not img_path:
            img_path = fr.get("frame_image_path") or fr.get("image_path") or ""
        # C-0.1: 先解析 timestamp 为 sec，用于后续拼文件名
        raw_ts = fr.get("timestamp", "")
        if isinstance(raw_ts, (int, float)):
            sec_val = float(raw_ts)
        elif isinstance(raw_ts, str) and raw_ts.strip():
            sec_val = _parse_ts_to_sec(raw_ts.strip())
        else:
            sec_val = float(idx)  # fallback: 帧序号当秒数
        # C-0.1 fix: 用 sec_val（来自 timestamp）拼文件名，不用 idx
        if not img_path and frames_dir:
            # 命名规则：{basename}_{HH}_{MM}_{SS}.jpg（timestamp 秒数转时分秒）
            total_sec = int(sec_val)
            h = total_sec // 3600
            m = (total_sec % 3600) // 60
            s = total_sec % 60
            fname = f"{json_stem}_{h:02d}_{m:02d}_{s:02d}.jpg"
            candidate = (frames_dir / fname).resolve()
            if candidate.exists():
                try:
                    img_path = "/static/" + str(candidate.relative_to(data_root)).replace("\\", "/")
                except ValueError:
                    img_path = ""
        # C-0 fix: 从 image_prompt_en 映射到 prompt_mj，prompt_sd/prompt_video 兜底
        image_prompt_en = fr.get("image_prompt_en") or fr.get("prompt_mj") or ""
        prompt_mj = image_prompt_en
        prompt_sd = fr.get("prompt_sd") or {"positive": image_prompt_en, "negative": ""}
        prompt_video = fr.get("prompt_video") or image_prompt_en
        frames.append({
            "idx": idx,
            "sec": sec_val,
            "ts": raw_ts if isinstance(raw_ts, str) else str(raw_ts),
            "frame_index": idx,
            "timestamp": raw_ts,
            "description": fr.get("description_zh") or fr.get("description") or "",
            "frame_image_path": img_path,
            "image_path": img_path,
            # 兼容前端 VideoResultFrame 的可选字段
            "shot_type": fr.get("shot_type", ""),
            "title": fr.get("title", ""),
            "subtitle": fr.get("subtitle", ""),
            "prompt_mj": prompt_mj,
            "prompt_sd": prompt_sd,
            "prompt_video": prompt_video,
            "tags": fr.get("tags", {}),
        })
    return {
        **results,
        "frames": frames,
        "transcript": results.get("transcript") or [],
        # N7b: LLM 字幕总结优先于视觉全局摘要
        "summary": results.get("summary") or visual.get("global_visual_summary", ""),
        "video_title": visual.get("video_title", ""),
    }


@router.get("/{workspace_id}/items/{item_id}/result")
def get_item_result(workspace_id: str, item_id: str) -> Dict[str, Any]:
    """视频结果页聚合数据（v1.1 §5.3 三轨时间轴所需）。

    优先返回 item.results 里的真数据；当 results 尚未由分析管线填充时，
    退化到 video_result_demo.build_demo_video_result，保证前端三轨可见。
    """
    rec = _store.get(workspace_id)
    if rec is None:
        raise HTTPException(status_code=404, detail=f"workspace not found: {workspace_id}")
    item = _find_item(rec, item_id)

    if item.type != ItemType.VIDEO.value:
        raise HTTPException(
            status_code=400,
            detail=f"item type {item.type!r} has no video result (only 'video' supported in Phase 1G)",
        )

    # R18.1.2: 任务已失败时直接返回 task_failed，不回落 demo
    failed = _task_failed_response(item)
    if failed is not None:
        return failed

    # X.1 bridge: check task results overlay so video_result sees real data
    v_overlay = _sync_item_with_tasks(item)
    v_results = dict(v_overlay.get("results", {})) if v_overlay and v_overlay.get("results") else dict(item.results or {})

    # 找最近一条 SUCCESS analyze task，用它的 payload.video_basenames 给 _materialize 提示
    preferred_basenames: List[str] = []
    for tid in reversed(item.related_task_ids):
        task = _pipeline_runner.store.get(tid)
        if task is None or task.task_type != "analyze" or task.status != TaskStatus.SUCCESS.value:
            continue
        preferred_basenames = list(task.payload.get("video_basenames") or [])
        if preferred_basenames:
            break
    v_results = _materialize_video_results_from_analyze(v_results, preferred_basenames=preferred_basenames)

    # C-5: 合并用户帧标题改名 overrides
    _title_overrides = (item.results or {}).get("frame_title_overrides", {})
    if _title_overrides and v_results.get("frames"):
        for _idx_str, _new_title in _title_overrides.items():
            _idx = int(_idx_str)
            if 0 <= _idx < len(v_results["frames"]):
                v_results["frames"][_idx]["title"] = _new_title

    # N7b / av_combined：规范化 transcript 为数组（前端 VideoResult.transcript 期望 array）
    if v_results.get("summary_path") in ("subtitle", "av_combined"):
        raw_transcript = v_results.get("transcript")
        if isinstance(raw_transcript, str):
            v_results["transcript"] = (
                [{"t_sec": 0, "t_str": "00:00", "text": raw_transcript.strip()}]
                if raw_transcript.strip()
                else []
            )
        elif not isinstance(raw_transcript, list):
            v_results["transcript"] = []
        v_results.setdefault("frames", [])
    # visual_only：确保 transcript 为空数组，frames 从 json_outputs 物化
    if v_results.get("summary_path") == "visual_only":
        v_results.setdefault("transcript", [])
        v_results.setdefault("frames", [])

    if _video_result_has_real_data(v_results):
        payload = v_results
        payload.setdefault("source", "item_results")
        duration = float(payload.get("duration_sec") or 0)

        # 解析 video URL：优先本地 /static 路径，兜底源 URL（仿 audio 模式）
        _video_url = ""
        _source_url = item.source_value if item.source == "url" else ""
        # 尝试从 workspace/videos/ 目录找本地视频文件
        _videos_dir = _ROOT_DIR / "data" / "workspaces" / workspace_id / "videos"
        if _videos_dir.is_dir():
            _video_files = sorted(_videos_dir.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True)
            if _video_files:
                _rel = _video_files[0].relative_to(_ROOT_DIR / "data").as_posix()
                _video_url = f"/static/{_rel}"
        # 降级：去 analyze 产物目录找 mp4（default_project/videos/）
        if not _video_url:
            _json_outputs = v_results.get("json_outputs") or []
            if _json_outputs:
                _located = _locate_analyze_report_dir(_json_outputs, preferred_basenames)
                if _located:
                    _report_parent = _located["report_dir"].parent
                    _json_stem = _located["json_stem"]
                    # 提取 BVid 用于匹配 mp4 文件名
                    import re as _re
                    _bvid_match = _re.search(r'(BV[A-Za-z0-9]+)', _json_stem)
                    if _bvid_match:
                        _bvid = _bvid_match.group(1)
                        for _mp4 in _report_parent.glob("*.mp4"):
                            if _bvid in _mp4.name:
                                _rel = _mp4.relative_to(_ROOT_DIR / "data").as_posix()
                                _video_url = f"/static/{_rel}"
                                break
        # 优先本地 URL；没有则用源 URL
        _final_video_url = _video_url or _source_url

        payload.setdefault(
            "video",
            {
                "item_id": item.item_id,
                "title": item.name,
                "url": _final_video_url,
                "source_url": _source_url,
                "duration_sec": duration,
                "duration_str": "",
            },
        )
        payload.setdefault(
            "tracks_meta",
            {
                "total_sec": duration,
                "frame_count": len(payload.get("frames", [])),
                "transcript_count": len(payload.get("transcript", [])),
            },
        )
        payload.setdefault("intent", item.preflight.intent)
        return payload

    return build_demo_video_result(item.item_id, item.name)


# ── Phase 1H: 图片结果页接口 ───────────────────────────────


def _build_demo_image_result(item_id: str, item_name: str) -> Dict[str, Any]:
    """图片结果页 demo fixture（Phase 1H）。

    当 item.results 尚未填充时返回固定示例，保证前端左图右信息 + 提示词 tabs 可跑通。
    数据对齐 v1.1 §7.4 图片结果页布局。
    """
    return {
        "source": "demo_fixture",
        "image": {
            "item_id": item_id,
            "title": item_name,
            "image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1200",
        },
        "description": "壮丽的山脉倒映在平静的湖面上，前景是翠绿的草地，天空呈现金色日落。画面构图采用三分法，前景草地、中景湖泊、远景山脉层次分明。",
        "ocr_text": "",
        "exif": {
            "device": "Canon EOS R5",
            "lens": "RF 24-70mm f/2.8 L IS USM",
            "time": "2024-08-15 18:32:05",
            "aperture": "f/8.0",
            "shutter": "1/250s",
            "iso": "ISO 100",
            "gps": {"lat": 46.6863, "lon": 7.8632},
        },
        "dimensions": {
            "width": 6000,
            "height": 4000,
            "format": "JPEG",
            "size_kb": 8520.3,
        },
        "prompts": {
            "mj": "majestic mountain reflection on calm lake, green meadow foreground, golden hour sunset, Swiss Alps, photorealistic, landscape photography, --ar 3:2 --style raw --v 6",
            "sd": {
                "positive": "majestic mountain reflection, calm lake, green meadow, golden hour, Swiss Alps, landscape photography, ultra detailed, 8k, masterpiece",
                "negative": "blurry, low quality, oversaturated, watermark, text",
            },
            "json": "",
        },
        "tags": {
            "subject": ["山脉", "湖泊", "草地"],
            "scene": ["瑞士", "因特拉肯", "阿尔卑斯"],
            "style": ["风光摄影", "写实"],
            "lighting": ["金色时刻", "逆光"],
            "color": ["金色", "翠绿", "深蓝"],
            "composition": ["三分法", "对称倒影"],
            "lens": ["广角", "f/8"],
        },
    }


@router.get("/{workspace_id}/items/{item_id}/image_result")
def get_image_result(workspace_id: str, item_id: str) -> Dict[str, Any]:
    """图片结果页聚合数据（v1.1 §7.4）。

    优先返回 item.results 里的真数据；当 results 尚未填充时，
    退化到 demo fixture，保证前端左图右信息 + 提示词 tabs 可跑通。
    """
    rec = _store.get(workspace_id)
    if rec is None:
        raise HTTPException(status_code=404, detail=f"workspace not found: {workspace_id}")
    item = _find_item(rec, item_id)

    if item.type != ItemType.IMAGE.value:
        raise HTTPException(
            status_code=400,
            detail=f"item type {item.type!r} has no image result (only 'image' supported in Phase 1H)",
        )

    # R18.1.2: 任务已失败时直接返回 task_failed，不回落 demo
    failed = _task_failed_response(item)
    if failed is not None:
        return failed

    # X.1 bridge: merge task results overlay so image_result sees real data
    overlay = _sync_item_with_tasks(item)
    results = dict(overlay.get("results", {})) if overlay and overlay.get("results") else dict(item.results or {})
    has_real = isinstance(results, dict) and results.get("description") and results.get("prompts")
    if has_real:
        payload = dict(results)
        payload.setdefault("source", "item_results")
        payload.setdefault(
            "image",
            {
                "item_id": item.item_id,
                "title": item.name,
                "image_url": item.source_value if item.source == "url" else "",
            },
        )
        return payload

    return _build_demo_image_result(item.item_id, item.name)


@router.get("/{workspace_id}/items/{item_id}/image_compare")
def get_image_compare(
    workspace_id: str,
    item_id: str,
    item_ids: Optional[str] = None,
) -> Dict[str, Any]:
    """多图对比（N9）。

    收集同工作空间内所有已完成分析的图片素材结果，
    与当前图片进行结构化对比（标签 / 描述 / 联想）。
    如果 VLM 可用，还会生成一段总结性对比分析。

    可选查询参数 item_ids（逗号分隔）：只对比指定素材。
    """
    rec = _store.get(workspace_id)
    if rec is None:
        raise HTTPException(status_code=404, detail=f"workspace not found: {workspace_id}")
    item = _find_item(rec, item_id)
    if item.type != ItemType.IMAGE.value:
        raise HTTPException(status_code=400, detail="image_compare 仅支持 image 类型素材")

    # 收集同 workspace 内所有已完成的 image 素材的结果
    allowed_ids = set(item_ids.split(",")) if item_ids else None
    image_items = [
        it for it in rec.items
        if it.type == ItemType.IMAGE.value and (allowed_ids is None or it.item_id in allowed_ids)
    ]
    collected: List[Dict[str, Any]] = []
    for it in image_items:
        overlay = _sync_item_with_tasks(it)
        results = dict(overlay.get("results", {})) if overlay and overlay.get("results") else dict(it.results or {})
        has_real = isinstance(results, dict) and results.get("description")
        collected.append({
            "item_id": it.item_id,
            "name": it.name,
            "is_current": it.item_id == item_id,
            "source_value": it.source_value,
            "description": results.get("description", ""),
            "ocr_text": results.get("ocr_text", ""),
            "tags": results.get("tags", {}),
            "prompts": results.get("prompts", {}),
            "associations": results.get("associations", {}),
            "has_result": has_real,
        })

    # 尝试 VLM 总结对比（best-effort）
    vlm_summary = ""
    items_with_results = [c for c in collected if c["has_result"]]
    if len(items_with_results) >= 2:
        try:
            from shared.settings_store import load_settings as _load_s
            from shared.provider_registry import create_default_registry as _cdr
            from shared.provider_base import ChatRequest as _CR

            _s = _load_s()
            _api_key = (_s.openai_api_key or "").strip()
            if _api_key:
                _reg = _cdr()
                _prof = _reg.resolve_default_profile(_s, "vision")
                _prov = _reg.build(_prof)
                _model = _prof.default_models.get("vision") or (_s.vision_model or "").strip()
                if _model:
                    # 构造对比 prompt
                    summaries = []
                    for idx, c in enumerate(items_with_results, 1):
                        tag_str = ", ".join(
                            v for vals in c["tags"].values() for v in vals
                        ) if c["tags"] else "无"
                        summaries.append(
                            f"图片{idx}「{c['name']}」：{c['description'][:200]}。标签：{tag_str}"
                        )
                    compare_prompt = (
                        f"以下是{len(items_with_results)}张图片的分析结果，请做对比总结：\n\n"
                        + "\n\n".join(summaries)
                        + "\n\n请从以下维度对比：\n"
                        "1. 内容主题差异\n2. 风格/色调对比\n3. 各自优势和适用场景\n"
                        "4. 如果要选一张做代表，选哪张？为什么？\n"
                        "用中文回答，300-500字。"
                    )
                    vlm_summary = _prov.chat(_CR(
                        model=_model,
                        messages=[{"role": "user", "content": compare_prompt}],
                        temperature=0.4,
                        max_tokens=1200,
                    )).strip()
        except Exception:
            pass  # VLM 对比是锦上添花，失败不影响结构化数据返回

    return {
        "workspace_id": workspace_id,
        "current_item_id": item_id,
        "images": collected,
        "vlm_summary": vlm_summary,
    }


# ── 多文对比（N10）────────────────────────────────────────────


@router.get("/{workspace_id}/items/{item_id}/text_compare")
def get_text_compare(
    workspace_id: str,
    item_id: str,
    item_ids: Optional[str] = None,
) -> Dict[str, Any]:
    """多文对比（N10）。

    收集同工作空间内所有已完成分析的文字素材结果，
    与当前文字进行结构化对比（摘要 / 要点 / 联想归纳）。
    如果 LLM 可用，还会生成一段总结性对比分析。

    可选查询参数 item_ids（逗号分隔）：只对比指定素材。
    """
    rec = _store.get(workspace_id)
    if rec is None:
        raise HTTPException(status_code=404, detail=f"workspace not found: {workspace_id}")
    item = _find_item(rec, item_id)
    if item.type != ItemType.TEXT.value:
        raise HTTPException(status_code=400, detail="text_compare 仅支持 text 类型素材")

    # 收集同 workspace 内所有已完成的 text 素材的结果
    allowed_ids = set(item_ids.split(",")) if item_ids else None
    text_items = [
        it for it in rec.items
        if it.type == ItemType.TEXT.value and (allowed_ids is None or it.item_id in allowed_ids)
    ]
    collected: List[Dict[str, Any]] = []
    for it in text_items:
        overlay = _sync_item_with_tasks(it)
        results = dict(overlay.get("results", {})) if overlay and overlay.get("results") else dict(it.results or {})
        has_real = isinstance(results, dict) and results.get("summary")
        collected.append({
            "item_id": it.item_id,
            "name": it.name,
            "is_current": it.item_id == item_id,
            "source_value": it.source_value,
            "summary": results.get("summary", ""),
            "content_preview": (results.get("content", "") or "")[:500],
            "associations": results.get("associations", {}),
            "rewrites": results.get("rewrites", {}),
            "translations": results.get("translations", {}),
            "char_count": results.get("char_count", 0),
            "has_result": has_real,
        })

    # 尝试 LLM 对比总结（best-effort）
    llm_summary = ""
    items_with_results = [c for c in collected if c["has_result"]]
    if len(items_with_results) >= 2:
        try:
            from shared.settings_store import load_settings as _load_s
            from shared.provider_registry import create_default_registry as _cdr
            from shared.provider_base import ChatRequest as _CR

            _s = _load_s()
            _api_key = (_s.openai_api_key or "").strip()
            if _api_key:
                _reg = _cdr()
                _prof = _reg.resolve_default_profile(_s, "chat")
                _prov = _reg.build(_prof)
                _model = _prof.default_models.get("chat") or (_s.text_model or "").strip()
                if _model:
                    summaries = []
                    for idx, c in enumerate(items_with_results, 1):
                        assoc_str = "; ".join(
                            f"{k}: {v[:80]}" for k, v in (c["associations"] or {}).items()
                        ) if c["associations"] else "无"
                        summaries.append(
                            f"文本{idx}「{c['name']}」（{c['char_count']}字）：{c['summary'][:200]}。联想：{assoc_str}"
                        )
                    compare_prompt = (
                        f"以下是{len(items_with_results)}篇文本的分析结果，请做对比总结：\n\n"
                        + "\n\n".join(summaries)
                        + "\n\n请从以下维度对比：\n"
                        "1. 观点异同\n2. 立场倾向\n3. 信息完整性\n4. 时间线梳理（若适用）\n"
                        "用中文回答，300-500字。"
                    )
                    llm_summary = _prov.chat(_CR(
                        model=_model,
                        messages=[{"role": "user", "content": compare_prompt}],
                        temperature=0.4,
                        max_tokens=1200,
                    )).strip()
        except Exception:
            pass  # LLM 对比是锦上添花，失败不影响结构化数据返回

    return {
        "workspace_id": workspace_id,
        "current_item_id": item_id,
        "texts": collected,
        "llm_summary": llm_summary,
    }


# ── 音频结果页（Phase 2B） ────────────────────────────────────


@router.get("/{workspace_id}/items/{item_id}/audio_result")
def get_audio_result(workspace_id: str, item_id: str) -> Dict[str, Any]:
    """音频结果页聚合数据（Phase 2B）。

    优先返回 item.results 里的真数据；当 results 尚未填充时，
    退化到 demo fixture，保证前端音频播放器 + transcript 列表可跑通。
    """
    rec = _store.get(workspace_id)
    if rec is None:
        raise HTTPException(status_code=404, detail=f"workspace not found: {workspace_id}")
    item = _find_item(rec, item_id)

    if item.type != ItemType.AUDIO.value:
        raise HTTPException(
            status_code=400,
            detail=f"item type {item.type!r} has no audio result (only 'audio' supported)",
        )

    # R18.1.2: 任务已失败时直接返回 task_failed，不回落 demo
    failed = _task_failed_response(item)
    if failed is not None:
        return failed

    # X.1 bridge: overlay task results so audio_result sees real data
    a_overlay = _sync_item_with_tasks(item)
    results = dict(a_overlay.get("results", {})) if a_overlay and a_overlay.get("results") else dict(item.results or {})
    has_real = isinstance(results, dict) and (
        results.get("transcript") or results.get("transcript_segments")
    )
    if has_real:
        payload = dict(results)
        payload.setdefault("source", "item_results")
        audio_payload = dict(payload.get("audio") or {})
        if not audio_payload.get("title"):
            filename_title = Path(str(audio_payload.get("filename") or "")).stem
            audio_payload["title"] = (
                str(results.get("video_title") or "").strip()
                or filename_title
                or item.name
            )
        audio_payload.setdefault("item_id", item.item_id)
        # url 字段：优先返回本地音频文件的 /static URL（浏览器可播）；
        # 找不到再 fallback 到源 URL（如 B 站网页链接，仅用于"打开来源"按钮，不能给 <audio src>）
        _filename = str(audio_payload.get("filename") or "").strip()
        _local_url = ""
        if _filename:
            _candidates = [
                _ROOT_DIR / "data" / "workspaces" / workspace_id / "audio" / _filename,
                _ROOT_DIR / "data" / "workspaces" / "default_project" / "audio" / _filename,
            ]
            for _p in _candidates:
                if _p.exists():
                    _rel = _p.relative_to(_ROOT_DIR / "data").as_posix()
                    _local_url = f"/static/{_rel}"
                    break
        # 注意：audio_payload 里可能已有 url（pipeline 写入的源 URL），不能用 setdefault
        # 必须强制覆盖：能播放的本地 URL 优先；同时把源 URL 留到 source_url 字段
        _existing_url = str(audio_payload.get("url") or "")
        _source_url = (
            item.source_value if item.source == "url"
            else _existing_url  # 兜底：若已有 url 字段就当源 URL 保留
        )
        audio_payload["url"] = _local_url or _source_url
        audio_payload.setdefault("source_url", _source_url)  # 保留源链接给"打开来源"按钮用
        audio_payload.setdefault("duration_sec", results.get("tracks_meta", {}).get("total_sec", 0))
        audio_payload.setdefault("duration_str", "")
        payload["audio"] = audio_payload
        payload.setdefault(
            "tracks_meta",
            {
                "total_sec": results.get("tracks_meta", {}).get("total_sec", 0),
                "transcript_count": len(results.get("transcript") or results.get("transcript_segments") or []),
            },
        )
        return payload

    return build_demo_audio_result(item.item_id, item.name)


# ── 文本结果页（Phase 2C.2）───────────────────────────────────


def _read_text_result_from_disk(task_id: str, project_id: str) -> Optional[Dict[str, Any]]:
    """从磁盘读取 text 任务产物（data/workspaces/<pid>/text/<task_id>.json）。"""
    json_path = DATA_DIR / "workspaces" / project_id / "text" / f"{task_id}.json"
    if not json_path.is_file():
        return None
    try:
        return json.loads(json_path.read_text(encoding="utf-8"))
    except Exception:
        return None


@router.get("/{workspace_id}/items/{item_id}/text_result")
def get_text_result(workspace_id: str, item_id: str) -> Dict[str, Any]:
    """文本结果页聚合数据（Phase 2C.2）。

    查找顺序：
      1. item.results（task_runner 已回写）
      2. item.related_task_ids → task_store → 磁盘 JSON 文件
    同时附带 prompt_versions 供前端展示提示词版本栈。
    """
    rec = _store.get(workspace_id)
    if rec is None:
        raise HTTPException(status_code=404, detail=f"workspace not found: {workspace_id}")
    item = _find_item(rec, item_id)

    if item.type != ItemType.TEXT.value:
        raise HTTPException(
            status_code=400,
            detail=f"item type {item.type!r} has no text result (only 'text' supported)",
        )

    # R18.1.2: 任务已失败时直接返回 task_failed
    failed = _task_failed_response(item)
    if failed is not None:
        return failed

    # 优先从 item.results 读取
    results = item.results or {}
    has_real = isinstance(results, dict) and "content" in results and bool(results.get("title"))
    if has_real:
        payload = dict(results)
        payload.setdefault("source", "item_results")
        payload["prompt_versions"] = [
            pv.to_dict() for pv in rec.prompt_versions.get(item_id) or []
        ]
        return payload

    # 回退：从 task_store + 磁盘文件读取
    project_id = "default_project"
    for task_id in reversed(item.related_task_ids):
        task = _pipeline_runner.store.get(task_id)
        if task is None:
            continue
        task_result = task.result or {}
        # 优先用 task.result 里的数据
        if "content" in task_result and bool(task_result.get("title")):
            payload = dict(task_result)
            payload.setdefault("source", "task_result")
            payload["prompt_versions"] = [
                pv.to_dict() for pv in rec.prompt_versions.get(item_id) or []
            ]
            return payload
        # 再尝试磁盘 JSON
        disk_data = _read_text_result_from_disk(task_id, project_id)
        if disk_data and "content" in disk_data:
            disk_data.setdefault("source", "disk_json")
            disk_data["prompt_versions"] = [
                pv.to_dict() for pv in rec.prompt_versions.get(item_id) or []
            ]
            return disk_data

    raise HTTPException(
        status_code=404,
        detail="text result not ready: no completed text task found for this item",
    )


# ── T2: 文本内容在线编辑 ─────────────────────────────────


class TextContentUpdateRequest(BaseModel):
    content: str = Field(min_length=0, description="编辑后的文本内容")


@router.patch("/{workspace_id}/items/{item_id}/text_content")
def update_text_content(
    workspace_id: str, item_id: str, req: TextContentUpdateRequest
) -> Dict[str, Any]:
    """更新纯文素材的正文内容（T2 在线编辑）。"""
    rec = _store.get(workspace_id)
    if rec is None:
        raise HTTPException(status_code=404, detail=f"workspace not found: {workspace_id}")
    item = _find_item(rec, item_id)
    if item.type != ItemType.TEXT.value:
        raise HTTPException(status_code=400, detail="only text items support content editing")

    results = dict(item.results or {})
    results["content"] = req.content
    _store.update_item(workspace_id, item_id, results=results)
    saved_at = datetime.now(timezone.utc).isoformat()
    return {"content": req.content, "saved_at": saved_at}


# ── 提示词版本栈（Phase 2C.2）────────────────────────────


@router.post("/{workspace_id}/items/{item_id}/prompts/versions")
def add_prompt_version(
    workspace_id: str, item_id: str, req: PromptVersionRequest
) -> Dict[str, Any]:
    """为指定素材追加一个提示词版本。"""
    try:
        pv = _store.add_prompt_version(workspace_id, item_id, req.content)
    except KeyError as err:
        raise HTTPException(status_code=404, detail=str(err)) from err
    return pv.to_dict()


@router.get("/{workspace_id}/items/{item_id}/prompts/versions")
def list_prompt_versions(workspace_id: str, item_id: str) -> List[Dict[str, Any]]:
    """列出指定素材的所有提示词版本。"""
    try:
        versions = _store.list_prompt_versions(workspace_id, item_id)
    except KeyError as err:
        raise HTTPException(status_code=404, detail=str(err)) from err
    return [pv.to_dict() for pv in versions]


# ── C-5 帧标题改名 ─────────────────────────────────────────


class FrameTitleRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)


@router.patch("/{workspace_id}/items/{item_id}/frames/{frame_idx}/title")
def update_frame_title(
    workspace_id: str, item_id: str, frame_idx: int, req: FrameTitleRequest
) -> Dict[str, Any]:
    """更新指定帧的标题（存入 item.results.frame_title_overrides）。"""
    rec = _store.get(workspace_id)
    if rec is None:
        raise HTTPException(status_code=404, detail=f"workspace not found: {workspace_id}")
    item = _find_item(rec, item_id)

    results = dict(item.results or {})
    overrides = dict(results.get("frame_title_overrides", {}))
    overrides[str(frame_idx)] = req.title
    results["frame_title_overrides"] = overrides

    try:
        _store.update_item(workspace_id, item_id, results=results)
    except KeyError as err:
        raise HTTPException(status_code=404, detail=str(err)) from err

    return {"ok": True, "frame_idx": frame_idx, "title": req.title}


# ── C-3 复刻包导出 ─────────────────────────────────────────


class ReproduceExportRequest(BaseModel):
    frame_indices: List[int] = Field(..., min_length=1)


@router.post("/{workspace_id}/items/{item_id}/reproduce/export")
def export_reproduce_package(
    workspace_id: str, item_id: str, req: ReproduceExportRequest
) -> StreamingResponse:
    """打包选中帧为复刻工作包 zip 流式返回。"""
    rec = _store.get(workspace_id)
    if rec is None:
        raise HTTPException(status_code=404, detail=f"workspace not found: {workspace_id}")
    item = _find_item(rec, item_id)

    # 复用 get_item_result 的数据获取逻辑
    v_results = dict(item.results or {})
    v_overlay = _sync_item_with_tasks(item)
    if v_overlay and v_overlay.get("results"):
        v_results = dict(v_overlay.get("results", {}))

    preferred_basenames: List[str] = []
    for tid in reversed(item.related_task_ids):
        task = _pipeline_runner.store.get(tid)
        if task is None or task.task_type != "analyze" or task.status != TaskStatus.SUCCESS.value:
            continue
        preferred_basenames = list(task.payload.get("video_basenames") or [])
        if preferred_basenames:
            break
    v_results = _materialize_video_results_from_analyze(v_results, preferred_basenames=preferred_basenames)
    frames = v_results.get("frames", [])

    # 过滤有效帧索引
    valid = [i for i in req.frame_indices if 0 <= i < len(frames)]
    if not valid:
        raise HTTPException(status_code=400, detail="no valid frame indices")

    data_root = _ROOT_DIR / "data"
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        # frames/*.jpg
        for i in valid:
            fr = frames[i]
            img_path = fr.get("image_path") or fr.get("frame_image_path") or ""
            if img_path.startswith("/static/"):
                fs_path = data_root / img_path[len("/static/"):]
            else:
                fs_path = None
            if fs_path and fs_path.is_file():
                zf.writestr(f"frames/{i:03d}.jpg", fs_path.read_bytes())

        # prompts.txt
        lines = []
        for i in valid:
            fr = frames[i]
            ts = fr.get("ts", "")
            title = fr.get("title", "")
            prompt = fr.get("prompt_mj") or fr.get("prompt_video") or ""
            lines.append(f"--- Frame {i} ({ts}) {title} ---\n{prompt}\n")
        zf.writestr("prompts.txt", "\n".join(lines))

        # styles.json — 所有选中帧的 tags 汇总
        styles = {}
        for i in valid:
            tags = frames[i].get("tags", {})
            for dim, vals in tags.items():
                if isinstance(vals, list):
                    styles.setdefault(dim, [])
                    for v in vals:
                        if v not in styles[dim]:
                            styles[dim].append(v)
        zf.writestr("styles.json", json.dumps(styles, ensure_ascii=False, indent=2))

        # manifest.json
        manifest = {
            "workspace_id": workspace_id,
            "item_id": item_id,
            "video_title": v_results.get("video", {}).get("title", ""),
            "frame_count": len(valid),
            "frames": [
                {
                    "index": i,
                    "ts": frames[i].get("ts", ""),
                    "title": frames[i].get("title", ""),
                    "shot_type": frames[i].get("shot_type", ""),
                }
                for i in valid
            ],
        }
        zf.writestr("manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2))

    buf.seek(0)
    filename = f"reproduce_{item_id[:8]}.zip"
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── Phase 3B.2：单工作空间语义检索 ─────────────────────────


class WorkspaceSearchRequest(BaseModel):
    query: str = Field(..., min_length=1)
    top_k: int = Field(default=5, ge=1, le=20)


@router.post("/{workspace_id}/search")
def workspace_search(workspace_id: str, req: WorkspaceSearchRequest) -> Dict[str, Any]:
    """在单个工作空间内做 RAG 检索，返回 {answer, sources[]}。"""
    try:
        return search_one_workspace(
            workspace_id=workspace_id,
            query=req.query,
            top_k=req.top_k,
            store=_store,
            task_store=_pipeline_runner.store,
        )
    except KeyError as err:
        raise HTTPException(status_code=404, detail=str(err)) from err
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err)) from err


# ── Phase 3C.3：标签 CRUD + 重新生成 ─────────────────────────


class TagsUpdateRequest(BaseModel):
    """手动校正标签请求体。"""

    tags: Dict[str, Any]


def _validate_tags(tags: Dict[str, Any]) -> None:
    """校验系统 6 维度的 key/value 合法性，custom_tags 跳过 value 校验。"""
    from shared.config import TAG_DIMENSIONS

    system_dims = {k: v for k, v in TAG_DIMENSIONS.items() if k != "custom_tags"}
    for key, value in tags.items():
        if key.startswith("_"):
            continue  # 跳过 _generated_at / _generated_model 等内部字段
        if key == "custom_tags":
            continue
        if key not in system_dims:
            raise HTTPException(
                status_code=422,
                detail=f"unknown tag dimension: {key!r}",
            )
        choices = system_dims[key].get("choices") or []
        if choices and value not in choices:
            raise HTTPException(
                status_code=422,
                detail=f"invalid value {value!r} for dimension {key!r}; expected one of {choices}",
            )


@router.get("/{workspace_id}/items/{item_id}/tags")
def get_item_tags(workspace_id: str, item_id: str) -> Dict[str, Any]:
    """返回指定素材的当前标签。"""
    rec = _store.get(workspace_id)
    if rec is None:
        raise HTTPException(status_code=404, detail=f"workspace not found: {workspace_id}")
    _find_item(rec, item_id)
    item = next(it for it in rec.items if it.item_id == item_id)
    return {"tags": item.tags}


@router.put("/{workspace_id}/items/{item_id}/tags")
def update_item_tags(
    workspace_id: str, item_id: str, req: TagsUpdateRequest
) -> Dict[str, Any]:
    """手动校正标签（做维度合法性校验）。"""
    rec = _store.get(workspace_id)
    if rec is None:
        raise HTTPException(status_code=404, detail=f"workspace not found: {workspace_id}")
    _find_item(rec, item_id)
    _validate_tags(req.tags)
    rec = _store.update_item(workspace_id, item_id, tags=req.tags)
    item = next(it for it in rec.items if it.item_id == item_id)
    return {"tags": item.tags}


@router.post("/{workspace_id}/items/{item_id}/tags/regenerate")
def regenerate_item_tags(workspace_id: str, item_id: str) -> Dict[str, Any]:
    """重新触发 LLM 打标并写回。"""
    from backend.app.services.tag_generator import generate_tags

    rec = _store.get(workspace_id)
    if rec is None:
        raise HTTPException(status_code=404, detail=f"workspace not found: {workspace_id}")
    item = _find_item(rec, item_id)
    try:
        new_tags = generate_tags(item, rec, task_store=_pipeline_runner.store)
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err)) from err
    rec = _store.update_item(workspace_id, item_id, tags=new_tags)
    item = next(it for it in rec.items if it.item_id == item_id)
    return {"tags": item.tags}


# ── A2：说话人名称映射 ─────────────────────────────────────


class SpeakerMapRequest(BaseModel):
    """说话人名称映射请求体。"""

    speaker_map: Dict[str, str]


@router.patch("/{workspace_id}/items/{item_id}/speaker_map")
def update_speaker_map(
    workspace_id: str, item_id: str, req: SpeakerMapRequest
) -> Dict[str, Any]:
    """保存说话人名称映射到 item.results。"""
    rec = _store.get(workspace_id)
    if rec is None:
        raise HTTPException(status_code=404, detail=f"workspace not found: {workspace_id}")
    item = _find_item(rec, item_id)
    results = dict(item.results or {})
    results["speaker_map"] = req.speaker_map
    _store.update_item(workspace_id, item_id, results=results)
    return {"speaker_map": req.speaker_map}


class TranscriptSegmentEditRequest(BaseModel):
    """转录段编辑请求体。"""

    edited_text: str = Field(..., description="编辑后的文本，空字符串表示恢复原文")


class NoteUpdateRequest(BaseModel):
    """R1.1: note.md 正文写入请求体。"""

    body: str = Field(..., description="正文 markdown（不含 frontmatter）")


@router.patch("/{workspace_id}/items/{item_id}/transcript/segments/{segment_idx}")
def update_transcript_segment(
    workspace_id: str,
    item_id: str,
    segment_idx: int,
    req: TranscriptSegmentEditRequest,
) -> Dict[str, Any]:
    """编辑单段转录文本（A-1：字幕在线编辑）。"""
    rec = _store.get(workspace_id)
    if rec is None:
        raise HTTPException(status_code=404, detail=f"workspace not found: {workspace_id}")
    item = _find_item(rec, item_id)
    results = dict(item.results or {})
    segs = list(results.get("transcript_segments") or [])
    if segment_idx < 0 or segment_idx >= len(segs):
        raise HTTPException(status_code=400, detail=f"segment_idx {segment_idx} out of range (0-{len(segs) - 1})")
    seg = dict(segs[segment_idx])
    seg["edited_text"] = req.edited_text if req.edited_text.strip() else None
    segs[segment_idx] = seg
    results["transcript_segments"] = segs
    _store.update_item(workspace_id, item_id, results=results)
    return {"segment_idx": segment_idx, "edited_text": seg["edited_text"]}


# ── 总结 CRUD ──────────────────────────────────────────────────


class SummaryCreateRequest(BaseModel):
    """生成总结请求体。"""

    template: str = Field(..., description="模板 id（concise / detailed / ...）")
    background_for_summary: str = Field("", description="总结用背景信息（可选）")


def _ensure_valid_template(template_id: str) -> None:
    if template_id not in list_template_ids():
        raise HTTPException(
            status_code=400,
            detail=f"未知模板: {template_id}，可用: {', '.join(list_template_ids())}",
        )


@router.get("/{workspace_id}/items/{item_id}/summaries")
def list_summaries(workspace_id: str, item_id: str) -> List[Dict[str, Any]]:
    """列出该 item 的所有总结（按 template 分组，按 version 排序）。"""
    rec = _store.get(workspace_id)
    if rec is None:
        raise HTTPException(status_code=404, detail=f"workspace not found: {workspace_id}")
    item = _find_item(rec, item_id)
    # 按 template 分组再按 version 排序
    sorted_summaries = sorted(item.summaries, key=lambda s: (s.template, s.version))
    return [s.to_dict() for s in sorted_summaries]


@router.post("/{workspace_id}/items/{item_id}/summaries", status_code=201)
async def create_summary(
    workspace_id: str, item_id: str, req: SummaryCreateRequest
) -> Dict[str, Any]:
    """同步生成一份总结并落盘。LLM 调用可能耗时 5-15s。"""
    from fastapi.concurrency import run_in_threadpool

    _ensure_valid_template(req.template)
    rec = _store.get(workspace_id)
    if rec is None:
        raise HTTPException(status_code=404, detail=f"workspace not found: {workspace_id}")
    item = _find_item(rec, item_id)

    # item.results 缺少实质内容时，从 task store 回填（与 _sync_item_with_tasks 同逻辑）
    has_content = item.results and (
        "content" in item.results or "transcript" in item.results
    )
    if not has_content and item.related_task_ids:
        for tid in reversed(item.related_task_ids):
            task = _pipeline_runner.store.get(tid)
            if task and task.result and (
                "content" in task.result or "transcript" in task.result
            ):
                item.results = dict(task.result)
                break

    next_ver = _store.next_version_for_template(workspace_id, item_id, req.template)

    def _do_generate() -> ItemSummary:
        summary = generate_summary(item, req.template, req.background_for_summary)
        summary.version = next_ver
        return summary

    try:
        summary = await run_in_threadpool(_do_generate)
    except RuntimeError as err:
        raise HTTPException(status_code=500, detail=str(err)) from err
    except Exception as err:
        raise HTTPException(status_code=502, detail=f"LLM 调用失败: {err}") from err

    _store.add_item_summary(workspace_id, item_id, summary)
    return summary.to_dict()


@router.get("/{workspace_id}/items/{item_id}/summaries/{summary_id}")
def get_summary(workspace_id: str, item_id: str, summary_id: str) -> Dict[str, Any]:
    """取单份总结详情。"""
    rec = _store.get(workspace_id)
    if rec is None:
        raise HTTPException(status_code=404, detail=f"workspace not found: {workspace_id}")
    item = _find_item(rec, item_id)
    summary = next((s for s in item.summaries if s.summary_id == summary_id), None)
    if summary is None:
        raise HTTPException(status_code=404, detail=f"summary not found: {summary_id}")
    return summary.to_dict()


@router.delete("/{workspace_id}/items/{item_id}/summaries/{summary_id}")
def delete_summary(workspace_id: str, item_id: str, summary_id: str) -> Dict[str, str]:
    """硬删指定总结。"""
    rec = _store.get(workspace_id)
    if rec is None:
        raise HTTPException(status_code=404, detail=f"workspace not found: {workspace_id}")
    _find_item(rec, item_id)  # 确认 item 存在
    deleted = _store.delete_item_summary(workspace_id, item_id, summary_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"summary not found: {summary_id}")
    return {"status": "deleted", "summary_id": summary_id}


# ── Note（R0.2: 只读 note 文件 + 惰性组装）───────────────────────


@router.get("/{workspace_id}/items/{item_id}/note")
def get_item_note(workspace_id: str, item_id: str) -> Dict[str, Any]:
    """读取 item 的 note 目录（source.md + note.md + summaries/*）。

    惰性组装：若 notes/<item_id>/ 不存在，先从 task store 回填 results，
    再 assemble_item_note 一次（覆盖历史 item）。
    """
    rec = _store.get(workspace_id)
    if rec is None:
        raise HTTPException(status_code=404, detail=f"workspace not found: {workspace_id}")
    item = _find_item(rec, item_id)

    nd = note_dir(workspace_id, item_id)
    note_path = nd / "note.md"

    # 惰性组装：目录不存在或 note.md 缺失时触发
    if not note_path.exists():
        # 从 task store 回填 results（与 create_summary 同逻辑）
        if item.related_task_ids:
            for tid in reversed(item.related_task_ids):
                task = _pipeline_runner.store.get(tid)
                if task and task.result:
                    merged = dict(item.results or {})
                    merged.update(task.result)
                    item.results = merged
                    break
        assemble_item_note(workspace_id, item_id, _item=item)

    # 读取文件（assemble 失败时文件可能不存在，返回空字符串）
    source_md = ""
    note_md = ""
    if (nd / "source.md").exists():
        source_md = (nd / "source.md").read_text(encoding="utf-8")
    if note_path.exists():
        note_md = note_path.read_text(encoding="utf-8")

    # 解析 frontmatter（从 note_md 提取 YAML）
    frontmatter: Dict[str, Any] = {}
    if note_md.startswith("---\n"):
        parts = note_md.split("---\n", 2)
        if len(parts) >= 3:
            import yaml  # noqa: PLC0415
            try:
                frontmatter = yaml.safe_load(parts[1]) or {}
            except Exception:
                pass

    # 收集 summaries 文件
    summaries: List[Dict[str, Any]] = []
    for sm_path in sorted(nd.glob("summaries/**/*.md")):
        rel = sm_path.relative_to(nd)
        # summaries/<template>/v<n>.md → 提取 template 和 version
        parts_rel = rel.parts  # ('summaries', '<template>', 'v<n>.md')
        template = parts_rel[1] if len(parts_rel) >= 2 else "unknown"
        version_str = parts_rel[2].replace("v", "").replace(".md", "") if len(parts_rel) >= 3 else "1"
        try:
            version = int(version_str)
        except ValueError:
            version = 1
        summaries.append({
            "template": template,
            "version": version,
            "path": str(rel),
            "content": sm_path.read_text(encoding="utf-8"),
        })

    return {
        "frontmatter": frontmatter,
        "source_md": source_md,
        "note_md": note_md,
        "summaries": summaries,
        "note_dir": str(nd),
    }


@router.put("/{workspace_id}/items/{item_id}/note")
def update_item_note(workspace_id: str, item_id: str, req: NoteUpdateRequest) -> Dict[str, Any]:
    """R1.1: 写入 note.md 正文（保留 frontmatter 机器字段）。

    逻辑：读现有 note.md → 解析旧 frontmatter（tags/media/layers 全部保留）
    → version+1、updated_at、user_edited=true → 正文换成新 body
    → 拼回 ---\nyaml---\nbody 写盘 → 返回完整 note（同 GET 结构）。
    note.md 不存在时先惰性组装拿 frontmatter 再写。
    """
    import yaml as _yaml  # noqa: PLC0415

    rec = _store.get(workspace_id)
    if rec is None:
        raise HTTPException(status_code=404, detail=f"workspace not found: {workspace_id}")
    _find_item(rec, item_id)  # 确认 item 存在

    nd = note_dir(workspace_id, item_id)
    note_path = nd / "note.md"

    # 读取或惰性初始化 frontmatter
    frontmatter: Dict[str, Any] = {}
    if note_path.exists():
        raw = note_path.read_text(encoding="utf-8")
        if raw.startswith("---\n"):
            parts = raw.split("---\n", 2)
            if len(parts) >= 3:
                try:
                    frontmatter = _yaml.safe_load(parts[1]) or {}
                except Exception:
                    frontmatter = {}
    else:
        # note.md 不存在 → 先惰性组装拿 frontmatter
        item = _find_item(rec, item_id)
        if item.related_task_ids:
            for tid in reversed(item.related_task_ids):
                task = _pipeline_runner.store.get(tid)
                if task and task.result:
                    merged = dict(item.results or {})
                    merged.update(task.result)
                    item.results = merged
                    break
        assemble_item_note(workspace_id, item_id, _item=item)
        # 重新读取刚刚写入的 frontmatter
        if note_path.exists():
            raw = note_path.read_text(encoding="utf-8")
            if raw.startswith("---\n"):
                parts = raw.split("---\n", 2)
                if len(parts) >= 3:
                    try:
                        frontmatter = _yaml.safe_load(parts[1]) or {}
                    except Exception:
                        frontmatter = {}

    # 更新 frontmatter 机器字段
    frontmatter["version"] = int(frontmatter.get("version", 1)) + 1
    frontmatter["updated_at"] = datetime.now(timezone.utc).isoformat()
    frontmatter["user_edited"] = True

    # 序列化 + 拼回 note.md
    fm_yaml = _yaml.dump(frontmatter, allow_unicode=True, default_flow_style=False, sort_keys=False)
    note_content = f"---\n{fm_yaml}---\n\n{req.body}"
    nd.mkdir(parents=True, exist_ok=True)
    note_path.write_text(note_content, encoding="utf-8")

    # 读取 source.md
    source_md = ""
    source_path = nd / "source.md"
    if source_path.exists():
        source_md = source_path.read_text(encoding="utf-8")

    # 收集 summaries（复用 GET 逻辑）
    summaries: List[Dict[str, Any]] = []
    for sm_path in sorted(nd.glob("summaries/**/*.md")):
        rel = sm_path.relative_to(nd)
        parts_rel = rel.parts
        template = parts_rel[1] if len(parts_rel) >= 2 else "unknown"
        version_str = parts_rel[2].replace("v", "").replace(".md", "") if len(parts_rel) >= 3 else "1"
        try:
            version = int(version_str)
        except ValueError:
            version = 1
        summaries.append({
            "template": template,
            "version": version,
            "path": str(rel),
            "content": sm_path.read_text(encoding="utf-8"),
        })

    return {
        "frontmatter": frontmatter,
        "source_md": source_md,
        "note_md": note_content,
        "summaries": summaries,
        "note_dir": str(nd),
    }


# ── InlineFrames（学习模式视频按需补图）───────────────────────────


@router.get("/{workspace_id}/items/{item_id}/inline-frames")
def list_inline_frames(workspace_id: str, item_id: str) -> List[Dict[str, Any]]:
    """列出已插入的帧（按 segment_idx 排序）。"""
    rec = _store.get(workspace_id)
    if rec is None:
        raise HTTPException(status_code=404, detail=f"workspace not found: {workspace_id}")
    item = _find_item(rec, item_id)
    frames = sorted(item.inline_frames, key=lambda f: f.segment_idx)
    return [f.to_dict() for f in frames]


@router.get("/{workspace_id}/items/{item_id}/inline-frames/suggested")
def get_suggested_inline_frames(workspace_id: str, item_id: str) -> List[Dict[str, Any]]:
    """临时计算返回系统推荐的帧位置（不持久化）。"""
    rec = _store.get(workspace_id)
    if rec is None:
        raise HTTPException(status_code=404, detail=f"workspace not found: {workspace_id}")
    item = _find_item(rec, item_id)

    if item.preflight.intent != "learning":
        return []

    results = item.results or {}
    # av_combined 路径的 frames 在 json_outputs 里，需要物化
    if not results.get("frames") and results.get("json_outputs"):
        results = _materialize_video_results_from_analyze(results)
    frames = results.get("frames") or []
    transcript = results.get("transcript") or []

    if not frames or not transcript:
        return []

    from backend.app.services.inline_frame_suggester import suggest_inline_frames

    # transcript 格式：Video 用 { t_sec, t_str, text }，转成 { start, text }
    segments = []
    for t in transcript:
        start = t.get("t_sec") or _ts_str_to_sec(t.get("t_str", "0:00"))
        segments.append({"start": start, "text": t.get("text", "")})

    return suggest_inline_frames(frames, segments)


def _ts_str_to_sec(ts: str) -> float:
    """把 'MM:SS' 或 'HH:MM:SS' 转成秒数。"""
    parts = str(ts).strip().split(":")
    try:
        if len(parts) == 2:
            return int(parts[0]) * 60 + int(parts[1])
        if len(parts) == 3:
            return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
    except ValueError:
        pass
    return 0.0


class InlineFramesSaveRequest(BaseModel):
    inline_frames: List[Dict[str, Any]]


@router.put("/{workspace_id}/items/{item_id}/inline-frames")
def save_inline_frames(
    workspace_id: str, item_id: str, req: InlineFramesSaveRequest
) -> Dict[str, Any]:
    """整体覆盖式保存 inline_frames。"""
    rec = _store.get(workspace_id)
    if rec is None:
        raise HTTPException(status_code=404, detail=f"workspace not found: {workspace_id}")
    _find_item(rec, item_id)

    frames = [InlineFrame.from_dict(f) for f in req.inline_frames]
    saved = _store.save_inline_frames(workspace_id, item_id, frames)
    return {"status": "saved", "count": len(saved)}


# ── 音乐教学拆解（A-4） ──────────────────────────────────────────

class MusicTeachingRequest(BaseModel):
    bpm: float = Field(..., description="BPM")
    key: str = Field(..., description="调性")
    music_prompt: str = Field("", description="音乐提示词")


@router.post("/{workspace_id}/items/{item_id}/music-teaching/{seg_idx}")
async def music_teaching(
    workspace_id: str,
    item_id: str,
    seg_idx: int,
    req: MusicTeachingRequest,
) -> Dict[str, str]:
    """为指定音乐段生成「为什么动人」的教学解释。"""
    from fastapi.concurrency import run_in_threadpool
    from backend.app.services.music_teaching_prompts import (
        MusicTeachingRequest as TeachingReq,
        generate_teaching_explanation,
    )

    rec = _store.get(workspace_id)
    if rec is None:
        raise HTTPException(status_code=404, detail=f"workspace not found: {workspace_id}")
    item = _find_item(rec, item_id)

    # 验证 seg_idx 有效性
    results = item.results or {}
    music_segments = results.get("music_segments") or []
    if seg_idx < 0 or seg_idx >= len(music_segments):
        raise HTTPException(status_code=400, detail=f"无效的段索引: {seg_idx}")

    teaching_req = TeachingReq(
        bpm=req.bpm,
        key=req.key,
        music_prompt=req.music_prompt,
    )

    # 复用 chat_runner
    from backend.app.services import chat_runner

    try:
        explanation = await run_in_threadpool(
            lambda: generate_teaching_explanation(teaching_req, chat_runner)
        )
    except Exception as err:
        raise HTTPException(status_code=502, detail=f"LLM 调用失败: {err}") from err

    return {"explanation": explanation}
