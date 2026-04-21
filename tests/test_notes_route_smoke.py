"""backend/app/routes/notes.py 最小 smoke 测试。

- 验证模块可 import 且暴露 APIRouter
- 用 FastAPI TestClient 访问 ``GET /api/provider/list`` 确认 200 OK
  且响应为 ``{code, msg, data}`` 三字段的 BiliNote 兼容结构。
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient


def test_notes_module_imports() -> None:
    """notes 模块可 import，且导出一个可挂载的 router。"""
    from backend.app.routes import notes

    assert hasattr(notes, "router")
    # FastAPI APIRouter 的最小契约：带 routes 列表
    assert hasattr(notes.router, "routes")
    assert len(notes.router.routes) > 0


def test_provider_list_endpoint_returns_200() -> None:
    """/api/provider/list 可被调用，返回 200 且符合 BiliNote 响应封装。"""
    from backend.app.routes.notes import router as notes_router

    # 用一个独立 FastAPI 实例，避免连带启动 main.py 的 lifespan/seed 逻辑
    app = FastAPI()
    app.include_router(notes_router)

    client = TestClient(app)
    resp = client.get("/api/provider/list")

    assert resp.status_code == 200
    body = resp.json()
    # BiliNote 统一响应契约：{code, msg, data}
    assert set(body.keys()) == {"code", "msg", "data"}
    assert body["code"] == 0
    assert "providers" in body["data"]
    assert isinstance(body["data"]["providers"], list)

