@echo off
title Serve CIS installer to Big-K (HTTP fallback when scp hangs)
cd /d "%~dp0desktop\cis_download"

if not exist "CarboCIS-Setup.exe" (
    echo CarboCIS-Setup.exe not found. Run BUILD-INSTALLER.cmd and stage-cis-download.ps1 first.
    pause
    exit /b 1
)

echo.
echo  Serving files from this folder on port 8765:
echo    %CD%
echo.
echo  Find your VPN IP on this PC ^(ipconfig - look for the VPN adapter^).
echo  Then ON THE SERVER run:
echo.
echo    mkdir -p ~/cis_app_upload
echo    curl -f -o ~/cis_app_upload/version.json --max-time 30 http://YOUR_PC_VPN_IP:8765/version.json
echo    curl -f -o ~/cis_app_upload/CarboCIS-Setup.exe --max-time 600 http://YOUR_PC_VPN_IP:8765/CarboCIS-Setup.exe
echo    sudo cp ~/cis_app_upload/* /opt/carbo/cis/app/
echo.
echo  Keep this window open until the server download finishes.
echo  Press Ctrl+C here when done.
echo.

python -m http.server 8765 --bind 0.0.0.0
pause
