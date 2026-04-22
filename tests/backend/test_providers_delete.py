"""DELETE /providers/{id} 幂等契约测试（SETTINGS_REPLICA_PLAN.md §3.2 M1）。

覆盖：
- 存在的 provider → 200 + {"code": 0}，落盘中确实移除；
- 不存在的 provider → 同样 200 + {"code": 0}（幂等），不抛 404；
- 多 provider 情况下仅删除目标，不误伤其他条目。
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

    seeds = (
        ProviderProfile(
            id="openai_compatible-alpha",
            name="Alpha",
            kind="openai_compatible",
            enabled=True,
            api_key="sk-alpha",
            base_url="https://alpha.test/v1",
            capabilities=("chat",),
        ),
        ProviderProfile(
            id="openai_compatible-beta",
            name="Beta",
            kind="openai_compatible",
            enabled=True,
            api_key="sk-beta",
            base_url="https://beta.test/v1",
            capabilities=("chat",),
        ),
    )
    save_settings(replace(AppSettings(), providers=seeds))

    app = FastAPI()
    app.include_router(providers_router)
    return TestClient(app)


def test_delete_existing_provider_returns_code_zero(client: TestClient) -> None:
    resp = client.delete("/providers/openai_compatible-alpha")
    assert resp.status_code == 200
    assert resp.json() == {"code": 0}

    # 落盘验证：alpha 被移除，beta 保留
    settings = load_settings()
    ids = {p.id for p in settings.providers}
    assert "openai_compatible-alpha" not in ids
    assert "openai_compatible-beta" in ids


def test_delete_missing_provider_is_idempotent(client: TestClient) -> None:
    """幂等契约：不存在的 id 也返回 {"code": 0}，不得抛 404。"""
    resp = client.delete("/providers/does-not-exist")
    assert resp.status_code == 200
    assert resp.json() == {"code": 0}

    # 既有 provider 不受影响
    settings = load_settings()
    ids = {p.id for p in settings.providers}
    assert ids == {"openai_compatible-alpha", "openai_compatible-beta"}


def test_delete_twice_is_idempotent(client: TestClient) -> None:
    """连续两次删除同一 id：第二次仍返回成功，不抖动。"""
    first = client.delete("/providers/openai_compatible-alpha")
    second = client.delete("/providers/openai_compatible-alpha")
    assert first.status_code == 200 and first.json() == {"code": 0}
    assert second.status_code == 200 and second.json() == {"code": 0}

    settings = load_settings()
    assert all(p.id != "openai_compatible-alpha" for p in settings.providers)

