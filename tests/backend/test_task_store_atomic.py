from __future__ import annotations

"""TaskStore._save 的原子写入 smoke 测试。

覆盖两条关键路径：
1) 正常写入：磁盘内容与内存 records 语义一致；
2) 写入过程中抛错：目标文件保持"上一版"有效 JSON，且目录内无残留 .tmp。
"""

import json
from pathlib import Path

import pytest

from backend.app.models.tasks import TaskRecord
from backend.app.services import task_store as ts_module
from backend.app.services.task_store import TaskStore


def _make_record(task_id: str = "t1", project_id: str = "p1") -> TaskRecord:
    return TaskRecord(
        task_id=task_id,
        project_id=project_id,
        task_type="dummy",
        payload={"x": 1},
    )


def _list_tmp_siblings(path: Path) -> list[Path]:
    """返回目标文件同目录下所有 .tmp 兄弟文件（原子写的临时文件前缀为 '.<name>.'、后缀为 '.tmp'）。"""
    return [p for p in path.parent.iterdir() if p.name != path.name and p.name.endswith(".tmp")]


def test_save_writes_valid_json_matching_records(tmp_path: Path) -> None:
    store_path = tmp_path / "tasks.json"
    store = TaskStore(path=store_path)

    store.create(_make_record("t1"))
    store.create(_make_record("t2"))

    assert store_path.is_file()
    on_disk = json.loads(store_path.read_text(encoding="utf-8"))
    assert isinstance(on_disk, list)
    assert {item["task_id"] for item in on_disk} == {"t1", "t2"}
    # 原子写完成后不应有临时文件残留
    assert _list_tmp_siblings(store_path) == []


def test_save_failure_preserves_previous_version_and_cleans_tmp(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    store_path = tmp_path / "tasks.json"
    store = TaskStore(path=store_path)

    # 第一次正常写入，作为"上一版"基线
    store.create(_make_record("baseline"))
    baseline_bytes = store_path.read_bytes()

    # 让 os.replace 在第二次写入时抛错，模拟原子替换阶段失败
    def _boom(src: str, dst: str) -> None:
        raise OSError("simulated replace failure")

    monkeypatch.setattr(ts_module.os, "replace", _boom)

    with pytest.raises(OSError, match="simulated replace failure"):
        store.create(_make_record("t-fail"))

    # 目标文件仍为上一版字节级相同的 JSON
    assert store_path.read_bytes() == baseline_bytes
    on_disk = json.loads(store_path.read_text(encoding="utf-8"))
    assert [item["task_id"] for item in on_disk] == ["baseline"]

    # 临时文件已被 except 分支清理
    assert _list_tmp_siblings(store_path) == []


def test_save_failure_before_replace_still_cleans_tmp(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    store_path = tmp_path / "tasks.json"
    store = TaskStore(path=store_path)
    store.create(_make_record("baseline"))
    baseline_bytes = store_path.read_bytes()

    # 让 fsync 抛错，模拟写临时文件阶段的磁盘异常
    def _fsync_boom(fd: int) -> None:
        raise OSError("simulated fsync failure")

    monkeypatch.setattr(ts_module.os, "fsync", _fsync_boom)

    with pytest.raises(OSError, match="simulated fsync failure"):
        store.create(_make_record("t-fail"))

    assert store_path.read_bytes() == baseline_bytes
    assert _list_tmp_siblings(store_path) == []

