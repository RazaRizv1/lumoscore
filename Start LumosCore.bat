@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
echo ================================================
echo    LumosCore - starting local server
echo ================================================
echo.

rem --- locate node ---
where node >nul 2>nul && (set "NODE=node") || (
  if exist "%ProgramFiles%\nodejs\node.exe" (
    set "NODE=%ProgramFiles%\nodejs\node.exe"
  ) else (
    echo [ERROR] Node.js was not found.
    echo Install it from https://nodejs.org then run this again.
    echo.
    pause
    exit /b 1
  )
)

rem --- start the server in its own window ---
start "LumosCore server" cmd /k ""%NODE%" serve.js"

rem --- wait until the server actually answers (max ~12s) ---
echo Waiting for server...
set /a tries=0
:waitloop
timeout /t 1 /nobreak >nul
powershell -NoProfile -Command "try{Invoke-WebRequest -UseBasicParsing http://localhost:8080/ -TimeoutSec 1 ^| Out-Null; exit 0}catch{exit 1}" >nul 2>nul
if not errorlevel 1 goto ready
set /a tries+=1
if !tries! lss 12 goto waitloop
echo [WARN] Server did not respond yet - opening anyway.

:ready
rem --- open in Chrome if we can find it, else the default browser ---
set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
set "CHROMEX=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if exist "%CHROME%" (
  start "" "%CHROME%" http://localhost:8080
) else if exist "%CHROMEX%" (
  start "" "%CHROMEX%" http://localhost:8080
) else (
  start "" http://localhost:8080
)
echo.
echo Opened http://localhost:8080
echo Keep the "LumosCore server" window open while using LumosCore.
echo (Close that window to stop the server.)
echo.
pause
