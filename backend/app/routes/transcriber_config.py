from __future__ import annotations

"""Transcriber (ASR) 配置端点。

冻结契约见 docs/DESIGN_NOTES_SETTINGS.md §3.4：
- GET  /transcriber_config 回显当前 AppSettings.transcriber
- POST /transcriber_config 写入 AppSettings.transcriber 并回显
"""

from dataclasses import asdict, replace
from typing import Any, Dict, Literal, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from shared.settings_store import (
    TranscriberConfig,
    TranscriberType,
    load_settings,
    save_settings,
)

router = APIRouter(tags=["transcriber"])

# 与 shared.settings_store._ALLOWED_TRANSCRIBER_TYPES 保持一致
_ALLOWED_TYPES: tuple[str, ...] = (
    "fast-whisper",
    "bcut",
    "kuaishou",
    "groq",
    "mlx-whisper",
)


class TranscriberConfigUpdateRequest(BaseModel):
    """POST /transcriber_config 请求体。

    全部字段可选：缺省则沿用现值；空串视为清空字符串字段。
    """

    type: Optional[Literal["fast-whisper", "bcut", "kuaishou", "groq", "mlx-whisper"]] = Field(
        default=None,
        description="转写引擎类型；传入值不在白名单时 422",
    )
    whisper_model_size: Optional[str] = None
    language: Optional[str] = None
    device: Optional[str] = None
    groq_api_key: Optional[str] = None
    initial_prompt: Optional[str] = None


def _serialize(cfg: TranscriberConfig) -> Dict[str, Any]:
    return asdict(cfg)


@router.get("/transcriber_config")
def get_transcriber_config() -> Dict[str, Any]:
    """回显当前转写器配置。"""
    settings = load_settings()
    return _serialize(settings.transcriber)


@router.post("/transcriber_config")
def update_transcriber_config(req: TranscriberConfigUpdateRequest) -> Dict[str, Any]:
    """写入转写器配置并回显。

    字段级语义：
    - 为 ``None``（未传）→ 保留旧值；
    - 非 ``None`` → 覆盖为新值（含空串，用于清空可选字符串字段如 ``groq_api_key``/``initial_prompt``）。
    """
    settings = load_settings()
    current = settings.transcriber

    next_type: TranscriberType = current.type
    if req.type is not None:
        # pydantic 已通过 Literal 校验白名单，这里仅显式断言
        assert req.type in _ALLOWED_TYPES
        next_type = req.type

    new_cfg = TranscriberConfig(
        type=next_type,
        whisper_model_size=req.whisper_model_size if req.whisper_model_size is not None else current.whisper_model_size,
        language=req.language if req.language is not None else current.language,
        device=req.device if req.device is not None else current.device,
        groq_api_key=req.groq_api_key if req.groq_api_key is not None else current.groq_api_key,
        initial_prompt=req.initial_prompt if req.initial_prompt is not None else current.initial_prompt,
    )

    save_settings(replace(settings, transcriber=new_cfg))
    return _serialize(new_cfg)

