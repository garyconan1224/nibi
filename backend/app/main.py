"""FastAPI backend entrypoint (phase-3 skeleton)."""

from __future__ import annotations

import os
import time
from contextlib import asynccontextmanager
from dataclasses import replace
from pathlib import Path
from typing import Any, Dict

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.routes.admin import router as admin_router
from backend.app.routes.download_config import router as download_config_router
from backend.app.routes.pipeline import router as pipeline_router
from backend.app.routes.providers import router as providers_router
from backend.app.routes.rag import router as rag_router
from backend.app.routes.transcriber_config import router as transcriber_config_router
from backend.app.routes.transcript import router as transcript_router
from backend.app.routes.notes import router as notes_router
from shared.settings_store import ProviderProfile, load_settings, save_settings

# 应用启动时间（UTC 时间戳），用于计算 uptime
_APP_START_TS: float = time.time()
# 应用版本号；与 FastAPI title/version 保持一致，供 /health 回显
_APP_VERSION: str = "0.2.0"

# 项目根目录（backend/app/main.py → backend/app → backend → root）
_ROOT_DIR: Path = Path(__file__).resolve().parent.parent.parent


def _seed_siliconflow_provider() -> None:
    """若 .env 含 SILICONFLOW_API_KEY 且存储中还没有该 provider，则自动创建。"""
    load_dotenv(_ROOT_DIR / ".env", override=False)
    api_key = os.getenv("SILICONFLOW_API_KEY", "").strip()
    if not api_key:
        return

    settings = load_settings()
    # 已存在同名 provider 则跳过
    if any(p.name == "SiliconFlow" for p in settings.providers):
        print("ℹ️  SiliconFlow provider already exists, skipping seed.")
        return

    base_url = os.getenv("SILICONFLOW_BASE_URL", "https://api.siliconflow.cn/v1").strip()
    new_profile = ProviderProfile(
        id="openai_compatible-siliconflow",
        name="SiliconFlow",
        kind="openai_compatible",
        enabled=True,
        api_key=api_key,
        base_url=base_url,
        capabilities=("chat", "vision"),
        default_models={},
        rate_limit_rpm=60,
        timeout_sec=120,
    )
    new_providers = settings.providers + (new_profile,)
    new_settings = replace(settings, providers=new_providers)
    save_settings(new_settings)
    print(f"✅ Seeded SiliconFlow provider (base_url={base_url})")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI 生命周期钩子：启动时自动 seed 默认 provider。"""
    _seed_siliconflow_provider()
    yield


app = FastAPI(title="VidMirror API", version=_APP_VERSION, lifespan=lifespan)

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
app.include_router(transcriber_config_router)
app.include_router(download_config_router)
app.include_router(rag_router)
app.include_router(notes_router)
app.include_router(admin_router)


@app.get("/health")
def health() -> Dict[str, Any]:
    """后端健康检查端点（M4 扩展）。

    返回结构：
        status:     "healthy" 固定字面量（进入此函数即视为健康）
        version:    应用版本号（与 FastAPI 实例 version 一致）
        uptime_sec: 应用已运行秒数（浮点，保留两位小数）
    """
    return {
        "status": "healthy",
        "version": _APP_VERSION,
        "uptime_sec": round(time.time() - _APP_START_TS, 2),
    }
