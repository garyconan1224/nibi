from __future__ import annotations

"""Pipeline task endpoints."""

import asyncio
import json
import time
from typing import Any, Dict, List, Union, Optional

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
from starlette.responses import StreamingResponse

from backend.app.models.tasks import TERMINAL_STATUS_VALUES, TaskStatus
from backend.app.services.pipeline_tasks import register_pipeline_handlers
from backend.app.services.task_runner import TaskRunner
from backend.app.services.task_store import TaskStore

router = APIRouter(prefix="/pipeline", tags=["pipeline"])
_store = TaskStore()
_runner = TaskRunner(_store)
register_pipeline_handlers(_runner)

_TERMINAL_STATUSES = TERMINAL_STATUS_VALUES


class TaskCreateRequest(BaseModel):
    project_id: str
    task_type: str = Field(description="download|analyze|create|storyboard|note")
    payload: Dict[str, Any] = Field(default_factory=dict)
    steps: List[str] = Field(
        default=["download", "transcribe", "analyze", "note"],
        description="可选步骤编排，仅对 note 任务生效。默认全量执行。",
    )


@router.get("/tasks")
def list_tasks(project_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """列出所有任务，可按 project_id 过滤。"""
    all_recs = _store.list_all()
    if project_id:
        all_recs = [r for r in all_recs if r.project_id == project_id]
    return [r.to_dict() for r in all_recs]


@router.post("/tasks")
def create_task(req: TaskCreateRequest) -> Dict[str, Any]:
    try:
        payload = dict(req.payload or {})
        # 将 steps 注入 payload，供 handle_note_task 读取
        if req.task_type == "note":
            payload["steps"] = req.steps
        rec = _runner.create_task(req.project_id, req.task_type, payload)
        return {"status": "accepted", "task_id": rec.task_id}
    except Exception as err:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(err)) from err


@router.post("/tasks/purge")
def purge_tasks(project_id: Optional[str] = None) -> Dict[str, Any]:
    """批量清理已终结的冗余失败任务。删除因 append_log bug 而失败的旧记录。"""
    all_recs = _store.list_all()
    if project_id:
        all_recs = [r for r in all_recs if r.project_id == project_id]
    removed: List[str] = []
    for rec in all_recs:
        if rec.status != TaskStatus.FAILED.value:
            continue
        err_msg = str(rec.error or "")
        if "append_log" in err_msg:
            _store.delete(rec.task_id)
            removed.append(rec.task_id)
    return {"purged": len(removed), "task_ids": removed}


@router.get("/tasks/{task_id}")
def get_task(task_id: str) -> Dict[str, Any]:
    rec = _store.get(task_id)
    if rec is None:
        raise HTTPException(status_code=404, detail=f"task not found: {task_id}")
    return rec.to_dict()


@router.delete("/tasks/{task_id}")
def delete_task(task_id: str) -> Dict[str, Any]:
    """从持久化存储中删除一条任务记录（仅限已终结状态）。"""
    rec = _store.get(task_id)
    if rec is None:
        raise HTTPException(status_code=404, detail=f"task not found: {task_id}")
    if rec.status not in _TERMINAL_STATUSES:
        raise HTTPException(
            status_code=409,
            detail=f"task {task_id} is still {rec.status}; only terminal tasks can be deleted",
        )
    ok = _store.delete(task_id)
    if not ok:
        raise HTTPException(status_code=500, detail="delete failed unexpectedly")
    return {"deleted": True, "task_id": task_id}


@router.post("/tasks/{task_id}/cancel")
def cancel_task(task_id: str) -> Dict[str, Any]:
    try:
        rec = _runner.cancel_task(task_id)
        return rec.to_dict()
    except KeyError as err:
        raise HTTPException(status_code=404, detail=str(err)) from err


@router.post("/tasks/{task_id}/retry")
def retry_task(task_id: str) -> Dict[str, Any]:
    try:
        rec = _runner.retry_task(task_id)
        return rec.to_dict()
    except KeyError as err:
        raise HTTPException(status_code=404, detail=str(err)) from err


class ConfirmMusicRequest(BaseModel):
    pass  # 无需 body，服务端自行改 payload


