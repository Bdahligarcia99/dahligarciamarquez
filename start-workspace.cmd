@echo off
setlocal enableextensions

echo.
echo ================================
echo   Workspace quick launcher
echo ================================
echo.

rem --- Open dashboards in your default browser ---
start "" "https://vercel.com/bdahligarcia99s-projects"
start "" "https://dashboard.render.com/"
start "" "https://supabase.com/dashboard/organizations"

rem ============================================================
rem  ChatGPT Desktop (NOT the browser)
rem  - Tries override var CHATGPT_EXE if you set it
rem  - Searches common install paths
rem  - Falls back to PATH
rem  - Finally tries Microsoft Store app via PowerShell
rem ============================================================
if defined CHATGPT_EXE (
  if exist "%CHATGPT_EXE%" (
    echo Launching ChatGPT: "%CHATGPT_EXE%"
    start "" "%CHATGPT_EXE%"
    goto :afterChatGPT
  )
)

set "chatgptExe="

for %%P in (
    "%LOCALAPPDATA%\Programs\ChatGPT\ChatGPT.exe"
    "%LOCALAPPDATA%\Programs\OpenAI\ChatGPT\ChatGPT.exe"
    "%LOCALAPPDATA%\ChatGPT\ChatGPT.exe"
    "C:\Program Files\ChatGPT\ChatGPT.exe"
    "C:\Program Files\OpenAI\ChatGPT\ChatGPT.exe"
    "C:\Program Files (x86)\ChatGPT\ChatGPT.exe"
    "C:\Program Files (x86)\OpenAI\ChatGPT\ChatGPT.exe"
) do (
    if exist %%~P (
        set "chatgptExe=%%~P"
        goto :foundChatGPT
    )
)

for %%G in (ChatGPT.exe chatgpt.exe) do (
    where %%G >nul 2>&1 && (
        for /f "usebackq delims=" %%H in (`where %%G`) do (
            set "chatgptExe=%%H"
            goto :foundChatGPT
        )
    )
)

rem Try Microsoft Store app (UWP) if installed that way
powershell -NoProfile -Command ^
  "$app = Get-StartApps | Where-Object { $_.Name -eq 'ChatGPT' -or $_.AppID -like '*ChatGPT*' } | Select-Object -First 1; if($app){ Start-Process ('shell:AppsFolder\' + $app.AppID); exit 0 } else { exit 1 }"
if "%ERRORLEVEL%"=="0" goto :afterChatGPT

echo [WARN] ChatGPT desktop app not found. Set CHATGPT_EXE to the full path or install the app.
goto :afterChatGPT

:foundChatGPT
echo Launching ChatGPT: "%chatgptExe%"
start "" "%chatgptExe%"

:afterChatGPT

rem --- Launch Cursor editor (try common install locations + PATH) ---
set "cursorExe="

for %%P in (
    "%LOCALAPPDATA%\Programs\Cursor\Cursor.exe"
    "%LOCALAPPDATA%\Cursor\Cursor.exe"
    "C:\Program Files\Cursor\Cursor.exe"
    "C:\Program Files (x86)\Cursor\Cursor.exe"
) do (
    if exist %%~P (
        set "cursorExe=%%~P"
        goto :foundCursor
    )
)

for %%G in (Cursor.exe cursor.exe) do (
    where %%G >nul 2>&1 && (
        for /f "usebackq delims=" %%H in (`where %%G`) do (
            set "cursorExe=%%H"
            goto :foundCursor
        )
    )
)

:foundCursor
if defined cursorExe (
    echo Launching Cursor: "%cursorExe%"
    start "" "%cursorExe%"
) else (
    echo [WARN] Cursor not found in common locations.
    echo If installed, add it to PATH or set CURSOR_EXE to its full path.
)

echo.
echo All set. Have a great session!
endlocal
exit /b 0
