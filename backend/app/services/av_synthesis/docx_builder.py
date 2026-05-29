"""R20: Word 导出 — python-docx 构建。"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi.responses import StreamingResponse


def build_docx(notes: Any, ws_root: Path) -> StreamingResponse:
    """生成 .docx 并返回 StreamingResponse。"""
    raise NotImplementedError("DOCX builder 待 R20 commit3 实现")
