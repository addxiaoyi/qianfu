param(
  [string]$BundleDir = "offline-bundle",
  [string]$ArchiveName = "qianfu-offline-installer.zip"
)

$ErrorActionPreference = "Stop"

function Step($msg) { Write-Host "[STEP] $msg" -ForegroundColor Cyan }
function Ok($msg) { Write-Host "[OK]   $msg" -ForegroundColor Green }
function Run-Cmd([string]$cmd) {
  Invoke-Expression $cmd
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed: $cmd"
  }
}

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root

Step "Building offline images..."
Run-Cmd "docker build -t qianfu-app:offline -f Dockerfile ."
Run-Cmd "docker build -t qianfu-xpay:offline -f `"xpay-3.1_YTM7H/xpay-code/Dockerfile`" `"xpay-3.1_YTM7H/xpay-code`""

Step "Pulling base images..."
Run-Cmd "docker pull mysql:8.0"
Run-Cmd "docker pull redis:7-alpine"
Run-Cmd "docker pull nginx:alpine"

if (Test-Path $BundleDir) {
  Remove-Item -Recurse -Force $BundleDir
}
New-Item -ItemType Directory -Path "$BundleDir/images" -Force | Out-Null
New-Item -ItemType Directory -Path "$BundleDir/scripts/linux" -Force | Out-Null
New-Item -ItemType Directory -Path "$BundleDir/scripts/windows" -Force | Out-Null

Step "Saving images..."
Run-Cmd "docker save -o `"$BundleDir/images/qianfu-app-offline.tar`" qianfu-app:offline"
Run-Cmd "docker save -o `"$BundleDir/images/qianfu-xpay-offline.tar`" qianfu-xpay:offline"
Run-Cmd "docker save -o `"$BundleDir/images/mysql-8.0.tar`" mysql:8.0"
Run-Cmd "docker save -o `"$BundleDir/images/redis-7-alpine.tar`" redis:7-alpine"
Run-Cmd "docker save -o `"$BundleDir/images/nginx-alpine.tar`" nginx:alpine"

Step "Copying runtime files..."
Copy-Item "docker-compose.offline.yml" "$BundleDir/docker-compose.offline.yml"
Copy-Item ".env.fullstack.example" "$BundleDir/.env.offline.example"
Copy-Item "nginx.conf" "$BundleDir/nginx.conf"
Copy-Item -Recurse "xpay-3.1_YTM7H/xpay-code/sql" "$BundleDir/sql"

Copy-Item "scripts/linux/bootstrap-offline.sh" "$BundleDir/scripts/linux/bootstrap-offline.sh"
Copy-Item "scripts/linux/install-offline.sh" "$BundleDir/scripts/linux/install-offline.sh"
Copy-Item "scripts/linux/verify-offline-stack.sh" "$BundleDir/scripts/linux/verify-offline-stack.sh"
Copy-Item "scripts/linux/collect-diagnostics.sh" "$BundleDir/scripts/linux/collect-diagnostics.sh"

$installPs1 = @'
$ErrorActionPreference = "Stop"
Write-Host "[STEP] Loading offline images..." -ForegroundColor Cyan
Get-ChildItem ".\images\*.tar" | ForEach-Object { docker load -i $_.FullName | Out-Null }
if (!(Test-Path ".env.offline")) { Copy-Item ".env.offline.example" ".env.offline" }
Write-Host "[STEP] Starting compose..." -ForegroundColor Cyan
docker compose --env-file .env.offline -f docker-compose.offline.yml up -d
Write-Host "[OK] Done. Web: http://127.0.0.1/" -ForegroundColor Green
'@
Set-Content -Path "$BundleDir/scripts/windows/install-offline.ps1" -Value $installPs1 -Encoding UTF8

$readme = @'
Offline installer package.

Linux:
  bash scripts/linux/install-offline.sh

Windows:
  powershell -ExecutionPolicy Bypass -File .\scripts\windows\install-offline.ps1
'@
Set-Content -Path "$BundleDir/README-OFFLINE.txt" -Value $readme -Encoding UTF8

if (Test-Path $ArchiveName) {
  Remove-Item -Force $ArchiveName
}
Compress-Archive -Path "$BundleDir/*" -DestinationPath $ArchiveName

Ok "Offline installer created: $ArchiveName"
