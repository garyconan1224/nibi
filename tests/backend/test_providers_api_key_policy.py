"""Provider 路由安全 & 契约修订测试（DESIGN_NOTES_SETTINGS.md §3.4 D10/脱敏项）。

覆盖：
- PUT /providers/{id} api_key == "" 不修改原值；
- PUT /providers/{id} api_key 为非空新值时覆盖；
- GET /providers/{id} 不再回传 api_key 明文；
- POST /providers 不再回传 api_key 明文，仅保留 has_api_key。
"""

from __future__ import annotations

from dataclasses import replace
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.app.routes.providers import router as providers_router
from shared import settings_store
from shared.settings_store import AppSettings, ProviderProfile, load_settings, save_settings


@pytest.fixture()
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setattr(settings_store, "SETTINGS_DIR", tmp_path)
    monkeypatch.setattr(settings_store, "SETTINGS_PATH", tmp_path / "settings.json")

    # 预置一个 provider，便于 PUT/GET 场景
    seed = ProviderProfile(
        id="openai_compatible-seed",
        name="Seed",
        kind="openai_compatible",
        enabled=True,
        api_key="sk-original",
        base_url="https://api.example.com/v1",
        capabilities=("chat",),
    )
    save_settings(replace(AppSettings(), providers=(seed,)))

    app = FastAPI()
    app.include_router(providers_router)
    return TestClient(app)


# ── GET 脱敏 ───────────────────────────────────────────────────────────────


def test_get_provider_does_not_leak_api_key(client: TestClient) -> None:
    resp = client.get("/providers/openai_compatible-seed")
    assert resp.status_code == 200
    body = resp.json()
    assert "api_key" not in body, "GET 响应不得包含 api_key 明文"
    assert body["has_api_key"] is True


def test_list_providers_does_not_leak_api_key(client: TestClient) -> None:
    resp = client.get("/providers")
    assert resp.status_code == 200
    for item in resp.json():
        assert "api_key" not in item
        assert "has_api_key" in item


# ── POST 脱敏 ──────────────────────────────────────────────────────────────


def test_create_provider_does_not_leak_api_key(client: TestClient) -> None:
    resp = client.post(
        "/providers",
        json={
            "name": "NewCo",
            "kind": "openai_compatible",
            "api_key": "sk-new-secret",
            "base_url": "https://newco.test/v1",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "api_key" not in body
    assert body["has_api_key"] is True
    assert body["name"] == "NewCo"


# ── PUT api_key 语义修订（D10） ────────────────────────────────────────────


def test_put_empty_string_api_key_keeps_original(client: TestClient) -> None:
    """api_key == '' 视为不修改，沿用原值。"""
    resp = client.put(
        "/providers/openai_compatible-seed",
        json={"api_key": "", "base_url": "https://changed.test/v1"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "api_key" not in body  # 响应仍脱敏
    assert body["has_api_key"] is True
    assert body["base_url"] == "https://changed.test/v1"

    # 实际落盘的 api_key 必须仍为原值
    settings = load_settings()
    profile = next(p for p in settings.providers if p.id == "openai_compatible-seed")
    assert profile.api_key == "sk-original"
    assert profile.base_url == "https://changed.test/v1"


def test_put_non_empty_api_key_overrides(client: TestClient) -> None:
    resp = client.put(
        "/providers/openai_compatible-seed",
        json={"api_key": "sk-rotated"},
    )
    assert resp.status_code == 200
    assert resp.json()["has_api_key"] is True

    settings = load_settings()
    profile = next(p for p in settings.providers if p.id == "openai_compatible-seed")
    assert profile.api_key == "sk-rotated"


def test_put_omitted_api_key_keeps_original(client: TestClient) -> None:
    resp = client.put(
        "/providers/openai_compatible-seed",
        json={"enabled": False},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["enabled"] is False

    settings = load_settings()
    profile = next(p for p in settings.providers if p.id == "openai_compatible-seed")
    assert profile.api_key == "sk-original"

