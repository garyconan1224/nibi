"""Single-item NoteShell export helpers."""

from __future__ import annotations

import base64
import io
import mimetypes
import re
import zipfile
from html import escape
from pathlib import Path
from typing import Iterable
from urllib.parse import quote, unquote

from fastapi import HTTPException
from fastapi.responses import StreamingResponse

from backend.app.models.workspace import WorkspaceItem
from shared.config import DATA_DIR


def build_note_export_response(
    *,
    workspace_id: str,
    item_id: str,
    item: WorkspaceItem,
    note_md: str,
    source_md: str = "",
    format: str = "obsidian",
) -> StreamingResponse:
    """Build an export response for one NoteShell note."""

    fmt = format.strip().lower().replace("-", "_")
    body = _strip_frontmatter(note_md)
    title = _title_from_body(body) or item.name or item_id
    safe_title = _safe_filename(title)

    if fmt in {"md", "markdown", "raw_md"}:
        return _stream_bytes(
            note_md.encode("utf-8"),
            "text/markdown; charset=utf-8",
            f"{safe_title}.md",
        )
    if fmt == "obsidian":
        return _build_obsidian_zip(
            title=title,
            safe_title=safe_title,
            workspace_id=workspace_id,
            item_id=item_id,
            item=item,
            body=body,
            source_md=source_md,
        )
    if fmt in {"html", "immersive"}:
        html = _render_note_html(title=title, item=item, body=body)
        return _stream_bytes(
            html.encode("utf-8"),
            "text/html; charset=utf-8",
            f"{safe_title}.html",
        )
    if fmt == "pdf":
        return _build_pdf(title=title, safe_title=safe_title, item=item, body=body)
    if fmt in {"long_image", "png", "image"}:
        return _build_long_image(title=title, safe_title=safe_title, item=item, body=body)
    if fmt in {"docx", "word"}:
        return _build_docx(title=title, safe_title=safe_title, item=item, body=body)
    if fmt in {"pptx", "ppt"}:
        return _build_pptx(title=title, safe_title=safe_title, item=item, body=body)

    raise HTTPException(
        status_code=400,
        detail="unsupported format: "
        f"{format!r}; use md/html/pdf/docx/long_image/pptx/obsidian",
    )


def _strip_frontmatter(markdown: str) -> str:
    if not markdown.startswith("---\n"):
        return markdown
    parts = markdown.split("---\n", 2)
    return parts[2].lstrip() if len(parts) >= 3 else markdown


def _title_from_body(body: str) -> str:
    match = re.search(r"^#\s+(.+)$", body, re.MULTILINE)
    return match.group(1).strip() if match else ""


def _safe_filename(name: str) -> str:
    safe = re.sub(r'[/\\:*?"<>|]+', "_", name).strip("._ ")
    return safe[:96] or "note"


def _stream_bytes(data: bytes, media_type: str, filename: str) -> StreamingResponse:
    return StreamingResponse(
        io.BytesIO(data),
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}"},
    )


def _build_obsidian_zip(
    *,
    title: str,
    safe_title: str,
    workspace_id: str,
    item_id: str,
    item: WorkspaceItem,
    body: str,
    source_md: str,
) -> StreamingResponse:
    exported_md = f"""---
title: {title}
source: {item.source_value or workspace_id}
workspace_id: {workspace_id}
item_id: {item_id}
tags: [nibi, noteshell]
---

{body}"""

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(f"{safe_title}.md", exported_md)
        if source_md.strip():
            zf.writestr(f"{safe_title}-source.md", source_md)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{quote(safe_title + '-obsidian.zip')}"
        },
    )


