@echo off
chcp 65001 >nul 2>&1
setlocal EnableDelayedExpansion

set "ROOT=%~dp0"
cd /d "%ROOT%"

:: ─── Detect Node.js: portable (node\) or system ───
if exist "%ROOT%node\node.exe" (
    set "NODE_EXE=%ROOT%node\node.exe"
    set "NPM_CMD=%ROOT%node\npm.cmd"
    set "NPX_CMD=%ROOT%node\npx.cmd"
    set "PATH=%ROOT%node;%ROOT%node\node_modules\npm\bin;%PATH%"
    echo [OK] Node.js portatil encontrado: node\
) else (
    where node >nul 2>&1
    if errorlevel 1 (
        echo [ERRO] Node.js nao encontrado!
        echo Baixe o Node.js portatil em: https://nodejs.org/en/download
        echo Extraia na pasta "node\" dentro de "%ROOT%"
        pause
        exit /b 1
    )
    set "NODE_EXE=node"
    set "NPM_CMD=npm"
    set "NPX_CMD=npx"
    echo [OK] Node.js do sistema encontrado.
)

echo.
echo ══════════════════════════════════════════════════
echo   Sistema Catalogo - Iniciando...
echo ══════════════════════════════════════════════════
echo.

:: ─── Install dependencies if needed ───
if not exist "%ROOT%node_modules" (
    echo [1/4] Instalando dependencias...
    call "%NPM_CMD%" install --production=false
    if errorlevel 1 (
        echo [ERRO] Falha ao instalar dependencias.
        pause
        exit /b 1
    )
    echo [OK] Dependencias instaladas.
) else (
    echo [OK] Dependencias ja instaladas.
)

:: ─── Generate Prisma client if needed ───
if not exist "%ROOT%node_modules\.prisma" (
    echo [2/4] Gerando Prisma Client...
    call "%NPX_CMD%" prisma generate --schema backend\prisma\schema.prisma
)

:: ─── Run migrations ───
echo [2/4] Verificando banco de dados...
call "%NPX_CMD%" prisma migrate deploy --schema backend\prisma\schema.prisma 2>nul
echo [OK] Banco de dados pronto.

:: ─── Build frontend if dist/ doesn't exist ───
if not exist "%ROOT%dist\index.html" (
    echo [3/4] Construindo frontend ^(primeira execucao^)...
    call "%NPX_CMD%" vite build
    if errorlevel 1 (
        echo [ERRO] Falha ao construir frontend.
        pause
        exit /b 1
    )
    echo [OK] Frontend construido.
) else (
    echo [OK] Frontend ja construido.
)

:: ─── Kill any existing process on port 5176 ───
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":5176" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%P >nul 2>&1
)

:: ─── Write a small launcher script so start cmd /k works with spaces ───
echo [4/4] Iniciando servidor...
echo.

set "LAUNCHER=%ROOT%_run_server.cmd"
(
    echo @echo off
    echo chcp 65001 ^>nul 2^>^&1
    echo title Sistema Catalogo - Servidor
    echo cd /d "%%~dp0"
    echo set "NODE_ENV=production"
    echo if exist "%%~dp0node\node.exe" set "PATH=%%~dp0node;%%PATH%%"
    echo echo.
    echo echo   Servidor rodando... Nao feche esta janela.
    echo echo   Pressione Ctrl+C para parar.
    echo echo.
    echo if exist "%%~dp0node\node.exe" ^( "%%~dp0node\node.exe" backend/server.js ^) else ^( node backend/server.js ^)
    echo echo.
    echo echo   [ERRO] Servidor parou inesperadamente.
    echo pause
) > "%LAUNCHER%"

start "Sistema Catalogo - Servidor" cmd /k ""%LAUNCHER%""

:: ─── Wait for server to be ready ───
echo Aguardando servidor ficar online...
set /a attempts=0
set /a maxAttempts=60

:wait_online
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:5176/api/health' -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }"
if errorlevel 1 goto not_ready

:: ─── Get LAN IP and show access info ───
echo.
echo ══════════════════════════════════════════════════
echo   Sistema Catalogo Online!
echo ══════════════════════════════════════════════════
echo.
echo   Local:  http://localhost:5176
for /f "tokens=2 delims=:" %%A in ('ipconfig ^| findstr /C:"IPv4"') do (
    set "IP=%%A"
    set "IP=!IP: =!"
    echo   Rede:   http://!IP!:5176
)
echo.
echo   Outros dispositivos na mesma rede podem acessar
echo   pelo endereco de Rede acima.
echo.
echo ══════════════════════════════════════════════════

start "" http://localhost:5176
goto end

:not_ready
set /a attempts+=1
if %attempts% GEQ %maxAttempts% goto timeout_online
timeout /t 1 /nobreak >nul
goto wait_online

:timeout_online
echo.
echo [AVISO] Servidor nao respondeu em %maxAttempts% segundos.
echo Verifique a janela do servidor e acesse manualmente: http://localhost:5176

:end
echo.
echo Pressione qualquer tecla para fechar este terminal...
echo (O servidor continuara rodando na outra janela)
pause >nul
