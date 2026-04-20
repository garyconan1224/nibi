from __future__ import annotations

"""Provider management endpoints."""

from dataclasses import asdict, replace
from typing import Any, Dict, List

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from shared.settings_store import load_settings, save_settings, ProviderProfile
from src.vidmirror.core.providers.registry import create_default_registry

router = APIRouter(prefix="/providers", tags=["providers"])


class ProviderTestRequest(BaseModel):
    provider_id: str


class ProviderCreateRequest(BaseModel):
    name: str
    kind: str
    api_key: str = ""
    base_url: str = ""


class ProviderUpdateRequest(BaseModel):
    api_key: str | None = None
    base_url: str | None = None
    enabled: bool | None = None
    default_models: dict[str, str] | None = None


@router.get("")
def list_providers() -> list[Dict[str, Any]]:
    """获取所有配置的提供商列表"""
    settings = load_settings()
    out: list = []
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


@router.get("/{provider_id}/models")
async def get_provider_models(provider_id: str) -> Dict[str, Any]:
    """调用上游 {base_url}/models 获取该 provider 支持的模型列表。
    返回格式: {"models": [{"id": "...", "name": "..."}]}
    失败时返回: {"models": [], "error": "错误信息"}，不抛 500。
    """
    settings = load_settings()
    profile = next((p for p in settings.providers if p.id == provider_id), None)
    if profile is None:
        raise HTTPException(status_code=404, detail=f"provider not found: {provider_id}")

    base_url = profile.base_url.rstrip("/") or "https://api.siliconflow.cn/v1"
    url = f"{base_url}/models"
    headers = {"Authorization": f"Bearer {profile.api_key}"}

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            raw = resp.json()
    except Exception as exc:  # noqa: BLE001
        return {"models": [], "error": str(exc)}

    # OpenAI 标准格式: {"data": [{"id": "...", "object": "model", ...}]}
    data_list: list = raw.get("data", []) if isinstance(raw, dict) else []
    models: List[Dict[str, str]] = [
        {"id": item["id"], "name": item.get("name") or item["id"]}
        for item in data_list
        if isinstance(item, dict) and item.get("id")
    ]
    return {"models": models}


@router.get("/{provider_id}")
def get_provider(provider_id: str) -> Dict[str, Any]:
    """获取单个提供商完整信息（含 api_key）"""
    settings = load_settings()
    profile = next((p for p in settings.providers if p.id == provider_id), None)
    if profile is None:
        raise HTTPException(status_code=404, detail=f"provider not found: {provider_id}")
    return {
        "id": profile.id,
        "name": profile.name,
        "kind": profile.kind,
        "enabled": profile.enabled,
        "capabilities": list(profile.capabilities),
        "base_url": profile.base_url,
        "api_key": profile.api_key,
        "has_api_key": bool(profile.api_key.strip()),
        "default_models": profile.default_models,
        "rate_limit_rpm": profile.rate_limit_rpm,
        "timeout_sec": profile.timeout_sec,
    }


@router.post("/test")
def test_provider(req: ProviderTestRequest) -> Dict[str, str]:
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


@router.put("/{provider_id}")
def update_provider(provider_id: str, req: ProviderUpdateRequest) -> Dict[str, Any]:
    """更新提供商配置"""
    settings = load_settings()
    profile = next((p for p in settings.providers if p.id == provider_id), None)
    if profile is None:
        raise HTTPException(status_code=404, detail=f"provider not found: {provider_id}")

    # 更新字段（因为 ProviderProfile 是 frozen dataclass，需要重新构造）
    profile_dict = asdict(profile)
    if req.api_key is not None:
        profile_dict["api_key"] = req.api_key
    if req.base_url is not None:
        profile_dict["base_url"] = req.base_url
    if req.enabled is not None:
        profile_dict["enabled"] = req.enabled
    if req.default_models is not None:
        profile_dict["default_models"] = req.default_models

    new_profile = ProviderProfile.from_dict(profile_dict)

    # 更新 settings 中的 providers
    new_providers = tuple(
        new_profile if p.id == provider_id else p for p in settings.providers
    )

    # 保存设置
    new_settings = replace(settings, providers=new_providers)
    save_settings(new_settings)

    return {
        "id": new_profile.id,
        "name": new_profile.name,
        "kind": new_profile.kind,
        "enabled": new_profile.enabled,
        "capabilities": list(new_profile.capabilities),
        "base_url": new_profile.base_url,
        "api_key": new_profile.api_key,
        "has_api_key": bool(new_profile.api_key.strip()),
        "default_models": new_profile.default_models,
    }


@router.post("")
def create_provider(req: ProviderCreateRequest) -> Dict[str, Any]:
    """新增提供商"""
    settings = load_settings()

    # 生成唯一 id
    base_id = f"{req.kind}-{req.name.lower().replace(' ', '-')}"
    provider_id = base_id
    counter = 1
    while any(p.id == provider_id for p in settings.providers):
        provider_id = f"{base_id}-{counter}"
        counter += 1

    # 创建新的 ProviderProfile
    new_profile = ProviderProfile(
        id=provider_id,
        name=req.name,
        kind=req.kind if req.kind in ("openai_compatible", "anthropic") else "openai_compatible",
        enabled=True,
        api_key=req.api_key,
        base_url=req.base_url,
        capabilities=("chat",),
        default_models={},
        rate_limit_rpm=60,
        timeout_sec=120,
    )

    # 添加到 settings
    new_providers = settings.providers + (new_profile,)
    new_settings = replace(settings, providers=new_providers)
    save_settings(new_settings)

    return {
        "id": new_profile.id,
        "name": new_profile.name,
        "kind": new_profile.kind,
        "enabled": new_profile.enabled,
        "capabilities": list(new_profile.capabilities),
        "base_url": new_profile.base_url,
        "api_key": new_profile.api_key,
        "has_api_key": bool(new_profile.api_key.strip()),
        "default_models": new_profile.default_models,
    }
