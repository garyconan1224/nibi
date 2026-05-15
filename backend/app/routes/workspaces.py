from __future__ import annotations

"""Workspace 路由——多媒体内容分析系统的「工作空间」CRUD。

路由前缀 /workspaces，与 /pipeline、/providers 等并列。
存储委托给 backend.app.services.workspace_store.WorkspaceStore，
持久化文件位于 data/workspaces/<workspace_id>.json。

接口清单（最小可用集，后续按设计文档增补）：
  POST   /workspaces                     创建工作空间
  GET    /workspaces                     列表（可按 project_id 过滤）
  GET    /workspaces/{ws_id}             详情
  PATCH  /workspaces/{ws_id}             更新名称 / 状态 / 背景信息
  DELETE /workspaces/{ws_id}             删除
  POST   /workspaces/{ws_id}/items       添加素材
  DELETE /workspaces/{ws_id}/items/{id}  移除素材
  POST   /workspaces/{ws_id}/favorites/{id}    收藏素材
  DELETE /workspaces/{ws_id}/favorites/{id}    取消收藏
"""

import re
import shutil
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

from backend.app.models.tasks import TERMINAL_STATUS_VALUES

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
from backend.app.services.workspace_store import WorkspaceStore
from shared.config import DATA_DIR

# 复用 pipeline 路由的 runner / store 单例，避免重复初始化任务引擎
from backend.app.routes.pipeline import _runner as _pipeline_runner

router = APIRouter(prefix="/workspaces", tags=["workspaces"])

# 进程级单例 store（与 pipeline 路由的 _store 同模式）
_store = WorkspaceStore()

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
}


# ── Pydantic 请求/响应模型 ─────────────────────────────────


class WorkspaceCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120, description="工作空间名称")
    project_id: str = Field(default="", description="可选：关联 project_id")
    background: Dict[str, Any] = Field(default_factory=dict)


class WorkspaceUpdateRequest(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = Field(default=None, description="active|processing|completed|archived")
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


def _enrich_workspace(rec: WorkspaceRecord) -> Dict[str, Any]:
    """把 WorkspaceRecord.to_dict() 合并上 Phase 1A 派生字段后返回。

    派生字段在路由层计算，不写回 WorkspaceStore。
    """
    d = rec.to_dict()
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
        project_id=req.project_id.strip(),
        background=bg,
    )
    _store.create(rec)
    return rec.to_dict()


@router.get("")
def list_workspaces(project_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """列出所有工作空间，可按 project_id 过滤。"""
    return [_enrich_workspace(r) for r in _store.list_all(project_id=project_id)]


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


@router.delete("/{workspace_id}")
def delete_workspace(workspace_id: str) -> Dict[str, Any]:
    if _store.get(workspace_id) is None:
        raise HTTPException(status_code=404, detail=f"workspace not found: {workspace_id}")
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

    item = WorkspaceItem(
        item_id=str(uuid.uuid4()),
        type=req.type,
        source=req.source,
        source_value=req.source_value.strip(),
        name=(req.name.strip() or _derive_item_name(req.source_value)),
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
    if item.type != ItemType.VIDEO.value:
        raise HTTPException(
            status_code=501,
            detail=(
                f"暂不支持触发 {item.type} 分支的分析"
                "（待实现 audio/image/text pipeline handler）"
            ),
        )

    if item.source == "url":
        # download 任务最小 payload：url 必填，其余从 preflight 透传可选项
        payload: Dict[str, Any] = {"url": item.source_value}
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

    # workspace 没绑定 project 时退化到 default_project（与 notes 路由策略一致）
    project_id = rec.project_id.strip() or "default_project"

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
