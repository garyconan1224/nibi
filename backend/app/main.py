"""FastAPI backend entrypoint (phase-3 skeleton)."""

from __future__ import annotations

from typing import Dict

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.routes.pipeline import router as pipeline_router
from backend.app.routes.providers import router as providers_router
from backend.app.routes.rag import router as rag_router
from backend.app.routes.transcript import router as transcript_router
from backend.app.routes.notes import router as notes_router

app = FastAPI(title="VidMirror API", version="0.2.0")

# 允许前端开发服务器跨域访问
# 浏览器把 localhost 和 127.0.0.1 视为不同源，两个都要加
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(providers_router)
app.include_router(pipeline_router)
app.include_router(transcript_router)
app.include_router(rag_router)
app.include_router(notes_router)  # 新增：笔记生成API


@app.get("/health")
def health() -> Dict[str, str]:
    """后端健康检查端点"""
    return {"status": "ok"}
