$ErrorActionPreference = "Stop"

function Write-Step($msg) {
  Write-Host "[STEP] $msg" -ForegroundColor Cyan
}

function Write-Ok($msg) {
  Write-Host "[OK]   $msg" -ForegroundColor Green
}

function Write-Warn($msg) {
  Write-Host "[WARN] $msg" -ForegroundColor Yellow
}

function Test-Port($port) {
  $res = netstat -ano | Select-String ":$port"
  return ($res -ne $null)
}

function Get-ListeningPid($port) {
  $line = netstat -ano | Select-String ":$port\s+.*LISTENING"
  if ($null -eq $line) { return $null }
  $match = [regex]::Match($line.Line, '\s+(\d+)\s*$')
  if ($match.Success) { return [int]$match.Groups[1].Value }
  return $null
}

function Test-BackendHealth($port) {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$port/api/health" -TimeoutSec 2
    $contentType = [string]$response.Headers['Content-Type']
    return $response.StatusCode -eq 200 -and $contentType -match 'application/json'
  } catch {
    return $false
  }
}

Write-Step "Checking required ports..."
if (Test-Port 3000) { Write-Warn "Port 3000 already in use" } else { Write-Ok "Port 3000 available" }
if (Test-Port 4123) { Write-Warn "Port 4123 already in use" } else { Write-Ok "Port 4123 available" }
if (Test-Port 8888) { Write-Warn "Port 8888 already in use" } else { Write-Ok "Port 8888 available" }

$backendPort = $null
foreach ($candidate in @(3000, 3001)) {
  if (Test-BackendHealth $candidate) {
    $backendPort = $candidate
    break
  }
}

if ($null -eq $backendPort) {
  # A listening Vite port is not an API. Keep 3000 as the default launch target.
  $backendPort = if (-not (Test-Port 3000)) { 3000 } elseif (-not (Test-Port 3001)) { 3001 } else { 3000 }
}
Write-Host "Detected backend target: http://localhost:$backendPort" -ForegroundColor Green
Write-Host "Suggested VITE_BACKEND_URL=http://localhost:$backendPort" -ForegroundColor Gray

Write-Step "Preparing Prisma client and migrations..."
npx prisma generate
npx prisma migrate deploy
Write-Ok "Prisma ready"

Write-Step "Starting integrated development stack..."
Write-Host "One terminal (no Docker): npm run dev:stack   — Vite HMR :4123 + API :3000" -ForegroundColor Green
Write-Host "Or split terminals:" -ForegroundColor White
Write-Host "1) xpay:   cd xpay-3.1_YTM7H\xpay-code && install.bat (or start your existing xpay process)" -ForegroundColor Gray
Write-Host "2) server: npm run server" -ForegroundColor Gray
Write-Host "3) web:    npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "After services are up, run: npm run local:verify" -ForegroundColor Green
