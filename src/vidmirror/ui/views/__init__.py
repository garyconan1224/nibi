"""Phase 2.3.a — 主工作区三视图包入口。

本包聚合 download / analyze / create 三个 view 函数，
从原 pages/1..3 正文搬运而来，签名统一为：

    render_xxx_view(project_id: str) -> None

由 app.py 的 VIEW_KEY 条件渲染调度。
"""

from __future__ import annotations

from src.vidmirror.ui.views.analyze import render_analyze_view
from src.vidmirror.ui.views.create import render_create_view
from src.vidmirror.ui.views.download import render_download_view

__all__ = [
    "render_download_view",
    "render_analyze_view",
    "render_create_view",
]

