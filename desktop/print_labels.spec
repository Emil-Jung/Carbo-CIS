# PyInstaller spec — Carbo Print Labels (standalone utility, one-folder build).

import os

spec_dir = os.path.dirname(os.path.abspath(SPEC))
repo_dir = os.path.dirname(spec_dir)
shell_dir = os.path.join(repo_dir, "shell")

datas = []
if os.path.isdir(shell_dir):
    datas.append((shell_dir, "shell"))

a = Analysis(
    [os.path.join(spec_dir, "print_labels_app.py")],
    pathex=[spec_dir],
    binaries=[],
    datas=datas,
    hiddenimports=[
        "version",
        "config",
        "a4_label_pdf",
        "a4_print_host",
        "printer_usb",
        "qrcode",
        "PIL",
        "PIL.ImageWin",
        "win32print",
        "win32ui",
        "win32con",
        "pywintypes",
        "webview",
        "webview.platforms.edgechromium",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=["tkinter", "matplotlib", "numpy", "pandas", "scipy", "PySide6", "PyQt5", "PyQt6"],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="Carbo Print Labels",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="Carbo Print Labels",
)
