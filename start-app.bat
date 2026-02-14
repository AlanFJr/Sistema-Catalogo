@echo off
setlocal

set "ROOT=%~dp0"

if not exist "%ROOT%node_modules" (
	echo Installing dependencies...
	pushd "%ROOT%"
	npm install
	popd
)

for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":5175" ^| findstr "LISTENING"') do (
	taskkill /F /PID %%P >nul 2>&1
)
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":5176" ^| findstr "LISTENING"') do (
	taskkill /F /PID %%P >nul 2>&1
)

start "App (dev)" cmd /c "cd /d "%ROOT%" && npm run dev"

timeout /t 3 /nobreak >nul
start "Browser" http://localhost:5175
