"""Open A4 label HTML in a pywebview window (avoids blocked window.open pop-ups)."""

from __future__ import annotations

import webview


def open_a4_print(html: str, *, auto_print: bool = True) -> dict:
    html = html if isinstance(html, str) else ""
    if not html.strip():
        return {"ok": False, "error": "No A4 document to print."}
    if len(html) > 8_000_000:
        return {"ok": False, "error": "A4 document is too large."}

    try:
        win = webview.create_window(
            "A4 pallet labels — Carbo Print Labels",
            html=html,
            width=920,
            height=980,
            resizable=True,
        )
    except Exception as exc:
        return {"ok": False, "error": str(exc)}

    if auto_print:
        def _do_print():
            try:
                win.evaluate_js(
                    "setTimeout(function(){ window.focus(); window.print(); }, 400);"
                )
            except Exception:
                pass

        try:
            win.events.loaded += _do_print
        except Exception:
            try:
                win.events.shown += _do_print
            except Exception:
                pass

    return {"ok": True}
