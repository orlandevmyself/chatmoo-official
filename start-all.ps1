# ChatMoo - Start All Services

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ChatMoo - Starting All Services" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$rootDir = Split-Path -Parent $MyInvocation.MyCommandPath
Set-Location $rootDir

Write-Host "[1/4] Starting Backend (Port 3000)..." -ForegroundColor Yellow
Start-Process -NoNewWindow -ArgumentList "cd $rootDir\backend && npm run start" -FilePath "cmd.exe" -WindowStyle Normal

Write-Host "[2/4] Starting Frontend (Port 3001)..." -ForegroundColor Yellow
Start-Process -NoNewWindow -ArgumentList "cd $rootDir\frontend && npm start" -FilePath "cmd.exe" -WindowStyle Normal

Write-Host "[3/4] Starting Admin (Port 3002)..." -ForegroundColor Yellow
Start-Process -NoNewWindow -ArgumentList "cd $rootDir\admin && npm start" -FilePath "cmd.exe" -WindowStyle Normal

Write-Host "[4/4] Starting ngrok Tunnel..." -ForegroundColor Yellow
Start-Process -ArgumentList "start --all --config ngrok.yml" -FilePath "ngrok.exe" -WindowStyle Normal

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Services Started!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Local URLs:" -ForegroundColor Cyan
Write-Host "  Frontend: http://localhost:3001" -ForegroundColor White
Write-Host "  Backend:  http://localhost:3000" -ForegroundColor White
Write-Host "  Admin:    http://localhost:3002" -ForegroundColor White
Write-Host ""
Write-Host "Check ngrok window for tunnel URLs:" -ForegroundColor Cyan
Write-Host "  https://xxxx-xxxx.ngrok.io (Frontend)" -ForegroundColor White
Write-Host "  https://yyyy-yyyy.ngrok.io (Admin)" -ForegroundColor White
Write-Host "  https://zzzz-zzzz.ngrok.io (Backend)" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C to stop all services" -ForegroundColor Yellow
Write-Host ""
