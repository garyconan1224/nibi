#!/usr/bin/env python3
"""Small Playwright smoke checks that print JSON instead of screenshots."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


def _safe_inner_text(locator: Any) -> str | None:
    try:
        if locator.count() == 0:
            return None
        return locator.first.inner_text(timeout=1000).strip()
    except Exception:  # noqa: BLE001
        return None


def _button_texts(page: Any) -> list[str]:
    texts: list[str] = []
    for i in range(min(page.locator("button").count(), 40)):
        try:
            txt = page.locator("button").nth(i).inner_text(timeout=500).strip()
            title = page.locator("button").nth(i).get_attribute("title") or ""
            label = txt or title
            if label:
                texts.append(label)
        except Exception:  # noqa: BLE001
            continue
    return texts


def _run(args: argparse.Namespace) -> tuple[int, dict[str, Any]]:
    try:
        from playwright.sync_api import sync_playwright
    except Exception as err:  # noqa: BLE001
        return 2, {
            "ok": False,
            "error": "playwright_import_failed",
            "detail": str(err),
        }

    console_messages: list[dict[str, str]] = []
    result: dict[str, Any] = {
        "ok": True,
        "target_url": args.url,
        "checks": {},
        "console_errors": [],
        "screenshot": None,
    }

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": args.width, "height": args.height})
        page.on(
            "console",
            lambda msg: console_messages.append(
                {"type": msg.type, "text": msg.text[:500]},
            ),
        )
        try:
            page.goto(args.url, wait_until="networkidle", timeout=args.timeout_ms)
            page.wait_for_timeout(args.settle_ms)
            result["final_url"] = page.url
            result["title"] = page.title()
            result["h1"] = _safe_inner_text(page.locator("h1"))
            result["checks"]["body_text_len"] = len(page.locator("body").inner_text(timeout=2000))

            if args.library:
                cards = page.locator(".ex-card").count()
                result["checks"].update(
                    {
                        "library_eyebrow": _safe_inner_text(page.locator(".eyebrow")),
                        "cards": cards,
                        "buttons": _button_texts(page),
                        "grid_button_count": page.get_by_title("网格视图").count(),
                        "list_button_count": page.get_by_title("列表视图").count(),
                    },
                )
                if args.expect_card_min is not None and cards < args.expect_card_min:
                    result["ok"] = False
                    result["checks"]["card_min_failed"] = {
                        "expected_min": args.expect_card_min,
                        "actual": cards,
                    }

                select = page.get_by_role("button", name="选择")
                if select.count() > 0:
                    select.first.click()
                    page.wait_for_timeout(200)
                    result["checks"]["select_mode"] = {
                        "all_button": page.get_by_role("button", name="全选").count(),
                        "cancel_button": page.get_by_role("button", name="取消").count(),
                        "delete_buttons": page.get_by_title("删除").count(),
                    }

            if args.screenshot:
                out = Path(args.screenshot)
                out.parent.mkdir(parents=True, exist_ok=True)
                page.screenshot(path=str(out), full_page=False)
                result["screenshot"] = {
                    "path": str(out),
                    "bytes": out.stat().st_size,
                    "read_into_context": False,
                }
        except Exception as err:  # noqa: BLE001
            result["ok"] = False
            result["error"] = type(err).__name__
            result["detail"] = str(err)[:1000]
        finally:
            browser.close()

    result["console_errors"] = [m for m in console_messages if m["type"] in {"error", "warning"}]
    if result["console_errors"] and args.fail_on_console:
        result["ok"] = False
    return (0 if result["ok"] else 1), result


def main() -> int:
    parser = argparse.ArgumentParser(description="Run small browser smoke checks and print compact JSON.")
    parser.add_argument("--url", required=True, help="URL to open, for example http://localhost:5175/library")
    parser.add_argument("--library", action="store_true", help="Run Nibi Library page structural checks")
    parser.add_argument("--screenshot", help="Optional screenshot output path. The script prints only metadata.")
    parser.add_argument("--expect-card-min", type=int, help="Fail if fewer cards are rendered")
    parser.add_argument("--timeout-ms", type=int, default=15000)
    parser.add_argument("--settle-ms", type=int, default=500)
    parser.add_argument("--width", type=int, default=1280)
    parser.add_argument("--height", type=int, default=720)
    parser.add_argument("--fail-on-console", action="store_true")
    args = parser.parse_args()

    code, payload = _run(args)
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return code


if __name__ == "__main__":
    raise SystemExit(main())
