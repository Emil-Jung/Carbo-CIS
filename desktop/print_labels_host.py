"""Launch the standalone Carbo Print Labels desktop utility."""

from __future__ import annotations

import os
import subprocess
import sys

PRINT_LABELS_EXE_NAME = "Carbo Print Labels.exe"


def print_labels_install_dir(cis_data_dir: str) -> str:
    return os.path.join(cis_data_dir, "Print Labels")


def print_labels_exe_path(cis_data_dir: str) -> str:
    return os.path.join(print_labels_install_dir(cis_data_dir), PRINT_LABELS_EXE_NAME)


def resolve_print_labels_exe(cis_data_dir: str) -> str:
    local_app = os.environ.get("LOCALAPPDATA", "")
    candidates = [
        print_labels_exe_path(cis_data_dir),
        os.path.join(local_app, "Programs", "Carbo CIS", "Print Labels", PRINT_LABELS_EXE_NAME),
    ]
    for path in candidates:
        if path and os.path.isfile(path):
            return path
    primary = print_labels_exe_path(cis_data_dir)
    raise FileNotFoundError(
        "Carbo Print Labels is not installed.\n\n"
        f"Expected: {primary}\n\n"
        "Install from Start menu setup, or download CarboPrintLabels-Setup.exe from /cis/app/."
    )


def open_print_labels(cis_data_dir: str, bearer_token: str | None = None) -> dict:
    if sys.platform != "win32":
        return {"ok": False, "error": "Print Labels requires Windows."}
    try:
        exe = resolve_print_labels_exe(cis_data_dir)
    except FileNotFoundError as exc:
        return {"ok": False, "error": str(exc)}

    env = os.environ.copy()
    if bearer_token:
        env["CIS_LAUNCH_TOKEN"] = bearer_token

    try:
        subprocess.Popen([exe], env=env, cwd=os.path.dirname(exe))
    except OSError as exc:
        return {"ok": False, "error": str(exc)}
    return {"ok": True, "path": exe}
