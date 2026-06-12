"""总结生成器：构造 prompt → 调 LLM → 返回 ItemSummary。"""

from __future__ import annotations

import json as _json
import logging
import re
import uuid
from difflib import SequenceMatcher
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
    embed_frames: bool = True,
    max_embed_frames: int = 0,
) -> Tuple[str, str]:
    """构造 (system_prompt, user_prompt)。

    背景信息拼到 user_prompt 前面作为前置上下文（零侵入模板）。
    standard 模板额外注入「关键帧清单」（若有截帧数据）。
    embed_frames=False 时跳过帧注入；max_embed_frames>0 时限制帧数。
    """
    tpl = get_template(template_id)
    raw_transcript = (item.results or {}).get("transcript", "")
    seg_list = raw_transcript if isinstance(raw_transcript, list) else None
    # 纯文本版本：用于字数统计、非 standard 模板，以及无分段时的兜底
    if seg_list is not None:
        plain_text = " ".join(
            seg.get("text", "") for seg in seg_list if isinstance(seg, dict)
        )
    else:
        plain_text = raw_transcript
    if not plain_text.strip():
        plain_text = (item.results or {}).get("content", "")
    if not plain_text.strip():
        plain_text = (item.results or {}).get("summary", "")

    # standard 额外用「[mm:ss] 文字」分段版本喂 LLM，使其能在 ## 章节标题后标注
    # 真实时间戳；其他模板维持纯文本，零影响。
    if template_id == "standard" and seg_list:
        parts = []
        for seg in seg_list:
            if not isinstance(seg, dict):
                continue
            text = str(seg.get("text", "")).strip()
            if not text:
                continue
            ts = str(seg.get("t_str") or "").strip()
            if not ts:
                sec = int(float(seg.get("t_sec", 0) or 0))
                ts = f"{sec // 60:02d}:{sec % 60:02d}"
            parts.append(f"[{ts}] {text}")
        transcript = "\n".join(parts) or plain_text
    else:
        transcript = plain_text

    user_prompt = tpl.user_prompt.format(transcript=transcript)

    # R3.6: standard 模板注入「内容画像」元数据（转写字数 + 视频时长）
    if template_id == "standard":
        char_count = len(plain_text)
        # 从 transcript_segments 最后一段的 t_sec 推算视频大致时长
        duration_sec = 0
        raw_seg = (item.results or {}).get("transcript_segments", [])
        if isinstance(raw_seg, list) and raw_seg:
            last_seg = raw_seg[-1]
            if isinstance(last_seg, dict):
                duration_sec = float(last_seg.get("t_sec") or last_seg.get("start") or 0)
        if duration_sec > 0:
            mm, ss = divmod(int(duration_sec), 60)
            duration_str = f"{mm}分{ss}秒" if mm else f"{ss}秒"
        else:
            duration_str = "未知"
        meta = (
            f"【内容画像参考】\n"
            f"- 转写字数：约 {char_count} 字\n"
            f"- 视频时长：约 {duration_str}\n"
        )
        user_prompt = f"{meta}\n{user_prompt}"

    # R3.2: standard 模板注入关键帧清单（若有截帧数据）
    # R3.11: embed_frames=False 时跳过
    # R3.16: max_embed_frames=0 不再表示「无限」（那会把所有帧塞进 prompt → 图太多），
    #        改为按时长自适应封顶；_collect_frames 已过价值闸门+去重，再按 cap 均匀采样。
    if template_id == "standard" and embed_frames:
        frames = _collect_frames(item)  # 已过价值闸门 + 去重，idx 连续
        cap = max_embed_frames if max_embed_frames > 0 else _adaptive_frame_cap(
            duration_sec, len(frames)
        )
        if cap > 0 and len(frames) > cap:
            frames = _evenly_sample_frames(frames, cap)
        if frames:
            lines = []
            for f in frames:
                mm = int(f["sec"]) // 60
                ss = int(f["sec"]) % 60
                lines.append(f"[图{f['idx']} @{mm:02d}:{ss:02d}] {f['desc']}")
            frame_list = "\n".join(lines)
            user_prompt = (
                f"{user_prompt}\n\n"
                f"【关键帧清单】（已剔除过渡/重复画面，共 {len(frames)} 张候选）\n"
                f"以下是从视频中精选的画面。**配图原则**：\n"
                f"- ✅ **应该配图**：演示操作、代码展示、UI界面、数据图表、关键步骤、对比示例、重要结论\n"
                f"- ❌ **不要配图**：纯口播、过渡画面、与正文重复、无信息画面\n\n"
                f"使用 `[[图N]]` 插入配图（N=帧号），整篇可只配几张甚至不配。\n\n"
                f"{frame_list}"
            )

    if background.strip():
        user_prompt = f"【背景信息】\n{background.strip()}\n\n{user_prompt}"

    return tpl.system_prompt, user_prompt


