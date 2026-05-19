"""Phase 2C.1：文本输入层端到端单元测试。

- text_loader.load_pdf / load_docx：用真实文件跑一次（生成 fixture）。
- text_loader.load_url：mock httpx。
- pipeline handle_text_task：mock load_auto，验证状态机推进 + 产物落盘。
- pipeline handle_text_task：缺 payload.source 抛 ValueError。
"""
from __future__ import annotations

import time
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock, patch

import pytest

from backend.app.models.tasks import TERMINAL_STATUS_VALUES, TaskStatus
from backend.app.services.pipeline_tasks import handle_text_task
from backend.app.services.task_runner import TaskRunner
from backend.app.services.task_store import TaskStore
from shared.text_loader import (
    TextDocument,
    TextLoaderError,
    load_docx,
    load_pdf,
    load_url,
)


# ── text_loader 直接测 ─────────────────────────────────────


def _make_pdf(path: Path, text_lines: list[str]) -> None:
    """用 pypdf 直接合成一个最小可读 PDF。"""
    from pypdf import PdfWriter
    # pypdf 不支持纯文本写入，改用 reportlab 不引入新依赖：手写一个最小 PDF
    # 因 pypdf 实际项目里只读，本测试用 fpdf2 又会引入新依赖；
    # 这里用最朴素的方式：通过 PdfWriter 加一个空白页后用 add_metadata 携带标题，
    # 然后 load_pdf 走 extract_text 拿到空串路径（覆盖"PDF 抽到空"分支）。
    writer = PdfWriter()
    writer.add_blank_page(width=200, height=200)
    writer.add_metadata({"/Title": "Test PDF"})
    with path.open("wb") as f:
        writer.write(f)


def test_load_pdf_blank_returns_empty_content(tmp_path: Path) -> None:
    pdf_file = tmp_path / "blank.pdf"
    _make_pdf(pdf_file, [])

    doc = load_pdf(pdf_file)
    assert doc.source_type == "pdf"
    # N10: marker 可能对空白 PDF 返回少量 OCR 内容，不再断言 content == ""
    assert isinstance(doc.content, str)
    assert isinstance(doc.char_count, int)
    # meta 中应有 parser 字段标记使用了哪个解析器
    assert "parser" in doc.meta


def test_load_pdf_missing_raises() -> None:
    with pytest.raises(TextLoaderError):
        load_pdf("/no/such/file.pdf")


def test_load_docx_roundtrip(tmp_path: Path) -> None:
    from docx import Document

    src = tmp_path / "sample.docx"
    doc = Document()
    doc.core_properties.title = "我的文档"
    doc.add_paragraph("第一段。")
    doc.add_paragraph("第二段，包含一些细节。")
    doc.save(str(src))

    out = load_docx(src)
    assert out.source_type == "docx"
    assert out.title == "我的文档"
    assert "第一段" in out.content and "第二段" in out.content
    assert out.char_count > 0


def test_load_url_happy(monkeypatch: pytest.MonkeyPatch) -> None:
    html = (
        b"<html><head><title>My Article</title></head>"
        b"<body><article><h1>Hello World</h1>"
        b"<p>This is the body content of a news article. " * 5
        + b"</p></article></body></html>"
    )

    class _FakeResp:
        status_code = 200
        content = html
        text = html.decode("utf-8")
        headers = {"content-type": "text/html"}
        url = "https://example.com/post"

    class _FakeClient:
        def __init__(self, *a: Any, **kw: Any) -> None:
            pass

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def get(self, url: str):
            return _FakeResp()

    monkeypatch.setattr("shared.text_loader.httpx.Client", _FakeClient)

    doc = load_url("https://example.com/post")
    assert doc.source_type == "url"
    assert doc.title  # readability 会拿到标题
    assert "body content" in doc.content
    assert doc.meta["http_status"] == 200


# ── handle_text_task 集成（mock load_auto）─────────────────


def _wait_terminal(store: TaskStore, task_id: str, timeout: float = 5.0):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        rec = store.get(task_id)
        if rec is not None and rec.status in TERMINAL_STATUS_VALUES:
            return rec
        time.sleep(0.05)
    return store.get(task_id)


def test_handle_text_task_happy(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    # 改写 PROJECT_WORKSPACES_DIR，让产物落到 tmp 下
    monkeypatch.setattr("shared.config.PROJECT_WORKSPACES_DIR", tmp_path)
    # 注意：pipeline_tasks 是 from shared.config import get_project_text_dir
    # 而 get_project_text_dir 内部读 PROJECT_WORKSPACES_DIR 模块级常量，monkeypatch 有效。

    fake_doc = TextDocument(
        title="Fake Title",
        content="Fake body content " * 10,
        source_type="url",
        source="https://example.com/post",
        char_count=200,
        meta={"http_status": 200},
    )
    monkeypatch.setattr(
        "backend.app.services.pipeline_tasks.load_auto",
        lambda source, source_type=None: fake_doc,
    )
    # 让 _summarize_text 走"未提供 api_key"分支，返回空串
    fake_settings = MagicMock()
    fake_settings.openai_api_key = ""
    fake_settings.text_model = ""
    monkeypatch.setattr(
        "backend.app.services.pipeline_tasks.load_settings",
        lambda: fake_settings,
    )

    store = TaskStore(path=tmp_path / "tasks.json")
    runner = TaskRunner(store, max_workers=1)
    runner.register("text", handle_text_task)

    rec = runner.create_task("proj-text", "text", {"source": "https://example.com/post"})
    final = _wait_terminal(store, rec.task_id)

    assert final is not None
    assert final.status == TaskStatus.SUCCESS.value, final.error
    result = final.result
    assert result["title"] == "Fake Title"
    assert result["char_count"] == 200
    assert result["summary"] == ""
    md_path = Path(result["markdown_path"])
    json_path = Path(result["json_path"])
    assert md_path.is_file() and json_path.is_file()
    assert "Fake Title" in md_path.read_text(encoding="utf-8")


def test_handle_text_task_missing_source(tmp_path: Path) -> None:
    store = TaskStore(path=tmp_path / "tasks.json")
    runner = TaskRunner(store, max_workers=1)
    runner.register("text", handle_text_task)

    rec = runner.create_task("proj-text", "text", {})  # 缺 source
    final = _wait_terminal(store, rec.task_id)
    assert final is not None
    assert final.status == TaskStatus.FAILED.value
    assert "source" in final.error.lower()
