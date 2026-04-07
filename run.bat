@echo off
cd /d "%~dp0"
echo Starting SPIRAL...

REM Try py launcher first (most reliable on Windows)
py --version >nul 2>&1
if not errorlevel 1 (
    py main.py
    goto :check_exit
)

REM Fall back to python — but verify it actually works
REM (Windows Store stub passes 'where' but fails to run)
python --version >nul 2>&1
if not errorlevel 1 (
    python main.py
    goto :check_exit
)

REM No working Python found
echo.
echo [ERROR] Python not found. Install Python 3.9+ from https://python.org
echo         Make sure to check "Add Python to PATH" during installation.
pause >nul
exit /b 1

:check_exit
if errorlevel 1 (
    echo.
    echo [ERROR] SPIRAL exited with an error. Press any key...
    pause >nul
)
