from __future__ import annotations

"""Persistent task store."""

import json
import os
import tempfile
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

from backend.app.models.tasks import TaskLogEntry, TaskRecord
from shared.config import ROOT_DIR

TASK_STORE_PATH = ROOT_DIR / ".local" / "backend_tasks.json"
MAX_LOG_ENTRIES = 500
SAVE_DEBOUNCE_S = 0.5  # progress/download_speed 写入节流间隔


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class TaskStore:
    def __init__(self, path: Path = TASK_STORE_PATH) -> None:
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._records: Dict[str, TaskRecord] = {}
        self._last_save_ts: float = 0.0
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
        # 原子写入：先在同目录下写入临时文件 + fsync，再 os.replace 原子替换，
        # 保证进程中断/磁盘抖动时目标文件始终是上一版有效 JSON，避免读到半行数据。
        payload = [r.to_dict() for r in self._records.values()]
        data = json.dumps(payload, ensure_ascii=False, indent=2)
        tmp_fd, tmp_name = tempfile.mkstemp(
            prefix=f".{self.path.name}.",
            suffix=".tmp",
            dir=str(self.path.parent),
        )
        tmp_path = Path(tmp_name)
        try:
            with os.fdopen(tmp_fd, "w", encoding="utf-8") as f:
                f.write(data)
                f.flush()
                os.fsync(f.fileno())
            os.replace(tmp_path, self.path)
        except Exception:
            try:
                tmp_path.unlink(missing_ok=True)
            except OSError:
                pass
            raise

    def create(self, record: TaskRecord) -> TaskRecord:
        with self._lock:
            self._records[record.task_id] = record
            self._save()
        return record

    def get(self, task_id: str) -> Optional[TaskRecord]:
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
            # 节流：progress / download_speed 变更不触发全量写盘
            # 仅 status / error / result / payload 等关键字段变化时落盘
            _throttled = {"progress", "download_speed"}
            if set(kwargs.keys()) - _throttled:
                self._save()
            else:
                now = time.monotonic()
                if now - self._last_save_ts >= SAVE_DEBOUNCE_S:
                    self._save()
                    self._last_save_ts = now
            return rec

    def append_log(self, task_id: str, message: str, *, level: str = "info") -> TaskRecord:
        with self._lock:
            rec = self._records.get(task_id)
            if rec is None:
                raise KeyError(f"task not found: {task_id}")
            rec.log.append(TaskLogEntry.create(message=message, level=level))  # type: ignore[arg-type]
            if len(rec.log) > MAX_LOG_ENTRIES:
                rec.log = rec.log[-MAX_LOG_ENTRIES:]
            rec.updated_at = _now_iso()
            self._save()
            return rec

    def list_all(self) -> List[TaskRecord]:
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
