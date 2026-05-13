param(
  [string]$BundleDir = "portable-bundle",
  [string]$MySqlDataDir = "D:\mysql84-data",
  [string]$RedisDataDir = "D:\redis-data",
  [switch]$SkipNodeModules
)

$ErrorActionPreference = "Stop"

function Step($msg) { Write-Host "[STEP] $msg" -ForegroundColor Cyan }
function Ok($msg) { Write-Host "[OK]   $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }

function New-DirectoryIfMissing([string]$path) {
  if (!(Test-Path $path)) {
    New-Item -ItemType Directory -Path $path -Force | Out-Null
  }
}

function Copy-Tree([string]$from, [string]$to) {
  New-DirectoryIfMissing $to
  $null = robocopy $from $to /MIR /R:2 /W:1 /NFL /NDL /NJH /NJS /NP
  if ($LASTEXITCODE -ge 8) {
    throw "robocopy failed from '$from' to '$to' (exit=$LASTEXITCODE)"
  }
}

function Copy-IfExists([string]$from, [string]$toDir) {
  if (Test-Path $from) {
    New-DirectoryIfMissing $toDir
    Copy-Item -Path $from -Destination $toDir -Recurse -Force
    return $true
  }
  return $false
}

function Get-Sha256Compat([string]$path) {
  if (Get-Command Get-FileHash -ErrorAction SilentlyContinue) {
    return (Get-FileHash -Algorithm SHA256 -Path $path).Hash
  }

  $lines = & certutil -hashfile $path SHA256
  if ($LASTEXITCODE -ne 0 -or !$lines) {
    throw "Failed to hash file: $path"
  }

  foreach ($line in $lines) {
    $trim = $line.Trim()
    if ($trim -match '^[0-9A-Fa-f]{64}$') {
      return $trim.ToUpper()
    }
  }
  throw "Could not parse SHA256 from certutil output for: $path"
}

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root

Step "Preparing bundle directories"
if (Test-Path $BundleDir) {
  Remove-Item -Recurse -Force $BundleDir
}
New-DirectoryIfMissing $BundleDir
New-DirectoryIfMissing "$BundleDir\project"
New-DirectoryIfMissing "$BundleDir\runtimes"
New-DirectoryIfMissing "$BundleDir\scripts\windows"
New-DirectoryIfMissing "$BundleDir\manifest"

Step "Detecting runtime paths"
$javaExe = (Get-Command java -ErrorAction SilentlyContinue).Source
if (!$javaExe) { throw "java not found in PATH" }
$javaHome = Split-Path -Parent (Split-Path -Parent $javaExe)

$nodeExe = (Get-Command node -ErrorAction SilentlyContinue).Source
if (!$nodeExe) { throw "node not found in PATH" }
$nodeHome = Split-Path -Parent $nodeExe

$mysqlExe = "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqld.exe"
if (!(Test-Path $mysqlExe)) {
  throw "mysqld.exe not found at '$mysqlExe'"
}
$mysqlHome = Split-Path -Parent (Split-Path -Parent $mysqlExe)

$redisExe = (Get-Command redis-server -ErrorAction SilentlyContinue).Source
$redisHome = $null
if ($redisExe) {
  $redisHome = Split-Path -Parent $redisExe
}

Step "Copying runtimes"
Copy-Tree $javaHome "$BundleDir\runtimes\java"
Copy-Tree $nodeHome "$BundleDir\runtimes\node"
Copy-Tree $mysqlHome "$BundleDir\runtimes\mysql"
if ($redisHome) {
  Copy-Tree $redisHome "$BundleDir\runtimes\redis"
} else {
  Warn "redis-server not found in PATH; runtime will not include Redis binaries"
}

if (Test-Path $MySqlDataDir) {
  Step "Copying MySQL data directory"
  Copy-Tree $MySqlDataDir "$BundleDir\runtimes\mysql-data"
} else {
  Warn "MySQL data directory not found: $MySqlDataDir (bundle will require init on target machine)"
}

if (Test-Path $RedisDataDir) {
  Step "Copying Redis data directory"
  Copy-Tree $RedisDataDir "$BundleDir\runtimes\redis-data"
} else {
  Warn "Redis data directory not found: $RedisDataDir (bundle will start with empty Redis data)"
}

Step "Ensuring Prisma client (prisma/generated)"
$prismaBin = Join-Path $root "node_modules\.bin\prisma.cmd"
if (Test-Path $prismaBin) {
  Push-Location $root
  try {
    npx prisma generate
  } finally {
    Pop-Location
  }
} elseif (Test-Path (Join-Path $root "prisma\generated\client")) {
  Ok "prisma/generated already present"
} else {
  Warn "No prisma CLI in node_modules and no prisma/generated — run npm ci in repo first, or start-portable will try prisma generate at runtime."
}

Step "Copying project files"
$includeDirs = @(
  "server", "src", "prisma", "public", "scripts", "xpay-3.1_YTM7H", "tests"
)
foreach ($d in $includeDirs) {
  Copy-IfExists "$root\$d" "$BundleDir\project\$d" | Out-Null
}

$includeFiles = @(
  "package.json",
  "package-lock.json",
  ".env",
  ".env.example",
  "tsconfig.json",
  "tsconfig.node.json",
  "tsconfig.server.json",
  "vite.config.ts",
  "docker-compose.fullstack.yml",
  "docker-compose.offline.yml",
  "LOCAL_FULLSTACK_INTEGRATION.md",
  "PORTABLE_MIGRATION.md"
)
foreach ($f in $includeFiles) {
  if (Test-Path "$root\$f") {
    Copy-IfExists "$root\$f" "$BundleDir\project" | Out-Null
  }
}

if (!$SkipNodeModules) {
  Step "Copying node_modules (this may take a while)"
  if (Test-Path "$root\node_modules") {
    Copy-Tree "$root\node_modules" "$BundleDir\project\node_modules"
  } else {
    Warn "node_modules not found; target machine must run npm ci"
  }
} else {
  Warn "Skipping node_modules by request"
}

Step "Creating portable startup script"
$startPortable = @'
$ErrorActionPreference = "Stop"

function Step($m) { Write-Host "[STEP] $m" -ForegroundColor Cyan }
function Ok($m) { Write-Host "[OK]   $m" -ForegroundColor Green }

$base = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$project = Join-Path $base "project"
$javaBin = Join-Path $base "runtimes\java\bin"
$nodeBin = Join-Path $base "runtimes\node"
$mysqlBin = Join-Path $base "runtimes\mysql\bin"
$mysqlData = Join-Path $base "runtimes\mysql-data"
$redisBin = Join-Path $base "runtimes\redis"
$redisData = Join-Path $base "runtimes\redis-data"

$env:PATH = "$javaBin;$nodeBin;$mysqlBin;$env:PATH"
$env:JAVA_HOME = Split-Path -Parent $javaBin

Step "Starting embedded MySQL (3306)"
if (Test-Path $mysqlData) {
  Start-Process -FilePath (Join-Path $mysqlBin "mysqld.exe") `
    -ArgumentList @("--basedir=$($base)\runtimes\mysql","--datadir=$mysqlData","--port=3306","--bind-address=127.0.0.1","--skip-networking=0","--enable-named-pipe=0","--mysqlx=0","--console") `
    -WindowStyle Minimized
} else {
  Write-Host "[WARN] mysql-data not found. Please init MySQL manually." -ForegroundColor Yellow
}

if (Test-Path (Join-Path $redisBin "redis-server.exe")) {
  Step "Starting embedded Redis (6379)"
  if (!(Test-Path $redisData)) {
    New-Item -ItemType Directory -Path $redisData -Force | Out-Null
  }
  Start-Process -FilePath (Join-Path $redisBin "redis-server.exe") `
    -ArgumentList @("--port","6379","--dir",$redisData,"--appendonly","yes") `
    -WindowStyle Minimized
} else {
  Write-Host "[WARN] redis-server.exe not found in bundle." -ForegroundColor Yellow
}

Set-Location (Join-Path $project "xpay-3.1_YTM7H\xpay-code")
Step "Starting xpay (8888)"
Start-Process -FilePath (Join-Path $javaBin "java.exe") `
  -ArgumentList @("-Xms256m","-Xmx512m","-jar","target\xpay-3.1.0.jar","--server.port=8888","--spring.main.allow-circular-references=true","--spring.datasource.url=jdbc:mysql://127.0.0.1:3306/xpay?characterEncoding=utf-8&useSSL=false&serverTimezone=Asia/Shanghai&allowPublicKeyRetrieval=true","--spring.datasource.username=root","--spring.datasource.password=","--spring.datasource.druid.filters=stat,wall","--spring.redis.host=127.0.0.1","--spring.redis.port=6379","--spring.redis.timeout=1000") `
  -WindowStyle Minimized

Set-Location $project
if (Test-Path (Join-Path $project "node_modules\.bin\prisma.cmd")) {
  Step "Prisma generate (portable)"
  $prismaLog = Join-Path $base "manifest\prisma-portable.log"
  New-DirectoryIfMissing (Split-Path -Parent $prismaLog)
  Push-Location $project
  try {
    $oldPath = $env:PATH
    $env:PATH = "$nodeBin;$oldPath"
    & (Join-Path $nodeBin "npx.cmd") prisma generate *>&1 | Out-File -FilePath $prismaLog -Encoding utf8
    if ($LASTEXITCODE -ne 0) {
      Write-Host "[WARN] prisma generate failed; see manifest\prisma-portable.log" -ForegroundColor Yellow
    }
  } finally {
    $env:PATH = $oldPath
    Pop-Location
  }
}
Step "Starting backend (3000)"
Start-Process -FilePath (Join-Path $nodeBin "npm.cmd") -ArgumentList @("run","server") -WindowStyle Minimized

Ok "Portable stack start command issued."
Write-Host "Backend: http://127.0.0.1:3000"
Write-Host "XPay:    http://127.0.0.1:8888/starmc/pay"
'@
Set-Content -Path "$BundleDir\scripts\windows\start-portable.ps1" -Value $startPortable -Encoding UTF8

Step "Generating manifest metadata"
$manifest = [ordered]@{
  generatedAt = (Get-Date).ToString("s")
  host = $env:COMPUTERNAME
  javaExe = $javaExe
  javaHome = $javaHome
  nodeExe = $nodeExe
  nodeHome = $nodeHome
  mysqlExe = $mysqlExe
  mysqlHome = $mysqlHome
  redisExe = $redisExe
  redisHome = $redisHome
  mysqlDataIncluded = (Test-Path $MySqlDataDir)
  mysqlDataSource = $MySqlDataDir
  redisDataIncluded = (Test-Path $RedisDataDir)
  redisDataSource = $RedisDataDir
  nodeModulesIncluded = (-not $SkipNodeModules.IsPresent)
}
$manifest | ConvertTo-Json -Depth 4 | Set-Content -Path "$BundleDir\manifest\portable-manifest.json" -Encoding UTF8

Step "Writing quick file hashes"
$hashTargets = @(
  "$BundleDir\project\package.json",
  "$BundleDir\project\package-lock.json",
  "$BundleDir\project\xpay-3.1_YTM7H\xpay-code\target\xpay-3.1.0.jar",
  "$BundleDir\scripts\windows\start-portable.ps1"
)
$hashOut = @()
foreach ($t in $hashTargets) {
  if (Test-Path $t) {
    $hash = Get-Sha256Compat $t
    $hashOut += "$hash *$($t.Substring((Resolve-Path $BundleDir).Path.Length + 1))"
  }
}
$hashOut | Set-Content -Path "$BundleDir\manifest\sha256sum.txt" -Encoding UTF8

Ok "Portable bundle created: $BundleDir"
Write-Host "Next: run .\portable-bundle\scripts\windows\start-portable.ps1 on target machine."
