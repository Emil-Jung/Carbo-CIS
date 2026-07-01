"""
Carbo Integrated System — installed desktop shell.

A thin PySide6 window that hosts the bundled web shell/modules in an embedded
browser. The shell is served from a local 127.0.0.1 port (so cross-origin calls to
the cloud APIs behave normally) and the app self-updates like the Manager app.
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

from PySide6.QtCore import QUrl, QTimer
from PySide6.QtGui import QAction
from PySide6.QtWidgets import QApplication, QMainWindow, QMessageBox
from PySide6.QtWebEngineWidgets import QWebEngineView

import config
import cis_update
from version import CIS_VERSION

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
        "cisVersion": CIS_VERSION,
    }
    with open(os.path.join(dest, "config.json"), "w", encoding="utf-8") as fh:
        json.dump(runtime_config, fh, indent=2)
    return dest


def _start_local_server(directory: str):
    """Serve `directory` on an ephemeral localhost port. Returns (httpd, port)."""
    handler = partial(_QuietHandler, directory=directory)
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    port = httpd.server_address[1]
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    return httpd, port


class _QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):  # silence console spam
        pass


class MainWindow(QMainWindow):
    def __init__(self, url: str):
        super().__init__()
        self.setWindowTitle(WINDOW_TITLE)
        self.resize(1240, 820)
        self.view = QWebEngineView()
        self.setCentralWidget(self.view)
        self.view.load(QUrl(url))
        self._build_menu()
        QTimer.singleShot(2500, self._startup_update_check)

    def _build_menu(self):
        help_menu = self.menuBar().addMenu("Help")
        act_update = QAction("Check for updates…", self)
        act_update.triggered.connect(self.check_for_updates)
        help_menu.addAction(act_update)
        help_menu.addSeparator()
        act_about = QAction("About", self)
        act_about.triggered.connect(self.show_about)
        help_menu.addAction(act_about)

    def show_about(self):
        QMessageBox.information(
            self,
            "About",
            f"Carbo Integrated System\nVersion {CIS_VERSION}\n\n"
            "Version format  X.Y.Z\n"
            "  X = CIS version\n"
            "  Y = module adjustments\n"
            "  Z = internal build",
        )

    def _startup_update_check(self):
        if not cis_update.is_frozen_exe():
            return
        try:
            status = cis_update.check_for_update()
        except Exception:
            return  # offline / server down — stay quiet on startup
        if cis_update.is_update_available(status):
            self._prompt_update(status)

    def check_for_updates(self):
        try:
            status = cis_update.check_for_update()
        except Exception as exc:
            QMessageBox.warning(self, "Updates", f"Could not check for updates:\n{exc}")
            return
        if not cis_update.is_frozen_exe():
            QMessageBox.information(
                self, "Updates",
                f"Current version {status['local_version']}.\n"
                "Auto-update applies only to the installed app.",
            )
            return
        if cis_update.is_update_available(status):
            self._prompt_update(status)
        else:
            QMessageBox.information(self, "Updates", f"You are up to date (v{status['local_version']}).")

    def _prompt_update(self, status):
        answer = QMessageBox.question(
            self,
            "Update available",
            f"A new version of CIS is available.\n\n"
            f"Installed: {status['local_version']}\n"
            f"Available: {status['remote_version']}\n\n"
            "Update now? The app will close and reopen.",
        )
        if answer == QMessageBox.StandardButton.Yes:
            try:
                cis_update.launch_update_and_exit(status["manifest"], QApplication.instance())
            except Exception as exc:
                QMessageBox.warning(self, "Updates", f"Update failed to start:\n{exc}")


def main():
    app = QApplication(sys.argv)
    app.setApplicationName("Carbo Integrated System")
    shell_dir = _prepare_shell_dir()
    _httpd, port = _start_local_server(shell_dir)
    window = MainWindow(f"http://127.0.0.1:{port}/index.html")
    window.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
