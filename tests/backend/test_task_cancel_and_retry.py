"""关键路径烟雾测试：取消和重试端点。

覆盖：
- POST /pipeline/tasks/{task_id}/cancel
- POST /pipeline/tasks/{task_id}/retry
"""
from __future__ import annotations

import time
from pathlib import Path

from backend.app.models.tasks import TERMINAL_STATUS_VALUES, TaskRecord, TaskStatus
from backend.app.services.task_runner import TaskRunner
from backend.app.services.task_store import TaskStore


def _wait_for_terminal(store: TaskStore, task_id: str, timeout: float = 3.0) -> TaskRecord:
    """等待任务进入终结态。"""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        rec = store.get(task_id)
        if rec is not None and rec.status in TERMINAL_STATUS_VALUES:
            return rec
        time.sleep(0.05)
    return store.get(task_id)  # type: ignore[return-value]


def test_cancel_task_smoke(tmp_path: Path) -> None:
    """烟雾测试：任务取消端点工作流程。"""
    store = TaskStore(path=tmp_path / "tasks.json")
    runner = TaskRunner(store, max_workers=1)

    # 注册一个简单的处理器
    def handler(record: TaskRecord, _runner: TaskRunner):
        # 模拟长时间运行
        for _ in range(50):
            if _runner.is_cancel_requested(record.task_id):
                return {"cancelled": True}
            time.sleep(0.01)
        return {"ok": True}

    runner.register("test-cancel", handler)
    
    # 创建任务
    created = runner.create_task("p1", "test-cancel", {"x": 1})
    assert created.task_id
    
    # 短暂等待任务开始
    time.sleep(0.1)
    
    # 取消任务
    cancelled = runner.cancel_task(created.task_id)
    assert cancelled.cancel_requested is True
    assert cancelled.status in (
        TaskStatus.CANCELLED.value,
        TaskStatus.DOWNLOADING.value,  # 可能还在 DOWNLOADING 阶段
    )
    
    # 验证最终状态
    final = _wait_for_terminal(store, created.task_id)
    assert final.status == TaskStatus.CANCELLED.value


def test_retry_task_smoke(tmp_path: Path) -> None:
    """烟雾测试：任务重试端点工作流程。"""
    store = TaskStore(path=tmp_path / "tasks.json")
    runner = TaskRunner(store, max_workers=1)

    # 注册一个立即失败的处理器
    def handler(record: TaskRecord, _runner: TaskRunner):
        raise ValueError("Intentional test failure")

    runner.register("test-fail", handler)
    
    # 创建任务（会立即失败）
    created = runner.create_task("p1", "test-fail", {"data": "test"})
    
    # 等待失败
    failed = _wait_for_terminal(store, created.task_id)
    assert failed.status == TaskStatus.FAILED.value
    assert "Intentional test failure" in failed.error
    
    # 重试任务（创建新的任务副本）
    retried = runner.retry_task(created.task_id)
    assert retried.task_id != created.task_id
    assert retried.retry_of == created.task_id
    assert retried.status in (
        TaskStatus.PENDING.value,
        TaskStatus.DOWNLOADING.value,
    )
    
    # 验证新任务最终也失败（相同处理器）
    final = _wait_for_terminal(store, retried.task_id)
    assert final.status == TaskStatus.FAILED.value


def test_retry_nonexistent_task(tmp_path: Path) -> None:
    """错误处理：重试不存在的任务。"""
    store = TaskStore(path=tmp_path / "tasks.json")
    runner = TaskRunner(store, max_workers=1)
    
    try:
        runner.retry_task("nonexistent-task-id")
        assert False, "Should have raised KeyError"
    except KeyError as e:
        assert "task not found" in str(e)


def test_retry_preserves_payload(tmp_path: Path) -> None:
    """验证：重试保留原始 payload。"""
    store = TaskStore(path=tmp_path / "tasks.json")
    runner = TaskRunner(store, max_workers=1)

    def handler(record: TaskRecord, _runner: TaskRunner):
        raise ValueError("Fail")

    runner.register("test-payload", handler)
    
    # 创建带 payload 的任务
    payload = {"url": "https://example.com/video", "steps": ["download", "analyze"]}
    created = runner.create_task("p1", "test-payload", payload)
    
    # 等待失败
    _wait_for_terminal(store, created.task_id)
    
    # 重试
    retried = runner.retry_task(created.task_id)
    
    # 验证 payload 保留
    assert retried.payload == payload
    assert retried.payload["url"] == "https://example.com/video"
    assert retried.payload["steps"] == ["download", "analyze"]

