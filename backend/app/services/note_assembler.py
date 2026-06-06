"""Note Assembler — R0.1 核心（纯函数 + 落盘，不接任何现有流程）。

把 WorkspaceItem（results / tags / summaries）按 schema v1 序列化成
source.md + note.md（frontmatter + 正文）+ summaries/<template>/v<n>.md，
落盘到 <workspace_root>/notes/<item_id>/，assets/ 建空目录占位。

不调 LLM、不改 summary/RAG/导出/现有结果页。
组装失败 best-effort（try/except + 日志），绝不阻断 item 分析主流程。
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

import yaml  # PyYAML，项目已有依赖

from backend.app.models.workspace import ItemSummary, WorkspaceItem
from shared.config import get_workspace_root

logger = logging.getLogger(__name__)

# ── 常量 ──────────────────────────────────────────────────────────
_SCHEMA_VERSION = 1
_NOTE_VERSION = 1  # R0 固定 1，R2 起递增


# ── 公共路径 ──────────────────────────────────────────────────────
def note_dir(workspace_id: str, item_id: str) -> Path:
    """返回 <workspace_root>/notes/<item_id>/ 的绝对路径（不创建）。"""
    return get_workspace_root(workspace_id) / "notes" / item_id


# ── frontmatter ──────────────────────────────────────────────────
def build_frontmatter(item: WorkspaceItem, workspace_id: str) -> Dict[str, Any]:
    """按 §3.4 schema v1 构建 frontmatter dict（不含 YAML 序列化）。"""

    # media 尽力从 results 提取，拿不到留空
    media: Dict[str, Any] = {}
    results = item.results or {}
    item_type = item.type

    if item_type == "image":
        img_path = results.get("image_path", "")
        media["images"] = [img_path] if img_path else []
    elif item_type == "video":
        duration = results.get("duration")
        if duration is not None:
            media["video"] = {"duration": duration}
        frames = results.get("frames", [])
        if frames:
            media["frames"] = [
                {"sec": f.get("sec", 0), "path": f.get("frame_path", "")}
                for f in frames
                if isinstance(f, dict)
            ]
    elif item_type == "audio":
        audio_path = results.get("audio_path", "")
        if audio_path:
            media["audio"] = audio_path

    # layers：记录各层相对路径
    summaries_paths = [
        f"summaries/{s.template}/v{s.version}.md"
        for s in (item.summaries or [])
    ]
    layers: Dict[str, Any] = {
        "source": "source.md",
        "note": "note.md",
        "summaries": summaries_paths,
    }

    # source_url：仅当 source == "url" 时填充
    source_url = ""
    if (item.source or "") == "url":
        source_url = item.source_value or ""

    # tags：直接序列化 item.tags
    tags = item.tags if isinstance(item.tags, dict) else {}

    return {
        "schema_version": _SCHEMA_VERSION,
        "id": item.item_id,
        "workspace_id": workspace_id,
        "type": item_type,
        "title": item.name or "",
        "source_url": source_url,
        "created_at": item.created_at or "",
        "tags": tags,
        "media": media,
        "layers": layers,
        "exports": {"html": "note.html"},  # R5 才真正生成，R0 仅占位
        "version": _NOTE_VERSION,
    }


# ── source.md / note.md 正文 ─────────────────────────────────────
def _build_body(item: WorkspaceItem) -> str:
    """按 item.type 取 results 中的主体文本，返回 markdown 正文。

    text    = content（纯文本内容）
    audio   = transcript 可读拼接 + transcript_segments 拼接
    video   = transcript 可读拼接（segments 或 frames 带 transcript 字段）
    image   = ocr_text / description
    """
    results = item.results or {}
    item_type = item.type

    if item_type == "text":
        # NI.1: note task 产出 results["markdown"]，优先使用
        return results.get("markdown") or results.get("content", "") or results.get("summary", "")

    if item_type in ("audio", "video"):
        # 优先用 transcript（str 或 list），再兜底 transcript_segments，最后 summary
        transcript = results.get("transcript")
        if isinstance(transcript, str) and transcript.strip():
            return transcript
        if isinstance(transcript, list) and transcript:
            # transcript 可能是 list of dicts（video 的 display lines）或 list of str
            lines = []
            for seg in transcript:
                if isinstance(seg, dict):
                    text = seg.get("text", "")
                    start = seg.get("start", "")
                    if start != "":
                        lines.append(f"**[{start}s]** {text}")
                    else:
                        lines.append(text)
                elif isinstance(seg, str):
                    lines.append(seg)
            joined = "\n\n".join(lines)
            if joined.strip():
                return joined
        # 兜底：transcript_segments（音频 handler 常见字段）
        segments = results.get("transcript_segments")
        if isinstance(segments, list) and segments:
            lines = []
            for seg in segments:
                if isinstance(seg, dict):
                    start = seg.get("start", "")
                    text = seg.get("text", "")
                    if start != "":
                        lines.append(f"**[{start}s]** {text}")
                    else:
                        lines.append(text)
            joined = "\n\n".join(lines)
            if joined.strip():
                return joined
        # 最终兜底：summary
        return results.get("summary", "")

    if item_type == "image":
        # NI.1: note task 产出 results["markdown"]（含图集描述），优先使用
        md = results.get("markdown", "")
        if md:
            return md
        parts = []
        ocr = results.get("ocr_text", "")
        if ocr:
            parts.append("## OCR 文本\n\n" + ocr)
        desc = results.get("description", "")
        if desc:
            parts.append("## 图片描述\n\n" + desc)
        return "\n\n".join(parts) if parts else ""

    return ""


def build_source_md(item: WorkspaceItem) -> str:
    """生成 source.md 内容（原始依据）。"""
    return _build_body(item)


def build_note_md(item: WorkspaceItem, frontmatter: Dict[str, Any]) -> str:
    """生成 note.md = YAML frontmatter + 正文。"""
    fm_yaml = yaml.dump(frontmatter, allow_unicode=True, default_flow_style=False, sort_keys=False)
    body = _build_body(item)
    return f"---\n{fm_yaml}---\n\n{body}"


# ── summaries 序列化 ─────────────────────────────────────────────
def serialize_summaries(
    item: WorkspaceItem,
    item_note_dir: Path,
) -> List[Path]:
    """把 item.summaries 逐条写成 summaries/<template>/v<n>.md，返回文件路径列表。"""
    written: List[Path] = []
    for summary in item.summaries or []:
        subdir = item_note_dir / "summaries" / summary.template
        subdir.mkdir(parents=True, exist_ok=True)
        path = subdir / f"v{summary.version}.md"
        path.write_text(summary.content_md or "", encoding="utf-8")
        written.append(path)
    return written


# ── 主组装函数 ────────────────────────────────────────────────────
def assemble_item_note(
    workspace_id: str,
    item_id: str,
    *,
    overwrite: bool = True,
    _item: Optional[WorkspaceItem] = None,
) -> Dict[str, Any]:
    """组装 + 落盘，返回各路径。

    参数：
        workspace_id: 工作空间 ID
        item_id: 素材 ID
        overwrite: True 时覆盖已有文件；False 时若 note.md 已存在则跳过
        _item: 测试注入用；生产环境通过 WorkspaceStore 查找（R0.2 接入）

    返回：
        {
            "note_dir": str,      # 目录绝对路径
            "note_md": str,       # note.md 路径
            "source_md": str,     # source.md 路径
            "summaries": [str],   # summaries/*.md 路径列表
            "skipped": bool,      # 是否因 overwrite=False 跳过
        }

    best-effort：任何异常只记日志，不向上抛。
    """
    try:
        return _assemble_inner(workspace_id, item_id, overwrite=overwrite, _item=_item)
    except Exception:
        logger.exception(
            "note_assembler: assemble_item_note 失败 ws=%s item=%s（best-effort，不阻断主流程）",
            workspace_id,
            item_id,
        )
        return {
            "note_dir": "",
            "note_md": "",
            "source_md": "",
            "summaries": [],
            "skipped": False,
            "error": True,
        }


def _assemble_inner(
    workspace_id: str,
    item_id: str,
    *,
    overwrite: bool,
    _item: Optional[WorkspaceItem],
) -> Dict[str, Any]:
    item = _item  # R0.2 接 WorkspaceStore 查找
    if item is None:
        raise ValueError(
            "assemble_item_note: _item 参数未传（R0.2 接入 WorkspaceStore 前必须显式传入）"
        )

    nd = note_dir(workspace_id, item_id)
    note_path = nd / "note.md"

    # 幂等：不覆盖时若 note.md 已存在，直接返回
    if not overwrite and note_path.exists():
        return {
            "note_dir": str(nd),
            "note_md": str(note_path),
            "source_md": str(nd / "source.md"),
            "summaries": [str(p) for p in nd.glob("summaries/**/*.md")],
            "skipped": True,
        }

    # 创建目录结构
    nd.mkdir(parents=True, exist_ok=True)
    (nd / "assets").mkdir(exist_ok=True)

    # build
    fm = build_frontmatter(item, workspace_id)
    source_content = build_source_md(item)
    note_content = build_note_md(item, fm)

    # 写文件
    source_path = nd / "source.md"
    source_path.write_text(source_content, encoding="utf-8")
    note_path.write_text(note_content, encoding="utf-8")

    # summaries
    written = serialize_summaries(item, nd)

    return {
        "note_dir": str(nd),
        "note_md": str(note_path),
        "source_md": str(source_path),
        "summaries": [str(p) for p in written],
        "skipped": False,
    }
