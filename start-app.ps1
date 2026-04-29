$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

# ─── Detect Node.js: portable (node\) or system ───
$portableNode = Join-Path $Root "node\node.exe"
$portableNpm  = Join-Path $Root "node\npm.cmd"
$portableNpx  = Join-Path $Root "node\npx.cmd"

if (Test-Path $portableNode) {
    $env:PATH = "$(Join-Path $Root 'node');$env:PATH"
    $NodeExe = $portableNode
    $NpmCmd  = $portableNpm
    $NpxCmd  = $portableNpx
    Write-Host "[OK] Node.js portatil encontrado: node\" -ForegroundColor Green
} elseif (Get-Command node -ErrorAction SilentlyContinue) {
    $NodeExe = "node"
    $NpmCmd  = "npm"
    $NpxCmd  = "npx"
    Write-Host "[OK] Node.js do sistema encontrado." -ForegroundColor Green
} else {
    Write-Host "[INFO] Node.js nao encontrado. Baixando Node.js portatil..." -ForegroundColor Yellow
    $installNode = Join-Path $Root "scripts\install-portable-node.ps1"
    & powershell -NoProfile -ExecutionPolicy Bypass -File $installNode -Root $Root
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $portableNode)) {
        Write-Host "[ERRO] Falha ao instalar Node.js portatil." -ForegroundColor Red
        Read-Host "Pressione Enter para sair"
        exit 1
    }
    $env:PATH = "$(Join-Path $Root 'node');$env:PATH"
    $NodeExe = $portableNode
    $NpmCmd  = $portableNpm
    $NpxCmd  = $portableNpx
}

Write-Host ""
Write-Host "══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  PIM (Product Information Management) Builder - Iniciando..." -ForegroundColor Cyan
Write-Host "══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# ─── Install dependencies if needed ───
if (-not (Test-Path (Join-Path $Root "node_modules"))) {
    Write-Host "[1/4] Instalando dependencias..."
    & $NpmCmd install --production=false
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERRO] Falha ao instalar dependencias." -ForegroundColor Red
        Read-Host "Pressione Enter para sair"
        exit 1
    }
    Write-Host "[OK] Dependencias instaladas." -ForegroundColor Green
} else {
    Write-Host "[OK] Dependencias ja instaladas." -ForegroundColor Green
}

# ─── Generate Prisma client if needed ───
if (-not (Test-Path (Join-Path $Root "node_modules\.prisma"))) {
    Write-Host "[2/4] Gerando Prisma Client..."
    & $NpxCmd prisma generate --schema backend/prisma/schema.prisma
}

# ─── Run migrations ───
Write-Host "[2/4] Verificando banco de dados..."
& $NpxCmd prisma migrate deploy --schema backend/prisma/schema.prisma 2>$null
Write-Host "[OK] Banco de dados pronto." -ForegroundColor Green

# --- Build frontend when source is newer than dist/ ---
# Atualiza tambem quando o codigo mudou ou algum asset do dist sumiu.
$ensureDist = Join-Path $Root "scripts\ensure-dist.ps1"
& powershell -NoProfile -ExecutionPolicy Bypass -File $ensureDist -Root $Root -NpxCmd $NpxCmd
if ($LASTEXITCODE -ne 0) {
    Read-Host "Pressione Enter para sair"
    exit 1
}

# ─── Kill any existing process on port 5176 ───
Get-NetTCPConnection -LocalPort 5176 -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique |
    ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }

# ─── Start backend (serves API + frontend from dist/) ───
Write-Host "[4/4] Iniciando servidor..."
$env:NODE_ENV = "production"
Start-Process -FilePath $NodeExe -ArgumentList "backend/server.js" -WorkingDirectory $Root

# ─── Wait for server to be ready ───
$backendUrl = "http://127.0.0.1:5176/api/health"
$maxWait = 60

Write-Host "Aguardando servidor ficar online..."
$isOnline = $false

for ($i = 0; $i -lt $maxWait; $i++) {
    try {
        $resp = Invoke-WebRequest -Uri $backendUrl -UseBasicParsing -TimeoutSec 2
        if ($resp.StatusCode -eq 200) { $isOnline = $true; break }
    } catch {}
    Start-Sleep -Seconds 1
}

if ($isOnline) {
    Write-Host ""
    Write-Host "══════════════════════════════════════════════════" -ForegroundColor Green
    Write-Host "  PIM (Product Information Management) Builder Online!" -ForegroundColor Green
    Write-Host "══════════════════════════════════════════════════" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Local:  http://localhost:5176" -ForegroundColor White

    # Show LAN addresses
    $nets = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.IPAddress -ne '127.0.0.1' -and $_.PrefixOrigin -ne 'WellKnown' }
    foreach ($net in $nets) {
        Write-Host "  Rede:   http://$($net.IPAddress):5176" -ForegroundColor Yellow
    }

    Write-Host ""
    Write-Host "  Outros dispositivos na mesma rede podem acessar" -ForegroundColor DarkGray
    Write-Host "  pelo endereco de Rede acima." -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "══════════════════════════════════════════════════" -ForegroundColor Green

    Start-Process "http://localhost:5176"
} else {
    Write-Host "[AVISO] Servidor nao respondeu em $maxWait segundos." -ForegroundColor Yellow
    Write-Host "Acesse manualmente: http://localhost:5176"
}

Write-Host ""
Write-Host "Pressione qualquer tecla para fechar..."
Write-Host "(O servidor continuara rodando em segundo plano)"
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
