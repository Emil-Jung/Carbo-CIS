"""Configuration for the installed CIS desktop app.

The app bundles the web shell/modules and hosts them locally; data comes from the
cloud APIs. All API URLs are absolute so they work from the desktop (and can be
overridden with environment variables for local development).
"""

import os
import sys
import tempfile


def _is_frozen() -> bool:
    return bool(getattr(sys, "frozen", False))


def _bundle_dir() -> str:
    """Read-only bundled files (the web shell) — PyInstaller _MEIPASS when frozen."""
    if _is_frozen():
        return sys._MEIPASS
    # dev: repo/desktop/.. -> repo root, shell lives at repo/shell
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _data_dir() -> str:
    """Writable files (logs, version.txt) — next to the .exe when packaged."""
    if _is_frozen():
        return os.path.dirname(os.path.abspath(sys.executable))
    return os.path.dirname(os.path.abspath(__file__))


BASE_DIR = _bundle_dir()
DATA_DIR = _data_dir()

# Bundled web shell (index.html, app.js, modules/…). Frozen: _MEIPASS/shell; dev: repo/shell.
SHELL_DIR = os.path.join(BASE_DIR, "shell")

# Cloud API bases (absolute — the desktop app is not served behind nginx).
IDENTITY_API_BASE_URL = os.environ.get("IDENTITY_API_BASE_URL", "").strip() \
    or "https://bkweb3.bigk.co.uk/identity/api"
MAINTENANCE_API_BASE_URL = os.environ.get("MAINTENANCE_API_BASE_URL", "").strip() \
    or "https://bkweb3.bigk.co.uk/maintenance/api"
QUALITY_VIEWER_URL = os.environ.get("QUALITY_VIEWER_URL", "").strip() \
    or "https://bkweb3.bigk.co.uk/quality/viewer/"

# Where the CIS app's own auto-update files live (version.json + the installer).
CIS_DOWNLOAD_BASE_URL = os.environ.get("CIS_DOWNLOAD_BASE_URL", "").strip() \
    or "https://bkweb3.bigk.co.uk/cis/app"

# Persistent WebView2 storage (cookies, localStorage, IndexedDB). Survives restarts
# so future offline traceability data (queued scans/sieving) is retained.
_LOCAL = os.environ.get("LOCALAPPDATA") or tempfile.gettempdir()
STORAGE_DIR = os.path.join(_LOCAL, "CarboCIS", "webview")

# Maintenance Manager .exe lives next to the CIS install (not a folder on C:\ root).
MANAGER_INSTALL_DIR = os.path.join(DATA_DIR, "Maintenance Manager")
