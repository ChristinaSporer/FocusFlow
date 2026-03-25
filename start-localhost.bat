@echo off
setlocal

cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm wurde nicht gefunden. Bitte zuerst Node.js installieren.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [INFO] Installiere Abhaengigkeiten ...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install ist fehlgeschlagen.
    pause
    exit /b 1
  )
)

echo [INFO] Starte Anwendung unter http://localhost:8080/index.html ...
call npm start

if errorlevel 1 (
  echo.
  echo [ERROR] Die Anwendung konnte nicht gestartet werden.
  pause
  exit /b 1
)

endlocal
