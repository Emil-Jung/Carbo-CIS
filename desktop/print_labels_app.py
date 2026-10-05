"""
Carbo Print Labels — standalone Windows utility (WebView2 via pywebview).

Hosts only the label printing module (Zebra + A4). Launched from the CIS PWA tile
via carbolabels:// or from the installed CIS desktop app.
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
import printer_usb

WINDOW_TITLE = f"Carbo Print Labels  —  v{CIS_VERSION}"

REMOTE_SHELL_URL = (
    os.environ.get("CIS_PRINT_LABELS_URL", "").strip()
    or "https://bkweb3.bigk.co.uk/cis/print_labels.html"
)

_LOCAL = os.environ.get("LOCALAPPDATA") or tempfile.gettempdir()
STORAGE_DIR = os.path.join(_LOCAL, "CarboPrintLabels", "webview")


def _use_local_shell_only() -> bool:
    return os.environ.get("CIS_LOCAL_SHELL", "").strip().lower() in ("1", "true", "yes")


def _remote_shell_available() -> bool:
    if _use_local_shell_only():
        return False
    try:
        import urllib.error
        import urllib.request

        cfg_url = REMOTE_SHELL_URL.rsplit("/", 1)[0] + "/config.json"
        req = urllib.request.Request(cfg_url, method="GET")
        with urllib.request.urlopen(req, timeout=6) as resp:
            return resp.status == 200
    except Exception:
        return False


def _prepare_shell_dir() -> str:
    dest = os.path.join(tempfile.gettempdir(), "carbo_print_labels_shell")
    if os.path.lexists(dest):
        shutil.rmtree(dest, ignore_errors=True)
    if os.path.lexists(dest):
        dest = tempfile.mkdtemp(prefix="carbo_print_labels_shell_", dir=tempfile.gettempdir())
    shutil.copytree(config.SHELL_DIR, dest, dirs_exist_ok=os.path.isdir(dest))

    runtime_config = {
        "appName": "Carbo Print Labels",
        "identityApiBase": config.IDENTITY_API_BASE_URL,
        "traceabilityApiBase": config.TRACEABILITY_API_BASE_URL,
        "displayTimezone": "Africa/Windhoek",
        "cisVersion": CIS_VERSION,
        "printLabelsInstallerUrl": f"{config.CIS_DOWNLOAD_BASE_URL.rstrip('/')}/CarboPrintLabels-Setup.exe",
    }
    with open(os.path.join(dest, "config.json"), "w", encoding="utf-8") as fh:
        json.dump(runtime_config, fh, indent=2)
    return dest


class _QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def _start_local_server(directory: str):
    handler = partial(_QuietHandler, directory=directory)
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    port = httpd.server_address[1]
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, port


class PrintLabelsApi:
    """Exposed to print_labels.html as window.pywebview.api.*"""

    def app_info(self):
        return {"name": "Carbo Print Labels", "version": CIS_VERSION}

    def list_printers(self):
        return printer_usb.list_printers()

    def send_zpl_usb(self, printer_name, zpl=""):
        return printer_usb.send_zpl(printer_name, zpl)

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
        try:
            with socket.create_connection((host, port_n), timeout=20) as sock:
                sock.settimeout(20)
                sock.sendall(zpl.encode("utf-8"))
        except OSError as exc:
            return {"ok": False, "error": str(exc)}
        return {"ok": True}


def main():
    if _remote_shell_available():
        url = REMOTE_SHELL_URL
    else:
        shell_dir = _prepare_shell_dir()
        httpd, port = _start_local_server(shell_dir)
        url = f"http://127.0.0.1:{port}/print_labels.html"

    webview.create_window(WINDOW_TITLE, url, js_api=PrintLabelsApi(), width=1100, height=820)
    os.makedirs(STORAGE_DIR, exist_ok=True)
    webview.start(storage_path=STORAGE_DIR, private_mode=False)


if __name__ == "__main__":
    main()
