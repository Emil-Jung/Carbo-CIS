@echo off
REM Fix a wrong shortcut that opens https://bkweb3.../cis/ in Chrome — this points at the .exe.
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Create-Desktop-Shortcut.ps1"
pause
