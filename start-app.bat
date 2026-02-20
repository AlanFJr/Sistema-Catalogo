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

echo Aguardando aplicacao ficar online...
set /a attempts=0
set /a maxAttempts=90

:wait_online
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:5175' -TimeoutSec 2; if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) { exit 0 } else { exit 1 } } catch { exit 1 }"
if errorlevel 1 goto not_ready

powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:5176/api/health' -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }"
if errorlevel 1 goto not_ready

echo Aplicacao online. Abrindo navegador...
start "Browser" http://localhost:5175
goto end

:not_ready
set /a attempts+=1
if %attempts% GEQ %maxAttempts% goto timeout_online
timeout /t 1 /nobreak >nul
goto wait_online

:timeout_online
echo Nao foi possivel detectar a aplicacao online em ate %maxAttempts% segundos.
echo Verifique o terminal do npm run dev e abra manualmente: http://localhost:5175

:end
