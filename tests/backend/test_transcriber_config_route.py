"""`GET/POST /transcriber_config` 路由冻结契约测试。

覆盖：
- GET 缺省回显 TranscriberConfig 默认值；
- POST 全量字段写入后回显一致，并持久化至 AppSettings.transcriber；
- POST 仅传部分字段时沿用旧值（None → 保留语义）；
- POST 非法 type 返回 422；
- TranscriberConfig dataclass 行为：frozen + from_dict 白名单兜底。
"""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.app.routes.transcriber_config import router as transcriber_router
from shared import settings_store
from shared.settings_store import TranscriberConfig, load_settings


@pytest.fixture()
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    """隔离的 TestClient：settings.json 指向 tmp_path，避免污染真实配置。"""
    monkeypatch.setattr(settings_store, "SETTINGS_DIR", tmp_path)
    monkeypatch.setattr(settings_store, "SETTINGS_PATH", tmp_path / "settings.json")

    app = FastAPI()
    app.include_router(transcriber_router)
    return TestClient(app)


# ── TranscriberConfig dataclass 行为 ─────────────────────────────────────────


def test_transcriber_config_is_frozen_dataclass() -> None:
    cfg = TranscriberConfig()
    with pytest.raises((AttributeError, Exception)):
        cfg.type = "groq"  # type: ignore[misc]


def test_transcriber_config_from_dict_whitelist_fallback() -> None:
    # 非法 type 回落为 'fast-whisper'
    cfg = TranscriberConfig.from_dict({"type": "malicious-engine"})
    assert cfg.type == "fast-whisper"

    # None / 非 dict 容错
    assert TranscriberConfig.from_dict(None).type == "fast-whisper"
    assert TranscriberConfig.from_dict("not-a-dict").language == "zh"


# ── GET /transcriber_config ────────────────────────────────────────────────


def test_get_returns_defaults_when_no_settings(client: TestClient) -> None:
    resp = client.get("/transcriber_config")
    assert resp.status_code == 200
    body = resp.json()
    assert body == {
        "type": "fast-whisper",
        "whisper_model_size": "medium",
        "language": "zh",
        "device": "cpu",
        "groq_api_key": "",
        "initial_prompt": "",
    }


# ── POST /transcriber_config ───────────────────────────────────────────────


def test_post_persists_full_payload(client: TestClient) -> None:
    payload = {
        "type": "groq",
        "whisper_model_size": "large-v3",
        "language": "en",
        "device": "cuda",
        "groq_api_key": "gsk_test",
        "initial_prompt": "专有名词：VidMirror",
    }
    resp = client.post("/transcriber_config", json=payload)
    assert resp.status_code == 200
    assert resp.json() == payload

    # 再次 GET 必须回显相同
    again = client.get("/transcriber_config").json()
    assert again == payload

    # 落盘到 AppSettings.transcriber
    settings = load_settings()
    assert settings.transcriber.type == "groq"
    assert settings.transcriber.groq_api_key == "gsk_test"


def test_post_partial_payload_preserves_untouched_fields(client: TestClient) -> None:
    # 先写一份完整配置
    client.post(
        "/transcriber_config",
        json={
            "type": "groq",
            "whisper_model_size": "large-v3",
            "language": "en",
            "device": "cuda",
            "groq_api_key": "gsk_keep",
            "initial_prompt": "keep me",
        },
    )
    # 仅修改 language，其余字段应沿用
    resp = client.post("/transcriber_config", json={"language": "ja"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["language"] == "ja"
    assert body["type"] == "groq"
    assert body["groq_api_key"] == "gsk_keep"
    assert body["initial_prompt"] == "keep me"


def test_post_rejects_invalid_type(client: TestClient) -> None:
    resp = client.post("/transcriber_config", json={"type": "deepspeech"})
    assert resp.status_code == 422


def test_post_empty_string_clears_optional_fields(client: TestClient) -> None:
    client.post(
        "/transcriber_config",
        json={"groq_api_key": "gsk_old", "initial_prompt": "old"},
    )
    resp = client.post("/transcriber_config", json={"groq_api_key": "", "initial_prompt": ""})
    assert resp.status_code == 200
    body = resp.json()
    # 契约：非 None 即覆盖，空串用于显式清空
    assert body["groq_api_key"] == ""
    assert body["initial_prompt"] == ""

