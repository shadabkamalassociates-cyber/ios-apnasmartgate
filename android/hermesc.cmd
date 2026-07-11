@echo off
REM Run Linux hermesc via WSL — hermes-compiler does not ship win64-bin on RN 0.84.
setlocal enabledelayedexpansion

set "SCRIPT_DIR=%~dp0"

for /f "usebackq tokens=*" %%i in (`wsl wslpath -u "%SCRIPT_DIR%..\node_modules\hermes-compiler\hermesc\linux64-bin\hermesc"`) do set "HERMESC_PATH=%%i"

set "ARGS="
:argloop
if "%~1"=="" goto :run
set "ARG=%~1"
set "ARG=!ARG:\=/!"

echo !ARG! | findstr /r "^[A-Za-z]:/" >nul 2>&1
if !errorlevel!==0 (
  set "WINARG=!ARG:/=\!"
  for /f "usebackq tokens=*" %%i in (`wsl wslpath -u "!WINARG!"`) do set "ARG=%%i"
)

if defined ARGS (
  set "ARGS=!ARGS! !ARG!"
) else (
  set "ARGS=!ARG!"
)
shift
goto :argloop

:run
wsl !HERMESC_PATH! !ARGS!
exit /b %errorlevel%
