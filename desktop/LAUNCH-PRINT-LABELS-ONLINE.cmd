@echo off
REM Use bkweb3 print_labels.html (same as browser) until a new installer is on the server.
REM Norton: allow "%LOCALAPPDATA%\Programs\Carbo CIS\Print Labels" if the app exits immediately.
set "CIS_REMOTE_SHELL=1"
set "EXE=%LOCALAPPDATA%\Programs\Carbo CIS\Print Labels\Carbo Print Labels.exe"
if not exist "%EXE%" (
  echo Carbo Print Labels is not installed.
  echo https://bkweb3.bigk.co.uk/cis/app/CarboPrintLabels-Setup.exe
  pause
  exit /b 1
)
start "" /D "%LOCALAPPDATA%\Programs\Carbo CIS\Print Labels" "%EXE%"
