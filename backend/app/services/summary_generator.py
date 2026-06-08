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
    # video/audio 的 transcript 是 list[{t_sec, t_str, text}]，拼成纯文本
    if isinstance(transcript, list):
        transcript = " ".join(
            seg.get("text", "") for seg in transcript if isinstance(seg, dict)
        )
    if not transcript.strip():
        transcript = (item.results or {}).get("content", "")
    if not transcript.strip():
        transcript = (item.results or {}).get("summary", "")

    user_prompt = tpl.user_prompt.format(transcript=transcript)
    if background.strip():
        user_prompt = f"【背景信息】\n{background.strip()}\n\n{user_prompt}"

    return tpl.system_prompt, user_prompt


def _call_llm(
    system_prompt: str,
    user_prompt: str,
    provider_id: str = "",
    model: str = "",
) -> Tuple[str, str]:
    """同步调用 LLM，返回 (content, model_used)。

    provider_id/model 可选覆盖：为空时走默认 profile。
    """
    from src.vidmirror.core.providers import ChatRequest
    from src.vidmirror.core.providers.registry import create_default_registry

    settings = load_settings()
    registry = create_default_registry()

    if provider_id:
        # 用户指定了 provider
        profile = next(
            (p for p in settings.providers if p.id == provider_id and p.enabled),
            None,
        )
        if profile is None:
            raise RuntimeError(f"provider 不存在或未启用: {provider_id}")
    else:
        profile = registry.resolve_default_profile(settings, "chat")

    provider = registry.build(profile)
    chat_model = model.strip() if model else str(
        profile.default_models.get("chat") or ""
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
    provider_id: str = "",
    model: str = "",
    search_web: bool = False,
) -> ItemSummary:
    """生成一份总结并返回 ItemSummary（不负责持久化）。

    search_web=True 时，先用内容关键词联网搜索，结果拼入 prompt。
    """
    # ── 联网搜索（可选） ──────────────────────────────────
    search_context = ""
    if search_web:
        from backend.app.services.web_search import (
            format_search_context,
            search_web_context,
        )

        # 用标题/背景/内容前 200 字构造搜索关键词
        title = (item.results or {}).get("title") or ""
        transcript = (item.results or {}).get("transcript", "")
        if isinstance(transcript, list):
            transcript = " ".join(
                seg.get("text", "") for seg in transcript if isinstance(seg, dict)
            )
        query = title or background[:100] or transcript[:200]
        if query.strip():
            search_results = search_web_context(query.strip(), max_results=5)
            search_context = format_search_context(search_results)

    system_prompt, user_prompt = build_prompt(item, template_id, background)

    # 搜索结果拼到 user_prompt 前面
    if search_context:
        user_prompt = f"{search_context}\n\n{user_prompt}"

    content_md, model_used = _call_llm(
        system_prompt, user_prompt,
        provider_id=provider_id, model=model,
    )

    return ItemSummary(
        summary_id=str(uuid.uuid4()),
        template=template_id,
        version=0,  # 调用方负责设置正确 version
        background_for_summary=background,
        content_md=content_md,
        model_used=model_used,
    )
