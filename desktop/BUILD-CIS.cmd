@echo off
REM Step 1 of release: build the one-folder app (exe + DLLs) with PyInstaller.
cd /d "%~dp0"

echo Building Carbo Integrated System (one-folder)...
python -m PyInstaller --clean --noconfirm cis.spec
if errorlevel 1 (
    echo.
    echo BUILD FAILED.
    pause
    exit /b 1
)

echo.
echo Done. Output folder: "%~dp0dist\Carbo Integrated System\"
echo Next: BUILD-INSTALLER.cmd  (wraps it into CarboCIS-Setup.exe)
pause
