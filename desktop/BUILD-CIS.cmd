@echo off
REM Build the Carbo Integrated System .exe (one file, bundles the web shell).
cd /d "%~dp0"

echo Building Carbo Integrated System...
python -m PyInstaller --clean --noconfirm cis.spec
if errorlevel 1 (
    echo.
    echo BUILD FAILED.
    pause
    exit /b 1
)

echo.
echo Done. Output: "%~dp0dist\Carbo Integrated System.exe"
echo Next: run PUBLISH steps to compute SHA256, write version.json, and upload.
pause
