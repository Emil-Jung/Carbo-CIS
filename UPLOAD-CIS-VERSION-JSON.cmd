@echo off
title Upload CIS version.json only (small file test)
cd /d "%~dp0"
set CIS_SERVER_SSH=bkweb3dev@192.168.89.101
call "%~dp0scripts\cis-upload-env.cmd"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\upload-cis-file.ps1" -FileName version.json
pause
