"""Markmap 思维导图组件的单元测试。"""
import unittest.mock as mock

from src.vidmirror.ui.markmap_view import render_markmap


def test_render_markmap_basic_not_raising() -> None:
    """测试基本 markmap 渲染不会抛异常。"""
    with mock.patch("streamlit.components.v1.html"):
        render_markmap("# title\n## child 1\n## child 2")


def test_render_markmap_empty_markdown_shows_info() -> None:
    """测试空 Markdown 会显示 info 提示。"""
    with mock.patch("streamlit.info") as mock_info:
        with mock.patch("streamlit.components.v1.html"):
            render_markmap("")
        mock_info.assert_called_once()


def test_render_markmap_whitespace_only_shows_info() -> None:
    """测试仅空白字符的 Markdown 会显示 info 提示。"""
    with mock.patch("streamlit.info") as mock_info:
        with mock.patch("streamlit.components.v1.html"):
            render_markmap("   \n\n  ")
        mock_info.assert_called_once()


def test_render_markmap_exception_fallback_to_markdown() -> None:
    """测试 CDN 加载失败时会回退到 Markdown 预览。"""
    markdown_content = "# Test\n## Section"
    with mock.patch("streamlit.components.v1.html", side_effect=Exception("CDN error")):
        with mock.patch("streamlit.warning") as mock_warning:
            with mock.patch("streamlit.markdown") as mock_markdown:
                render_markmap(markdown_content)
            mock_warning.assert_called_once()
            mock_markdown.assert_called_once_with(markdown_content)

