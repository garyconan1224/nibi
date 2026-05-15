from __future__ import annotations

"""Phase 1A — GET /workspaces 派生字段测试。

验证：
  happy path  — 新建 workspace 后列表和详情都含 5 个派生字段，四类计数齐全
  error path  — 查不存在的 workspace_id 返回 404
"""

import io
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


def test_upload_item_persists_file_and_registers_item(
    client: TestClient, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """上传本地文件后，应落盘并登记为 workspace local item。"""
    monkeypatch.setattr(
        ws_module,
        "WORKSPACE_UPLOAD_ROOT",
        tmp_path / "workspace_uploads",
        raising=False,
    )

    resp = client.post("/workspaces", json={"name": "上传测试"})
    ws_id = resp.json()["workspace_id"]

    payload = b"fake-video-bytes"
    files = {"file": ("hello world.mp4", io.BytesIO(payload), "video/mp4")}
    resp = client.post(f"/workspaces/{ws_id}/items/upload", files=files)

    assert resp.status_code == 200
    ws = resp.json()
    assert len(ws["items"]) == 1
    item = ws["items"][0]
    assert item["type"] == "video"
    assert item["source"] == "local"
    assert item["name"] == "hello_world.mp4"

    stored = Path(item["source_value"])
    assert stored.is_file()
    assert stored.read_bytes() == payload

    resp = client.delete(f"/workspaces/{ws_id}")
    assert resp.status_code == 200
    assert not stored.exists()


def test_upload_item_workspace_not_found(client: TestClient) -> None:
    """上传到不存在的 workspace 应返回 404。"""
    files = {"file": ("hello.mp4", io.BytesIO(b"video"), "video/mp4")}
    resp = client.post("/workspaces/missing/items/upload", files=files)

    assert resp.status_code == 404


def test_upload_item_rejects_empty_file(
    client: TestClient, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """空文件不应落盘或登记为素材。"""
    upload_root = tmp_path / "workspace_uploads"
    monkeypatch.setattr(ws_module, "WORKSPACE_UPLOAD_ROOT", upload_root, raising=False)

    resp = client.post("/workspaces", json={"name": "空文件测试"})
    ws_id = resp.json()["workspace_id"]

    files = {"file": ("empty.txt", io.BytesIO(b""), "text/plain")}
    resp = client.post(f"/workspaces/{ws_id}/items/upload", files=files)

    assert resp.status_code == 400
    assert resp.json()["detail"] == "uploaded file cannot be empty"
    assert not any(p.is_file() for p in upload_root.rglob("*"))
    ws = client.get(f"/workspaces/{ws_id}").json()
    assert ws["items"] == []


def test_upload_item_rejects_oversized_file(
    client: TestClient, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """超过上传上限的文件不应保留部分文件或登记为素材。"""
    upload_root = tmp_path / "workspace_uploads"
    monkeypatch.setattr(ws_module, "WORKSPACE_UPLOAD_ROOT", upload_root, raising=False)
    monkeypatch.setattr(ws_module, "MAX_UPLOAD_BYTES", 4, raising=False)

    resp = client.post("/workspaces", json={"name": "超限测试"})
    ws_id = resp.json()["workspace_id"]

    files = {"file": ("big.txt", io.BytesIO(b"12345"), "text/plain")}
    resp = client.post(f"/workspaces/{ws_id}/items/upload", files=files)

    assert resp.status_code == 413
    assert resp.json()["detail"] == "uploaded file exceeds 500MB limit"
    assert not any(p.is_file() for p in upload_root.rglob("*"))
    ws = client.get(f"/workspaces/{ws_id}").json()
    assert ws["items"] == []


# ── Phase 1E — 网络链接添加 ──────────────────────────────────────────────────


def test_add_url_item_happy_path(client: TestClient) -> None:
    """提交合法 http URL 时素材成功登记，并出现在工作空间详情里。"""
    ws_id = client.post("/workspaces", json={"name": "URL 测试"}).json()["workspace_id"]
    resp = client.post(
        f"/workspaces/{ws_id}/items",
        json={
            "type": "video",
            "source": "url",
            "source_value": "  https://www.bilibili.com/video/BV1xx411c7mD  ",
        },
    )
    assert resp.status_code == 200
    ws = resp.json()
    assert len(ws["items"]) == 1
    item = ws["items"][0]
    assert item["source"] == "url"
    # 校验通过后存储的是 strip 过的值
    assert item["source_value"] == "https://www.bilibili.com/video/BV1xx411c7mD"


@pytest.mark.parametrize(
    "bad_url,expected_keyword",
    [
        ("not a url", "http"),
        ("ftp://example.com/a.mp4", "http"),
        ("https://", "host"),
        ("   ", "empty"),
    ],
)
def test_add_url_item_rejects_invalid_url(
    client: TestClient, bad_url: str, expected_keyword: str
) -> None:
    """非 http(s) / 缺 host / 空白 URL 一律返回 400。"""
    ws_id = client.post("/workspaces", json={"name": "URL 错误测试"}).json()[
        "workspace_id"
    ]
    resp = client.post(
        f"/workspaces/{ws_id}/items",
        json={"type": "video", "source": "url", "source_value": bad_url},
    )
    assert resp.status_code == 400
    assert expected_keyword in resp.json()["detail"].lower()
    # 错误请求不应留下任何 item
    ws = client.get(f"/workspaces/{ws_id}").json()
    assert ws["items"] == []


# ── Error path ────────────────────────────────────────────────────────────────


def test_get_workspace_not_found(client: TestClient) -> None:
    """查不存在的 workspace_id 返回 404。"""
    resp = client.get("/workspaces/nonexistent-id")
    assert resp.status_code == 404
