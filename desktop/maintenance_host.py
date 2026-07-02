"""Launch and embed Carbo Maintenance Manager inside the CIS desktop window."""

from __future__ import annotations

import ctypes
import os
import subprocess
import sys
import threading
import time
from ctypes import wintypes

user32 = ctypes.windll.user32

GWL_STYLE = -16
WS_CAPTION = 0x00C00000
WS_THICKFRAME = 0x00040000
WS_CHILD = 0x40000000
WS_VISIBLE = 0x10000000
SWP_NOZORDER = 0x0004
SWP_SHOWWINDOW = 0x0040

_manager_proc: subprocess.Popen | None = None
_host_hwnd: int | None = None
_chrome_hwnd: int | None = None
_webview_window = None
_watch_thread: threading.Thread | None = None

CHROME_HEIGHT = 44
MANAGER_EXE_NAME = "Carbo Maintenance Manager.exe"
MANAGER_WINDOW_TITLE = "Vehicle Maintenance — Carbo Namibia"


def manager_install_dir(cis_data_dir: str) -> str:
    """Co-located with CIS: …/Programs/Carbo CIS/Maintenance Manager/"""
    return os.path.join(cis_data_dir, "Maintenance Manager")


def manager_exe_path(cis_data_dir: str) -> str:
    return os.path.join(manager_install_dir(cis_data_dir), MANAGER_EXE_NAME)


def resolve_manager_exe(cis_data_dir: str) -> str:
    primary = manager_exe_path(cis_data_dir)
    if os.path.isfile(primary):
        return primary
    legacy = os.path.join(
        os.environ.get("LOCALAPPDATA") or "",
        "CarboMaintenanceManager",
        MANAGER_EXE_NAME,
    )
    if os.path.isfile(legacy):
        return legacy
    raise FileNotFoundError(
        "Maintenance Manager is not installed next to CIS.\n\n"
        f"Expected: {primary}\n\n"
        "Run “UPDATE MANAGER FROM WEB.cmd” once, or copy the app into the "
        "Maintenance Manager folder under your CIS install."
    )


def get_main_window_hwnd(webview_window) -> int | None:
    """Best-effort native HWND for the CIS pywebview window (Windows)."""
    if sys.platform != "win32":
        return None
    native = getattr(webview_window, "native", None)
    if native is not None:
        if hasattr(native, "Handle"):
            return int(native.Handle)
        if isinstance(native, int) and native:
            return native
    gui = getattr(webview_window, "gui", None)
    if gui is not None:
        for attr in ("hwnd", "Handle"):
            val = getattr(gui, attr, None)
            if isinstance(val, int) and val:
                return val
    return None


def _create_host_panel(parent_hwnd: int) -> int:
    rect = wintypes.RECT()
    user32.GetClientRect(parent_hwnd, ctypes.byref(rect))
    width = max(rect.right - rect.left, 400)
    height = max(rect.bottom - rect.top - CHROME_HEIGHT, 200)
    host = user32.CreateWindowExW(
        0,
        "Static",
        None,
        WS_CHILD | WS_VISIBLE,
        0,
        CHROME_HEIGHT,
        width,
        height,
        parent_hwnd,
        None,
        None,
        None,
    )
    if not host:
        raise OSError("Could not create native host panel for Maintenance Manager.")
    return int(host)


def _create_chrome_bar(parent_hwnd: int) -> int:
    rect = wintypes.RECT()
    user32.GetClientRect(parent_hwnd, ctypes.byref(rect))
    width = max(rect.right - rect.left, 400)
    bar = user32.CreateWindowExW(
        0,
        "Static",
        "Maintenance Manager  —  use “Back to CIS” inside the app, or close this module from the taskbar",
        WS_CHILD | WS_VISIBLE,
        12,
        10,
        width - 24,
        CHROME_HEIGHT - 16,
        parent_hwnd,
        None,
        None,
        None,
    )
    return int(bar) if bar else 0


def _find_manager_hwnd(timeout: float = 45.0) -> int | None:
    end = time.time() + timeout
    while time.time() < end:
        hwnd = user32.FindWindowW(None, MANAGER_WINDOW_TITLE)
        if hwnd:
            return int(hwnd)
        time.sleep(0.25)
    return None


