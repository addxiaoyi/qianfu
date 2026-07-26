[CmdletBinding()]
param(
  [string]$EnvFile
)

$ErrorActionPreference = 'Stop'
$DeployRoot = Split-Path -Parent $PSScriptRoot
$ComposeFile = Join-Path $DeployRoot 'docker-compose.yml'
if ([string]::IsNullOrWhiteSpace($EnvFile)) {
  $EnvFile = Join-Path $DeployRoot '.env'
}
$EnvFile = [System.IO.Path]::GetFullPath($EnvFile)

function Read-DotEnv([string]$Path) {
  $values = @{}
  foreach ($rawLine in Get-Content -LiteralPath $Path) {
    $line = $rawLine.Trim()
    if (-not $line -or $line.StartsWith('#')) { continue }
    $separator = $line.IndexOf('=')
    if ($separator -lt 1) { throw "Invalid .env line: $rawLine" }
    $key = $line.Substring(0, $separator).Trim()
    $value = $line.Substring($separator + 1).Trim()
    $values[$key] = $value
  }
  return $values
}

function Require-Value([hashtable]$Values, [string]$Key) {
  $value = [string]$Values[$Key]
  if ([string]::IsNullOrWhiteSpace($value)) { throw "$Key is required" }
  if ($value -match '(?i)replace-') { throw "$Key still contains a placeholder" }
  return $value
}

function Require-MinLength([hashtable]$Values, [string]$Key, [int]$Length) {
  $value = Require-Value $Values $Key
  if ($value.Length -lt $Length) { throw "$Key must contain at least $Length characters" }
}

function Assert-Hash([string]$FilePath) {
  $hashPath = "$FilePath.sha256"
  if (-not (Test-Path $FilePath -PathType Leaf)) { throw "Missing file: $FilePath" }
  if (-not (Test-Path $hashPath -PathType Leaf)) { throw "Missing checksum: $hashPath" }
  $expected = ((Get-Content -LiteralPath $hashPath -Raw).Trim() -split '\s+')[0].ToLowerInvariant()
  $actual = (Get-FileHash -LiteralPath $FilePath -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actual -ne $expected) { throw "Checksum mismatch: $FilePath" }
}

function Resolve-ComposeCommand {
  if (Get-Command docker-compose -ErrorAction SilentlyContinue) { return 'standalone' }
  if (Get-Command docker -ErrorAction SilentlyContinue) { return 'plugin' }
  throw 'Docker Compose is not available'
}

function Invoke-Compose([string]$Mode, [string[]]$ComposeArgs) {
  if ($Mode -eq 'plugin') {
    & docker compose @ComposeArgs
  } else {
    & docker-compose @ComposeArgs
  }
  if ($LASTEXITCODE -ne 0) { throw "Docker Compose failed with exit code $LASTEXITCODE" }
}

if (-not (Test-Path $EnvFile -PathType Leaf)) { throw "Missing environment file: $EnvFile" }
if (-not (Test-Path $ComposeFile -PathType Leaf)) { throw "Missing Compose file: $ComposeFile" }
if (-not (Test-Path (Join-Path $DeployRoot 'mysql-migrations\002-order-expiry-decrement.sql') -PathType Leaf)) {
  throw 'Missing database migration 002'
}
Assert-Hash (Join-Path $DeployRoot 'artifacts\paypro.jar')
Assert-Hash (Join-Path $DeployRoot 'mysql-init\001-schema.sql')

$values = Read-DotEnv $EnvFile
foreach ($key in @('PAYPRO_DB_PASSWORD', 'PAYPRO_MYSQL_ROOT_PASSWORD', 'PAYPRO_REDIS_PASSWORD')) {
  Require-MinLength $values $key 24
}
foreach ($key in @('PAYPRO_OPENAPI_SECRET', 'PAYPRO_ADMIN_TOKEN')) {
  Require-MinLength $values $key 32
}

$dbName = if ($values.ContainsKey('PAYPRO_DB_NAME')) { [string]$values['PAYPRO_DB_NAME'] } else { 'paypro' }
$dbUser = if ($values.ContainsKey('PAYPRO_DB_USER')) { [string]$values['PAYPRO_DB_USER'] } else { 'paypro' }
if ($dbName -notmatch '^[A-Za-z0-9_]+$') { throw 'PAYPRO_DB_NAME contains invalid characters' }
if ($dbUser -notmatch '^[A-Za-z0-9_]+$') { throw 'PAYPRO_DB_USER contains invalid characters' }

