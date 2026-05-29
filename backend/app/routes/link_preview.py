"""Link preview endpoint — 抓取网页 og 元数据，B 站走专用解析。"""

from __future__ import annotations

import logging
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Query
from lxml import html as lxml_html

try:
    from backend.app.downloaders.bilibili_nocookie import (
        BilibiliNoCookieDownloader,
        extract_bvid_from_url,
    )
    _HAS_BILI = True
except ImportError:
    _HAS_BILI = False

    def extract_bvid_from_url(url: str) -> None:  # type: ignore[misc]
        return None

try:
    from shared.text_loader import load_url as _load_url, TextLoaderError
    _HAS_LOADER = True
except ImportError:
    _HAS_LOADER = False

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/link-preview", tags=["link-preview"])

# 通用浏览器 UA，防反爬
_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/125.0.0.0 Safari/537.36"
)


def _extract_og(page_html: str) -> dict[str, Optional[str]]:
    """从 HTML 提取 og:title / og:description / og:image。"""
    try:
        tree = lxml_html.fromstring(page_html)
    except Exception:
        return {"title": None, "description": None, "image_url": None}

    def _og(prop: str) -> Optional[str]:
        nodes = tree.xpath(f'//meta[@property="og:{prop}"]/@content')
        return nodes[0].strip() if nodes and nodes[0].strip() else None

    # fallback: <title> 和 <meta name="description">
    title = _og("title")
    if not title:
        title_nodes = tree.xpath("//title/text()")
        title = title_nodes[0].strip() if title_nodes else None

    description = _og("description")
    if not description:
        desc_nodes = tree.xpath('//meta[@name="description"]/@content')
        description = desc_nodes[0].strip() if desc_nodes else None

    return {
        "title": title,
        "description": description,
        "image_url": _og("image"),
    }


@router.get("")
async def link_preview(
    url: str = Query(..., description="待预览的链接"),
    include_content: bool = Query(False, description="是否返回 readability 正文"),
):
    """抓取链接的 og 元数据。

    返回 { title, description, image_url, source }。
    source: "bili" | "og" | "fallback"

    当 include_content=True 时，额外返回 { content, word_count }。
    """
    if not url.strip():
        raise HTTPException(status_code=400, detail="url 参数不能为空")

    # ── B 站：走专用 downloader（如果可用）──
    if _HAS_BILI and extract_bvid_from_url(url):
        try:
            dl = BilibiliNoCookieDownloader()
            meta = dl.get_meta(url)
            result = {
                "title": meta.title or None,
                "description": meta.description or None,
                "image_url": meta.cover_url or None,
                "source": "bili",
            }
            if include_content:
                result["content"] = ""
                result["word_count"] = 0
            return result
        except Exception as exc:
            logger.warning("B 站预览失败，降级到 og: %s", exc)
            # 降级到通用 og（B 站页面也有 og 标签）

    # ── 通用网页：og 抓取 ──
    try:
        async with httpx.AsyncClient(
            timeout=5,
            follow_redirects=True,
            headers={"User-Agent": _UA},
        ) as client:
            resp = await client.get(url)
            resp.raise_for_status()
    except Exception as exc:
        logger.warning("网页抓取失败: %s", exc)
        result = {
            "title": None,
            "description": None,
            "image_url": None,
            "source": "fallback",
        }
        if include_content:
            result["content"] = ""
            result["word_count"] = 0
        return result

    og = _extract_og(resp.text)

    if og["title"] or og["description"]:
        og["source"] = "og"
    else:
        og["source"] = "fallback"

    # ── 可选：readability 正文提取 ──
    if include_content:
        content, word_count = _extract_content(url)
        og["content"] = content
        og["word_count"] = word_count

    return og


def _extract_content(url: str) -> tuple[str, int]:
    """用 readability 提取正文，失败返回空串。"""
    if not _HAS_LOADER:
        logger.warning("text_loader 不可用，跳过正文提取")
        return "", 0
    try:
        doc = _load_url(url, timeout=10)
        return doc.content, doc.char_count
    except (TextLoaderError, Exception) as exc:
        logger.warning("readability 正文提取失败: %s", exc)
        return "", 0
