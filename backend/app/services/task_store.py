from __future__ import annotations

"""Persistent task store."""

import json
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict

from backend.app.models.tasks import TaskLogEntry, TaskRecord
from shared.config import ROOT_DIR

TASK_STORE_PATH = ROOT_DIR / ".local" / "backend_tasks.json"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class TaskStore:
    def __init__(self, path: Path = TASK_STORE_PATH) -> None:
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._records: Dict[str, TaskRecord] = {}
        self._load()

    def _load(self) -> None:
        if not self.path.is_file():
            return
        try:
            data = json.loads(self.path.read_text(encoding="utf-8"))
        except Exception:
            return
        if not isinstance(data, list):
            return
        for item in data:
            if isinstance(item, dict):
                rec = TaskRecord.from_dict(item)
                if rec.task_id:
                    self._records[rec.task_id] = rec

    def _save(self) -> None:
        payload = [r.to_dict() for r in self._records.values()]
        self.path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    def create(self, record: TaskRecord) -> TaskRecord:
        with self._lock:
            self._records[record.task_id] = record
            self._save()
        return record

    def get(self, task_id: str) -> TaskRecord | None:
        with self._lock:
            return self._records.get(task_id)

    def update(self, task_id: str, **kwargs: object) -> TaskRecord:
        with self._lock:
            rec = self._records.get(task_id)
            if rec is None:
                raise KeyError(f"task not found: {task_id}")
            for k, v in kwargs.items():
                setattr(rec, k, v)
            rec.updated_at = _now_iso()
            self._save()
            return rec

    def append_log(self, task_id: str, message: str, *, level: str = "info") -> TaskRecord:
        with self._lock:
            rec = self._records.get(task_id)
            if rec is None:
                raise KeyError(f"task not found: {task_id}")
            rec.log.append(TaskLogEntry.create(message=message, level=level))  # type: ignore[arg-type]
            rec.updated_at = _now_iso()
            self._save()
            return rec

    def list_all(self) -> list[TaskRecord]:
        with self._lock:
            return list(self._records.values())

    def delete(self, task_id: str) -> bool:
        """从持久化存储中删除一条任务记录。"""
        with self._lock:
            if task_id not in self._records:
                return False
            del self._records[task_id]
            self._save()
            return True
