@echo off
setlocal

where pm2 >nul 2>nul
if errorlevel 1 (
  echo PM2 is not installed.
  echo Install it first: npm install -g pm2
  exit /b 1
)

pm2 stop nuar-backend
endlocal
