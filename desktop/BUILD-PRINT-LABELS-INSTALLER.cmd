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

echo Using ISCC: %ISCC%
"%ISCC%" /DAppVer=1.6.4 installer\print_labels.iss
if errorlevel 1 (
  echo BUILD FAILED.
  pause
  exit /b 1
)

echo.
echo Done: installer\Output\CarboPrintLabels-Setup.exe
pause
