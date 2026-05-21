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

import json
import logging
import re
import shutil
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

from backend.app.models.tasks import TERMINAL_STATUS_VALUES, TaskStatus

# 项目根目录（backend/app/routes/workspaces.py → routes → app → backend → root）
_ROOT_DIR: Path = Path(__file__).resolve().parent.parent.parent.parent

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from backend.app.models.workspace import (
    ItemStatus,
    ItemType,
    PreflightConfig,
    WorkspaceBackground,
    WorkspaceItem,
    WorkspaceRecord,
    WorkspaceStatus,
)
from backend.app.services.audio_result_demo import build_demo_audio_result
from backend.app.services.video_result_demo import build_demo_video_result
from backend.app.services.workspace_search_service import search_one_workspace
from backend.app.services.workspace_store import WorkspaceStore
from shared.config import DATA_DIR

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


def _augment_video_analyze_payload(payload: Dict[str, Any], item: WorkspaceItem) -> None:
    """Copy video preflight params used by the current analyze pipeline."""
    tasks = item.preflight.tasks or {}
    frame_prompts_params = tasks.get("frame_prompt")
    if isinstance(frame_prompts_params, dict):
        payload["frame_prompt"] = frame_prompts_params

    summary_params = tasks.get("summary")
    if isinstance(summary_params, dict):
        if summary_params.get("path"):
            payload["summary_path"] = summary_params["path"]
        if summary_params.get("video_template"):
            payload["video_template"] = summary_params["video_template"]


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

    try:
        analyze_task = runner.create_task(project_id, "analyze", analyze_payload)
    except Exception:
        return  # analyze enqueue 失败不影响 download 本身

    # 把 analyze task_id 写入引用了此 download task 的所有 workspace items
    for ws, item in refs:
        new_ids = list(item.related_task_ids) + [analyze_task.task_id]
        try:
            _store.update_item(ws.workspace_id, item.item_id, related_task_ids=new_ids)
        except Exception:
            pass  # 写失败不阻断（X.1 桥仍能通过 download task 显示最终状态）


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


