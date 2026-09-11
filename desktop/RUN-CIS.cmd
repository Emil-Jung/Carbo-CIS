@echo off
REM Run CIS from source — no Python console (uses pythonw).
cd /d "%~dp0"

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