# ── 智能配图：价值闸门 + 去重 + 自适应限量（治「图太多 / 不够智能」）──────
# 低信息画面描述（价值闸门）：这些帧对理解无帮助，不进配图候选。
_LOW_VALUE_FRAME_DESCS = {
    "纯色过渡帧", "纯色画面", "过渡帧", "黑屏", "黑场", "纯黑画面",
    "白屏", "白场", "无画面内容", "无内容", "画面模糊", "模糊画面",
}


def _is_low_value_frame(desc: str) -> bool:
    """价值闸门：描述极短 / 属于过渡·纯色等无信息画面 → 不配图。"""
    d = (desc or "").strip()
    if len(d) <= 2:
        return True
    return d in _LOW_VALUE_FRAME_DESCS


def _frames_too_similar(a: str, b: str, threshold: float = 0.86) -> bool:
    """相邻帧画面描述高度相似 → 视为重复画面，去重。"""
    a, b = (a or "").strip(), (b or "").strip()
    if not a or not b:
        return False
    return SequenceMatcher(None, a, b).ratio() >= threshold


def _filter_and_dedup_frames(
    frames: List[Dict[str, object]],
) -> List[Dict[str, object]]:
    """价值闸门 + 相邻去重 + 重编号 idx。

    重编号保证 idx 与列表位置一致，使 build_prompt 的 [[图N]] 与
    _postprocess_frames 的 frames[N] 始终指向同一帧（采样只取子集、保留 idx）。
    """
    cleaned: List[Dict[str, object]] = []
    for fr in frames:
        desc = str(fr.get("desc") or "")
        if _is_low_value_frame(desc):
            continue
        if cleaned and _frames_too_similar(desc, str(cleaned[-1].get("desc") or "")):
            continue
        cleaned.append(fr)
    for n, fr in enumerate(cleaned):
        fr["idx"] = n
    return cleaned


def _adaptive_frame_cap(duration_sec: float, n_candidates: int, hard_max: int = 8) -> int:
    """配图「候选清单长度」上限：候选已过价值闸门+去重，这里仅封顶防「图太多」。

    替代旧的 max_embed_frames=0「不限制」语义（那会把所有帧塞进 prompt → 图太多）。
    短视频候选少 → 全给；候选多 → 封顶 hard_max，让 LLM 在精选里按需插（宁缺毋滥）。
    超长视频（>12min）按每 5min +1 微放宽，仍封顶 12。
    """
    cap = hard_max
    if duration_sec and duration_sec > 720:
        cap = min(12, hard_max + round((duration_sec - 720) / 300))
    return min(cap, n_candidates) if n_candidates else 0


def _evenly_sample_frames(
    frames: List[Dict[str, object]], cap: int,
) -> List[Dict[str, object]]:
    """按时间顺序均匀采样到 cap 张，保留每帧原 idx（与 _postprocess 全集对齐）。"""
    if cap <= 0:
        return []
    if len(frames) <= cap:
        return frames
    step = len(frames) / cap
    return [frames[min(len(frames) - 1, int(i * step))] for i in range(cap)]


