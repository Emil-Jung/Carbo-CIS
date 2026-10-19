@echo off
REM Carbo Print Labels only (no CIS dashboard). Uses bundled print_labels.html locally.
cd /d "%~dp0"
set "CIS_LOCAL_SHELL=1"
pythonw print_labels_app.py
