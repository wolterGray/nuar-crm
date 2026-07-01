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

echo Removing old nuar-backend PM2 process if it exists...
pm2 delete nuar-backend
if errorlevel 1 (
  echo nuar-backend was not running or does not exist. Continuing...
)

echo Starting backend with PM2...
pm2 start "%CD%\server.js" --name nuar-backend --update-env
if errorlevel 1 (
  echo ERROR: PM2 failed to start backend.
  goto error
)

echo.
pm2 status

echo.
echo Checking health endpoint...
curl -f http://localhost:3001/health
if errorlevel 1 (
  echo.
  echo ERROR: Health check failed.
  goto error
)

echo.
echo Checking auth endpoint exists...
curl -s -o nul -w "%%{http_code}" -X POST http://localhost:3001/api/auth/login > "%TEMP%\nuar-auth-code.txt"
set /p AUTH_CODE=<"%TEMP%\nuar-auth-code.txt"
echo Auth endpoint returned HTTP %AUTH_CODE%
if "%AUTH_CODE%"=="404" (
  echo ERROR: /api/auth/login is missing. Old backend code is still running.
  goto error
)

echo.
echo Checking CRM API requires JWT...
curl -s -o nul -w "%%{http_code}" http://localhost:3001/api/clients > "%TEMP%\nuar-clients-code.txt"
set /p CLIENTS_CODE=<"%TEMP%\nuar-clients-code.txt"
echo /api/clients without token returned HTTP %CLIENTS_CODE%
if not "%CLIENTS_CODE%"=="401" (
  echo ERROR: /api/clients must return 401 without Authorization.
  echo Old backend code or unprotected routes are still running.
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
