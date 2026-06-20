"""list_tasks 轻量模式仍注入 result 展示字段白名单（封面/标题/类型）。

回归用户反馈：首页「最近任务」往期已完成任务卡无封面，点进详情才有。
根因是轻量列表 include_result=False 把整个 result 清空；修复是注入展示字段白名单，
但仍排除总结 md / 转录等重量级字段，保持列表轻量。
"""

from pathlib import Path

from backend.app.models.tasks import TaskRecord, TaskStatus
from backend.app.routes import pipeline
from backend.app.services.task_store import TaskStore


def _seed_store(tmp_path: Path) -> TaskStore:
    store = TaskStore(path=tmp_path / "backend_tasks.json")
    store.create(
        TaskRecord(
            task_id="t-cover",
            project_id="ws-1",
            task_type="note",
            payload={"url": "https://www.bilibili.com/video/BV1"},
            status=TaskStatus.SUCCESS.value,
            result={
                "video_title": "标题",
                "video_thumbnail_url": "/static/x.jpg",
                "note_kind": "video",
                # 重量级字段：不应出现在轻量列表里
                "summary_md": "# 很长的总结" * 1000,
                "segments": [{"t": 0}],
            },
        )
    )
    return store


def test_list_tasks_light_includes_cover_fields(tmp_path, monkeypatch):
    monkeypatch.setattr(pipeline, "_store", _seed_store(tmp_path))
    rows = pipeline.list_tasks(include_result=False)
    assert len(rows) == 1
    result = rows[0]["result"]
    # 展示字段在（卡片渲染所需）
    assert result["video_thumbnail_url"] == "/static/x.jpg"
    assert result["video_title"] == "标题"
    assert result["note_kind"] == "video"
    # 重量级字段不在（保持列表轻量）
    assert "summary_md" not in result
    assert "segments" not in result


def test_list_tasks_full_includes_everything(tmp_path, monkeypatch):
    monkeypatch.setattr(pipeline, "_store", _seed_store(tmp_path))
    rows = pipeline.list_tasks(include_result=True)
    result = rows[0]["result"]
    assert "summary_md" in result
    assert result["video_thumbnail_url"] == "/static/x.jpg"
