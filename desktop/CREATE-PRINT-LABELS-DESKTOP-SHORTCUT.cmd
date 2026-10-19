@echo off
REM Desktop shortcut for label printing only (not CIS web).
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Create-Print-Labels-Desktop-Shortcut.ps1"
pause
