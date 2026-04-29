param(
    [Parameter(Mandatory = $true)]
    [string]$Root
)

$ErrorActionPreference = "Stop"

$nodeDir = Join-Path $Root "node"
$nodeExe = Join-Path $nodeDir "node.exe"

if (Test-Path -LiteralPath $nodeExe) {
    Write-Host "[OK] Node.js portatil encontrado: node\" -ForegroundColor Green
    exit 0
}

if ([Environment]::Is64BitOperatingSystem -ne $true) {
    Write-Host "[ERRO] Download automatico requer Windows 64-bit." -ForegroundColor Red
    exit 1
}

$arch = if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64" -or $env:PROCESSOR_ARCHITEW6432 -eq "ARM64") {
    "win-arm64"
} else {
    "win-x64"
}

$downloadRoot = Join-Path ([IO.Path]::GetTempPath()) "sistema-catalogo-node"
$extractRoot = Join-Path $downloadRoot "extract"
New-Item -ItemType Directory -Force -Path $downloadRoot | Out-Null

$securityProtocol = [Net.ServicePointManager]::SecurityProtocol
[Net.ServicePointManager]::SecurityProtocol = $securityProtocol -bor [Net.SecurityProtocolType]::Tls12

try {
    $zipPath = $null
    $zipName = $null
    $majorCandidates = @("24", "22", "20")

    foreach ($major in $majorCandidates) {
        $baseUrl = "https://nodejs.org/dist/latest-v$major.x"
        $sumsUrl = "$baseUrl/SHASUMS256.txt"
        Write-Host "[INFO] Procurando Node.js latest-v$major.x para $arch..."

        try {
            $sums = (Invoke-WebRequest -UseBasicParsing -Uri $sumsUrl -TimeoutSec 30).Content
            $match = [regex]::Match($sums, "node-v[\d.]+-$arch\.zip")
            if (-not $match.Success) { continue }

            $zipName = $match.Value
            $zipPath = Join-Path $downloadRoot $zipName
            $zipUrl = "$baseUrl/$zipName"

            if (-not (Test-Path -LiteralPath $zipPath)) {
                Write-Host "[INFO] Baixando $zipName..."
                Invoke-WebRequest -UseBasicParsing -Uri $zipUrl -OutFile $zipPath -TimeoutSec 300
            }
            break
        } catch {
            Write-Host "[AVISO] Falha ao baixar latest-v$major.x. Tentando outra versao..." -ForegroundColor Yellow
        }
    }

    if (-not $zipPath -or -not (Test-Path -LiteralPath $zipPath)) {
        Write-Host "[ERRO] Nao foi possivel baixar o Node.js portatil." -ForegroundColor Red
        exit 1
    }

    Remove-Item -LiteralPath $extractRoot -Recurse -Force -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Force -Path $extractRoot | Out-Null

    Write-Host "[INFO] Extraindo Node.js..."
    Expand-Archive -LiteralPath $zipPath -DestinationPath $extractRoot -Force

    $extractedDir = Get-ChildItem -LiteralPath $extractRoot -Directory |
        Where-Object { $_.Name -like "node-v*-windows-*" -or $_.Name -like "node-v*-win-*" } |
        Select-Object -First 1

    if (-not $extractedDir) {
        Write-Host "[ERRO] Arquivo do Node.js nao possui a estrutura esperada." -ForegroundColor Red
        exit 1
    }

    if (Test-Path -LiteralPath $nodeDir) {
        $backupDir = Join-Path $Root ("node.backup-" + (Get-Date -Format "yyyyMMddHHmmss"))
        Write-Host "[AVISO] Pasta node existente sem node.exe. Renomeando para $([IO.Path]::GetFileName($backupDir))." -ForegroundColor Yellow
        Move-Item -LiteralPath $nodeDir -Destination $backupDir
    }

    Move-Item -LiteralPath $extractedDir.FullName -Destination $nodeDir

    if (-not (Test-Path -LiteralPath $nodeExe)) {
        Write-Host "[ERRO] Instalacao do Node.js portatil falhou." -ForegroundColor Red
        exit 1
    }

    Write-Host "[OK] Node.js portatil instalado em node\" -ForegroundColor Green
    exit 0
} finally {
    [Net.ServicePointManager]::SecurityProtocol = $securityProtocol
    Remove-Item -LiteralPath $extractRoot -Recurse -Force -ErrorAction SilentlyContinue
}
