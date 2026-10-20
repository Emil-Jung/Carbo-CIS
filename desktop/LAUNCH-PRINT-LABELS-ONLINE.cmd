@echo off
REM Launch the installed Print Labels .exe (UI is bundled in the installer; not loaded from bkweb3).
REM Norton: allow "%LOCALAPPDATA%\Programs\Carbo CIS\Print Labels" if the app exits immediately.
set "EXE=%LOCALAPPDATA%\Programs\Carbo CIS\Print Labels\Carbo Print Labels.exe"
if not exist "%EXE%" (
  echo Carbo Print Labels is not installed.
  echo https://bkweb3.bigk.co.uk/cis/app/CarboPrintLabels-Setup.exe
  pause
  exit /b 1
)
start "" /D "%LOCALAPPDATA%\Programs\Carbo CIS\Print Labels" "%EXE%"
