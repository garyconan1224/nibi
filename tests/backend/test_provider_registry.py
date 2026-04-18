from shared.settings_store import AppSettings, ProviderProfile
from src.vidmirror.core.providers.registry import create_default_registry


def test_registry_resolves_default_chat_provider() -> None:
    settings = AppSettings(
        providers=(
            ProviderProfile(
                id="openai-main",
                name="OpenAI Main",
                kind="openai_compatible",
                enabled=True,
                api_key="k-openai",
                capabilities=("chat", "embedding"),
            ),
            ProviderProfile(
                id="anthropic-main",
                name="Anthropic Main",
                kind="anthropic",
                enabled=True,
                api_key="k-anthropic",
                capabilities=("chat",),
            ),
        ),
        default_provider_for_chat="anthropic-main",
    )
    registry = create_default_registry()
    p = registry.resolve_default_profile(settings, "chat")
    assert p.id == "anthropic-main"
    provider = registry.build(p)
    assert provider.provider_id == "anthropic-main"
