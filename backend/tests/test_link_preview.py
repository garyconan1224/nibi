"""tests for GET /link-preview"""

from __future__ import annotations

from dataclasses import dataclass
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from backend.app.main import app

client = TestClient(app)


# ── helpers ──────────────────────────────────────────────────────────────


@dataclass
class _FakeMeta:
    title: str = "B站视频标题"
    description: str = "B站视频简介"
    cover_url: str = "https://i0.hdslb.com/cover.jpg"


def _mock_get_meta(url: str) -> _FakeMeta:
    return _FakeMeta()


# ── B 站链接 → source=bili ───────────────────────────────────────────────


@patch("backend.app.routes.link_preview._HAS_BILI", True)
@patch(
    "backend.app.routes.link_preview.BilibiliNoCookieDownloader",
    create=True,
)
@patch(
    "backend.app.routes.link_preview.extract_bvid_from_url",
    return_value="BV1xx411c7mD",
)
def test_bili(mock_bvid, mock_dl_cls):
    mock_dl = MagicMock()
    mock_dl.get_meta.return_value = _FakeMeta()
    mock_dl_cls.return_value = mock_dl

    resp = client.get(
        "/link-preview",
        params={"url": "https://www.bilibili.com/video/BV1xx411c7mD"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["source"] == "bili"
    assert body["title"] == "B站视频标题"
    assert body["description"] == "B站视频简介"
    assert "hdslb.com" in body["image_url"]


# ── 通用网页 og → source=og ─────────────────────────────────────────────


_OG_HTML = """<!DOCTYPE html>
<html>
<head>
  <meta property="og:title" content="OG标题">
  <meta property="og:description" content="OG描述">
  <meta property="og:image" content="https://example.com/img.jpg">
</head>
<body></body>
</html>"""


@patch("backend.app.routes.link_preview._HAS_BILI", False)
@patch("httpx.AsyncClient.get")
def test_og(mock_get):
    mock_resp = MagicMock()
    mock_resp.text = _OG_HTML
    mock_resp.status_code = 200
    mock_resp.raise_for_status = MagicMock()
    mock_get.return_value = mock_resp

    resp = client.get("/link-preview", params={"url": "https://example.com/article"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["source"] == "og"
    assert body["title"] == "OG标题"
    assert body["description"] == "OG描述"
    assert body["image_url"] == "https://example.com/img.jpg"


# ── 抓取失败 → source=fallback ──────────────────────────────────────────


@patch("backend.app.routes.link_preview._HAS_BILI", False)
@patch("httpx.AsyncClient.get", side_effect=Exception("timeout"))
def test_fallback(mock_get):
    resp = client.get("/link-preview", params={"url": "https://bad.example.com"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["source"] == "fallback"
    assert body["title"] is None
    assert body["description"] is None
    assert body["image_url"] is None


# ── 空 url → 400 ────────────────────────────────────────────────────────


def test_empty_url():
    resp = client.get("/link-preview", params={"url": ""})
    assert resp.status_code == 400