def _embed_manager_window(manager_hwnd: int, host_hwnd: int) -> None:
    rect = wintypes.RECT()
    user32.GetClientRect(host_hwnd, ctypes.byref(rect))
    width = rect.right - rect.left
    height = rect.bottom - rect.top
    style = user32.GetWindowLongW(manager_hwnd, GWL_STYLE)
    style = (style & ~WS_CAPTION & ~WS_THICKFRAME) | WS_CHILD
    user32.SetWindowLongW(manager_hwnd, GWL_STYLE, style)
    user32.SetParent(manager_hwnd, host_hwnd)
    user32.SetWindowPos(
        manager_hwnd,
        0,
        0,
        0,
        width,
        height,
        SWP_NOZORDER | SWP_SHOWWINDOW,
    )


def _watch_manager_process(on_closed) -> None:
    global _manager_proc
    proc = _manager_proc
    if not proc:
        return
    proc.wait()
    on_closed()


def _cleanup_native_host() -> None:
    global _host_hwnd, _chrome_hwnd
    if _host_hwnd:
        try:
            user32.DestroyWindow(_host_hwnd)
        except Exception:
            pass
        _host_hwnd = None
    if _chrome_hwnd:
        try:
            user32.DestroyWindow(_chrome_hwnd)
        except Exception:
            pass
        _chrome_hwnd = None


def close_maintenance() -> dict:
    """Stop embedded manager and restore the CIS web shell."""
    global _manager_proc, _webview_window, _watch_thread
    proc = _manager_proc
    _manager_proc = None
    if proc and proc.poll() is None:
        try:
            proc.terminate()
            proc.wait(timeout=5)
        except Exception:
            try:
                proc.kill()
            except Exception:
                pass
    _cleanup_native_host()
    win = _webview_window
    if win is not None:
        try:
            win.show()
        except Exception:
            pass
    return {"ok": True}


def open_maintenance(webview_window, cis_data_dir: str, bearer_token: str | None) -> dict:
    """Hide the web shell briefly, embed Maintenance Manager in the CIS window frame."""
    global _manager_proc, _host_hwnd, _chrome_hwnd, _webview_window, _watch_thread

    if sys.platform != "win32":
        return {"ok": False, "error": "Maintenance Manager embedding requires the Windows CIS desktop app."}

    close_maintenance()
    _webview_window = webview_window

    try:
        exe = resolve_manager_exe(cis_data_dir)
    except FileNotFoundError as exc:
        return {"ok": False, "error": str(exc)}

    parent = get_main_window_hwnd(webview_window)
    if not parent:
        return {"ok": False, "error": "Could not obtain the CIS window handle."}

    try:
        webview_window.hide()
    except Exception:
        pass

    _chrome_hwnd = _create_chrome_bar(parent)
    _host_hwnd = _create_host_panel(parent)

    env = os.environ.copy()
    env["CARBO_CIS_EMBED"] = "1"
    env["CARBO_CIS_MAIN_HWND"] = str(parent)
    if bearer_token:
        env["CARBO_CIS_BEARER_TOKEN"] = bearer_token.strip()

    host_arg = f"--cis-host-hwnd={_host_hwnd}"
    _manager_proc = subprocess.Popen(
        [exe, host_arg],
        env=env,
        cwd=os.path.dirname(exe),
    )

    def _embed_worker() -> None:
        mgr = _find_manager_hwnd()
        if mgr and _host_hwnd:
            _embed_manager_window(mgr, _host_hwnd)

    threading.Thread(target=_embed_worker, daemon=True).start()

    def _on_closed() -> None:
        close_maintenance()
        try:
            webview_window.evaluate_js(
                "if (window.CIS && CIS.showDashboard) CIS.showDashboard();"
            )
        except Exception:
            pass

    _watch_thread = threading.Thread(target=_watch_manager_process, args=(_on_closed,), daemon=True)
    _watch_thread.start()

    return {"ok": True, "exe": exe}


def maintenance_status() -> dict:
    running = bool(_manager_proc and _manager_proc.poll() is None)
    return {"ok": True, "running": running}
