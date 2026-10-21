"""
Carbo Print Labels — standalone Windows utility (WebView2 via pywebview).

UI and label logic are frozen inside the installed build. Updates only when IT runs
CarboPrintLabels-Setup.exe again. Cloud APIs (login, bag IDs) are unchanged.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import socket
import sys
import tempfile
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

import webview

import config
from version import CIS_VERSION
import a4_label_pdf
import a4_print_host
import printer_usb

WINDOW_TITLE = "Carbo Print Labels"
# Bump when desktop host / bundled shell changes (shown in UI). Release = new installer on each PC.
PRINT_LABELS_APP_BUILD = "20261021-pdf-white-bg"

_LOCAL = os.environ.get("LOCALAPPDATA") or tempfile.gettempdir()
STORAGE_DIR = os.path.join(_LOCAL, "CarboPrintLabels", "webview")

# Copied from repo shell/config.json at build time — not fetched from the network.
_BUNDLED_CFG_KEYS = (
    "shellRev",
    "zebraLabelStockStandardOnly",
    "zebraLabelStockDefault",
    "zebraPrinterHost",
    "zebraPrinterPort",
)


def _prepare_shell_dir() -> str:
    """Copy bundled shell to a temp dir and write runtime API config (no remote files)."""
    tmp_root = tempfile.gettempdir()
    dest = os.path.join(tmp_root, "carbo_print_labels_shell")
    if os.path.lexists(dest):
        shutil.rmtree(dest, ignore_errors=True)
    if os.path.lexists(dest):
        dest = tempfile.mkdtemp(prefix="carbo_print_labels_shell_", dir=tmp_root)
    shutil.copytree(config.SHELL_DIR, dest, dirs_exist_ok=os.path.isdir(dest))

    runtime_config = {
        "appName": "Carbo Print Labels",
        "identityApiBase": config.IDENTITY_API_BASE_URL,
        "traceabilityApiBase": config.TRACEABILITY_API_BASE_URL,
        "displayTimezone": "Africa/Windhoek",
        "cisVersion": CIS_VERSION,
        "printLabelsAppBuild": PRINT_LABELS_APP_BUILD,
        "printLabelsInstallerUrl": f"{config.CIS_DOWNLOAD_BASE_URL.rstrip('/')}/CarboPrintLabels-Setup.exe",
        "zebraPrinterHost": os.environ.get("CIS_ZEBRA_HOST", "192.168.8.73"),
        "zebraPrinterPort": int(os.environ.get("CIS_ZEBRA_PORT", "9100") or "9100"),
    }

    bundled_cfg_path = os.path.join(config.SHELL_DIR, "config.json")
    try:
        with open(bundled_cfg_path, encoding="utf-8") as fh:
            bundled = json.load(fh)
        for key in _BUNDLED_CFG_KEYS:
            if key in bundled:
                runtime_config[key] = bundled[key]
    except (OSError, json.JSONDecodeError):
        pass

    with open(os.path.join(dest, "config.json"), "w", encoding="utf-8") as fh:
        json.dump(runtime_config, fh, indent=2)
    return dest


class _QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def _window_rect_for_work_area(width: int, height: int) -> tuple[int | None, int | None, int, int]:
    """Center on the primary monitor work area (above taskbar) so the bottom is never off-screen."""
    if sys.platform != "win32":
        return None, None, width, height
    try:
        import ctypes
        from ctypes import wintypes

        rect = wintypes.RECT()
        if not ctypes.windll.user32.SystemParametersInfoW(0x0030, 0, ctypes.byref(rect), 0):
            return None, None, width, height
        work_w = int(rect.right - rect.left)
        work_h = int(rect.bottom - rect.top)
        margin = 32
        w = min(width, max(720, work_w - margin))
        h = min(height, max(560, work_h - margin))
        x = int(rect.left + (work_w - w) // 2)
        y = int(rect.top + (work_h - h) // 2)
        return x, y, w, h
    except (AttributeError, OSError, ValueError):
        return None, None, width, height


def _start_local_server(directory: str):
    handler = partial(_QuietHandler, directory=directory)
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    port = httpd.server_address[1]
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, port


class PrintLabelsApi:
    """Exposed to print_labels.html as window.pywebview.api.*"""

    def app_info(self):
        return {
            "name": "Carbo Print Labels",
            "version": CIS_VERSION,
            "build": PRINT_LABELS_APP_BUILD,
            "shell_mode": "bundled",
        }

    def set_window_title(self, title=""):
        title = "Carbo Print Labels"
        try:
            if webview.windows:
                webview.windows[0].title = title
            return {"ok": True}
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    def maximize_window(self):
        try:
            if webview.windows:
                webview.windows[0].maximize()
            return {"ok": True}
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    def print_a4_labels(self, serials=None, printer_name=""):
        return a4_label_pdf.print_serials_to_printer(serials or [], printer_name or "")

    def list_printers(self):
        return printer_usb.list_printers()

    def send_zpl_usb(self, printer_name, zpl=""):
        return printer_usb.send_zpl(printer_name, zpl)

    def open_a4_print(self, html="", auto_print=False):
        return a4_print_host.open_a4_preview(html)

    def test_printer_tcp(self, host, port=9100):
        """Check LAN reachability — ping can succeed while raw print port is blocked."""
        host = (host or "").strip()
        if not host or len(host) > 253 or not re.match(r"^[A-Za-z0-9.:-]+$", host):
            return {"ok": False, "error": "Invalid printer IP address."}
        try:
            port_n = int(port)
        except (TypeError, ValueError):
            return {"ok": False, "error": "Invalid port number."}
        if port_n < 1 or port_n > 65535:
            return {"ok": False, "error": "Invalid port number."}
        try:
            with socket.create_connection((host, port_n), timeout=5):
                pass
        except OSError as exc:
            return {
                "ok": False,
                "error": (
                    f"Cannot connect to {host}:{port_n} — {exc}. "
                    "The printer is on the network but raw printing (port 9100) is blocked or disabled. "
                    "Ask IT to enable TCP port 9100 on the Zebra, or add the printer in Windows Settings "
                    "and use Windows printer mode in this app."
                ),
            }
        return {"ok": True, "host": host, "port": port_n}

    def send_zpl(self, host, port=9100, zpl=""):
        host = (host or "").strip()
        if not host or len(host) > 253 or not re.match(r"^[A-Za-z0-9.:-]+$", host):
            return {"ok": False, "error": "Invalid printer host."}
        try:
            port_n = int(port)
        except (TypeError, ValueError):
            return {"ok": False, "error": "Invalid printer port."}
        if port_n < 1 or port_n > 65535:
            return {"ok": False, "error": "Invalid printer port."}
        if not isinstance(zpl, str) or not zpl.strip():
            return {"ok": False, "error": "No ZPL to send."}
        if len(zpl) > 2_000_000:
            return {"ok": False, "error": "ZPL payload is too large."}
        probe = self.test_printer_tcp(host, port_n)
        if not probe.get("ok"):
            return probe
        try:
            with socket.create_connection((host, port_n), timeout=20) as sock:
                sock.settimeout(20)
                sock.sendall(zpl.encode("utf-8"))
        except OSError as exc:
            return {"ok": False, "error": str(exc)}
        return {"ok": True}


def main():
    shell_dir = _prepare_shell_dir()
    httpd, port = _start_local_server(shell_dir)
    url = f"http://127.0.0.1:{port}/print_labels.html"

    want_w, want_h = 940, 520
    pos_x, pos_y, win_w, win_h = _window_rect_for_work_area(want_w, want_h)

    webview.create_window(
        WINDOW_TITLE,
        url,
        js_api=PrintLabelsApi(),
        width=win_w,
        height=win_h,
        x=pos_x,
        y=pos_y,
        min_size=(860, 500),
        background_color="#f0f0f0",
    )
    os.makedirs(STORAGE_DIR, exist_ok=True)

    def _on_start():
        try:
            if not webview.windows:
                return
            win = webview.windows[0]
            if pos_x is not None and pos_y is not None:
                win.move(pos_x, pos_y)
            win.resize(win_w, win_h)
        except Exception:
            pass

    webview.start(_on_start, storage_path=STORAGE_DIR, private_mode=False)


if __name__ == "__main__":
    main()
