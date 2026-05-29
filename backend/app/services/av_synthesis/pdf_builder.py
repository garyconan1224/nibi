"""R20: PDF 导出 — Jinja2 HTML 模板 + playwright chromium 渲染。"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi.responses import StreamingResponse


def build_pdf(notes: Any, ws_root: Path) -> StreamingResponse:
    """生成 PDF 并返回 StreamingResponse。"""
    raise NotImplementedError("PDF builder 待 R20 commit2 实现")
