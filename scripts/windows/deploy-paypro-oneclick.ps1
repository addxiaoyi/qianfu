[CmdletBinding()]
param(
  [Alias('SkipPayProBuild')]
  [switch]$SkipBuild,
  [switch]$Start
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$DeployRoot = Join-Path $Root 'deploy\paypro'
$PrepareScript = Join-Path $DeployRoot 'scripts\prepare.ps1'
$VerifyScript = Join-Path $DeployRoot 'scripts\verify.ps1'
$EnvFile = Join-Path $DeployRoot '.env'
$ComposeFile = Join-Path $DeployRoot 'docker-compose.yml'

function Invoke-Compose([string[]]$ComposeArgs) {
  if (Get-Command docker-compose -ErrorAction SilentlyContinue) {
    & docker-compose @ComposeArgs
  } elseif (Get-Command docker -ErrorAction SilentlyContinue) {
    & docker compose @ComposeArgs
  } else {
    throw 'Docker Compose is not available'
  }
  if ($LASTEXITCODE -ne 0) {
    throw "Docker Compose failed with exit code $LASTEXITCODE"
  }
}

if (-not (Test-Path $PrepareScript -PathType Leaf)) {
  throw "Missing prepare script: $PrepareScript"
}

& $PrepareScript -SkipBuild:$SkipBuild

if (-not (Test-Path $EnvFile -PathType Leaf)) {
  Write-Warning "Prepared isolated PayPro artifacts, but no containers were started because $EnvFile is missing."
  Write-Host "Copy $DeployRoot\.env.example to $EnvFile and replace every placeholder."
  exit 0
}

& $VerifyScript -EnvFile $EnvFile
if (-not $Start) {
  Write-Host '[OK] Preparation and validation completed.' -ForegroundColor Green
  Write-Host 'No containers were started. Pass -Start explicitly to launch the isolated local stack.'
  exit 0
}

Invoke-Compose @('--env-file', $EnvFile, '-f', $ComposeFile, 'build', '--pull', 'paypro')
Invoke-Compose @('--env-file', $EnvFile, '-f', $ComposeFile, 'up', '-d', '--wait', '--wait-timeout', '240')

$hostPort = 8889
foreach ($line in Get-Content -LiteralPath $EnvFile) {
  if ($line -match '^PAYPRO_HOST_PORT=(\d+)$') {
    $hostPort = [int]$Matches[1]
    break
  }
}

$response = Invoke-RestMethod -Uri "http://127.0.0.1:$hostPort/api/health" -TimeoutSec 10
if ($response.status -ne 'ok') {
  throw 'PayPro health endpoint did not return status=ok'
}

Write-Host '[OK] Isolated local PayPro stack is healthy.' -ForegroundColor Green
Write-Host 'QianFu .env, payment project configuration, and production releases were not changed.'
