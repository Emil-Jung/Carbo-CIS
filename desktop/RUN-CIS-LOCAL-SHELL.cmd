@echo off
REM Use repo shell/ (not bkweb3) — for label ZPL tuning before DEPLOY-SHELL.
cd /d "%~dp0"
set "CIS_LOCAL_SHELL=1"
call "%~dp0RUN-CIS.cmd"