def _collect_frames(item: WorkspaceItem) -> List[Dict[str, object]]:
    """收集关键帧信息：优先从 results["frames"]，兜底从 json_outputs 文件。

    返回前统一过价值闸门 + 去重（_filter_and_dedup_frames）。
    """
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
            return _filter_and_dedup_frames(out)

    # 兜底：从 json_outputs 文件读取（handle_note_task 存的路径）
    json_paths = results.get("json_outputs") or []
    if not json_paths:
        out = []
    else:
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

    # 如果还没有 frames，尝试从 default_project 的分析报告目录查找
    if not out:
        out = _collect_frames_from_default_project(item)

    # 收集 ln-screenshots/ 手动截图（用户在视频播放器中截取的）
    # 注意：WorkspaceItem 没有 workspace_id 属性，需要从其他地方获取
    # 这里暂时跳过，因为需要修改 WorkspaceItem 模型
    # ws_id = item.workspace_id or ""
    # item_id = item.item_id or ""
    # if ws_id:
    #     from shared.config import get_workspace_root
    #     ws_root = get_workspace_root(ws_id)
    #     ln_shots_dir = ws_root / "ln-screenshots"
    #     if ln_shots_dir.is_dir():
    #         for shot_file in sorted(ln_shots_dir.glob("shot-*.png")):
    #             # 文件名格式：shot-XXXXXX-HHMMSS.png，XXXXXX 是秒数
    #             parts = shot_file.stem.split("-")
    #             if len(parts) >= 2:
    #                 try:
    #                     sec = float(parts[1])
    #                 except ValueError:
    #                     sec = 0.0
    #             else:
    #                 sec = 0.0
    #             img_url = f"/static/workspaces/{ws_id}/ln-screenshots/{shot_file.name}"
    #             out.append({
    #                 "idx": len(out),
    #                 "sec": sec,
    #                 "desc": f"用户截图 @{int(sec)//60:02d}:{int(sec)%60:02d}",
    #                 "image_path": img_url,
    #             })

    return _filter_and_dedup_frames(out)


def _collect_frames_from_default_project(item: WorkspaceItem) -> List[Dict[str, object]]:
    """从 default_project 的分析报告目录中收集 frames 数据。

    当 item.results 没有 frames 数据时，尝试从 default_project 的 videos 目录中
    查找对应的分析报告，读取视觉数据 JSON 中的 frames。
    """
    from shared.config import get_workspace_root

    # 获取视频标题或 source_value
    source_value = item.source_value or ""
    title = item.name or ""

    # 尝试从 default_project 的 videos 目录查找分析报告
    default_ws_root = get_workspace_root("default_project")
    videos_dir = default_ws_root / "videos"
    if not videos_dir.is_dir():
        return []

    out = []
    # 遍历所有分析报告目录
    for report_dir in videos_dir.glob("*_分析报告"):
        json_files = list(report_dir.glob("*_视觉数据.json"))
        if not json_files:
            continue

        # 检查是否与当前 item 相关（通过标题或 BV 号匹配）
        dir_name = report_dir.name.replace("_分析报告", "")
        is_match = False
        if title and dir_name in title:
            is_match = True
        elif source_value:
            # 从 source_value 提取 BV 号
            import re
            bv_match = re.search(r"BV[0-9A-Za-z]+", source_value)
            if bv_match and bv_match.group() in dir_name:
                is_match = True

        if not is_match:
            continue

        # 读取视觉数据 JSON
        for json_file in json_files:
            try:
                data = _json.loads(json_file.read_text(encoding="utf-8"))
            except Exception:
                continue

            frames_data = data.get("frames", [])
            for i, fr in enumerate(frames_data):
                desc = str(fr.get("content_zh") or fr.get("description_zh") or "").strip()
                if not desc:
                    continue
                ts = str(fr.get("timestamp") or "00:00:00")
                sec = _ts_to_sec(ts)
                # 从 frames/ 目录找对应图片
                img = _find_frame_image(str(json_file), i)
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
    """从 json 定位分析报告目录下的 frames/ 找第 idx 帧图片。

    复用 _locate_analyze_report_dir 同款路径探测：
    - json_data/<stem>_视觉数据.json → videos/<stem>_分析报告/frames/
    - json_path.parent/<stem>_分析报告/frames/
    - json_path.parent/frames/（旧产物）
    """
    jp = Path(json_path)
    json_stem = jp.stem.replace("_视觉数据", "")
    parent = jp.parent

    frames_dir = None
    for candidate_dir in [
        parent / f"{json_stem}_分析报告" / "frames",
        parent.parent / "videos" / f"{json_stem}_分析报告" / "frames",
        parent / "frames",
    ]:
        if candidate_dir.is_dir():
            frames_dir = candidate_dir
            break
    if not frames_dir:
        return ""

    # 按文件名排序取第 idx 个
    all_imgs = sorted(frames_dir.glob("*.jpg")) + sorted(frames_dir.glob("*.png"))
    if idx < len(all_imgs):
        return str(all_imgs[idx])
    return ""


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
    embed_frames: bool = True,
    max_embed_frames: int = 0,
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

    system_prompt, user_prompt = build_prompt(
        item, template_id, background,
        embed_frames=embed_frames, max_embed_frames=max_embed_frames,
    )

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
