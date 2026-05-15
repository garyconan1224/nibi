from __future__ import annotations

"""Phase 1A — GET /workspaces 派生字段测试。

验证：
  happy path  — 新建 workspace 后列表和详情都含 5 个派生字段，四类计数齐全
  error path  — 查不存在的 workspace_id 返回 404
"""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# ── 测试用隔离 App ────────────────────────────────────────────────────────────
# 直接构建一个轻量 FastAPI app，挂 workspaces router；
# 不启动 uvicorn，避免跑全部 lifespan 钩子（seed provider 等）。

from fastapi import FastAPI
from unittest.mock import MagicMock, patch

from backend.app.routes import workspaces as ws_module
from backend.app.services.workspace_store import WorkspaceStore


@pytest.fixture()
def client(tmp_path: Path):
    """每个测试用独立临时目录的 WorkspaceStore，并 mock pipeline runner store。"""
    # 替换路由模块里的单例 store
    isolated_store = WorkspaceStore(root=tmp_path / "workspaces")

    # mock pipeline runner：store.get 全返回 None（无活跃任务）
    mock_runner = MagicMock()
    mock_runner.store.get.return_value = None

    app = FastAPI()
    with (
        patch.object(ws_module, "_store", isolated_store),
        patch.object(ws_module, "_pipeline_runner", mock_runner),
    ):
        app.include_router(ws_module.router)
        with TestClient(app) as c:
            yield c


# ── Happy path ────────────────────────────────────────────────────────────────


def test_list_workspaces_derived_fields_present(client: TestClient) -> None:
    """新建 workspace 后，GET /workspaces 返回条目含所有 Phase 1A 派生字段。"""
    # 新建
    resp = client.post("/workspaces", json={"name": "测试空间"})
    assert resp.status_code == 200

    # 列表
    resp = client.get("/workspaces")
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    ws = items[0]

    # 派生字段存在
    assert "current_step" in ws
    assert "items_count_by_type" in ws
    assert "cover_thumbnail" in ws
    assert "last_active_at" in ws

    # current_step — 无活跃任务应为 null
    assert ws["current_step"] is None

    # cover_thumbnail — 无 video items 应为 null
    assert ws["cover_thumbnail"] is None

    # items_count_by_type — 四类都要有，初始全为 0
    counts = ws["items_count_by_type"]
    assert counts == {"video": 0, "audio": 0, "image": 0, "text": 0}

    # last_active_at 等于 updated_at
    assert ws["last_active_at"] == ws["updated_at"]


def test_get_workspace_derived_fields_present(client: TestClient) -> None:
    """GET /workspaces/{id} 详情也含派生字段。"""
    resp = client.post("/workspaces", json={"name": "详情测试"})
    ws_id = resp.json()["workspace_id"]

    resp = client.get(f"/workspaces/{ws_id}")
    assert resp.status_code == 200
    ws = resp.json()

    for key in ("current_step", "items_count_by_type", "cover_thumbnail", "last_active_at"):
        assert key in ws, f"缺少字段: {key}"


def test_items_count_by_type_after_adding_items(client: TestClient) -> None:
    """添加素材后，items_count_by_type 数字正确累加。"""
    resp = client.post("/workspaces", json={"name": "素材计数测试"})
    ws_id = resp.json()["workspace_id"]

    client.post(f"/workspaces/{ws_id}/items", json={"type": "video", "source": "url", "source_value": "https://example.com/a.mp4"})
    client.post(f"/workspaces/{ws_id}/items", json={"type": "video", "source": "url", "source_value": "https://example.com/b.mp4"})
    client.post(f"/workspaces/{ws_id}/items", json={"type": "image", "source": "local", "source_value": "/tmp/img.jpg"})

    resp = client.get(f"/workspaces/{ws_id}")
    counts = resp.json()["items_count_by_type"]
    assert counts["video"] == 2
    assert counts["image"] == 1
    assert counts["audio"] == 0
    assert counts["text"] == 0


# ── Error path ────────────────────────────────────────────────────────────────


def test_get_workspace_not_found(client: TestClient) -> None:
    """查不存在的 workspace_id 返回 404。"""
    resp = client.get("/workspaces/nonexistent-id")
    assert resp.status_code == 404
