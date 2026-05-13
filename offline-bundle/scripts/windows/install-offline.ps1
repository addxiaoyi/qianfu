$ErrorActionPreference = "Stop"
Write-Host "[STEP] Loading offline images..." -ForegroundColor Cyan
Get-ChildItem ".\images\*.tar" | ForEach-Object { docker load -i $_.FullName | Out-Null }
if (!(Test-Path ".env.offline")) { Copy-Item ".env.offline.example" ".env.offline" }
Write-Host "[STEP] Starting compose..." -ForegroundColor Cyan
docker compose --env-file .env.offline -f docker-compose.offline.yml up -d
Write-Host "[OK] Done. Web: http://127.0.0.1/" -ForegroundColor Green