@router.post("/tasks/{task_id}/confirm-music")
def confirm_music_mode(task_id: str) -> Dict[str, Any]:
    """A3: 用户确认无人声音频切换为音乐分析模式。

    1. 更新 payload（music=True, asr=False, music_mode_confirmed=True）
    2. 重置状态为 PENDING，交 executor 重跑
    3. SSE 连接保持在同一个 task_id 上继续推送进度
    """
    rec = _store.get(task_id)
    if rec is None:
        raise HTTPException(status_code=404, detail=f"task not found: {task_id}")
    if rec.status != TaskStatus.AWAITING_CONFIRM.value:
        raise HTTPException(
            status_code=409,
            detail=f"task {task_id} is {rec.status}, expected AWAITING_CONFIRM",
        )

    payload = dict(rec.payload)
    payload["music"] = {"enabled": True}
    payload["asr"] = {"enabled": False}
    payload["music_mode_confirmed"] = True

    _store.update(task_id, payload=payload, status=TaskStatus.PENDING.value, progress=0.0, error="")
    _store.append_log(task_id, "🎵 用户确认切换为音乐分析模式", level="info")
    _runner.resubmit_task(task_id)

    return _store.get(task_id).to_dict()


@router.get("/tasks/{task_id}/events")
def stream_task_events(task_id: str) -> StreamingResponse:
    """Server-Sent Events：推送任务快照与新增日志行。

    Phase 1F 优化（对齐 v1.1 §11 + 风险表「30s 心跳防反代断连」）：
    - 任务快照仅在 status / progress 变化时下发，减少前端无谓重渲染。
    - 静默 ≥ 30s 时主动下发 `: heartbeat` SSE 注释行作为 keepalive。
    - 轮询间隔提升到 0.5s（原 0.2s 过密）。
    """

    HEARTBEAT_INTERVAL_S = 30.0
    POLL_INTERVAL_S = 0.5

    async def event_stream():
        last_log_idx = 0
        last_status: Optional[str] = None
        last_progress: Optional[float] = None
        last_send_ts = time.monotonic()

        while True:
            rec = _store.get(task_id)
            if rec is None:
                yield f"data: {json.dumps({'type': 'error', 'message': 'not found'})}\n\n"
                break
            d = rec.to_dict()
            logs = d.get("log") or []
            while last_log_idx < len(logs):
                yield f"data: {json.dumps({'type': 'log', 'entry': logs[last_log_idx]})}\n\n"
                last_log_idx += 1
                last_send_ts = time.monotonic()

            cur_status = d.get("status")
            cur_progress = d.get("progress")
            changed = (cur_status != last_status) or (cur_progress != last_progress)
            if changed:
                yield f"data: {json.dumps({'type': 'task', 'task': d})}\n\n"
                last_status, last_progress = cur_status, cur_progress
                last_send_ts = time.monotonic()

            if cur_status in _TERMINAL_STATUSES:
                # 终结前确保前端拿到最终快照（即便上面已发过也再发一次，幂等）
                if not changed:
                    yield f"data: {json.dumps({'type': 'task', 'task': d})}\n\n"
                break

            # 心跳：静默超过 30s 时发送 SSE 注释行（不会被 EventSource 当成事件）
            if time.monotonic() - last_send_ts >= HEARTBEAT_INTERVAL_S:
                yield ": heartbeat\n\n"
                last_send_ts = time.monotonic()

            await asyncio.sleep(POLL_INTERVAL_S)

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.websocket("/tasks/{task_id}/ws")
async def stream_task_ws(websocket: WebSocket, task_id: str) -> None:
    """WebSocket：与 /events 相同信息，JSON 帧。

    与 SSE 版本一致：去重 + 30s 心跳 ping。
    """
    HEARTBEAT_INTERVAL_S = 30.0
    POLL_INTERVAL_S = 0.5

    await websocket.accept()
    last_log_idx = 0
    last_status: Optional[str] = None
    last_progress: Optional[float] = None
    last_send_ts = time.monotonic()
    try:
        while True:
            rec = _store.get(task_id)
            if rec is None:
                await websocket.send_json({"type": "error", "message": "not found"})
                break
            d = rec.to_dict()
            logs = d.get("log") or []
            while last_log_idx < len(logs):
                await websocket.send_json({"type": "log", "entry": logs[last_log_idx]})
                last_log_idx += 1
                last_send_ts = time.monotonic()

            cur_status = d.get("status")
            cur_progress = d.get("progress")
            changed = (cur_status != last_status) or (cur_progress != last_progress)
            if changed:
                await websocket.send_json({"type": "task", "task": d})
                last_status, last_progress = cur_status, cur_progress
                last_send_ts = time.monotonic()

            if cur_status in _TERMINAL_STATUSES:
                if not changed:
                    await websocket.send_json({"type": "task", "task": d})
                break

            if time.monotonic() - last_send_ts >= HEARTBEAT_INTERVAL_S:
                await websocket.send_json({"type": "ping"})
                last_send_ts = time.monotonic()

            await asyncio.sleep(POLL_INTERVAL_S)
    except WebSocketDisconnect:
        return
