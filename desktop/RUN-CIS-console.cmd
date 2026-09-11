@echo off
REM Dev only — shows a console for Python errors and print() output.
cd /d "%~dp0"
if exist ".venv\Scripts\python.exe" (
  .venv\Scripts\python.exe app.py
) else (
  python app.py
)
pause
