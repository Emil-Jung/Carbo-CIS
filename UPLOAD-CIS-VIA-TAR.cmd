@echo off
title Upload CIS files via tar+ssh (when scp hangs)
cd /d "%~dp0desktop\cis_download"

if not exist "CarboCIS-Setup.exe" (
    echo Missing CarboCIS-Setup.exe — run BUILD-INSTALLER.cmd and stage-cis-download.ps1 first.
    pause
    exit /b 1
)

set "SSH=bkweb3dev@192.168.89.101"
if defined CIS_SERVER_SSH set "SSH=%CIS_SERVER_SSH%"

echo.
echo  Upload via tar+ssh to %SSH%
echo  You will be asked for your SSH password ONCE.
echo  The installer is ~18 MB — allow several minutes after password.
echo.

tar cf - version.json CarboCIS-Setup.exe | ssh -o ConnectTimeout=15 %SSH% "mkdir -p cis_app_upload && cd cis_app_upload && tar xf -"

if errorlevel 1 (
    echo.
    echo UPLOAD FAILED.
    echo Try WinSCP: host 192.168.89.101 user bkweb3dev folder cis_app_upload
    pause
    exit /b 1
)

echo.
echo Upload OK. On the server run:
echo   sudo cp ~/cis_app_upload/* /opt/carbo/cis/app/
echo   ls -la /opt/carbo/cis/app/
echo.
echo Verify in browser: https://bkweb3.bigk.co.uk/cis/app/version.json
pause
