@echo off
REM Build the standalone Carbo Print Labels utility (PyInstaller one-folder).
REM Run BEFORE BUILD-INSTALLER.cmd so cis.iss can bundle Print Labels into CarboCIS-Setup.exe.
cd /d "%~dp0"

echo Closing any running Print Labels instance...
taskkill /F /IM "Carbo Print Labels.exe" >nul 2>&1
timeout /t 1 /nobreak >nul

if exist build\print_labels rmdir /S /Q build\print_labels >nul 2>&1
if exist "dist\Carbo Print Labels" rmdir /S /Q "dist\Carbo Print Labels" >nul 2>&1

echo Building Carbo Print Labels (one-folder)...
python -m PyInstaller --noconfirm print_labels.spec
if errorlevel 1 (
    echo.
    echo BUILD FAILED.
    pause
    exit /b 1
)

echo.
echo Done. Output: "%~dp0dist\Carbo Print Labels\Carbo Print Labels.exe"
echo Next: BUILD-CIS.cmd  then  BUILD-INSTALLER.cmd
pause
