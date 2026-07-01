# PyInstaller spec — Carbo Integrated System (one-FOLDER build).
# Uses pywebview (WebView2), so no bundled Chromium. Build: BUILD-CIS.cmd
#
# Produces dist\Carbo Integrated System\  (exe + DLLs). Inno Setup then wraps that
# folder into CarboCIS-Setup.exe (see installer\cis.iss / BUILD-INSTALLER.cmd).

import os

spec_dir = os.path.dirname(os.path.abspath(SPEC))
repo_dir = os.path.dirname(spec_dir)
shell_dir = os.path.join(repo_dir, "shell")
updater_script = os.path.join(spec_dir, "scripts", "update_cis.ps1")

datas = []
if os.path.isdir(shell_dir):
    datas.append((shell_dir, "shell"))          # -> _internal/shell
if os.path.isfile(updater_script):
    datas.append((updater_script, "updater"))    # -> _internal/updater

a = Analysis(
    [os.path.join(spec_dir, "app.py")],
    pathex=[spec_dir],
    binaries=[],
    datas=datas,
    hiddenimports=[
        "cis_update",
        "version",
        "config",
        "webview",
        "webview.platforms.edgechromium",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        "tkinter",
        "matplotlib",
        "numpy",
        "pandas",
        "scipy",
        "PySide6",
        "PyQt5",
        "PyQt6",
    ],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="Carbo Integrated System",
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
    name="Carbo Integrated System",
)
