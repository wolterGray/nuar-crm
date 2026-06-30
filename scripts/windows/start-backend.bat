@echo off
setlocal

set "PROJECT_ROOT=%~dp0..\.."

echo.
echo === NUAR backend start ===
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

cd backend
if errorlevel 1 (
  echo ERROR: Cannot open backend folder.
  goto error
)

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
echo Backend started successfully.
pause
exit /b 0

:error
echo.
echo Script failed. See the error above.
pm2 status
pause
exit /b 1
