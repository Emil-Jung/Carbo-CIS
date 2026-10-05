"""Open A4 label HTML in a pywebview window (preview only — no pop-ups)."""

from __future__ import annotations

import webview


def open_a4_preview(html: str) -> dict:
    html = html if isinstance(html, str) else ""
    if not html.strip():
        return {"ok": False, "error": "No A4 document to preview."}
    if len(html) > 8_000_000:
        return {"ok": False, "error": "A4 document is too large."}

    try:
        webview.create_window(
            "A4 pallet labels — Carbo Print Labels",
            html=html,
            width=920,
            height=980,
            resizable=True,
        )
    except Exception as exc:
        return {"ok": False, "error": str(exc)}

    return {"ok": True}
