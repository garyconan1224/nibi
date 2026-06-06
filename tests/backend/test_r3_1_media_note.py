from __future__ import annotations

"""R3.1 — to_static_url helper + image item GET /note media 测试。

验证：
  to_static_url  — data 内文件→/static/... URL；data 外→''；/static/ 开头→原样；缺失→''
  image /note    — GET …/note 返回 media.images 为 /static URL 列表
"""

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.app.routes import workspaces as ws_module
from backend.app.services.workspace_store import WorkspaceStore


# ── to_static_url 单测 ────────────────────────────────────────────────────────


class TestToStaticUrl:
    """to_static_url 路径转 URL 的各种情况。"""

    def test_path_inside_data_dir(self, tmp_path: Path) -> None:
        """data 目录下文件存在 → /static/ 相对路径。"""
        data_dir = tmp_path / "data"
        data_dir.mkdir()
        target = data_dir / "workspaces" / "ws1" / "images" / "photo.jpg"
        target.parent.mkdir(parents=True)
        target.write_bytes(b"\x89PNG")

        with patch.object(ws_module, "DATA_DIR", data_dir):
            url = ws_module.to_static_url(str(target))
        assert url == "/static/workspaces/ws1/images/photo.jpg"

    def test_path_outside_data_dir(self, tmp_path: Path) -> None:
        """data 目录外的路径 → 空串。"""
        data_dir = tmp_path / "data"
        data_dir.mkdir()
        outside = tmp_path / "other" / "file.jpg"
        outside.parent.mkdir(parents=True)
        outside.write_bytes(b"\x89PNG")

        with patch.object(ws_module, "DATA_DIR", data_dir):
            url = ws_module.to_static_url(str(outside))
        assert url == ""

    def test_path_file_not_exist(self, tmp_path: Path) -> None:
        """data 目录下但文件不存在 → 空串。"""
        data_dir = tmp_path / "data"
        data_dir.mkdir()
        missing = data_dir / "workspaces" / "ws1" / "images" / "gone.jpg"

        with patch.object(ws_module, "DATA_DIR", data_dir):
            url = ws_module.to_static_url(str(missing))
        assert url == ""

    def test_already_static_prefix(self) -> None:
        """已经以 /static/ 开头 → 原样返回。"""
        assert ws_module.to_static_url("/static/workspaces/ws1/images/a.jpg") == "/static/workspaces/ws1/images/a.jpg"

    def test_empty_path(self) -> None:
        """空路径 → 空串。"""
        assert ws_module.to_static_url("") == ""

    def test_path_object_input(self, tmp_path: Path) -> None:
        """接受 Path 对象输入。"""
        data_dir = tmp_path / "data"
        data_dir.mkdir()
        target = data_dir / "audio" / "clip.mp3"
        target.parent.mkdir(parents=True)
        target.write_bytes(b"ID3")

        with patch.object(ws_module, "DATA_DIR", data_dir):
            url = ws_module.to_static_url(target)
        assert url == "/static/audio/clip.mp3"

    def test_relative_path_under_data_dir(self, tmp_path: Path) -> None:
        """相对路径（如 workspaces/ws1/images/a.png）按 DATA_DIR/相对路径 解析。"""
        data_dir = tmp_path / "data"
        target = data_dir / "workspaces" / "ws1" / "images" / "a.png"
        target.parent.mkdir(parents=True)
        target.write_bytes(b"\x89PNG")

        with patch.object(ws_module, "DATA_DIR", data_dir):
            url = ws_module.to_static_url("workspaces/ws1/images/a.png")
        assert url == "/static/workspaces/ws1/images/a.png"

    def test_relative_path_not_exist(self, tmp_path: Path) -> None:
        """相对路径但文件不存在 → 空串。"""
        data_dir = tmp_path / "data"
        data_dir.mkdir()

        with patch.object(ws_module, "DATA_DIR", data_dir):
            url = ws_module.to_static_url("workspaces/ws1/images/missing.png")
        assert url == ""


# ── image GET /note media 测试 ─────────────────────────────────────────────────


@pytest.fixture()
def client(tmp_path: Path):
    """每个测试用独立临时目录的 WorkspaceStore，并 mock pipeline runner store。"""
    isolated_store = WorkspaceStore(root=tmp_path / "workspaces")
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


def test_image_item_note_returns_media_images(client: TestClient, tmp_path: Path) -> None:
    """上传 image 素材后，GET /…/note 返回 media.images 含可访问 /static URL。"""
    # 准备 data 目录结构
    data_dir = tmp_path / "data"
    data_dir.mkdir(exist_ok=True)

    # 创建 workspace
    resp = client.post("/workspaces", json={"name": "image-test"})
    assert resp.status_code == 200
    ws_id = resp.json()["workspace_id"]

    # 手动创建 image 文件（模拟上传后落盘）
    img_dir = data_dir / "workspaces" / ws_id / "images"
    img_dir.mkdir(parents=True, exist_ok=True)
    img_file = img_dir / "test.png"
    img_file.write_bytes(b"\x89PNG fake image data")

    # 添加 image item（source_value 用本地路径）
    resp = client.post(
        f"/workspaces/{ws_id}/items",
        json={
            "type": "image",
            "source": "local",
            "source_value": str(img_file),
        },
    )
    assert resp.status_code == 200
    item_id = resp.json()["items"][-1]["item_id"]

    # 给 item 写入 results（模拟分析完成后）
    store = ws_module._store
    rec = store.get(ws_id)
    item = next(i for i in rec.items if i.item_id == item_id)
    item.results = {
        "description": "一张测试图片",
        "ocr_text": "hello",
        "tags": {},
    }

    # PATCH DATA_DIR 让 to_static_url 指向 tmp_path
    with patch.object(ws_module, "DATA_DIR", data_dir):
        resp = client.get(f"/workspaces/{ws_id}/items/{item_id}/note")

    assert resp.status_code == 200
    data = resp.json()
    assert "media" in data
    assert "transcript" in data
    # image 类型应返回 images 列表
    assert isinstance(data["media"]["images"], list)
    assert len(data["media"]["images"]) == 1
    assert data["media"]["images"][0].startswith("/static/")
    assert "test.png" in data["media"]["images"][0]


def test_url_image_item_note_returns_external_url(client: TestClient) -> None:
    """URL 来源的 image 素材，GET /…/note 返回 media.images 为外部 URL。"""
    resp = client.post("/workspaces", json={"name": "url-image-test"})
    ws_id = resp.json()["workspace_id"]

    resp = client.post(
        f"/workspaces/{ws_id}/items",
        json={
            "type": "image",
            "source": "url",
            "source_value": "https://example.com/photo.jpg",
        },
    )
    item_id = resp.json()["items"][-1]["item_id"]

    resp = client.get(f"/workspaces/{ws_id}/items/{item_id}/note")
    assert resp.status_code == 200
    data = resp.json()
    assert data["media"]["images"] == ["https://example.com/photo.jpg"]
