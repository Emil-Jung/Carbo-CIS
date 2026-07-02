@echo off
title Carbo CIS — regenerate shell icons from logo
cd /d "%~dp0.."
set LOGO=CIS APP logo.png
set ASSETS=shell\assets

if not exist "%LOGO%" (
  echo ERROR: Logo not found: %CD%\%LOGO%
  exit /b 1
)

copy /Y "%LOGO%" "%ASSETS%\logo.png" >nul
echo Copied logo to %ASSETS%\logo.png

python "%~dp0generate_shell_icons.py"
if errorlevel 1 exit /b 1

echo.
echo Done. Icons are in %ASSETS%\
echo Deploy shell to server when ready.
