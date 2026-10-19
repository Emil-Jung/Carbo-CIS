@echo off
REM Run CIS desktop from source (WebView2 window, bundled repo shell — NOT the browser URL).
REM For bkweb3 web shell inside the window: set CIS_REMOTE_SHELL=1 before running.
cd /d "%~dp0"
set "CIS_LOCAL_SHELL=1"

set "PYW=%~dp0.venv\Scripts\pythonw.exe"
if exist "%PYW%" goto :launch

for /f "delims=" %%i in ('where pythonw 2^>nul') do (
  set "PYW=%%i"
  goto :launch
)

REM Fallback: resolve via PowerShell (handles paths with spaces reliably).
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0RUN-CIS.ps1"
set "ERR=%ERRORLEVEL%"
if not "%ERR%"=="0" pause
exit /b %ERR%

:launch
start "" "%PYW%" "%~dp0app.py"
exit /b 0
