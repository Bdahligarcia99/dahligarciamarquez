@echo off
SETLOCAL ENABLEEXTENSIONS
REM ===============================
REM One-click dev runner for Windows (Git Bash)
REM - Kills ports 8080 (server) and 5173 (Vite)
REM - Starts server and client in separate Git Bash terminals
REM - Installs deps if node_modules missing
REM 7f1a2e4c-53f9-45d7-8c73-dad2c2b9e84f-6c41e2cfd7aa1d95b3
REM ===============================

REM Anchor to repo root
cd /d "%~dp0"

echo.
echo [One-Click Dev] Cleaning up ports 8080 and 5173 (if any)...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "foreach($p in 8080,5173){try{Get-NetTCPConnection -LocalPort $p -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }}catch{}}" >NUL 2>&1

REM Find Git Bash executable
set "GIT_BASH="
if exist "C:\Program Files\Git\bin\bash.exe" set "GIT_BASH=C:\Program Files\Git\bin\bash.exe"
if exist "C:\Program Files (x86)\Git\bin\bash.exe" set "GIT_BASH=C:\Program Files (x86)\Git\bin\bash.exe"
if exist "%LOCALAPPDATA%\Programs\Git\bin\bash.exe" set "GIT_BASH=%LOCALAPPDATA%\Programs\Git\bin\bash.exe"

REM Fallback to system PATH
if "%GIT_BASH%"=="" (
    where bash.exe >NUL 2>&1
    if !ERRORLEVEL! EQU 0 set "GIT_BASH=bash.exe"
)

REM Check if Git Bash was found
if "%GIT_BASH%"=="" (
    echo [ERROR] Git Bash not found. Please install Git for Windows or use regular CMD version.
    pause
    exit /b 1
)

echo [One-Click Dev] Using Git Bash: %GIT_BASH%

REM Server commands for bash
set "_SERVER_CMD=cd server && [ ! -d node_modules ] && (npm ci || npm i); npm start"

REM Client commands for bash  
set "_CLIENT_CMD=cd client && [ ! -d node_modules ] && (npm ci || npm i); VITE_API_BASE_URL=http://localhost:8080 npm run dev"

echo [One-Click Dev] Launching SERVER (port 8080) in Git Bash...
start "SERVER :8080" "%GIT_BASH%" -c "cd '%CD%' && %_SERVER_CMD%; exec bash"

REM Add a small delay so logs are readable in order
timeout /t 3 /nobreak >NUL

echo [One-Click Dev] Launching CLIENT (Vite) in Git Bash...
start "CLIENT :5173" "%GIT_BASH%" -c "cd '%CD%' && %_CLIENT_CMD%; exec bash"

REM Add doctor check window (optional)
set "_DOCTOR_CMD=cd server && sleep 8 && npm run doctor; exec bash"
echo [One-Click Dev] Launching DOCTOR (diagnostics) in Git Bash...
start "DOCTOR" "%GIT_BASH%" -c "cd '%CD%' && %_DOCTOR_CMD%"

REM Wait a bit for the client to start up, then open browser
echo [One-Click Dev] Waiting for Vite dev server to start...
timeout /t 5 /nobreak >NUL

echo [One-Click Dev] Opening browser to http://localhost:5173
start "" "http://localhost:5173"

echo.
echo [One-Click Dev] Both Git Bash windows launched and browser opened. Close this window if you like.
ENDLOCAL
