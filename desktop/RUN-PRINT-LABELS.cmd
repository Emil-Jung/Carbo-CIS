@echo off
REM Carbo Print Labels dev run (bundled shell only — same as installed .exe behaviour).
cd /d "%~dp0"
pythonw print_labels_app.py
