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

Start-Sleep -Seconds 3
Start-Process "http://localhost:5175"
