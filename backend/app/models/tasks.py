"""Task domain models."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Literal

TaskStatus = Literal["queued", "running", "succeeded", "failed", "cancelled"]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class TaskLogEntry:
    ts: str
    level: Literal["info", "warning", "error"]
    message: str

    @classmethod
    def create(cls, message: str, level: Literal["info", "warning", "error"] = "info") -> "TaskLogEntry":
        return cls(ts=_now_iso(), level=level, message=message)


@dataclass
class TaskRecord:
    task_id: str
    project_id: str
    task_type: str
    payload: dict[str, Any]
    status: TaskStatus = "queued"
    progress: float = 0.0
    log: list[TaskLogEntry] = field(default_factory=list)
    result: dict[str, Any] = field(default_factory=dict)
    error: str = ""
    retry_of: str = ""
    cancel_requested: bool = False
    created_at: str = field(default_factory=_now_iso)
    updated_at: str = field(default_factory=_now_iso)

    def to_dict(self) -> dict[str, Any]:
        obj = asdict(self)
        obj["log"] = [asdict(item) for item in self.log]
        return obj

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "TaskRecord":
        log_items: list[TaskLogEntry] = []
        for item in data.get("log") or []:
            if not isinstance(item, dict):
                continue
            log_items.append(
                TaskLogEntry(
                    ts=str(item.get("ts") or _now_iso()),
                    level=str(item.get("level") or "info"),  # type: ignore[arg-type]
                    message=str(item.get("message") or ""),
                )
            )
        return cls(
            task_id=str(data.get("task_id") or ""),
            project_id=str(data.get("project_id") or ""),
            task_type=str(data.get("task_type") or ""),
            payload=dict(data.get("payload") or {}),
            status=str(data.get("status") or "queued"),  # type: ignore[arg-type]
            progress=float(data.get("progress") or 0.0),
            log=log_items,
            result=dict(data.get("result") or {}),
            error=str(data.get("error") or ""),
            retry_of=str(data.get("retry_of") or ""),
            cancel_requested=bool(data.get("cancel_requested") or False),
            created_at=str(data.get("created_at") or _now_iso()),
            updated_at=str(data.get("updated_at") or _now_iso()),
        )
