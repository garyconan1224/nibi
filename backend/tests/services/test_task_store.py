"""TaskStore 启动清理（死任务根治）测试。

场景：后端重启后 executor 线程池是空的，磁盘里残留的非终态任务（PENDING /
运行中各阶段，如截帧 FRAMES 60%）不可能继续执行，全是僵尸。_load 应统一标
FAILED，根治「死任务」重启复活；终态任务（SUCCESS/FAILED/CANCELLED）不动。
"""

import json
from pathlib import Path

from backend.app.models.tasks import TaskStatus
from backend.app.services.task_store import TaskStore


def _write_tasks(path: Path, records: list[dict]) -> None:
    path.write_text(json.dumps(records, ensure_ascii=False), encoding="utf-8")


def test_load_marks_non_terminal_as_failed(tmp_path):
    """非终态僵尸（PENDING / 截帧中）→ FAILED；终态任务不动。"""
    store_path = tmp_path / "backend_tasks.json"
    _write_tasks(
        store_path,
        [
            {"task_id": "zombie-pending", "status": "PENDING", "progress": 0.0},
            {"task_id": "zombie-frames", "status": "FRAMES", "progress": 0.6},
            {"task_id": "done-ok", "status": "SUCCESS", "progress": 1.0},
            {"task_id": "done-fail", "status": "FAILED", "error": "原始错误"},
        ],
    )

    store = TaskStore(path=store_path)

    # 非终态 → FAILED + 中断说明
    pending = store.get("zombie-pending")
    frames = store.get("zombie-frames")
    assert pending is not None and pending.status == TaskStatus.FAILED.value
    assert "重启" in pending.error
    assert frames is not None and frames.status == TaskStatus.FAILED.value

    # 终态不动
    assert store.get("done-ok").status == TaskStatus.SUCCESS.value
    fail = store.get("done-fail")
    assert fail.status == TaskStatus.FAILED.value
    assert fail.error == "原始错误"  # 已有 error 不被覆盖


def test_load_persists_cleanup_to_disk(tmp_path):
    """清理后磁盘文件也变干净：重读 json，僵尸已是 FAILED（下次重启不再复活）。"""
    store_path = tmp_path / "backend_tasks.json"
    _write_tasks(store_path, [{"task_id": "z", "status": "ASR", "progress": 0.3}])

    TaskStore(path=store_path)  # 触发清理 + 落盘

    on_disk = json.loads(store_path.read_text(encoding="utf-8"))
    assert on_disk[0]["status"] == TaskStatus.FAILED.value


def test_load_no_rewrite_when_all_terminal(tmp_path):
    """全是终态时不重写磁盘（dirty=False，避免无谓写盘）。"""
    store_path = tmp_path / "backend_tasks.json"
    # 故意写成紧凑格式；若误触发 _save 会被重写成 indent=2，内容即不同
    store_path.write_text(
        json.dumps([{"task_id": "ok", "status": "SUCCESS", "progress": 1.0}]),
        encoding="utf-8",
    )
    raw_before = store_path.read_text(encoding="utf-8")

    TaskStore(path=store_path)

    assert store_path.read_text(encoding="utf-8") == raw_before
