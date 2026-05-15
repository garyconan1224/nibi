"""BiliNote 兼容适配层单测（Phase A.2）。

覆盖 6 条：
1. 响应统一 `{code, msg, data}` 包装
2. 状态机映射（ANALYZING→SUMMARIZING、CANCELLED→FAILED）
3. `/api/generate_note` 成功创建任务
4. `/api/delete_task` 只允许删除终结态
5. `/providers` 能读到 settings
6. `/api/upload` 落盘到项目 videos 目录
"""

from __future__ import annotations

import io
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.app.models.tasks import TaskRecord, TaskStatus
from backend.app.routes import notes as notes_module
from backend.app.services.task_runner import TaskRunner
from backend.app.services.task_store import TaskStore


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> TestClient:
    """构造一个独立 store/runner 替换到 notes 模块里，隔离 pipeline 真实任务。"""
    store = TaskStore(path=tmp_path / "tasks.json")
    runner = TaskRunner(store, max_workers=1)

    def _noop_handler(record, _runner):  # type: ignore[no-untyped-def]
        return {"content": "ok"}

    # note/analyze/download/storyboard 全部注册成 noop，避免误跑真实下载
    for t in ("note", "analyze", "download", "storyboard"):
        runner.register(t, _noop_handler)

    monkeypatch.setattr(notes_module, "_pipeline_store", store)
    monkeypatch.setattr(notes_module, "_pipeline_runner", runner)

    from backend.app.main import app

    # FastAPI 路由闭包在模块级拿到旧引用，故也要把 main 模块里的替掉
    import backend.app.routes.pipeline as pipeline_module

    monkeypatch.setattr(pipeline_module, "_store", store)
    monkeypatch.setattr(pipeline_module, "_runner", runner)

    return TestClient(app)


def test_response_envelope_shape(client: TestClient) -> None:
    """所有 BiliNote 风格路由应返回 `{code, msg, data}` 三字段。"""
    r = client.get("/api/task_status/nonexistent-xxx")
    assert r.status_code == 200
    body = r.json()
    assert set(body.keys()) == {"code", "msg", "data"}
    assert body["code"] == 1  # 不存在
    assert "not found" in body["msg"]


def test_status_mapping_vlm_and_cancelled(client: TestClient) -> None:
    """v1.1 §11 新阶段名应被映射为 BiliNote 可识别的 7 态之一。

    直接用 `store.create` 绕过 runner 的 worker，避免 handler 异步把状态改掉。
    VLM（视觉分析）保留旧 ANALYZING → SUMMARIZING 的语义路径。
    """
    store = notes_module._pipeline_store
    tid = "fake-vlm-0001"
    store.create(
        TaskRecord(
            task_id=tid,
            project_id="p_test",
            task_type="note",
            payload={"url": "x"},
            status=TaskStatus.VLM.value,
        )
    )
    r = client.get(f"/api/task_status/{tid}")
    # BiliNote 兼容输出固定为旧名 "SUMMARIZING"（不是 TaskStatus 枚举值）
    assert r.json()["data"]["status"] == "SUMMARIZING"

    store.update(tid, status=TaskStatus.CANCELLED.value)
    body = client.get(f"/api/task_status/{tid}").json()
    # 取消态映射为 BiliNote 的 "FAILED" + 标注消息
    assert body["data"]["status"] == "FAILED"
    assert body["data"]["message"] == "已取消"


def test_generate_note_creates_task(client: TestClient) -> None:
    """POST /api/generate_note 应该返回 task_id 并写入 store。"""
    r = client.post(
        "/api/generate_note",
        json={
            "video_url": "https://www.bilibili.com/video/BVtest",
            "platform": "bilibili",
            "project_id": "unit_test_proj",
            "task_type": "note",
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["code"] == 0
    tid = body["data"]["task_id"]
    assert notes_module._pipeline_store.get(tid) is not None


def test_delete_task_only_terminal(client: TestClient) -> None:
    """未完成任务不允许删；SUCCESS 后才能删。"""
    store = notes_module._pipeline_store
    tid = "fake-del-0001"
    # 直接 store.create，保证状态不被后台 worker 改写
    store.create(
        TaskRecord(
            task_id=tid,
            project_id="p_test",
            task_type="note",
            payload={"url": "x"},
            status=TaskStatus.DOWNLOAD.value,
        )
    )
    r = client.post("/api/delete_task", json={"task_id": tid})
    assert r.json()["code"] == 409

    store.update(tid, status=TaskStatus.SUCCESS.value)
    r = client.post("/api/delete_task", json={"task_id": tid})
    body = r.json()
    assert body["code"] == 0
    assert body["data"]["deleted"] is True
    assert store.get(tid) is None


def test_provider_list_reads_settings(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    """/providers 应能从 settings_store 读出至少 1 条 provider。"""
    import backend.app.routes.providers as providers_module
    from shared.settings_store import ProviderProfile

    monkeypatch.setattr(
        providers_module,
        "load_settings",
        lambda: type(
            "Settings",
            (),
            {
                "providers": (
                    ProviderProfile(
                        id="unit-provider",
                        name="Unit Provider",
                        kind="openai_compatible",
                        enabled=True,
                        api_key="sk-test",
                        base_url="https://example.test/v1",
                        capabilities=("chat",),
                        default_models={},
                    ),
                ),
            },
        )(),
    )
    r = client.get("/providers")
    assert r.status_code == 200
    providers = r.json()
    assert isinstance(providers, list) and len(providers) >= 1
    # 必要字段
    sample = providers[0]
    for key in ("id", "name", "kind", "enabled", "capabilities", "has_api_key"):
        assert key in sample


def test_upload_persists_file_in_videos_dir(client: TestClient, tmp_path: Path) -> None:
    """/api/upload 必须把文件落到 data/projects/<pid>/videos/ 下。"""
    from shared.config import get_project_videos_dir

    pid = "unit_upload_proj"
    payload = b"fake-video-bytes"
    files = {"file": ("hello world.mp4", io.BytesIO(payload), "video/mp4")}
    r = client.post("/api/upload", data={"project_id": pid}, files=files)
    body = r.json()
    assert body["code"] == 0
    assert body["data"]["project_id"] == pid
    safe_name = body["data"]["filename"]
    dest = get_project_videos_dir(pid) / safe_name
    assert dest.is_file()
    assert dest.read_bytes() == payload
    # 清理测试产物
    try:
        dest.unlink()
    except Exception:
        pass