def _validate_network_url(raw: str) -> str:
    """校验网络链接：必须是 http/https 且 host 非空。

    Why: source=url 直接交给下游 yt-dlp / 下载器，空白或畸形字符串会在
    pipeline 深处才报错，对用户不友好。这里在入口阻断。
    """
    value = raw.strip()
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
        if item.type != "video":
            continue
        r = item.results or {}
        if r.get("cover_thumbnail"):
            return str(r["cover_thumbnail"])
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

    if latest_success is not None and latest_success.result and not item.results:
        overlay["results"] = dict(latest_success.result)

    return overlay


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
    """用 LLM 根据 hint 生成 4-12 个汉字的工作空间名称；失败时 fallback。"""
    hint = (hint_url or hint_text or "").strip()
    if hint:
        prompt = (
            "根据下面的 URL 或文本，给一个 4-12 个汉字的简短中文工作空间名称"
            "（不要引号、不要标点）：\n" + hint
        )
    else:
        prompt = "给一个 4-12 个汉字的简短中文工作空间名称（不要引号、不要标点）"

    try:
        from src.vidmirror.core.providers import ChatRequest
        from src.vidmirror.core.providers.registry import create_default_registry

        reg = create_default_registry()
        from shared.settings_store import load_settings

        settings = load_settings()
        profile = reg.resolve_default_profile(settings, "chat")
        provider = reg.build(profile)
        model = (profile.default_models.get("chat") or "").strip()
        if not model:
            raise ValueError("no default chat model configured")
        resp = provider.chat(ChatRequest(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=64,
        ))
        name = resp.strip().strip("「」\"'。，、")
        if 2 <= len(name) <= 20:
            return name
        _AUTO_CREATE_LOGGER.warning("LLM returned unexpected name length: %r", name)
    except Exception:
        _AUTO_CREATE_LOGGER.debug("LLM name generation failed, using fallback", exc_info=True)

    # fallback: hostname + 时间
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
        _copy_task_config(payload, "asr", tasks, "asr_summary", "asr")
        _copy_task_config(payload, "voiceprint", tasks, "voiceprint")
        _copy_task_config(payload, "srt", tasks, "subtitle_file", "srt")
        _copy_task_config(payload, "music", tasks, "music_analysis", "music")
        # 以下三个前端任务 ID 透传到 payload，Tier B 后端未实现
        _copy_task_config(payload, "vocal_separation", tasks, "vocal_separation")
        _copy_task_config(payload, "music_transcribe", tasks, "music_transcribe")
        _copy_task_config(payload, "prompt_generation", tasks, "prompt_generation")
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
        return "download", payload

    # local：直接走 analyze
    # analyze 需要：api_key（后端从 settings 拿）、vision_model、text_model、
    # video_basenames（限定要分析的本地视频）
    payload = {
        "video_basenames": [item.name or item.source_value.split("/")[-1]],
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
    """判断 item.results 里是否已经有可用的 frames + transcript。"""
    if not isinstance(results, dict):
        return False
    frames = results.get("frames")
    transcript = results.get("transcript")
    return bool(frames) and isinstance(frames, list) and isinstance(transcript, list)


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
    if results.get("frames"):
        return results  # 已是目标格式
    json_outputs = results.get("json_outputs") or []
    if not json_outputs:
        return results
    import json as _json
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
        return results
    try:
        with open(target_path, "r", encoding="utf-8") as f:
            visual = _json.load(f)
    except Exception:
        return results
    raw_frames = visual.get("frames") or []

    # 从 json 文件名推导 basename（去掉 _视觉数据.json 后缀）
    json_stem = _Path(target_path).stem.replace("_视觉数据", "")
    # 在多个可能的位置查找 frames 目录
    parent_dir = _Path(target_path).parent
    data_root = _ROOT_DIR / "data"
    frames_dir = None
    for candidate_dir in [
        parent_dir / "frames",                          # 同级 frames/
        parent_dir / f"{json_stem}_分析报告" / "frames",  # videos/{name}_分析报告/frames/
        parent_dir.parent / "videos" / f"{json_stem}_分析报告" / "frames",  # json_data → videos/
    ]:
        if candidate_dir.is_dir():
            frames_dir = candidate_dir
            break

    frames = []
    for idx, fr in enumerate(raw_frames):
        # 优先用 JSON 里自带的路径，否则按命名规则拼
        img_path = fr.get("frame_image_path") or fr.get("image_path") or ""
        if not img_path and frames_dir:
            # 命名规则：{basename}_{HH}_{MM}_{SS}.jpg（idx 秒数转时分秒）
            h = idx // 3600
            m = (idx % 3600) // 60
            s = idx % 60
            fname = f"{json_stem}_{h:02d}_{m:02d}_{s:02d}.jpg"
            candidate = (frames_dir / fname).resolve()
            if candidate.exists():
                # 转为 URL 路径：/static/projects/{pid}/...
                try:
                    img_path = "/static/" + str(candidate.relative_to(data_root)).replace("\\", "/")
                except ValueError:
                    img_path = ""
        frames.append({
            "frame_index": idx,
            "timestamp": fr.get("timestamp", ""),
            "description": fr.get("description_zh") or fr.get("description") or "",
            "frame_image_path": img_path,
            "image_path": img_path,
        })
    return {
        **results,
        "frames": frames,
        "transcript": results.get("transcript") or [],
        "summary": visual.get("global_visual_summary", ""),
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
    if _video_result_has_real_data(v_results):
        payload = v_results
        payload.setdefault("source", "item_results")
        payload.setdefault(
            "video",
            {
                "item_id": item.item_id,
                "title": item.name,
                "url": item.source_value if item.source == "url" else "",
                "duration_sec": payload.get("tracks_meta", {}).get("total_sec", 0),
                "duration_str": "",
            },
        )
        payload.setdefault(
            "tracks_meta",
            {
                "total_sec": 0,
                "frame_count": len(payload.get("frames", [])),
                "transcript_count": len(payload.get("transcript", [])),
            },
        )
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
            "time": "2024-08-15 18:32:05",
            "location": "瑞士·因特拉肯",
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
def get_image_compare(workspace_id: str, item_id: str) -> Dict[str, Any]:
    """多图对比（N9）。

    收集同工作空间内所有已完成分析的图片素材结果，
    与当前图片进行结构化对比（标签 / 描述 / 联想）。
    如果 VLM 可用，还会生成一段总结性对比分析。
    """
    rec = _store.get(workspace_id)
    if rec is None:
        raise HTTPException(status_code=404, detail=f"workspace not found: {workspace_id}")
    item = _find_item(rec, item_id)
    if item.type != ItemType.IMAGE.value:
        raise HTTPException(status_code=400, detail="image_compare 仅支持 image 类型素材")

    # 收集同 workspace 内所有已完成的 image 素材的结果
    image_items = [it for it in rec.items if it.type == ItemType.IMAGE.value]
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
def get_text_compare(workspace_id: str, item_id: str) -> Dict[str, Any]:
    """多文对比（N10）。

    收集同工作空间内所有已完成分析的文字素材结果，
    与当前文字进行结构化对比（摘要 / 要点 / 联想归纳）。
    如果 LLM 可用，还会生成一段总结性对比分析。
    """
    rec = _store.get(workspace_id)
    if rec is None:
        raise HTTPException(status_code=404, detail=f"workspace not found: {workspace_id}")
    item = _find_item(rec, item_id)
    if item.type != ItemType.TEXT.value:
        raise HTTPException(status_code=400, detail="text_compare 仅支持 text 类型素材")

    # 收集同 workspace 内所有已完成的 text 素材的结果
    text_items = [it for it in rec.items if it.type == ItemType.TEXT.value]
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

    # X.1 bridge: overlay task results so audio_result sees real data
    a_overlay = _sync_item_with_tasks(item)
    results = dict(a_overlay.get("results", {})) if a_overlay and a_overlay.get("results") else dict(item.results or {})
    has_real = isinstance(results, dict) and results.get("transcript")
    if has_real:
        payload = dict(results)
        payload.setdefault("source", "item_results")
        payload.setdefault(
            "audio",
            {
                "item_id": item.item_id,
                "title": item.name,
                "url": item.source_value if item.source == "url" else "",
                "duration_sec": results.get("tracks_meta", {}).get("total_sec", 0),
                "duration_str": "",
            },
        )
        payload.setdefault(
            "tracks_meta",
            {
                "total_sec": results.get("tracks_meta", {}).get("total_sec", 0),
                "transcript_count": len(results.get("transcript", [])),
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

    # 优先从 item.results 读取
    results = item.results or {}
    has_real = isinstance(results, dict) and results.get("content") and results.get("title")
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
        if task_result.get("content") and task_result.get("title"):
            payload = dict(task_result)
            payload.setdefault("source", "task_result")
            payload["prompt_versions"] = [
                pv.to_dict() for pv in rec.prompt_versions.get(item_id) or []
            ]
            return payload
        # 再尝试磁盘 JSON
        disk_data = _read_text_result_from_disk(task_id, project_id)
        if disk_data and disk_data.get("content"):
            disk_data.setdefault("source", "disk_json")
            disk_data["prompt_versions"] = [
                pv.to_dict() for pv in rec.prompt_versions.get(item_id) or []
            ]
            return disk_data

    raise HTTPException(
        status_code=404,
        detail="text result not ready: no completed text task found for this item",
    )


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
