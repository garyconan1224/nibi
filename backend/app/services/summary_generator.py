"""总结生成器：构造 prompt → 调 LLM → 返回 ItemSummary。"""

from __future__ import annotations

import uuid
from typing import Tuple

from backend.app.models.workspace import ItemSummary, WorkspaceItem
from backend.app.services.summary_templates import get_template
from shared.settings_store import load_settings


def build_prompt(
    item: WorkspaceItem,
    template_id: str,
    background: str = "",
) -> Tuple[str, str]:
    """构造 (system_prompt, user_prompt)。

    背景信息拼到 user_prompt 前面作为前置上下文（零侵入模板）。
    """
    tpl = get_template(template_id)
    transcript = (item.results or {}).get("transcript", "")
    if not transcript.strip():
        transcript = (item.results or {}).get("summary", "")

    user_prompt = tpl.user_prompt.format(transcript=transcript)
    if background.strip():
        user_prompt = f"【背景信息】\n{background.strip()}\n\n{user_prompt}"

    return tpl.system_prompt, user_prompt


def _call_llm(system_prompt: str, user_prompt: str) -> Tuple[str, str]:
    """同步调用 LLM，返回 (content, model_used)。"""
    from src.vidmirror.core.providers import ChatRequest
    from src.vidmirror.core.providers.registry import create_default_registry

    settings = load_settings()
    registry = create_default_registry()
    profile = registry.resolve_default_profile(settings, "chat")
    provider = registry.build(profile)
    chat_model = str(
        getattr(profile.default_models, "chat", None) or ""
    ).strip()
    if not chat_model:
        raise RuntimeError("未配置 chat model")

    text = provider.chat(ChatRequest(
        model=chat_model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.3,
        max_tokens=4000,
    ))
    model_used = f"{profile.id}/{chat_model}"
    return text, model_used


def generate_summary(
    item: WorkspaceItem,
    template_id: str,
    background: str = "",
) -> ItemSummary:
    """生成一份总结并返回 ItemSummary（不负责持久化）。"""
    system_prompt, user_prompt = build_prompt(item, template_id, background)
    content_md, model_used = _call_llm(system_prompt, user_prompt)

    return ItemSummary(
        summary_id=str(uuid.uuid4()),
        template=template_id,
        version=1,  # 调用方负责设置正确 version
        background_for_summary=background,
        content_md=content_md,
        model_used=model_used,
    )
