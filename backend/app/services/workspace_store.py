from __future__ import annotations

"""Workspace（工作空间）持久化存储。

实现风格完全对齐 backend/app/services/task_store.py：
- JSON 文件 + 原子写入（tmp + os.replace）
- 内存 dict 缓存 + threading.Lock 串行写
- 与 TaskStore 平级，互不耦合

存储路径：data/workspaces/<workspace_id>.json（每个 workspace 一个文件，
便于浏览/手工修改/未来分库；不像 task_store 把所有任务塞一个文件）。
"""

import json
import os
import tempfile
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

from backend.app.models.workspace import (
    ItemStatus,
    PromptVersion,
    WorkspaceBackground,
    WorkspaceItem,
    WorkspaceRecord,
    WorkspaceStatus,
)
from shared.config import DATA_DIR

WORKSPACE_DIR: Path = DATA_DIR / "workspaces"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _atomic_write(path: Path, payload: str) -> None:
    """复用 task_store 的原子写策略，但内联避免循环依赖。"""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_fd, tmp_name = tempfile.mkstemp(
        prefix=f".{path.name}.",
        suffix=".tmp",
        dir=str(path.parent),
    )
    tmp_path = Path(tmp_name)
    try:
        with os.fdopen(tmp_fd, "w", encoding="utf-8") as f:
            f.write(payload)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp_path, path)
    except Exception:
        try:
            tmp_path.unlink(missing_ok=True)
        except OSError:
            pass
        raise


class WorkspaceStore:
    """工作空间存储——按 workspace_id 一文件保存。"""

    def __init__(self, root: Path = WORKSPACE_DIR) -> None:
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._records: Dict[str, WorkspaceRecord] = {}
        self._load_all()

    # ── 内部：磁盘 I/O ────────────────────────────────────────

    def _file_path(self, workspace_id: str) -> Path:
        # 简单消毒：禁止跨目录；workspace_id 由后端生成（uuid），用户不应直接传任意字符串
        safe = workspace_id.replace("/", "_").replace("\\", "_").strip()
        return self.root / f"{safe}.json"

    def _load_all(self) -> None:
        if not self.root.is_dir():
            return
        for fp in self.root.glob("*.json"):
            try:
                data = json.loads(fp.read_text(encoding="utf-8"))
            except Exception:
                continue
            if not isinstance(data, dict):
                continue
            rec = WorkspaceRecord.from_dict(data)
            if rec.workspace_id:
                self._records[rec.workspace_id] = rec

    def _save(self, rec: WorkspaceRecord) -> None:
        rec.updated_at = _now_iso()
        data = json.dumps(rec.to_dict(), ensure_ascii=False, indent=2)
        _atomic_write(self._file_path(rec.workspace_id), data)

    # ── Workspace 级 CRUD ────────────────────────────────────

    def create(self, rec: WorkspaceRecord) -> WorkspaceRecord:
        with self._lock:
            self._records[rec.workspace_id] = rec
            self._save(rec)
        return rec

    def get(self, workspace_id: str) -> Optional[WorkspaceRecord]:
        with self._lock:
            return self._records.get(workspace_id)

    def list_all(
        self,
        project_id: Optional[str] = None,
        *,
        include_trashed: bool = False,
        trashed_only: bool = False,
    ) -> List[WorkspaceRecord]:
        """列出工作空间。

        默认仅返回非 trashed 的记录（主列表语义）。
        trashed_only=True：仅返回 trashed 的记录（垃圾桶视图）。
        include_trashed=True：返回全部（含 trashed），用于管理后台/调试。
        trashed_only 优先于 include_trashed。
        """
        with self._lock:
            recs = list(self._records.values())
        if project_id:
            recs = [r for r in recs if r.project_id == project_id]
        if trashed_only:
            recs = [r for r in recs if r.trashed]
        elif not include_trashed:
            recs = [r for r in recs if not r.trashed]
        # 按 updated_at 倒序，最近更新在前
        return sorted(recs, key=lambda r: r.updated_at, reverse=True)

    def update(self, workspace_id: str, **kwargs: object) -> WorkspaceRecord:
        with self._lock:
            rec = self._records.get(workspace_id)
            if rec is None:
                raise KeyError(f"workspace not found: {workspace_id}")
            for k, v in kwargs.items():
                if k == "background" and isinstance(v, dict):
                    rec.background = WorkspaceBackground.from_dict(v)
                else:
                    setattr(rec, k, v)
            self._save(rec)
            return rec

    def delete(self, workspace_id: str) -> bool:
        """删除工作空间。

        顺序：先删磁盘文件，成功后再从内存移除。这样若磁盘 IO 失败，
        内存视图保持一致，避免「内存已删但磁盘还在 → 重启后又加载回来」。
        """
        with self._lock:
            if workspace_id not in self._records:
                return False
            fp = self._file_path(workspace_id)
            if fp.exists():
                try:
                    fp.unlink()
                except OSError:
                    return False
            del self._records[workspace_id]
            return True

    # ── Item 级操作 ──────────────────────────────────────────

    def add_item(self, workspace_id: str, item: WorkspaceItem) -> WorkspaceRecord:
        with self._lock:
            rec = self._records.get(workspace_id)
            if rec is None:
                raise KeyError(f"workspace not found: {workspace_id}")
            rec.items.append(item)
            self._save(rec)
            return rec

    def update_item(
        self, workspace_id: str, item_id: str, **kwargs: object
    ) -> WorkspaceRecord:
        with self._lock:
            rec = self._records.get(workspace_id)
            if rec is None:
                raise KeyError(f"workspace not found: {workspace_id}")
            target = next((it for it in rec.items if it.item_id == item_id), None)
            if target is None:
                raise KeyError(f"item not found: {item_id}")
            for k, v in kwargs.items():
                setattr(target, k, v)
            target.updated_at = _now_iso()
            self._save(rec)
            return rec

    def remove_item(self, workspace_id: str, item_id: str) -> WorkspaceRecord:
        with self._lock:
            rec = self._records.get(workspace_id)
            if rec is None:
                raise KeyError(f"workspace not found: {workspace_id}")
            before = len(rec.items)
            rec.items = [it for it in rec.items if it.item_id != item_id]
            if len(rec.items) == before:
                raise KeyError(f"item not found: {item_id}")
            # 同步从复刻收藏夹移除
            rec.favorites = [fid for fid in rec.favorites if fid != item_id]
            self._save(rec)
            return rec

    # ── Prompt 版本栈 ──────────────────────────────────────

    def add_prompt_version(
        self, workspace_id: str, item_id: str, content: str
    ) -> PromptVersion:
        """为指定 item 追加一个提示词版本，version 自增。"""
        with self._lock:
            rec = self._records.get(workspace_id)
            if rec is None:
                raise KeyError(f"workspace not found: {workspace_id}")
            if not any(it.item_id == item_id for it in rec.items):
                raise KeyError(f"item not found: {item_id}")
            versions = rec.prompt_versions.setdefault(item_id, [])
            next_ver = (versions[-1].version + 1) if versions else 1
            pv = PromptVersion(version=next_ver, content=content)
            versions.append(pv)
            self._save(rec)
            return pv

    def list_prompt_versions(
        self, workspace_id: str, item_id: str
    ) -> List[PromptVersion]:
        """列出指定 item 的所有提示词版本。"""
        with self._lock:
            rec = self._records.get(workspace_id)
            if rec is None:
                raise KeyError(f"workspace not found: {workspace_id}")
            if not any(it.item_id == item_id for it in rec.items):
                raise KeyError(f"item not found: {item_id}")
            return list(rec.prompt_versions.get(item_id) or [])
