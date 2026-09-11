@echo off
REM Run CIS from source with no console window.
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0RUN-CIS.ps1"
exit /b %ERRORLEVEL%
