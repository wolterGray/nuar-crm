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

cd /d "%PROJECT_ROOT%"
if errorlevel 1 exit /b 1

echo Stopping nuar-backend if it is running...
pm2 stop nuar-backend >nul 2>nul
if errorlevel 1 (
  echo nuar-backend is not running yet. Continuing...
)

echo Pulling latest main...
git pull origin main
if errorlevel 1 exit /b 1

cd /d "%BACKEND_DIR%"
if errorlevel 1 exit /b 1

echo Installing backend dependencies...
call npm install
if errorlevel 1 exit /b 1

echo Generating Prisma Client...
call npx prisma generate
if errorlevel 1 exit /b 1

echo Applying Prisma migrations...
call npx prisma migrate deploy
if errorlevel 1 exit /b 1

cd /d "%PROJECT_ROOT%"
if errorlevel 1 exit /b 1

echo Starting backend...
call "%~dp0start-backend.bat"
if errorlevel 1 exit /b 1

pm2 status

echo Backend update complete.
endlocal
