"""Provider management endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from shared.settings_store import load_settings
from src.video_pipeline_studio.core.providers.registry import create_default_registry

router = APIRouter(prefix="/providers", tags=["providers"])


class ProviderTestRequest(BaseModel):
    provider_id: str


@router.get("")
def list_providers() -> list[dict[str, object]]:
    settings = load_settings()
    out: list[dict[str, object]] = []
    for p in settings.providers:
        out.append(
            {
                "id": p.id,
                "name": p.name,
                "kind": p.kind,
                "enabled": p.enabled,
                "capabilities": list(p.capabilities),
                "base_url": p.base_url,
                "has_api_key": bool(p.api_key.strip()),
            }
        )
    return out


@router.post("/test")
def test_provider(req: ProviderTestRequest) -> dict[str, str]:
    settings = load_settings()
    profile = next((p for p in settings.providers if p.id == req.provider_id), None)
    if profile is None:
        raise HTTPException(status_code=404, detail=f"provider not found: {req.provider_id}")
    try:
        provider = create_default_registry().build(profile)
        message = provider.test_connection()
        return {"status": "ok", "message": message}
    except Exception as err:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(err)) from err
