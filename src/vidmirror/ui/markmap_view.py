"""Markmap 思维导图组件，把 Markdown 渲染为交互式思维导图。"""
from __future__ import annotations

import streamlit as st

_MARKMAP_CDN = "https://cdn.jsdelivr.net/npm/markmap-autoloader"


def render_markmap(markdown: str, height: int = 600) -> None:
    """
    使用 markmap-autoloader CDN 渲染思维导图。
    CDN 不可达时优雅降级为纯 Markdown 预览（不抛异常）。
    
    Args:
        markdown: Markdown 格式的文本内容
        height: 思维导图高度（像素），默认 600
    """
    if not markdown or not markdown.strip():
        st.info("暂无内容可渲染为思维导图")
        return

    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        svg.markmap {{ width: 100%; height: {height}px; }}
      </style>
      <script src="{_MARKMAP_CDN}"></script>
    </head>
    <body>
      <div class="markmap">
        <script type="text/template">
{markdown}
        </script>
      </div>
    </body>
    </html>
    """

    try:
        st.components.v1.html(html, height=height + 40, scrolling=True)
    except Exception as exc:
        st.warning(f"Markmap 加载失败（{exc}），回退到 Markdown 预览")
        st.markdown(markdown)

