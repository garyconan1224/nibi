"""
应用设置持久化（本地文件，不入库）。

用途：
- 统一保存 API 与后端配置；
- 启动后自动加载，避免重复输入；
- 提供清空能力用于发布前安全检查。
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Literal

TEXT_BACKEND_OPENAI_COMPAT: str = "openai_compatible"
ROOT_DIR: Path = Path(__file__).resolve().parent.parent

SETTINGS_DIR: Path = ROOT_DIR / ".local"
SETTINGS_PATH: Path = SETTINGS_DIR / "settings.json"

ProviderKind = Literal["openai_compatible", "anthropic"]
ProviderCapability = Literal["chat", "vision", "embedding", "rerank"]


@dataclass(frozen=True)
class ProviderProfile:
    id: str
    name: str
    kind: ProviderKind
    enabled: bool = True
    api_key: str = ""
    base_url: str = ""
    capabilities: tuple[ProviderCapability, ...] = ("chat",)
    default_models: dict[str, str] = field(default_factory=dict)
    rate_limit_rpm: int = 60
    timeout_sec: int = 120

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "ProviderProfile":
        cap_raw = data.get("capabilities") or ["chat"]
        caps: list[ProviderCapability] = []
        if isinstance(cap_raw, list):
            for c in cap_raw:
                s = str(c or "").strip().lower()
                if s in ("chat", "vision", "embedding", "rerank") and s not in caps:
                    caps.append(s)  # type: ignore[arg-type]
        if not caps:
            caps = ["chat"]

        kind_raw = str(data.get("kind") or "openai_compatible").strip().lower()
        kind: ProviderKind = "anthropic" if kind_raw == "anthropic" else "openai_compatible"
        default_models_raw = data.get("default_models") or {}
        default_models: dict[str, str] = {}
        if isinstance(default_models_raw, dict):
            for k, v in default_models_raw.items():
                key = str(k or "").strip()
                val = str(v or "").strip()
                if key and val:
                    default_models[key] = val

        pid = str(data.get("id") or "").strip() or f"{kind}-profile"
        return cls(
            id=pid,
            name=str(data.get("name") or pid),
            kind=kind,
            enabled=bool(data.get("enabled", True)),
            api_key=str(data.get("api_key") or ""),
            base_url=str(data.get("base_url") or ""),
            capabilities=tuple(caps),
            default_models=default_models,
            rate_limit_rpm=max(1, int(data.get("rate_limit_rpm") or 60)),
            timeout_sec=max(10, int(data.get("timeout_sec") or 120)),
        )


@dataclass(frozen=True)
class AppSettings:
    openai_api_key: str = ""
    openai_base_url: str = ""
    anthropic_api_key: str = ""
    anthropic_base_url: str = ""
    text_backend: str = TEXT_BACKEND_OPENAI_COMPAT
    text_model: str = ""
    vision_model: str = ""
    embedding_model: str = ""
    anthropic_model: str = ""
    providers: tuple[ProviderProfile, ...] = ()
    default_provider_for_chat: str = ""
    default_provider_for_vision: str = ""
    default_provider_for_embedding: str = ""
    default_provider_for_rerank: str = ""

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "AppSettings":
        providers = _parse_providers_with_migration(data)
        defaults = _default_provider_ids_from_profiles(providers)
        return cls(
            openai_api_key=str(data.get("openai_api_key") or ""),
            openai_base_url=str(data.get("openai_base_url") or ""),
            anthropic_api_key=str(data.get("anthropic_api_key") or ""),
            anthropic_base_url=str(data.get("anthropic_base_url") or ""),
            text_backend=str(data.get("text_backend") or TEXT_BACKEND_OPENAI_COMPAT),
            text_model=str(data.get("text_model") or ""),
            vision_model=str(data.get("vision_model") or ""),
            embedding_model=str(data.get("embedding_model") or ""),
            anthropic_model=str(data.get("anthropic_model") or ""),
            providers=providers,
            default_provider_for_chat=str(data.get("default_provider_for_chat") or defaults.get("chat") or ""),
            default_provider_for_vision=str(data.get("default_provider_for_vision") or defaults.get("vision") or ""),
            default_provider_for_embedding=str(data.get("default_provider_for_embedding") or defaults.get("embedding") or ""),
            default_provider_for_rerank=str(data.get("default_provider_for_rerank") or defaults.get("rerank") or ""),
        )


def load_settings() -> AppSettings:
    if not SETTINGS_PATH.is_file():
        return AppSettings()
    try:
        raw = SETTINGS_PATH.read_text(encoding="utf-8")
        data = json.loads(raw)
    except Exception:
        return AppSettings()
    if not isinstance(data, dict):
        return AppSettings()
    return AppSettings.from_dict(data)


def save_settings(settings: AppSettings) -> None:
    SETTINGS_DIR.mkdir(parents=True, exist_ok=True)
    payload = asdict(settings)
    payload["providers"] = [asdict(p) for p in settings.providers]
    SETTINGS_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def clear_settings() -> None:
    if SETTINGS_PATH.exists():
        SETTINGS_PATH.unlink()


def _parse_providers_with_migration(data: dict[str, Any]) -> tuple[ProviderProfile, ...]:
    raw = data.get("providers")
    out: list[ProviderProfile] = []
    if isinstance(raw, list):
        for item in raw:
            if not isinstance(item, dict):
                continue
            out.append(ProviderProfile.from_dict(item))
    if out:
        return tuple(out)

    # backward-compatible migration from legacy single-provider fields
    openai_provider = ProviderProfile(
        id="openai-default",
        name="OpenAI Compatible (Default)",
        kind="openai_compatible",
        enabled=True,
        api_key=str(data.get("openai_api_key") or ""),
        base_url=str(data.get("openai_base_url") or ""),
        capabilities=("chat", "vision", "embedding", "rerank"),
        default_models={
            "chat": str(data.get("text_model") or ""),
            "vision": str(data.get("vision_model") or ""),
            "embedding": str(data.get("embedding_model") or ""),
        },
        rate_limit_rpm=60,
        timeout_sec=120,
    )
    anthropic_provider = ProviderProfile(
        id="anthropic-default",
        name="Anthropic (Default)",
        kind="anthropic",
        enabled=True,
        api_key=str(data.get("anthropic_api_key") or ""),
        base_url=str(data.get("anthropic_base_url") or ""),
        capabilities=("chat",),
        default_models={"chat": str(data.get("anthropic_model") or "")},
        rate_limit_rpm=60,
        timeout_sec=120,
    )
    return (openai_provider, anthropic_provider)


def _default_provider_ids_from_profiles(providers: tuple[ProviderProfile, ...]) -> dict[str, str]:
    result = {"chat": "", "vision": "", "embedding": "", "rerank": ""}
    for cap in ("chat", "vision", "embedding", "rerank"):
        for p in providers:
            if p.enabled and cap in p.capabilities:
                result[cap] = p.id
                break
    return result
