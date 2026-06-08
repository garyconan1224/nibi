"""总结生成器：构造 prompt → 调 LLM → 返回 ItemSummary。"""

from __future__ import annotations

import json as _json
import logging
import re
import uuid
from pathlib import Path
from typing import Dict, List, Tuple

logger = logging.getLogger(__name__)

from backend.app.models.workspace import ItemSummary, WorkspaceItem
from backend.app.services.summary_templates import get_template
from shared.config import DATA_DIR
from shared.settings_store import load_settings


def build_prompt(
    item: WorkspaceItem,
    template_id: str,
    background: str = "",
) -> Tuple[str, str]:
    """构造 (system_prompt, user_prompt)。

    背景信息拼到 user_prompt 前面作为前置上下文（零侵入模板）。
    standard 模板额外注入「关键帧清单」（若有截帧数据）。
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

    # R3.2: standard 模板注入关键帧清单（若有截帧数据）
    if template_id == "standard":
        frames = _collect_frames(item)
        if frames:
            lines = []
            for f in frames:
                mm = int(f["sec"]) // 60
                ss = int(f["sec"]) % 60
                lines.append(f"[图{f['idx']} @{mm:02d}:{ss:02d}] {f['desc']}")
            frame_list = "\n".join(lines)
            user_prompt = (
                f"{user_prompt}\n\n"
                f"【关键帧清单】\n"
                f"以下是从视频中截取的关键帧及画面描述。在讲到对应内容处用 [[图N]] 插入配图"
                f"（N=帧号），只在画面确实支撑该处讲解时插，不硬塞。\n\n"
                f"{frame_list}"
            )

    if background.strip():
        user_prompt = f"【背景信息】\n{background.strip()}\n\n{user_prompt}"

    return tpl.system_prompt, user_prompt


def _collect_frames(item: WorkspaceItem) -> List[Dict[str, object]]:
    """收集关键帧信息：优先从 results["frames"]，兜底从 json_outputs 文件。"""
    results = item.results or {}

    # 优先：已物化的 frames（路由层 _materialize_video_results_from_analyze 产出）
    raw_frames = results.get("frames") or []
    if raw_frames and isinstance(raw_frames[0], dict) and "description" in raw_frames[0]:
        out = []
        for i, fr in enumerate(raw_frames):
            desc = str(fr.get("description") or fr.get("description_zh") or "").strip()
            if not desc:
                continue
            img = str(fr.get("image_path") or fr.get("frame_image_path") or "")
            sec = float(fr.get("sec") or 0)
            out.append({"idx": i, "sec": sec, "desc": desc[:200], "image_path": img})
        if out:
            return out

    # 兜底：从 json_outputs 文件读取（handle_note_task 存的路径）
    json_paths = results.get("json_outputs") or []
    if not json_paths:
        return []
    out = []
    for jp in json_paths:
        try:
            data = _json.loads(Path(jp).read_text(encoding="utf-8"))
        except Exception:
            continue
        for i, fr in enumerate(data.get("frames", [])):
            desc = str(fr.get("description_zh") or fr.get("description") or "").strip()
            if not desc:
                continue
            ts = str(fr.get("timestamp") or "00:00:00")
            sec = _ts_to_sec(ts)
            # 尝试从 frames/ 目录找对应图片
            img = _find_frame_image(jp, i)
            out.append({"idx": len(out), "sec": sec, "desc": desc[:200], "image_path": img})
    return out


def _ts_to_sec(ts: str) -> float:
    """'00:01:30' → 90.0"""
    parts = ts.split(":")
    try:
        if len(parts) == 3:
            return int(parts[0]) * 3600 + int(parts[1]) * 60 + float(parts[2])
        if len(parts) == 2:
            return int(parts[0]) * 60 + float(parts[1])
        return float(ts)
    except (ValueError, IndexError):
        return 0.0


def _find_frame_image(json_path: str, idx: int) -> str:
    """从 json 同级 frames/ 目录找第 idx 帧图片，返回绝对路径或空串。"""
    jp = Path(json_path)
    frames_dir = jp.parent / "frames"
    if not frames_dir.is_dir():
        return ""
    # 帧图片命名通常为 {json_stem}_frame_{idx:04d}.jpg 或类似
    stem = jp.stem.replace("_视觉数据", "")
    candidates = sorted(frames_dir.glob(f"*{stem}*frame*{idx:04d}*"))
    if not candidates:
        # 退化：按文件名排序取第 idx 个
        all_imgs = sorted(frames_dir.glob("*.jpg")) + sorted(frames_dir.glob("*.png"))
        if idx < len(all_imgs):
            return str(all_imgs[idx])
        return ""
    return str(candidates[0])


def _postprocess_frames(content_md: str, frames: List[Dict[str, object]]) -> str:
    """把 LLM 输出中的 [[图N]] 替换为 ![desc](/static/path)。越界的删掉。"""
    if not frames:
        # 没有帧数据，删掉所有 [[图N]] 引用
        return re.sub(r"\[\[图\d+]\]", "", content_md)

    def _replace(m: re.Match) -> str:
        # [[图N]] → 提取 N
        tag = m.group(0)  # e.g. [[图3]]
        num_str = re.search(r"\d+", tag)
        if not num_str:
            return ""
        n = int(num_str.group())
        if 0 <= n < len(frames):
            fr = frames[n]
            img_path = str(fr.get("image_path") or "")
            desc = str(fr.get("desc") or "")
            # 转 /static/ URL
            static_url = _to_static_url(img_path)
            if static_url:
                return f"![{desc[:60]}]({static_url})"
            return ""  # 图片不存在，删掉引用
        return ""  # 越界，删掉

    return re.sub(r"\[\[图\d+]\]", _replace, content_md)


def _to_static_url(path: str) -> str:
    """本地绝对路径 → /static/... URL。"""
    if not path:
        return ""
    if path.startswith("/static/"):
        return path
    try:
        p = Path(path).resolve()
        data_resolved = DATA_DIR.resolve()
        if str(p).startswith(str(data_resolved)):
            rel = p.relative_to(data_resolved)
            return f"/static/{rel.as_posix()}"
    except (ValueError, OSError):
        pass
    return ""


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
        logger.info("联网搜索上下文已拼入 prompt（%d 字）", len(search_context))

    content_md, model_used = _call_llm(
        system_prompt, user_prompt,
        provider_id=provider_id, model=model,
    )

    # R3.2: standard 模板后处理 — [[图N]] → ![desc](/static/path)
    if template_id == "standard":
        frames = _collect_frames(item)
        content_md = _postprocess_frames(content_md, frames)

    return ItemSummary(
        summary_id=str(uuid.uuid4()),
        template=template_id,
        version=0,  # 调用方负责设置正确 version
        background_for_summary=background,
        content_md=content_md,
        model_used=model_used,
    )
