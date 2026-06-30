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

echo Pulling latest main...
git pull origin main
if errorlevel 1 exit /b 1

cd /d "%BACKEND_DIR%"
if errorlevel 1 exit /b 1

echo Installing backend dependencies...
call npm install
if errorlevel 1 exit /b 1

echo Generating Prisma Client...
call npm run prisma:generate
if errorlevel 1 exit /b 1

echo Applying Prisma migrations...
call npm run prisma:deploy
if errorlevel 1 exit /b 1

echo Restarting backend...
call "%~dp0start-backend.bat"
if errorlevel 1 exit /b 1

echo Backend update complete.
endlocal
