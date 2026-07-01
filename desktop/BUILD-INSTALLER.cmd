@echo off
REM Step 2 of release: wrap the one-folder build into CarboCIS-Setup.exe with Inno Setup.
REM Requires Inno Setup (ISCC.exe). Reads the version from version.py.
cd /d "%~dp0"

if not exist "dist\Carbo Integrated System\Carbo Integrated System.exe" (
    echo One-folder build not found. Run BUILD-CIS.cmd first.
    pause
    exit /b 1
)

REM Read X.Y.Z from version.py
for /f "usebackq delims=" %%v in (`powershell -NoProfile -Command "$c=Get-Content 'version.py' -Raw; $x=[regex]::Match($c,'CIS_MAJOR\s*=\s*(\d+)').Groups[1].Value; $y=[regex]::Match($c,'CIS_MODULE\s*=\s*(\d+)').Groups[1].Value; $z=[regex]::Match($c,'CIS_INTERNAL\s*=\s*(\d+)').Groups[1].Value; \"$x.$y.$z\""`) do set CIS_VER=%%v
echo Building installer for version %CIS_VER%...

REM Locate ISCC (adjust if installed elsewhere).
set ISCC=
if exist "%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe" set ISCC=%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe
if exist "%ProgramFiles%\Inno Setup 6\ISCC.exe" set ISCC=%ProgramFiles%\Inno Setup 6\ISCC.exe
if "%ISCC%"=="" (
    echo Could not find ISCC.exe. Install Inno Setup 6 from https://jrsoftware.org/isinfo.php
    pause
    exit /b 1
)

"%ISCC%" /DAppVer=%CIS_VER% "installer\cis.iss"
if errorlevel 1 (
    echo.
    echo INSTALLER BUILD FAILED.
    pause
    exit /b 1
)

echo.
echo Done. Installer: "%~dp0installer\Output\CarboCIS-Setup.exe"
echo Next: scripts\stage-cis-download.ps1  (computes SHA256, writes version.json)
pause
