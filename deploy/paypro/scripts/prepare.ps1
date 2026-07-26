[CmdletBinding()]
param(
  [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$DeployRoot = Split-Path -Parent $PSScriptRoot
$RepoRoot = (Resolve-Path (Join-Path $DeployRoot '..\..')).Path
$PayProRoot = Join-Path $RepoRoot 'tmp\PayPro'
$JarSource = Join-Path $PayProRoot 'target\paypro-1.0-SNAPSHOT.jar'
$SchemaSource = Join-Path $PayProRoot 'src\main\resources\db.sql'
$ArtifactDir = Join-Path $DeployRoot 'artifacts'
$InitDir = Join-Path $DeployRoot 'mysql-init'
$JarTarget = Join-Path $ArtifactDir 'paypro.jar'
$SchemaTarget = Join-Path $InitDir '001-schema.sql'

function Invoke-Checked([string]$Label, [scriptblock]$Command) {
  Write-Host "[STEP] $Label" -ForegroundColor Cyan
  & $Command
  if ($LASTEXITCODE -ne 0) {
    throw "$Label failed with exit code $LASTEXITCODE"
  }
}

if (-not (Test-Path $PayProRoot)) {
  throw "PayPro source not found: $PayProRoot"
}

if (-not $SkipBuild) {
  Push-Location $PayProRoot
  try {
    Invoke-Checked 'PayPro tests' { mvn test }
    Invoke-Checked 'PayPro package' { mvn -DskipTests package }
  } finally {
    Pop-Location
  }
}

foreach ($path in @($JarSource, $SchemaSource)) {
  if (-not (Test-Path $path -PathType Leaf)) {
    throw "Required source file is missing: $path"
  }
}

New-Item -ItemType Directory -Force -Path $ArtifactDir, $InitDir, (Join-Path $DeployRoot 'payment-assets\qr'), (Join-Path $DeployRoot 'backups') | Out-Null
Copy-Item -LiteralPath $JarSource -Destination $JarTarget -Force
Copy-Item -LiteralPath $SchemaSource -Destination $SchemaTarget -Force

$jarHash = (Get-FileHash -LiteralPath $JarTarget -Algorithm SHA256).Hash.ToLowerInvariant()
$schemaHash = (Get-FileHash -LiteralPath $SchemaTarget -Algorithm SHA256).Hash.ToLowerInvariant()
[System.IO.File]::WriteAllText("$JarTarget.sha256", "$jarHash  paypro.jar`n", [System.Text.Encoding]::ASCII)
[System.IO.File]::WriteAllText("$SchemaTarget.sha256", "$schemaHash  001-schema.sql`n", [System.Text.Encoding]::ASCII)

Write-Host "[OK] PayPro deployment context prepared" -ForegroundColor Green
Write-Host "JAR SHA-256:    $jarHash"
Write-Host "Schema SHA-256: $schemaHash"
Write-Host 'No containers were started and no payment method was enabled.'