$allowBundled = ([string]$values['PAYPRO_ALLOW_BUNDLED_QR_CODES']).ToLowerInvariant()
if ($allowBundled -ne 'false') { throw 'PAYPRO_ALLOW_BUNDLED_QR_CODES must remain false' }

$orderTimeout = if ($values.ContainsKey('PAYPRO_ORDER_TIMEOUT_MINUTES')) { [string]$values['PAYPRO_ORDER_TIMEOUT_MINUTES'] } else { '30' }
if ($orderTimeout -notmatch '^\d+$' -or [int64]$orderTimeout -lt 1 -or [int64]$orderTimeout -gt 10080) {
  throw 'PAYPRO_ORDER_TIMEOUT_MINUTES must be between 1 and 10080'
}
$decrementEnabled = if ($values.ContainsKey('PAYPRO_DECREMENT_ENABLED')) { ([string]$values['PAYPRO_DECREMENT_ENABLED']).ToLowerInvariant() } else { 'false' }
if ($decrementEnabled -ne 'false') { throw 'PAYPRO_DECREMENT_ENABLED must remain false until no-note payment assets are accepted' }
$decrementMaxCount = if ($values.ContainsKey('PAYPRO_DECREMENT_MAX_COUNT')) { [string]$values['PAYPRO_DECREMENT_MAX_COUNT'] } else { '5' }
if ($decrementMaxCount -notmatch '^\d+$' -or [int64]$decrementMaxCount -lt 1 -or [int64]$decrementMaxCount -gt 100) {
  throw 'PAYPRO_DECREMENT_MAX_COUNT must be between 1 and 100'
}
$decrementStep = if ($values.ContainsKey('PAYPRO_DECREMENT_STEP')) { [string]$values['PAYPRO_DECREMENT_STEP'] } else { '0.01' }
[decimal]$parsedStep = 0
if (-not [decimal]::TryParse($decrementStep, [Globalization.NumberStyles]::AllowDecimalPoint, [Globalization.CultureInfo]::InvariantCulture, [ref]$parsedStep) -or $parsedStep -le 0) {
  throw 'PAYPRO_DECREMENT_STEP must be a positive decimal'
}

$alipayEnabled = ([string]$values['PAYPRO_ALIPAY_ENABLED']).ToLowerInvariant() -eq 'true'
$wechatEnabled = ([string]$values['PAYPRO_WECHAT_ENABLED']).ToLowerInvariant() -eq 'true'
if ($alipayEnabled -or $wechatEnabled) {
  $site = Require-Value $values 'PAYPRO_SITE'
  if ($site -notmatch '^https://[^/]+(?:/.*)?$') { throw 'PAYPRO_SITE must use HTTPS when payment is enabled' }

  $allowedHosts = Require-Value $values 'PAYPRO_NOTIFY_ALLOWED_HOSTS'
  foreach ($hostName in $allowedHosts.Split(',')) {
    if ($hostName.Trim() -notmatch '^[A-Za-z0-9.-]+$') { throw 'PAYPRO_NOTIFY_ALLOWED_HOSTS contains an invalid host' }
  }

  foreach ($key in @('PAYPRO_MAIL_HOST', 'PAYPRO_MAIL_SENDER', 'PAYPRO_MAIL_RECEIVER')) {
    [void](Require-Value $values $key)
  }

  $qrRoot = Join-Path $DeployRoot 'payment-assets\qr'
  if ($alipayEnabled -and -not (Get-ChildItem (Join-Path $qrRoot 'alipay') -Filter '*.png' -File -Recurse -ErrorAction SilentlyContinue)) {
    throw 'Alipay is enabled but no confirmed PNG asset exists under payment-assets/qr/alipay'
  }
  if ($wechatEnabled -and -not (Get-ChildItem (Join-Path $qrRoot 'wechat') -Filter '*.png' -File -Recurse -ErrorAction SilentlyContinue)) {
    throw 'WeChat is enabled but no confirmed PNG asset exists under payment-assets/qr/wechat'
  }
}

$composeMode = Resolve-ComposeCommand
Invoke-Compose $composeMode @('--env-file', $EnvFile, '-f', $ComposeFile, 'config', '--quiet')

Write-Host '[OK] PayPro deployment configuration passed all safety gates.' -ForegroundColor Green
Write-Host "Compose mode: $composeMode"
Write-Host "Payment methods enabled: alipay=$alipayEnabled, wechat=$wechatEnabled"