def _render_note_html(*, title: str, item: WorkspaceItem, body: str) -> str:
    try:
        import markdown2
    except ImportError as exc:
        raise HTTPException(status_code=500, detail="markdown2 未安装，无法导出 HTML/PDF/长图") from exc

    html_body = markdown2.markdown(
        _embed_markdown_images(body),
        extras=["tables", "fenced-code-blocks", "break-on-newline", "task_list"],
    )
    source_label = _source_label(item.source_value)
    item_type = item.type.upper()
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>{escape(title)}</title>
  <style>
    :root {{
      color-scheme: light;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: #191410;
      background: #f7f3ec;
    }}
    body {{
      margin: 0;
      background: #f7f3ec;
    }}
    .page {{
      width: min(920px, calc(100vw - 72px));
      margin: 0 auto;
      padding: 42px 0 64px;
    }}
    .source {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      min-height: 72px;
      margin-bottom: 38px;
      padding: 18px 22px;
      border-radius: 12px;
      color: #f8f5ee;
      background: linear-gradient(135deg, #20242c, #62656c);
    }}
    .source strong {{
      display: block;
      max-width: 680px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 16px;
    }}
    .source span {{
      color: rgba(255,255,255,.72);
      font-size: 12px;
    }}
    article {{
      padding: 0 4px;
      font-size: 16px;
      line-height: 1.85;
    }}
    h1 {{
      margin: 0 0 28px;
      padding-bottom: 16px;
      border-bottom: 1px solid rgba(25,20,16,.12);
      font-size: 30px;
      line-height: 1.2;
    }}
    h2 {{
      margin: 34px 0 14px;
      font-size: 23px;
      line-height: 1.25;
    }}
    h3 {{
      margin: 28px 0 10px;
      font-size: 18px;
    }}
    p, li {{
      color: #3d3929;
    }}
    blockquote {{
      margin: 20px 0;
      padding: 14px 18px;
      border-left: 4px solid #e96f22;
      border-radius: 0 8px 8px 0;
      background: #fff0dd;
      color: #2f291d;
    }}
    table {{
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
      font-size: 14px;
    }}
    th, td {{
      border: 1px solid rgba(25,20,16,.12);
      padding: 8px 10px;
      vertical-align: top;
    }}
    th {{
      background: rgba(255,255,255,.68);
    }}
    img {{
      max-width: 100%;
      height: auto;
      display: block;
      margin: 18px auto;
      border-radius: 10px;
      box-shadow: 0 12px 30px rgba(28,24,18,.12);
    }}
    code, pre {{
      font-family: "SFMono-Regular", Consolas, monospace;
      background: rgba(25,20,16,.06);
      border-radius: 6px;
    }}
    pre {{
      overflow-x: auto;
      padding: 12px;
    }}
  </style>
</head>
<body>
  <main class="page">
    <section class="source">
      <div>
        <strong>{escape(title)}</strong>
        <span>{escape(item_type)} · {escape(source_label)}</span>
      </div>
      <span>Generated by Nibi</span>
    </section>
    <article>
      <h1>{escape(title)}</h1>
      {html_body}
    </article>
  </main>
