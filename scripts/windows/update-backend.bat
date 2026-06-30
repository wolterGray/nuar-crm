@echo off
setlocal

set "PROJECT_ROOT=%~dp0..\.."

echo.
echo === NUAR backend update ===
echo Project root: %PROJECT_ROOT%
echo.

where pm2 >nul 2>nul
if errorlevel 1 (
  echo ERROR: PM2 is not installed.
  echo Install it first:
  echo npm install -g pm2
  goto error
)

cd /d "%PROJECT_ROOT%"
if errorlevel 1 (
  echo ERROR: Cannot open project root.
  goto error
)

echo Stopping nuar-backend if it exists...
pm2 stop nuar-backend
if errorlevel 1 (
  echo nuar-backend was not running or does not exist. Continuing...
)

echo.
echo Pulling latest main...
git pull origin main
if errorlevel 1 (
  echo ERROR: git pull failed.
  goto error
)

cd backend
if errorlevel 1 (
  echo ERROR: Cannot open backend folder.
  goto error
)

echo.
echo Installing backend dependencies...
call npm install
if errorlevel 1 (
  echo ERROR: npm install failed.
  goto error
)

echo.
echo Generating Prisma Client...
call npx prisma generate
if errorlevel 1 (
  echo ERROR: prisma generate failed.
  goto error
)

echo.
echo Applying Prisma migrations...
call npx prisma migrate deploy
if errorlevel 1 (
  echo ERROR: prisma migrate deploy failed.
  goto error
)

echo.
echo Starting backend with PM2...
pm2 start server.js --name nuar-backend --update-env
if errorlevel 1 (
  echo ERROR: PM2 failed to start backend.
  goto error
)

echo.
pm2 status

echo.
echo Checking health endpoint...
curl http://localhost:3001/health
if errorlevel 1 (
  echo.
  echo ERROR: Health check failed.
  goto error
)

echo.
echo Backend update complete.
pause
exit /b 0

:error
echo.
echo Script failed. See the error above.
pm2 status
pause
exit /b 1
