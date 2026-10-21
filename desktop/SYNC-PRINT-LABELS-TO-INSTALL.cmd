@echo off
REM DEV ONLY — copy PyInstaller output into the installed folder on THIS dev PC.
REM Plant label PCs must get updates via CarboPrintLabels-Setup.exe (same file on all three stations).
REM Shortcuts open: %LOCALAPPDATA%\Programs\Carbo CIS\Print Labels\
REM Run BUILD-PRINT-LABELS.cmd first.
cd /d "%~dp0"

set "SRC=%~dp0dist\Carbo Print Labels"
set "DEST=%LOCALAPPDATA%\Programs\Carbo CIS\Print Labels"
set "EXE=Carbo Print Labels.exe"

if not exist "%SRC%\%EXE%" (
  echo Run BUILD-PRINT-LABELS.cmd first — missing:
  echo   %SRC%\%EXE%
  pause
  exit /b 1
)

echo Closing any running Print Labels instance...
taskkill /F /IM "%EXE%" >nul 2>&1
timeout /t 1 /nobreak >nul

if not exist "%DEST%" mkdir "%DEST%"

echo Syncing build to installed location...
echo   FROM: %SRC%
echo   TO:   %DEST%
robocopy "%SRC%" "%DEST%" /MIR /NFL /NDL /NJH /NJS /nc /ns /np
if errorlevel 8 (
  echo robocopy failed with code %errorlevel%
  pause
  exit /b 1
)

if exist "%~dp0assets\print_labels.ico" (
  copy /Y "%~dp0assets\print_labels.ico" "%DEST%\print_labels.ico" >nul
) else if exist "%SRC%\print_labels.ico" (
  copy /Y "%SRC%\print_labels.ico" "%DEST%\print_labels.ico" >nul
)

for /f "delims=" %%T in ('powershell -NoProfile -Command "(Get-Item '%DEST%\%EXE%').LastWriteTime.ToString('yyyy-MM-dd HH:mm')"') do set "STAMP=%%T"
echo. > "%DEST%\print_labels_install_stamp.txt"
echo installed_from=desktop\dist >> "%DEST%\print_labels_install_stamp.txt"
echo synced_at=%STAMP% >> "%DEST%\print_labels_install_stamp.txt"

echo.
echo Done. Shortcuts already target:
echo   %DEST%\%EXE%
echo Reopen Carbo Print Labels from Start or desktop.
pause
