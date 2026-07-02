@echo off
title Upload CIS installer exe (large file)
cd /d "%~dp0"
set CIS_SERVER_SSH=bkweb3dev@192.168.89.101
call "%~dp0scripts\cis-upload-env.cmd"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\upload-cis-file.ps1" -FileName CarboCIS-Setup.exe
pause
