"""Task domain models."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Literal


# 注：backend/app/services/note_generator.py 另有一个笔记生成专用的 TaskStatus，
#     领域不同（含 SAVING 状态），本 Enum 仅用于 pipeline 任务。
#     合并两者留待后续单独立项。
class TaskStatus(str, Enum):
    """Pipeline 任务状态机（继承 str 以便 JSON 直接序列化为字符串）。"""

    PENDING = "PENDING"
    PARSING = "PARSING"
    DOWNLOADING = "DOWNLOADING"
    TRANSCRIBING = "TRANSCRIBING"
    ANALYZING = "ANALYZING"      # nibi 特有：视觉分析
    SUMMARIZING = "SUMMARIZING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


# 历史遗留小写状态 → 新 Enum 的映射。
# 覆盖范围：phase-1 早期命名（running/done/error/queued）与 phase-2 命名
# （succeeded/failed/cancelled）。
LEGACY_STATUS_MAP: dict[str, "TaskStatus"] = {
    "running": TaskStatus.DOWNLOADING,
    "done": TaskStatus.SUCCESS,
    "error": TaskStatus.FAILED,
    "queued": TaskStatus.PENDING,
    "succeeded": TaskStatus.SUCCESS,
    "failed": TaskStatus.FAILED,
    "cancelled": TaskStatus.CANCELLED,
}


# 终结态集合（用于 delete/SSE 终止判断等）。
TERMINAL_STATUS_VALUES: frozenset[str] = frozenset(
    {TaskStatus.SUCCESS.value, TaskStatus.FAILED.value, TaskStatus.CANCELLED.value}
)


def coerce_status(raw: Any) -> "TaskStatus":
    """将任意旧/新状态字符串归一为 TaskStatus，未知值兜底为 PENDING。"""
    if isinstance(raw, TaskStatus):
        return raw
    key = str(raw or "")
    mapped = LEGACY_STATUS_MAP.get(key)
    if mapped is not None:
        return mapped
    try:
        return TaskStatus(key)
    except ValueError:
        return TaskStatus.PENDING


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
    status: str = TaskStatus.PENDING.value
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
        # 防御：即便某处误把 Enum 成员直接赋给 status，也保证外部 JSON 为纯字符串值
        obj["status"] = self.status.value if isinstance(self.status, TaskStatus) else str(self.status)
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
            status=coerce_status(data.get("status")).value,
            progress=float(data.get("progress") or 0.0),
            log=log_items,
            result=dict(data.get("result") or {}),
            error=str(data.get("error") or ""),
            retry_of=str(data.get("retry_of") or ""),
            cancel_requested=bool(data.get("cancel_requested") or False),
            created_at=str(data.get("created_at") or _now_iso()),
            updated_at=str(data.get("updated_at") or _now_iso()),
        )
