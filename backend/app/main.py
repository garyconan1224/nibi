"""FastAPI backend entrypoint (phase-3 skeleton)."""

from __future__ import annotations

from fastapi import FastAPI

from backend.app.routes.pipeline import router as pipeline_router
from backend.app.routes.providers import router as providers_router
from backend.app.routes.rag import router as rag_router
from backend.app.routes.transcript import router as transcript_router
from backend.app.routes.notes import router as notes_router

app = FastAPI(title="Video Pipeline Studio API", version="0.2.0")
app.include_router(providers_router)
app.include_router(pipeline_router)
app.include_router(transcript_router)
app.include_router(rag_router)
app.include_router(notes_router)  # 新增：笔记生成API


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
