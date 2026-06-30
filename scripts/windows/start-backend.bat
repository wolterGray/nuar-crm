@echo off
setlocal

set "PROJECT_ROOT=%~dp0..\.."
set "BACKEND_DIR=%PROJECT_ROOT%\backend"

where pm2 >nul 2>nul
if errorlevel 1 (
  echo PM2 is not installed.
  echo Install it first: npm install -g pm2
  exit /b 1
)

cd /d "%BACKEND_DIR%"
if errorlevel 1 exit /b 1

pm2 describe nuar-backend >nul 2>nul
if errorlevel 1 (
  echo Starting nuar-backend with PM2...
  pm2 start server.js --name nuar-backend
) else (
  echo Restarting nuar-backend with PM2...
  pm2 restart nuar-backend --update-env
)

pm2 save
endlocal
