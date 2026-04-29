param(
    [Parameter(Mandatory = $true)]
    [string]$Root,

    [Parameter(Mandatory = $true)]
    [string]$NpxCmd
)

$ErrorActionPreference = "Stop"
Set-Location $Root

$distDir = Join-Path $Root "dist"
$distIndex = Join-Path $distDir "index.html"
$needsBuild = -not (Test-Path -LiteralPath $distIndex)

if (-not $needsBuild) {
    $html = Get-Content -LiteralPath $distIndex -Raw
    $assetRefs = [regex]::Matches($html, '(?:src|href)="/([^"]+)"')
    foreach ($assetRef in $assetRefs) {
        $relativePath = $assetRef.Groups[1].Value
        if ($relativePath.StartsWith("assets/")) {
            $assetPath = Join-Path $distDir $relativePath
            if (-not (Test-Path -LiteralPath $assetPath)) {
                $needsBuild = $true
                break
            }
        }
    }
}

if (-not $needsBuild) {
    $distTime = (Get-Item -LiteralPath $distIndex).LastWriteTimeUtc
    $inputPaths = @(
        (Join-Path $Root "src"),
        (Join-Path $Root "Logos"),
        (Join-Path $Root "index.html"),
        (Join-Path $Root "vite.config.js"),
        (Join-Path $Root "tailwind.config.js"),
        (Join-Path $Root "postcss.config.js"),
        (Join-Path $Root "package.json"),
        (Join-Path $Root "package-lock.json")
    )

    foreach ($inputPath in $inputPaths) {
        if (-not (Test-Path -LiteralPath $inputPath)) { continue }
        $item = Get-Item -LiteralPath $inputPath
        $files = if ($item.PSIsContainer) {
            Get-ChildItem -LiteralPath $inputPath -Recurse -File
        } else {
            @($item)
        }

        $newerFile = $files | Where-Object { $_.LastWriteTimeUtc -gt $distTime } | Select-Object -First 1
        if ($null -ne $newerFile) {
            $needsBuild = $true
            break
        }
    }
}

if ($needsBuild) {
    Write-Host "[3/4] Construindo frontend para web..."
    & $NpxCmd vite build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERRO] Falha ao construir frontend." -ForegroundColor Red
        exit $LASTEXITCODE
    }
    Write-Host "[OK] Frontend construido." -ForegroundColor Green
} else {
    Write-Host "[OK] Frontend web atualizado." -ForegroundColor Green
}
