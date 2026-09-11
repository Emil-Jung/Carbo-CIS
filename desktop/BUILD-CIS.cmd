@echo off
REM Step 1 of release: build the one-folder app (exe + DLLs) with PyInstaller.
cd /d "%~dp0"

echo Closing any running CIS instance...
taskkill /F /IM "Carbo Integrated System.exe" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq Carbo Integrated System*" >nul 2>&1
timeout /t 1 /nobreak >nul

echo Clearing old build output (close File Explorer on desktop\dist if this fails)...
if exist build attrib -R build /S /D >nul 2>&1
if exist dist attrib -R dist /S /D >nul 2>&1
if exist build rmdir /S /Q build >nul 2>&1
if exist "dist\Carbo Integrated System" rmdir /S /Q "dist\Carbo Integrated System" >nul 2>&1

echo Building Carbo Integrated System (one-folder)...
python -m PyInstaller --noconfirm cis.spec
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
