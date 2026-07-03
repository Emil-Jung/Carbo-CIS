"""
Carbo Integrated System — installed desktop shell (WebView2 via pywebview).

A thin host that renders the bundled web shell/modules using the OS Edge WebView2
engine (no bundled Chromium). The shell is served from a local 127.0.0.1 port so it
runs in a secure context (needed later for camera/QR + normal cross-origin API
calls), and the app self-updates from the server by running a silent installer.
"""

from __future__ import annotations

import json
import os
import shutil
import sys
import tempfile
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

import webview

import config
import cis_update
from version import CIS_VERSION
import maintenance_host

WINDOW_TITLE = f"Carbo Integrated System  —  v{CIS_VERSION}"


def _prepare_shell_dir() -> str:
    """Copy the bundled shell to a writable temp dir and write a runtime config.json."""
    dest = os.path.join(tempfile.gettempdir(), "carbo_cis_shell")
    if os.path.isdir(dest):
        shutil.rmtree(dest, ignore_errors=True)
    shutil.copytree(config.SHELL_DIR, dest)

    runtime_config = {
        "appName": "Carbo Integrated System",
        "identityApiBase": config.IDENTITY_API_BASE_URL,
        "maintenanceApiBase": config.MAINTENANCE_API_BASE_URL,
        "qualityViewerUrl": config.QUALITY_VIEWER_URL,
        "qualityCaptureUrl": "https://bkweb3.bigk.co.uk/quality/",
        "qualityApiBase": "https://bkweb3.bigk.co.uk/quality/api",
        "maintenancePwaUrl": "https://bkweb3.bigk.co.uk/maintenance/",
        "producersOfficeUrl": "https://bkweb3.bigk.co.uk/producers/office/",
        "maintenanceManagerUrl": "https://bkweb3.bigk.co.uk/maintenance/manager/",
        "displayTimezone": "Africa/Windhoek",
        "cisVersion": CIS_VERSION,
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


def _native_confirm(title: str, text: str) -> bool:
    """Windows Yes/No box (used for the startup update prompt)."""
    if sys.platform != "win32":
        return False
    import ctypes

    MB_YESNO = 0x4
    MB_ICONQUESTION = 0x20
    IDYES = 6
    return ctypes.windll.user32.MessageBoxW(0, text, title, MB_YESNO | MB_ICONQUESTION) == IDYES


def _quit_and_update(manifest) -> None:
    cis_update.start_update(manifest)
    for win in list(webview.windows):
        try:
            win.destroy()
        except Exception:
            pass


class Api:
    """Exposed to the web shell as window.pywebview.api.* (desktop only)."""

    def app_info(self):
        return {"name": "Carbo Integrated System", "version": CIS_VERSION,
                "installed": cis_update.is_frozen_exe()}

    def check_updates(self):
        try:
            status = cis_update.check_for_update()
        except Exception as exc:
            return {"ok": False, "error": str(exc)}
        return {
            "ok": True,
            "installed": cis_update.is_frozen_exe(),
            "local": status["local_version"],
            "remote": status["remote_version"],
            "available": bool(status["update_available"]),
        }

    def apply_update(self):
        if not cis_update.is_frozen_exe():
            return {"ok": False, "error": "Updates apply only to the installed app."}
        try:
            status = cis_update.check_for_update()
            if not status["update_available"]:
                return {"ok": True, "applied": False}
            _quit_and_update(status["manifest"])
            return {"ok": True, "applied": True}
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    def open_maintenance_manager(self, bearer_token=None):
        if not webview.windows:
            return {"ok": False, "error": "CIS window is not ready."}
        return maintenance_host.open_maintenance(
            webview.windows[0],
            config.DATA_DIR,
            bearer_token,
        )

    def close_maintenance_manager(self):
        return maintenance_host.close_maintenance()

    def maintenance_manager_status(self):
        return maintenance_host.maintenance_status()

    def maintenance_manager_install_dir(self):
        return {
            "ok": True,
            "path": maintenance_host.manager_install_dir(config.DATA_DIR),
            "exe": maintenance_host.manager_exe_path(config.DATA_DIR),
        }


def _startup_update_check():
    if not cis_update.is_frozen_exe():
        return
    try:
        status = cis_update.check_for_update()
    except Exception:
        return  # offline / server down — stay quiet
    if status["update_available"]:
        if _native_confirm(
            "Update available",
            f"A new version of CIS is available.\n\n"
            f"Installed: {status['local_version']}\n"
            f"Available: {status['remote_version']}\n\n"
            "Update now? The app will close, update, and reopen.",
        ):
            _quit_and_update(status["manifest"])


def main():
    shell_dir = _prepare_shell_dir()
    _httpd, port = _start_local_server(shell_dir)
    url = f"http://127.0.0.1:{port}/index.html"

    webview.create_window(WINDOW_TITLE, url, js_api=Api(), width=1240, height=820)

    def _on_start():
        threading.Timer(2.5, _startup_update_check).start()

    os.makedirs(config.STORAGE_DIR, exist_ok=True)
    # private_mode=False + storage_path => localStorage/IndexedDB persist (future offline).
    webview.start(_on_start, storage_path=config.STORAGE_DIR, private_mode=False)


if __name__ == "__main__":
    main()
