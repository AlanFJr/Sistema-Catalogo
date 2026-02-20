$Root = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not (Test-Path (Join-Path $Root "node_modules"))) {
	Write-Host "Installing dependencies..."
	Push-Location $Root
	npm install
	Pop-Location
}

$ports = @(5175, 5176)
foreach ($port in $ports) {
	Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
		Select-Object -ExpandProperty OwningProcess -Unique |
		ForEach-Object {
			Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
		}
}

Start-Process -WorkingDirectory $Root -FilePath "npm" -ArgumentList "run","dev"

$frontendUrl = "http://127.0.0.1:5175"
$backendUrl = "http://127.0.0.1:5176/api/health"
$maxWaitSeconds = 90

Write-Host "Aguardando aplicacao ficar online..."
$isOnline = $false

for ($i = 0; $i -lt $maxWaitSeconds; $i++) {
	$frontendReady = $false
	$backendReady = $false

	try {
		$frontendResponse = Invoke-WebRequest -Uri $frontendUrl -UseBasicParsing -TimeoutSec 2
		if ($frontendResponse.StatusCode -ge 200 -and $frontendResponse.StatusCode -lt 500) {
			$frontendReady = $true
		}
	} catch {}

	try {
		$backendResponse = Invoke-WebRequest -Uri $backendUrl -UseBasicParsing -TimeoutSec 2
		if ($backendResponse.StatusCode -eq 200) {
			$backendReady = $true
		}
	} catch {}

	if ($frontendReady -and $backendReady) {
		$isOnline = $true
		break
	}

	Start-Sleep -Seconds 1
}

if ($isOnline) {
	Write-Host "Aplicacao online. Abrindo navegador..."
	Start-Process "http://localhost:5175"
} else {
	Write-Host "Nao foi possivel detectar a aplicacao online em ate $maxWaitSeconds segundos."
	Write-Host "Verifique o terminal do npm run dev e abra manualmente: http://localhost:5175"
}
