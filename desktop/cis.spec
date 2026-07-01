# PyInstaller spec — Carbo Integrated System .exe (bundles the web shell + updater).
# Build:  BUILD-CIS.cmd   or   pyinstaller --clean cis.spec
#
# Note: QtWebEngine is large. This produces a one-file exe; first launch extracts
# and is slower. If you prefer faster startup, change EXE(onefile) to a COLLECT
# (one-folder) build.

import os

spec_dir = os.path.dirname(os.path.abspath(SPEC))
repo_dir = os.path.dirname(spec_dir)
shell_dir = os.path.join(repo_dir, "shell")
updater_script = os.path.join(spec_dir, "scripts", "update_cis.ps1")

datas = []
if os.path.isdir(shell_dir):
    datas.append((shell_dir, "shell"))          # -> _MEIPASS/shell
if os.path.isfile(updater_script):
    datas.append((updater_script, "updater"))    # -> _MEIPASS/updater

a = Analysis(
    [os.path.join(spec_dir, "app.py")],
    pathex=[spec_dir],
    binaries=[],
    datas=datas,
    hiddenimports=[
        "cis_update",
        "version",
        "config",
        "PySide6.QtCore",
        "PySide6.QtGui",
        "PySide6.QtWidgets",
        "PySide6.QtWebEngineCore",
        "PySide6.QtWebEngineWidgets",
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
    ],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="Carbo Integrated System",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
