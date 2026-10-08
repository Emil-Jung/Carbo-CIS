@echo off
REM Build CarboPrintLabels-Setup.exe (run BUILD-PRINT-LABELS.cmd first).
cd /d "%~dp0"

set "ISCC="
for %%P in (
  "%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe"
  "%ProgramFiles%\Inno Setup 6\ISCC.exe"
  "%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe"
) do if exist %%P set "ISCC=%%~P"

if not defined ISCC (
  echo Inno Setup 6 not found. Install from:
  echo   winget install JRSoftware.InnoSetup --source winget
  echo or https://jrsoftware.org/isdl.php
  pause
  exit /b 1
)

if not exist "dist\Carbo Print Labels\Carbo Print Labels.exe" (
  echo Run BUILD-PRINT-LABELS.cmd first.
  pause
  exit /b 1
)

for /f "delims=" %%V in ('python -c "from version import CIS_VERSION; print(CIS_VERSION)"') do set "AppVer=%%V"
if not defined AppVer (
  echo Could not read version from version.py
  pause
  exit /b 1
)

echo Using ISCC: %ISCC%
echo Building installer v%AppVer% ...
"%ISCC%" /DAppVer=%AppVer% installer\print_labels.iss
if errorlevel 1 (
  echo BUILD FAILED.
  pause
  exit /b 1
)

echo.
echo Done: installer\Output\CarboPrintLabels-Setup-%AppVer%.exe
echo Upload to server as: /opt/carbo/cis/app/CarboPrintLabels-Setup.exe
pause
