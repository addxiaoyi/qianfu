param(
  [int]$WebPort = 4123,
  [int]$ApiPort = 3000,
  [int]$SupertokensPort = 3567,
  [int]$XpayPort = 8888,
  [int]$PreviewPort = 4124,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $Root

function Step($msg) { Write-Host "[STEP] $msg" -ForegroundColor Cyan }
function Ok($msg) { Write-Host "[OK]   $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Fail($msg) { Write-Host "[FAIL] $msg" -ForegroundColor Red; exit 1 }

function Test-Port([int]$Port) {
  try {
    $listeners = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction Stop
    return $null -ne $listeners
  } catch {
    return $false
  }
}

function Find-FreePort([int]$StartPort) {
  $port = $StartPort
  while (Test-Port $port) { $port++ }
  return $port
}

function Ensure-Command($name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    Fail "$name not found in PATH"
  }
}

function Ensure-NodeModules {
  if (-not (Test-Path 'node_modules')) {
    Step 'node_modules missing, running npm install'
    if ($DryRun) {
      Ok '[dry-run] npm install'
    } else {
      npm install
    }
  } else {
    Ok 'node_modules exists'
  }
}

function Ensure-EnvLocal {
  if (-not (Test-Path '.env.local')) {
    if (Test-Path '.env.example') {
      Copy-Item '.env.example' '.env.local' -Force
      Ok 'Created .env.local from .env.example'
    } elseif (Test-Path '.env') {
      Copy-Item '.env' '.env.local' -Force
      Ok 'Created .env.local from .env'
    } else {
      Fail 'No .env.example or .env found'
    }
  }
}

function Write-AutoEnv([int]$Api, [int]$Web, [int]$ST, [int]$Xpay, [int]$Preview) {
  $content = @"
PORT=$Api
FRONTEND_URL=http://127.0.0.1:$Web
API_PUBLIC_URL=http://127.0.0.1:$Api
VITE_BACKEND_URL=http://127.0.0.1:$Api
VITE_SUPERTOKENS_API_DOMAIN=http://127.0.0.1:$Api
SUPERTOKENS_CONNECTION_URI=http://127.0.0.1:$ST
QIANFU_API_URL=http://127.0.0.1:$Xpay/qianfu-api
QIANFU_CALLBACK_URL=http://127.0.0.1:$Api/api/qianfu/xpay/notify
VITE_PORT=$Web
VITE_PREVIEW_PORT=$Preview
VITE_USE_POLLING=1
NODE_ENV=development
"@
  if ($DryRun) {
    Ok '[dry-run] write .env.local.auto'
  } else {
    $content | Set-Content '.env.local.auto' -Encoding UTF8
  }
}

function Start-Detached($name, $command, $args, $logFile) {
  if ($DryRun) {
    Ok "[dry-run] $command $args > $logFile"
    return
  }
  Start-Process -FilePath $command -ArgumentList $args -WindowStyle Minimized -RedirectStandardOutput $logFile -RedirectStandardError $logFile | Out-Null
}

Ensure-Command npm
Ensure-Command npx
Ensure-Command curl

if (Get-Command docker -ErrorAction SilentlyContinue) {
  Ok 'docker found'
} else {
  Warn 'docker not found; SuperTokens compose auto-start will be skipped'
}

if (Get-Command java -ErrorAction SilentlyContinue) {
  Ok 'java found'
} else {
  Warn 'java not found; xpay auto-start may be skipped'
}

Ensure-NodeModules
Ensure-EnvLocal

$WebPort = Find-FreePort $WebPort
$ApiPort = Find-FreePort $ApiPort
$SupertokensPort = Find-FreePort $SupertokensPort
$XpayPort = Find-FreePort $XpayPort
$PreviewPort = Find-FreePort $PreviewPort

Write-AutoEnv -Api $ApiPort -Web $WebPort -ST $SupertokensPort -Xpay $XpayPort -Preview $PreviewPort

Step "Ports selected: web=$WebPort, api=$ApiPort, supertokens=$SupertokensPort, xpay=$XpayPort, preview=$PreviewPort"

$env:PORT = "$ApiPort"
$env:FRONTEND_URL = "http://127.0.0.1:$WebPort"
$env:API_PUBLIC_URL = "http://127.0.0.1:$ApiPort"
$env:VITE_BACKEND_URL = "http://127.0.0.1:$ApiPort"
$env:VITE_SUPERTOKENS_API_DOMAIN = "http://127.0.0.1:$ApiPort"
$env:SUPERTOKENS_CONNECTION_URI = "http://127.0.0.1:$SupertokensPort"
$env:QIANFU_API_URL = "http://127.0.0.1:$XpayPort/qianfu-api"
$env:QIANFU_CALLBACK_URL = "http://127.0.0.1:$ApiPort/api/qianfu/xpay/notify"
$env:VITE_PORT = "$WebPort"
$env:VITE_PREVIEW_PORT = "$PreviewPort"
$env:VITE_USE_POLLING = '1'

Step 'Preparing Prisma'
if ($DryRun) {
  Ok '[dry-run] npx prisma generate'
  Ok '[dry-run] npx prisma migrate deploy'
} else {
  npx prisma generate
  npx prisma migrate deploy
}

if (Get-Command docker -ErrorAction SilentlyContinue) {
  if (Test-Path 'docker-compose.supertokens.yml') {
    Step 'Attempting to start SuperTokens core via docker compose'
    if ($DryRun) {
      Ok '[dry-run] docker compose -f docker-compose.supertokens.yml up -d'
    } else {
      docker compose -f docker-compose.supertokens.yml up -d | Out-Null
    }
  } else {
    Warn 'docker-compose.supertokens.yml not found; skipping SuperTokens core compose start'
  }
}

$xpayDir = Join-Path $Root 'xpay-3.1_YTM7H\xpay-code'
if (Test-Path $xpayDir) {
  $mvnw = Join-Path $xpayDir 'mvnw'
  if (Test-Path $mvnw) {
    Step 'Starting xpay service'
    if ($DryRun) {
      Ok '[dry-run] xpay spring-boot:run'
    } else {
      Start-Process -FilePath $mvnw -ArgumentList @('spring-boot:run') -WorkingDirectory $xpayDir -WindowStyle Minimized | Out-Null
    }
  } else {
    Warn 'xpay mvnw not found; skipping xpay start'
  }
} else {
  Warn 'xpay directory not found; skipping xpay start'
}

Step 'Starting backend'
Start-Detached 'api' 'npm.cmd' @('run','server') '.run-api.log'

Step 'Starting frontend'
Start-Detached 'web' 'npm.cmd' @('run','dev') '.run-web.log'

if ($DryRun) {
  Ok '[dry-run] skip health checks'
} else {
  Start-Sleep -Seconds 5
  try {
    curl.exe -fsS "http://127.0.0.1:$ApiPort/api/health" | Out-Null
    Ok "backend ready: http://127.0.0.1:$ApiPort/api/health"
  } catch {
    Warn 'backend health check failed'
  }
  try {
    curl.exe -fsS "http://127.0.0.1:$WebPort" | Out-Null
    Ok "frontend ready: http://127.0.0.1:$WebPort"
  } catch {
    Warn 'frontend health check failed'
  }
}

Ok 'Fullstack started successfully.'
Write-Host "API: http://127.0.0.1:$ApiPort"
Write-Host "Web: http://127.0.0.1:$WebPort"
Write-Host "Logs: .run-api.log, .run-web.log"
