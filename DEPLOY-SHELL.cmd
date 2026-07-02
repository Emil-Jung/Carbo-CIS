@echo off
title Deploy CIS web shell to bkweb3
cd /d "%~dp0"

if not defined CIS_SERVER_SSH set "CIS_SERVER_SSH=bkweb3dev@192.168.89.101"

echo.
echo  CIS web shell deploy
echo  ====================
echo  1. Make sure you already ran:  git add .   git commit   git push
echo  2. VPN must be ON
echo  3. This copies shell/* to /opt/carbo/cis/shell/ (what nginx serves)
echo.
pause

echo Uploading sync script and running on server...
scp -o ConnectTimeout=15 "%~dp0sync_cis_shell_on_server.sh" %CIS_SERVER_SSH%:~/sync_cis_shell_on_server.sh
if errorlevel 1 (
  echo.
  echo SCP failed. Check VPN and SSH: %CIS_SERVER_SSH%
  pause
  exit /b 1
)

ssh -o ConnectTimeout=15 %CIS_SERVER_SSH% "bash ~/sync_cis_shell_on_server.sh"
if errorlevel 1 (
  echo.
  echo Deploy failed. See messages above.
  pause
  exit /b 1
)

echo.
echo Done. Open https://bkweb3.bigk.co.uk/cis/ and press Ctrl+F5
pause
