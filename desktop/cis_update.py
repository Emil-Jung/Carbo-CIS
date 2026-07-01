"""
Built-in CIS updates (installer model).

Checks version.json on the server; if a newer version exists, a detached PowerShell
helper downloads the signed installer, verifies its SHA256, runs it silently
(per-user, no UAC), and relaunches the app.

Server version.json:
    { "version": "1.2.0", "setup": "CarboCIS-Setup.exe", "sha256": "<hex>", "released": "2026-07-01" }
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import urllib.request
from pathlib import Path
from typing import Any

from config import CIS_DOWNLOAD_BASE_URL, BASE_DIR
from version import CIS_VERSION

APP_EXE_NAME = "Carbo Integrated System.exe"
DEFAULT_SETUP_NAME = "CarboCIS-Setup.exe"
UPDATER_SCRIPT_NAME = "update_cis.ps1"
PARAMS_FILE_NAME = "update_params.json"


def is_frozen_exe() -> bool:
    return bool(getattr(sys, "frozen", False))


def get_install_dir() -> Path:
    if is_frozen_exe():
        return Path(sys.executable).resolve().parent
    return Path(os.environ.get("LOCALAPPDATA", "")) / "CarboIntegratedSystem"


def get_download_base_url() -> str:
    return (CIS_DOWNLOAD_BASE_URL or "").rstrip("/")


def _ssl_verify_enabled() -> bool:
    flag = os.environ.get("API_SSL_VERIFY", "1").strip().lower()
    return flag not in ("0", "false", "no", "off")


def _ssl_context():
    import ssl

    if _ssl_verify_enabled():
        return ssl.create_default_context()
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


def _fetch_json(url: str, timeout: int = 60) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": "CarboIntegratedSystem"})
    with urllib.request.urlopen(req, timeout=timeout, context=_ssl_context()) as resp:
        return json.loads(resp.read().decode("utf-8"))


def parse_version(value: str | None) -> tuple[int, ...]:
    if not value:
        return (0,)
    parts: list[int] = []
    for piece in str(value).strip().split("."):
        try:
            parts.append(int(piece))
        except ValueError:
            parts.append(0)
    return tuple(parts) if parts else (0,)


def version_less(left: str | None, right: str | None) -> bool:
    return parse_version(left) < parse_version(right)


def get_local_version() -> str:
    return CIS_VERSION


def fetch_remote_manifest(base_url: str | None = None) -> dict[str, Any]:
    base = (base_url or get_download_base_url()).rstrip("/")
    manifest = _fetch_json(f"{base}/version.json")
    if not manifest.get("version"):
        raise RuntimeError("Server version.json is missing a version field.")
    return manifest


def check_for_update(base_url: str | None = None) -> dict[str, Any]:
    base = (base_url or get_download_base_url()).rstrip("/")
    manifest = fetch_remote_manifest(base)
    local_version = get_local_version()
    remote_version = str(manifest["version"]).strip()
    return {
        "base_url": base,
        "local_version": local_version,
        "remote_version": remote_version,
        "update_available": version_less(local_version, remote_version),
        "manifest": manifest,
        "install_dir": str(get_install_dir()),
    }


def is_update_available(status: dict[str, Any]) -> bool:
    return bool(status.get("update_available"))


def _bundled_updater_script() -> Path | None:
    candidate = Path(BASE_DIR) / "updater" / UPDATER_SCRIPT_NAME
    return candidate if candidate.is_file() else None


def _updater_work_dir() -> Path:
    """Writable scratch dir for the updater (install dir may be read-only-ish)."""
    base = os.environ.get("LOCALAPPDATA") or os.environ.get("TEMP") or "."
    d = Path(base) / "CarboCIS" / "update"
    d.mkdir(parents=True, exist_ok=True)
    return d


def ensure_updater_script(work_dir: Path) -> Path:
    dest = work_dir / UPDATER_SCRIPT_NAME
    bundled = _bundled_updater_script()
    if bundled:
        dest.write_bytes(bundled.read_bytes())
    elif not dest.is_file():
        raise RuntimeError(f"Updater script not found. Expected {dest} or bundled in the app.")
    return dest


def build_update_params(manifest: dict[str, Any], parent_pid: int | None = None) -> dict[str, Any]:
    install_dir = get_install_dir()
    work_dir = _updater_work_dir()
    setup_name = manifest.get("setup") or DEFAULT_SETUP_NAME
    return {
        "base_url": get_download_base_url(),
        "work_dir": str(work_dir),
        "install_dir": str(install_dir),
        "app_exe": str(install_dir / APP_EXE_NAME),
        "setup_name": setup_name,
        "remote_version": str(manifest.get("version", "")).strip(),
        "sha256": (manifest.get("sha256") or "").strip().lower(),
        "parent_pid": parent_pid or os.getpid(),
        "ssl_verify": _ssl_verify_enabled(),
        "trust_flag": str(install_dir / "trust-internal-ssl.flag"),
    }


def start_update(manifest: dict[str, Any]) -> None:
    """Write params and launch the detached PowerShell installer helper. Does NOT exit;
    the caller should close the app window right after (Windows can't replace files in use)."""
    if not is_frozen_exe():
        raise RuntimeError("Updates only apply to the installed CIS app.")

    work_dir = _updater_work_dir()
    updater_script = ensure_updater_script(work_dir)
    params_path = work_dir / PARAMS_FILE_NAME
    params_path.write_text(json.dumps(build_update_params(manifest), indent=2), encoding="utf-8")

    creationflags = 0
    if sys.platform == "win32":
        creationflags = subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP

    subprocess.Popen(
        [
            "powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass",
            "-WindowStyle", "Hidden", "-File", str(updater_script),
            "-ParamsFile", str(params_path),
        ],
        cwd=str(work_dir),
        creationflags=creationflags,
        close_fds=True,
    )
