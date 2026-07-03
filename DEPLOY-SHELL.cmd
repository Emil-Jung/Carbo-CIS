@echo off
title Deploy CIS web shell to bkweb3
cd /d "%~dp0"

if not defined CIS_SERVER_SSH set "CIS_SERVER_SSH=bkweb3dev@192.168.89.101"

echo.
echo  CIS web shell deploy
echo  ====================
echo  1. Commit and push from this PC first (deploy only pulls on the server)
echo  2. VPN must be ON
echo  3. This copies shell/* to /opt/carbo/cis/shell/ (what nginx serves)
echo.

git fetch origin master 2>nul
if errorlevel 1 (
  echo WARN: Could not reach origin — check network/VPN before deploy.
) else (
  git rev-list --count origin/master..HEAD 2>nul | findstr /r "^[1-9]" >nul
  if not errorlevel 1 (
    echo ERROR: Local commits not pushed — server will not get your changes.
    echo   git push origin master
    echo   DEPLOY-SHELL.cmd
    echo.
    pause
    exit /b 1
  )
)

git diff --quiet shell 2>nul
if errorlevel 1 (
  echo WARN: You still have uncommitted changes under shell\ on this PC.
  echo       The server will get what you already pushed — not these local edits.
  git status --short shell
  echo.
  echo Press any key to deploy pushed commits anyway, or Ctrl+C to cancel.
  pause
)

echo Running deploy on server (git pull + copy shell to nginx)...
ssh -o ConnectTimeout=15 %CIS_SERVER_SSH% "cd /opt/carbo/carbo-cis && git pull origin master && bash deploy_on_server.sh"
if errorlevel 1 (
  echo.
  echo Deploy failed. See messages above.
  pause
  exit /b 1
)

echo.
echo Done. Open https://bkweb3.bigk.co.uk/cis/ and press Ctrl+F5
pause
