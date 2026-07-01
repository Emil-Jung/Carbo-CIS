@echo off
title Upload CIS app to Big-K server
cd /d "%~dp0"

echo.
echo  Upload CarboCIS-Setup.exe + version.json to bkweb3dev@192.168.89.101
echo  (VPN must be connected)
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\publish-cis-to-server.ps1"
echo.
pause
