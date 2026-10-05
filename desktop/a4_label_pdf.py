"""Print A4 pallet labels to a named Windows printer (single-sided, no dialog)."""

from __future__ import annotations

import sys

import qrcode
from PIL import Image, ImageWin


def _validate_serial(serial: str) -> str:
    serial = (serial or "").strip()
    if not serial or len(serial) > 64:
        raise ValueError("Invalid Bag ID for A4 label.")
    return serial


def _printer_names() -> set[str]:
    import win32print

    flags = win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS
    return {row[2] for row in win32print.EnumPrinters(flags) if row[2]}


def _qr_image(serial: str, size_px: int) -> Image.Image:
    qr = qrcode.make(serial, box_size=8, border=2).convert("RGB")
    if size_px < 8:
        return qr
    return qr.resize((size_px, size_px), Image.LANCZOS)


def _devmode_simplex(printer_name: str):
    import win32con
    import win32print

    handle = win32print.OpenPrinter(printer_name)
    try:
        devmode = win32print.GetPrinter(handle, 2).get("pDevMode")
        if not devmode:
            return None
        devmode.Duplex = win32con.DMDUP_SIMPLEX
        devmode.Fields = devmode.Fields | win32con.DM_DUPLEX
        devmode.Orientation = win32con.DMORIENT_PORTRAIT
        devmode.Fields = devmode.Fields | win32con.DM_ORIENTATION
        return devmode
    finally:
        win32print.ClosePrinter(handle)


def print_serials_to_printer(serials, printer_name: str) -> dict:
    if not isinstance(serials, list) or not serials:
        return {"ok": False, "error": "No labels to print."}
    if sys.platform != "win32":
        return {"ok": False, "error": "A4 printing is available on Windows only."}

    printer_name = (printer_name or "").strip()
    if not printer_name:
        return {"ok": False, "error": "Select the A4 printer in the Printer panel."}

    try:
        import win32con
        import win32print
        import win32ui
    except ImportError:
        return {"ok": False, "error": "pywin32 is required for A4 printing."}

    names = _printer_names()
    if printer_name not in names:
        return {"ok": False, "error": f"Printer not found in Windows: {printer_name}"}

    try:
        validated = [_validate_serial(str(s)) for s in serials]
    except ValueError as exc:
        return {"ok": False, "error": str(exc)}

    devmode = _devmode_simplex(printer_name)
    hdc = win32ui.CreateDC()
    try:
        if devmode:
            hdc.CreateDC("WINSPOOL", printer_name, None, devmode)
        else:
            hdc.CreatePrinterDC(printer_name)
            if devmode:
                hdc.ResetDC(devmode)

        page_w = hdc.GetDeviceCaps(win32con.HORZRES)
        page_h = hdc.GetDeviceCaps(win32con.VERTRES)
        dpi_x = hdc.GetDeviceCaps(win32con.LOGPIXELSX)
        dpi_y = hdc.GetDeviceCaps(win32con.LOGPIXELSY)

        qr_px = max(1, int(85 / 25.4 * dpi_x))
        top_pad_px = int(52 / 25.4 * dpi_y)
        gap_px = int(10 / 25.4 * dpi_y)

        font = win32ui.CreateFont(
            {
                "name": "Arial",
                "height": max(12, int(26 / 72.0 * dpi_y)),
                "weight": win32con.FW_BOLD,
            }
        )

        hdc.StartDoc("Carbo A4 Pallet Labels")
        for serial in validated:
            hdc.StartPage()
            img = _qr_image(serial, qr_px)
            dib = ImageWin.Dib(img)
            x0 = max(0, (page_w - qr_px) // 2)
            y0 = top_pad_px
            dib.draw(hdc.GetHandleOutput(), (x0, y0, x0 + qr_px, y0 + qr_px))

            hdc.SelectObject(font)
            text_w, _text_h = hdc.GetTextExtent(serial)
            text_x = max(0, (page_w - text_w) // 2)
            text_y = y0 + qr_px + gap_px
            hdc.TextOut(text_x, text_y, serial)
            hdc.EndPage()
        hdc.EndDoc()
    except Exception as exc:
        return {"ok": False, "error": str(exc)}
    finally:
        try:
            hdc.DeleteDC()
        except Exception:
            pass

    return {"ok": True, "printer": printer_name, "pages": len(validated), "duplex": "simplex"}
