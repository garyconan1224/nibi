"""R20: Obsidian Vault 导出 — zip 含 markdown + frames/。"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi.responses import StreamingResponse


def build_obsidian_zip(notes: Any, ws_root: Path) -> StreamingResponse:
    """生成 Obsidian Vault zip 并返回 StreamingResponse。"""
    raise NotImplementedError("Obsidian builder 待 R20 commit4 实现")
