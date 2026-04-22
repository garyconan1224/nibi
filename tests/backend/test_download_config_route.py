"""`GET/POST /download_config` 路由冻结契约测试。

覆盖:
- GET 缺省回显 DownloadConfig 默认值;
- POST 全量字段写入后回显一致,并持久化至 AppSettings.download;
- POST 仅传部分字段时沿用旧值(None → 保留语义);
- POST 越界数值返回 422(Pydantic ge/le 前置校验);
- POST cookie_base_dirs 去空白 + 去重 + 保序,入参 list → 落 tuple;
- DownloadConfig dataclass 行为: frozen + from_dict 白名单 / clamp 兜底。
"""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.app.routes.download_config import router as download_router
from shared import settings_store
from shared.settings_store import DownloadConfig, load_settings


@pytest.fixture()
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    """隔离的 TestClient:settings.json 指向 tmp_path,避免污染真实配置。"""
    monkeypatch.setattr(settings_store, "SETTINGS_DIR", tmp_path)
    monkeypatch.setattr(settings_store, "SETTINGS_PATH", tmp_path / "settings.json")

    app = FastAPI()
    app.include_router(download_router)
    return TestClient(app)


# ── DownloadConfig dataclass 行为 ───────────────────────────────────────────


def test_download_config_is_frozen_dataclass() -> None:
    cfg = DownloadConfig()
    with pytest.raises((AttributeError, Exception)):
        cfg.output_dir = "/tmp/out"  # type: ignore[misc]


def test_download_config_from_dict_clamp_fallback() -> None:
    # 数值越界回落到边界值
    cfg = DownloadConfig.from_dict({
        "concurrency_limit": 999,
        "retry_count": -5,
        "socket_timeout": 1,
    })
    assert cfg.concurrency_limit == 8
    assert cfg.retry_count == 0
    assert cfg.socket_timeout == 5

    # 非数值回落到默认值
    cfg2 = DownloadConfig.from_dict({"concurrency_limit": "abc"})
    assert cfg2.concurrency_limit == 2

    # None / 非 dict 容错 → 全部默认
    assert DownloadConfig.from_dict(None).filename_template == "%(title)s-%(id)s.%(ext)s"
    assert DownloadConfig.from_dict("not-a-dict").concurrency_limit == 2


def test_download_config_from_dict_cookie_dirs_normalization() -> None:
    cfg = DownloadConfig.from_dict({
        "cookie_base_dirs": ["/a", "  /b  ", "", "/a", None, "/c"],
    })
    # 去空白 + 去重 + 保序,结果为 tuple
    assert cfg.cookie_base_dirs == ("/a", "/b", "/c")
    assert isinstance(cfg.cookie_base_dirs, tuple)


# ── GET /download_config ─────────────────────────────────────────────────


def test_get_returns_defaults_when_no_settings(client: TestClient) -> None:
    resp = client.get("/download_config")
    assert resp.status_code == 200
    body = resp.json()
    assert body == {
        "output_dir": "",
        "filename_template": "%(title)s-%(id)s.%(ext)s",
        "http_proxy": "",
        "po_token": "",
        "visitor_data": "",
        "cookie_base_dirs": [],
        "concurrency_limit": 2,
        "retry_count": 3,
        "socket_timeout": 30,
    }


# ── POST /download_config ────────────────────────────────────────────────


def test_post_persists_full_payload(client: TestClient) -> None:
    payload = {
        "output_dir": "/data/videos",
        "filename_template": "%(uploader)s/%(title)s.%(ext)s",
        "http_proxy": "http://127.0.0.1:7890",
        "po_token": "tok_abc",
        "visitor_data": "vd_xyz",
        "cookie_base_dirs": ["/a", "/b"],
        "concurrency_limit": 4,
        "retry_count": 5,
        "socket_timeout": 60,
    }
    resp = client.post("/download_config", json=payload)
    assert resp.status_code == 200
    assert resp.json() == payload

    # 再次 GET 必须回显相同
    assert client.get("/download_config").json() == payload

    # 落盘至 AppSettings.download,并且 cookie_base_dirs 内部为 tuple
    settings = load_settings()
    assert settings.download.output_dir == "/data/videos"
    assert settings.download.cookie_base_dirs == ("/a", "/b")
    assert isinstance(settings.download.cookie_base_dirs, tuple)


def test_post_partial_payload_preserves_untouched_fields(client: TestClient) -> None:
    client.post("/download_config", json={
        "output_dir": "/keep",
        "po_token": "keep_tok",
        "concurrency_limit": 6,
    })
    # 只改 retry_count,其余字段沿用
    resp = client.post("/download_config", json={"retry_count": 7})
    assert resp.status_code == 200
    body = resp.json()
    assert body["retry_count"] == 7
    assert body["output_dir"] == "/keep"
    assert body["po_token"] == "keep_tok"
    assert body["concurrency_limit"] == 6


def test_post_rejects_out_of_range_numeric(client: TestClient) -> None:
    assert client.post("/download_config", json={"concurrency_limit": 99}).status_code == 422
    assert client.post("/download_config", json={"retry_count": -1}).status_code == 422
    assert client.post("/download_config", json={"socket_timeout": 3}).status_code == 422


def test_post_cookie_dirs_dedup_and_trim(client: TestClient) -> None:
    resp = client.post("/download_config", json={
        "cookie_base_dirs": ["/a", "  /b ", "", "/a", "/c"],
    })
    assert resp.status_code == 200
    assert resp.json()["cookie_base_dirs"] == ["/a", "/b", "/c"]


def test_post_empty_array_clears_cookie_dirs(client: TestClient) -> None:
    client.post("/download_config", json={"cookie_base_dirs": ["/a"]})
    resp = client.post("/download_config", json={"cookie_base_dirs": []})
    assert resp.status_code == 200
    assert resp.json()["cookie_base_dirs"] == []