</body>
</html>"""


def _source_label(source_value: str) -> str:
    host = (source_value or "").replace("https://", "").replace("http://", "").split("/")[0]
    return host or "本地素材"


def _embed_markdown_images(markdown: str) -> str:
    def replace(match: re.Match[str]) -> str:
        alt = match.group(1)
        src = match.group(2)
        data_uri = _asset_to_data_uri(src)
        return f"![{alt}]({data_uri or src})"

    return re.sub(r"!\[([^\]]*)\]\(([^)]+)\)", replace, markdown)


def _asset_to_data_uri(src: str) -> str:
    path = _resolve_asset_path(src)
    if not path or not path.exists() or not path.is_file():
        return ""
    mime = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
    return f"data:{mime};base64,{base64.b64encode(path.read_bytes()).decode('ascii')}"


def _resolve_asset_path(src: str) -> Path | None:
    if not src:
        return None
    raw = unquote(src)
    if raw.startswith("/static/"):
        return DATA_DIR / raw.removeprefix("/static/")
    if raw.startswith("static/"):
        return DATA_DIR / raw.removeprefix("static/")
    if raw.startswith(("http://", "https://", "data:")):
        return None
    path = Path(raw)
    if path.is_absolute():
        return path
    return DATA_DIR / path


def _build_pdf(*, title: str, safe_title: str, item: WorkspaceItem, body: str) -> StreamingResponse:
    html = _render_note_html(title=title, item=item, body=body)
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as exc:
        raise HTTPException(status_code=500, detail="playwright 未安装，无法导出 PDF") from exc

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page(viewport={"width": 1200, "height": 1600})
            page.set_content(html, wait_until="networkidle")
            data = page.pdf(
                format="A4",
                print_background=True,
                margin={"top": "16mm", "right": "16mm", "bottom": "18mm", "left": "16mm"},
            )
            browser.close()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"PDF 导出失败: {exc}") from exc

    return _stream_bytes(data, "application/pdf", f"{safe_title}.pdf")


def _build_long_image(*, title: str, safe_title: str, item: WorkspaceItem, body: str) -> StreamingResponse:
    html = _render_note_html(title=title, item=item, body=body)
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as exc:
        raise HTTPException(status_code=500, detail="playwright 未安装，无法导出长图") from exc

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page(viewport={"width": 1200, "height": 1600}, device_scale_factor=1)
            page.set_content(html, wait_until="networkidle")
            data = page.screenshot(full_page=True, type="png")
            browser.close()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"长图导出失败: {exc}") from exc

    return _stream_bytes(data, "image/png", f"{safe_title}.png")


def _build_docx(*, title: str, safe_title: str, item: WorkspaceItem, body: str) -> StreamingResponse:
    try:
        from docx import Document
        from docx.shared import Inches
    except ImportError as exc:
        raise HTTPException(status_code=500, detail="python-docx 未安装，无法导出 Word") from exc

    doc = Document()
    doc.add_heading(title, level=0)
    source = doc.add_paragraph()
    source.add_run(f"{item.type.upper()} · {_source_label(item.source_value)}").italic = True

    for line in body.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        img_match = re.match(r"!\[[^\]]*\]\(([^)]+)\)", stripped)
        if img_match:
            path = _resolve_asset_path(img_match.group(1))
            if path and path.exists():
                try:
                    doc.add_picture(str(path), width=Inches(5.6))
                    continue
                except Exception:
                    pass
        if stripped.startswith("# "):
            doc.add_heading(stripped[2:].strip(), level=1)
        elif stripped.startswith("## "):
            doc.add_heading(stripped[3:].strip(), level=2)
        elif stripped.startswith("### "):
            doc.add_heading(stripped[4:].strip(), level=3)
        elif stripped.startswith(("- ", "* ")):
            doc.add_paragraph(_plain_markdown(stripped[2:]), style="List Bullet")
        elif re.match(r"^\d+\.\s+", stripped):
            doc.add_paragraph(_plain_markdown(re.sub(r"^\d+\.\s+", "", stripped)), style="List Number")
        elif stripped.startswith(">"):
            doc.add_paragraph(_plain_markdown(stripped.lstrip("> ").strip()))
        elif stripped.startswith("|"):
            doc.add_paragraph(_plain_markdown(stripped))
        else:
            doc.add_paragraph(_plain_markdown(stripped))

    buf = io.BytesIO()
    doc.save(buf)
    buf.seek(0)
    return _stream_bytes(
        buf.read(),
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        f"{safe_title}.docx",
    )


def _build_pptx(*, title: str, safe_title: str, item: WorkspaceItem, body: str) -> StreamingResponse:
    try:
        from pptx import Presentation
        from pptx.util import Inches, Pt
    except ImportError as exc:
        raise HTTPException(
            status_code=500,
            detail="python-pptx 未安装，无法导出 PPT；请先安装 python-pptx",
        ) from exc

    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)

    title_slide = prs.slides.add_slide(prs.slide_layouts[0])
    title_slide.shapes.title.text = title
    title_slide.placeholders[1].text = f"{item.type.upper()} · {_source_label(item.source_value)}"

    for section_title, lines in _split_markdown_sections(body):
        slide = prs.slides.add_slide(prs.slide_layouts[1])
        slide.shapes.title.text = section_title[:80]
        body_shape = slide.placeholders[1]
        frame = body_shape.text_frame
        frame.clear()

        image_path = _first_image_path(lines)
        bullet_lines = [
            _plain_markdown(line)
            for line in lines
            if _plain_markdown(line) and not line.strip().startswith(("!", "|"))
        ][:8]
        for idx, text in enumerate(bullet_lines or ["（本节主要内容见原笔记）"]):
            paragraph = frame.paragraphs[0] if idx == 0 else frame.add_paragraph()
            paragraph.text = text[:160]
            paragraph.level = 0
            paragraph.font.size = Pt(18)

        if image_path and image_path.exists():
            try:
                slide.shapes.add_picture(str(image_path), Inches(8.3), Inches(1.55), width=Inches(4.25))
                body_shape.width = Inches(7.2)
            except Exception:
                pass

    buf = io.BytesIO()
    prs.save(buf)
    buf.seek(0)
    return _stream_bytes(
        buf.read(),
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        f"{safe_title}.pptx",
    )


def _plain_markdown(text: str) -> str:
    text = re.sub(r"!\[[^\]]*\]\([^)]+\)", "", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"[*_`>#]", "", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _split_markdown_sections(markdown: str) -> Iterable[tuple[str, list[str]]]:
    current_title = "内容概览"
    current_lines: list[str] = []
    for line in markdown.splitlines():
        match = re.match(r"^(#{2,3})\s+(.+)", line)
        if match:
            if current_lines:
                yield current_title, current_lines
            current_title = _plain_markdown(match.group(2)) or "未命名章节"
            current_lines = []
            continue
        if line.startswith("# "):
            continue
        current_lines.append(line)
    if current_lines:
        yield current_title, current_lines


def _first_image_path(lines: list[str]) -> Path | None:
    for line in lines:
        match = re.search(r"!\[[^\]]*\]\(([^)]+)\)", line)
        if match:
            path = _resolve_asset_path(match.group(1))
            if path and path.exists():
                return path
    return None
