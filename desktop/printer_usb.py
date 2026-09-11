"""Send raw ZPL to a Windows printer (USB or shared) by spooler name."""

from __future__ import annotations

import sys


def list_printers() -> dict:
    if sys.platform != "win32":
        return {"ok": False, "printers": [], "error": "USB printing is available on Windows desktop CIS only."}
    try:
        import win32print
    except ImportError:
        return {
            "ok": False,
            "printers": [],
            "error": "pywin32 is required for USB printing (pip install pywin32).",
        }
    flags = win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS
    names = sorted({row[2] for row in win32print.EnumPrinters(flags) if row[2]})
    return {"ok": True, "printers": names}


def send_zpl(printer_name: str, zpl: str) -> dict:
    printer_name = (printer_name or "").strip()
    if not printer_name:
        return {"ok": False, "error": "Select a Windows printer."}
    if not isinstance(zpl, str) or not zpl.strip():
        return {"ok": False, "error": "No ZPL to send."}
    if len(zpl) > 2_000_000:
        return {"ok": False, "error": "ZPL payload is too large."}
    if sys.platform != "win32":
        return {"ok": False, "error": "USB printing is available on Windows desktop CIS only."}
    try:
        import win32print
    except ImportError:
        return {"ok": False, "error": "pywin32 is required for USB printing."}

    data = zpl.encode("utf-8")
    handle = None
    try:
        handle = win32print.OpenPrinter(printer_name)
        job = win32print.StartDocPrinter(handle, 1, ("CIS Print Labels", None, "RAW"))
        win32print.StartPagePrinter(handle)
        win32print.WritePrinter(handle, data)
        win32print.EndPagePrinter(handle)
        win32print.EndDocPrinter(handle)
    except Exception as exc:
        return {"ok": False, "error": str(exc)}
    finally:
        if handle:
            try:
                win32print.ClosePrinter(handle)
            except Exception:
                pass
    return {"ok": True}
