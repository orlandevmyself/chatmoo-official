@echo off
REM ChatMoo Tunnel Setup for Windows
REM This script starts all services needed for tunnel testing

setlocal enabledelayedexpansion
cd /d "%~dp0"

echo.
echo ===================================
echo   ChatMoo Tunnel Setup - Windows
echo ===================================
echo.

REM Check if ngrok is installed
where ngrok >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] ngrok is not installed
    echo.
    echo Download from: https://ngrok.com/download
    echo Or install with: choco install ngrok
    echo.
    pause
    exit /b 1
)

echo [OK] ngrok is installed
echo.

echo ===================================
echo   Service Configuration
echo ===================================
echo.
echo Backend:  Port 3000
echo Frontend: Port 3001
echo Admin:    Port 3002
echo.

echo ===================================
echo   Starting Services
echo ===================================
echo.
echo [1/4] Starting Backend (3000)...
start "ChatMoo Backend" cmd /k "cd backend && npm run start"
timeout /t 3 /nobreak

echo [2/4] Starting Frontend (3001)...
start "ChatMoo Frontend" cmd /k "cd frontend && npm start"
timeout /t 3 /nobreak

echo [3/4] Starting Admin (3002)...
start "ChatMoo Admin" cmd /k "cd admin && npm start"
timeout /t 3 /nobreak

echo [4/4] Starting ngrok Tunnel...
start "ChatMoo ngrok" cmd /k "ngrok start --all --config ngrok.yml"
timeout /t 2 /nobreak

echo.
echo ===================================
echo   Services Started!
echo ===================================
echo.
echo Local URLs:
echo   Frontend: http://localhost:3001
echo   Backend:  http://localhost:3000
echo   Admin:    http://localhost:3002
echo.
echo Tunnel URLs (check ngrok window):
echo   Frontend: https://xxxx-xxxx.ngrok.io
echo   Admin:    https://yyyy-yyyy.ngrok.io
echo   Backend:  https://zzzz-zzzz.ngrok.io
echo.
echo ===================================
echo.
echo All windows should now be open.
echo Check each window for status messages.
echo.
pause
