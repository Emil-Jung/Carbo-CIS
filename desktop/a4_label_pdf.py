"""Print A4 pallet labels to a named Windows printer (single-sided, no dialog)."""

from __future__ import annotations

import subprocess
import sys

import qrcode
from PIL import Image, ImageDraw, ImageFont, ImageWin

# Printed QR width (mm) — tuned for wrap-station scanning at arm's length.
A4_QR_SIZE_MM = 135
# Compact PDF export (Microsoft Print to PDF embeds huge full-page rasters).
PDF_EXPORT_DPI = 200
A4_WIDTH_MM = 210
A4_HEIGHT_MM = 297
A4_TOP_PAD_MM = 52
A4_TEXT_GAP_MM = 10
A4_TEXT_PT = 26


def _validate_serial(serial: str) -> str:
    serial = (serial or "").strip()
    if not serial or len(serial) > 64:
        raise ValueError("Invalid Bag ID for A4 label.")
    return serial


def _printer_names() -> set[str]:
    import win32print

    flags = win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS
    network = getattr(win32print, "PRINTER_ENUM_NETWORK", 0)
    names: set[str] = set()
    for flag_set in (flags, flags | network):
        try:
            names.update(row[2] for row in win32print.EnumPrinters(flag_set) if row[2])
        except Exception:
            pass
    return names


def _qr_image(serial: str, size_px: int) -> Image.Image:
    """Crisp 1-bit QR — LANCZOS/RGB upscaling prints as washed-out gray on many A4 lasers."""
    factory = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=12,
        border=2,
    )
    factory.add_data(serial)
    factory.make(fit=True)
    # qrcode treats fill_color=0 as missing — use named colours or the QR renders solid black.
    img = factory.make_image(fill_color="black", back_color="white").convert("L")
    if size_px >= 8 and img.width != size_px:
        img = img.resize((size_px, size_px), Image.NEAREST)
    # Pure black/white only (no anti-aliased module edges).
    return img.point(lambda p: 0 if p < 128 else 255, mode="1").convert("RGB")


def _apply_devmode(hdc, devmode) -> None:
    """Apply DEVMODE (simplex/portrait). PyCDC.ResetDC was removed in pywin32 ≥ 306."""
    if not devmode:
        return
    try:
        reset = getattr(hdc, "ResetDC", None)
        if callable(reset):
            reset(devmode)
            return
    except Exception:
        pass
    try:
        import win32gui

        win32gui.ResetDC(hdc.GetHandleOutput(), devmode)
    except Exception:
        pass


def _is_pdf_printer(printer_name: str) -> bool:
    return "pdf" in (printer_name or "").lower()


def _mm_to_px(mm: float, dpi: int) -> int:
    return max(1, int(round(mm / 25.4 * dpi)))


def _prompt_save_pdf_path(default_name: str) -> str | None:
    """Windows Save As — avoids Microsoft Print to PDF multi‑hundred‑MB raster files."""
    safe = (default_name or "Carbo-A4-labels.pdf").replace('"', "`")
    script = (
        "Add-Type -AssemblyName System.Windows.Forms; "
        "$d = New-Object System.Windows.Forms.SaveFileDialog; "
        "$d.Filter = 'PDF (*.pdf)|*.pdf'; "
        f'$d.FileName = "{safe}"; '
        "if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { $d.FileName }"
    )
    try:
        proc = subprocess.run(
            ["powershell", "-NoProfile", "-Sta", "-Command", script],
            capture_output=True,
            text=True,
            timeout=600,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    path = (proc.stdout or "").strip()
    return path or None


def _render_a4_page_image(serial: str, dpi: int) -> Image.Image:
    page_w = _mm_to_px(A4_WIDTH_MM, dpi)
    page_h = _mm_to_px(A4_HEIGHT_MM, dpi)
    page = Image.new("RGB", (page_w, page_h), (255, 255, 255))
    qr_px = _mm_to_px(A4_QR_SIZE_MM, dpi)
    qr = _qr_image(serial, qr_px)
    x0 = max(0, (page_w - qr_px) // 2)
    y0 = _mm_to_px(A4_TOP_PAD_MM, dpi)
    page.paste(qr, (x0, y0))

    draw = ImageDraw.Draw(page)
    font_px = max(12, int(round(A4_TEXT_PT / 72.0 * dpi)))
    try:
        font = ImageFont.truetype("arialbd.ttf", font_px)
    except OSError:
        try:
            font = ImageFont.truetype("Arial Bold.ttf", font_px)
        except OSError:
            font = ImageFont.load_default()
    text_y = y0 + qr_px + _mm_to_px(A4_TEXT_GAP_MM, dpi)
    bbox = draw.textbbox((0, 0), serial, font=font)
    text_w = bbox[2] - bbox[0]
    draw.text(((page_w - text_w) // 2, text_y), serial, fill=0, font=font)
    return page


def write_serials_pdf_file(serials: list[str], path: str) -> dict:
    pages = [_render_a4_page_image(s, PDF_EXPORT_DPI) for s in serials]
    pages[0].save(
        path,
        format="PDF",
        save_all=True,
        append_images=pages[1:],
        resolution=PDF_EXPORT_DPI,
        optimize=True,
    )
    return {
        "ok": True,
        "printer": "PDF file",
        "pages": len(pages),
        "path": path,
        "duplex": "simplex",
        "pdf_compact": True,
    }


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

    if _is_pdf_printer(printer_name):
        first = validated[0].replace("/", "-")
        last = validated[-1].replace("/", "-")
        default = (
            f"Carbo-A4-{first}.pdf"
            if len(validated) == 1
            else f"Carbo-A4-{first}_to_{last}.pdf"
        )
        save_path = _prompt_save_pdf_path(default)
        if not save_path:
            return {"ok": False, "error": "PDF save cancelled."}
        if not save_path.lower().endswith(".pdf"):
            save_path += ".pdf"
        try:
            return write_serials_pdf_file(validated, save_path)
        except OSError as exc:
            return {"ok": False, "error": str(exc)}

    devmode = _devmode_simplex(printer_name)
    hdc = win32ui.CreateDC()
    try:
        # pywin32 ≥ 306: CreateDC() returns PyCDC — use CreatePrinterDC, not CreateDC(...).
        hdc.CreatePrinterDC(printer_name)
        _apply_devmode(hdc, devmode)

        page_w = hdc.GetDeviceCaps(win32con.HORZRES)
        page_h = hdc.GetDeviceCaps(win32con.VERTRES)
        dpi_x = hdc.GetDeviceCaps(win32con.LOGPIXELSX)
        dpi_y = hdc.GetDeviceCaps(win32con.LOGPIXELSY)

        qr_px = max(1, int(A4_QR_SIZE_MM / 25.4 * dpi_x))
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
