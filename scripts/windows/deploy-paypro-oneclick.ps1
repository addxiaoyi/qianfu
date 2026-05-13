param(
  [int]$ApiPort = 3000,
  [int]$PayProPort = 8889,
  [string]$BindHost = "127.0.0.1",
  [switch]$WithWeb,
  [switch]$SkipPayProBuild,
  [switch]$ForceInstall,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$PayProRoot = Join-Path $Root 'tmp\PayPro'
$EnvFile = Join-Path $Root '.env'
$EnvExample = Join-Path $Root '.env.example'

$ApiBase = "http://${BindHost}:$ApiPort"
$PayProBase = "http://${BindHost}:$PayProPort"
$PayProNotify = "$ApiBase/api/v1/payment/paypro/notify"

$ApiLog = Join-Path $Root '.run-api.log'
$WebLog = Join-Path $Root '.run-web.log'
$PayProLog = Join-Path $Root '.run-paypro.log'

function Step($msg) { Write-Host "[STEP] $msg" -ForegroundColor Cyan }
function Ok($msg) { Write-Host "[OK]   $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Fail($msg) { Write-Host "[FAIL] $msg" -ForegroundColor Red; exit 1 }

function Ensure-Command($name) {
  $cmd = Get-Command $name -ErrorAction SilentlyContinue
  if (-not $cmd) {
    Fail "$name not found in PATH"
  }
  return $cmd.Source
}

function Test-PortListening([int]$port) {
  try {
    $listeners = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction Stop
    return $null -ne $listeners
  } catch {
    try {
      $rows = netstat -ano | Select-String -Pattern ":$port\s"
      return $null -ne $rows
    } catch {
      return $false
    }
  }
}

function Ensure-EnvFile {
  if (Test-Path $EnvFile) {
    Ok ".env found"
    return
  }

  if (Test-Path $EnvExample) {
    Copy-Item $EnvExample $EnvFile -Force
    Ok "Created .env from .env.example"
    return
  }

  Fail "Missing .env and .env.example"
}

function Read-EnvValue([string]$key) {
  if (-not (Test-Path $EnvFile)) { return $null }
  $escaped = [regex]::Escape($key)
  foreach ($line in Get-Content $EnvFile) {
    if ($line -match "^\s*$escaped=(.*)$") {
      return $Matches[1].Trim()
    }
  }
  return $null
}

function Upsert-EnvValue([string]$key, [string]$value) {
  if ($DryRun) {
    Ok "[dry-run] set $key=$value"
    return
  }

  $content = Get-Content -Path $EnvFile -Raw
  $escaped = [regex]::Escape($key)
  $pattern = "(?m)^$escaped=.*$"

  if ([regex]::IsMatch($content, $pattern)) {
    $content = [regex]::Replace($content, $pattern, "$key=$value")
  } else {
    if (-not $content.EndsWith("`n")) {
      $content += "`r`n"
    }
    $content += "$key=$value`r`n"
  }

  Set-Content -Path $EnvFile -Value $content -Encoding UTF8
}

function New-RandomSecret([int]$length = 48) {
  $alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  $bytes = New-Object byte[] $length
  $rng = New-Object System.Security.Cryptography.RNGCryptoServiceProvider
  $rng.GetBytes($bytes)
  $rng.Dispose()
  $chars = for ($i = 0; $i -lt $length; $i++) {
    $alphabet[$bytes[$i] % $alphabet.Length]
  }
  return -join $chars
}

function Mask-Secret([string]$secret) {
  if ([string]::IsNullOrWhiteSpace($secret)) { return "<empty>" }
  if ($secret.Length -le 10) { return "********" }
  return "{0}****{1}" -f $secret.Substring(0, 6), $secret.Substring($secret.Length - 4)
}

function Invoke-StepCommand([string]$name, [string]$filePath, [string[]]$argList, [string]$workingDir) {
  if ($DryRun) {
    Ok "[dry-run] $name => $filePath $($argList -join ' ')"
    return
  }
  Step $name
  & $filePath @argList
  if ($LASTEXITCODE -ne 0) {
    Fail "$name failed with exit code $LASTEXITCODE"
  }
  Ok "$name completed"
}

function Start-Detached([string]$name, [string]$filePath, [string[]]$argList, [string]$workingDir, [string]$logPath) {
  if ($DryRun) {
    Ok "[dry-run] start $name => $filePath $($argList -join ' ') (log: $logPath)"
    return $null
  }

  $proc = Start-Process -FilePath $filePath -ArgumentList $argList -WorkingDirectory $workingDir -WindowStyle Minimized -RedirectStandardOutput $logPath -RedirectStandardError $logPath -PassThru
  Ok "$name started (PID $($proc.Id))"
  return $proc
}

function Wait-ApiReady([string]$url, [int]$timeoutSec = 90) {
  $deadline = (Get-Date).AddSeconds($timeoutSec)
  while ((Get-Date) -lt $deadline) {
    try {
      $res = Invoke-WebRequest -Uri $url -Method GET -TimeoutSec 5
      if ($res.StatusCode -eq 200) {
        return $true
      }
    } catch {}
    Start-Sleep -Seconds 2
  }
  return $false
}

function Wait-PayProReady([string]$base, [int]$timeoutSec = 120) {
  $deadline = (Get-Date).AddSeconds($timeoutSec)
  while ((Get-Date) -lt $deadline) {
    $payload = @{
      orderNo = "probe-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"
      amount = 1.00
      payType = 'alipay'
      timestamp = [int64]([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
      sign = 'INVALID'
    } | ConvertTo-Json -Compress

    try {
      $res = Invoke-WebRequest -Uri "$base/api/openapi/add" -Method POST -Body $payload -ContentType 'application/json' -TimeoutSec 5
      if ($res.StatusCode -ge 200) {
        return $true
      }
    } catch {
      if ($_.Exception.Response) {
        return $true
      }
    }
    Start-Sleep -Seconds 2
  }
  return $false
}

Set-Location $Root

Step "QianFu + PayPro one-click deployment"
Ok "Root: $Root"

$npmCmd = Ensure-Command 'npm'
$npxCmd = Ensure-Command 'npx'
$mvnCmd = Ensure-Command 'mvn'

Ensure-EnvFile

$payProSecret = Read-EnvValue 'PAYPRO_OPENAPI_SECRET'
if ([string]::IsNullOrWhiteSpace($payProSecret) -or $payProSecret -eq 'your_openapi_secret_key_here') {
  $payProSecret = New-RandomSecret
  Upsert-EnvValue 'PAYPRO_OPENAPI_SECRET' $payProSecret
  Ok "Generated PAYPRO_OPENAPI_SECRET: $(Mask-Secret $payProSecret)"
} else {
  Ok "Using PAYPRO_OPENAPI_SECRET from .env: $(Mask-Secret $payProSecret)"
}

Upsert-EnvValue 'PORT' "$ApiPort"
Upsert-EnvValue 'API_PUBLIC_URL' $ApiBase
Upsert-EnvValue 'PAYPRO_ENABLED' 'true'
Upsert-EnvValue 'PAYPRO_API_URL' $PayProBase
Upsert-EnvValue 'PAYPRO_NOTIFY_URL' $PayProNotify
Upsert-EnvValue 'PAYPRO_TIMEOUT_MS' '10000'

if (-not $DryRun) {
  Step "Current PayPro env in .env"
  Get-Content $EnvFile | Select-String -Pattern '^PAYPRO_|^PORT=|^API_PUBLIC_URL=' | ForEach-Object { Write-Host $_.Line }
}

if (-not (Test-Path (Join-Path $Root 'node_modules')) -or $ForceInstall) {
  Invoke-StepCommand -name "npm install" -filePath $npmCmd -argList @('install') -workingDir $Root
} else {
  Ok "node_modules exists (skip install)"
}

Invoke-StepCommand -name "prisma prepare" -filePath $npmCmd -argList @('run', 'local:prepare') -workingDir $Root
Invoke-StepCommand -name "runtime env validate" -filePath $npmCmd -argList @('run', 'validate:env') -workingDir $Root

if (-not (Test-Path $PayProRoot)) {
  Fail "PayPro source not found: $PayProRoot"
}

if (-not $SkipPayProBuild) {
  Invoke-StepCommand -name "build PayPro (maven package)" -filePath $mvnCmd -argList @('clean', 'package', '-DskipTests') -workingDir $PayProRoot
} else {
  Warn "SkipPayProBuild enabled"
}

if (Test-PortListening $PayProPort) {
  Warn "Port $PayProPort already in use, skip starting PayPro"
} else {
  $payProArgs = @(
    'spring-boot:run',
    "-Dspring-boot.run.arguments=--server.port=$PayProPort --paypro.site=$PayProBase --paypro.openapi.secret=$payProSecret"
  )
  Start-Detached -name 'PayPro' -filePath $mvnCmd -argList $payProArgs -workingDir $PayProRoot -logPath $PayProLog | Out-Null
}

if (Test-PortListening $ApiPort) {
  Warn "Port $ApiPort already in use, skip starting QianFu API"
} else {
  Start-Detached -name 'QianFu API' -filePath $npmCmd -argList @('run', 'server') -workingDir $Root -logPath $ApiLog | Out-Null
}

if ($WithWeb) {
  if (Test-PortListening 4123) {
    Warn "Port 4123 already in use, skip starting web dev server"
  } else {
    Start-Detached -name 'QianFu Web' -filePath $npmCmd -argList @('run', 'dev') -workingDir $Root -logPath $WebLog | Out-Null
  }
}

if ($DryRun) {
  Ok "[dry-run] skip health checks"
  exit 0
}

Step "Health checks"
if (Wait-PayProReady $PayProBase 120) {
  Ok "PayPro ready: $PayProBase"
} else {
  Warn "PayPro is not ready yet. Check log: $PayProLog"
}

if (Wait-ApiReady "$ApiBase/api/health" 90) {
  Ok "QianFu API ready: $ApiBase/api/health"
} else {
  Warn "QianFu API is not ready yet. Check log: $ApiLog"
}

if ($WithWeb) {
  if (Wait-ApiReady "http://${BindHost}:4123" 90) {
    Ok "QianFu Web ready: http://${BindHost}:4123"
  } else {
    Warn "QianFu Web is not ready yet. Check log: $WebLog"
  }
}

Write-Host ""
Ok "Deployment script completed"
Write-Host "API: $ApiBase"
Write-Host "PayPro: $PayProBase"
Write-Host "PayPro callback: $PayProNotify"
Write-Host "Logs:"
Write-Host "  - $ApiLog"
Write-Host "  - $PayProLog"
if ($WithWeb) {
  Write-Host "  - $WebLog"
}
