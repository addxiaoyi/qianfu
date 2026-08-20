param(
    [string]$HostName = $(if ($env:QF_SSH_HOST) { $env:QF_SSH_HOST } else { "121.196.161.249" }),
    [int]$Port = $(if ($env:QF_SSH_PORT) { [int]$env:QF_SSH_PORT } else { 22 }),
    [string]$User = $(if ($env:QF_SSH_USER) { $env:QF_SSH_USER } else { "root" }),
    [string]$IdentityFile = $env:QF_SSH_IDENTITY,
    [string]$BundlePath = $(if ($env:QF_RESTORE_BUNDLE) { $env:QF_RESTORE_BUNDLE } else { "" }),
    [string]$RemoteAppRoot = $(if ($env:QF_REMOTE_APP_ROOT) { $env:QF_REMOTE_APP_ROOT } else { "/www/wwwroot/qianfu-app" }),
    [string]$RemoteBundlePath = $env:QF_REMOTE_BUNDLE_PATH,
    [switch]$DryRun,
    [switch]$SkipUpload,
    [switch]$SnapshotOnly,
    [switch]$PreflightOnly,
    [switch]$WebOnly,
    [switch]$PayOnly,
    [switch]$NoRepair,
    [switch]$NoStrict,
    [switch]$NoVerify,
    [int]$ConnectTimeout = 12
)

$ErrorActionPreference = "Stop"

function Get-LatestRestoreBundle {
    $bundleDir = "output/prod-restore-bundles"
    if (-not (Test-Path -LiteralPath $bundleDir)) {
        throw "Restore bundle directory not found: $bundleDir"
    }

    $bundle = Get-ChildItem -LiteralPath $bundleDir -Filter "qianfu-prod-restore-*.tar.gz" |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1

    if (-not $bundle) {
        throw "No qianfu-prod-restore-*.tar.gz bundle found under $bundleDir"
    }

    return $bundle.FullName
}

function Quote-Bash {
    param([string]$Value)
    return "'" + $Value.Replace("'", "'`"`"'`"'") + "'"
}

function Format-Command {
    param([string]$FilePath, [string[]]$Arguments)
    $parts = @($FilePath) + $Arguments
    return ($parts | ForEach-Object {
        if ($_ -match "\s") {
            '"' + $_.Replace('"', '\"') + '"'
        } else {
            $_
        }
    }) -join " "
}

function Invoke-CheckedCommand {
    param(
        [string]$FilePath,
        [string[]]$Arguments,
        [switch]$AllowDryRun
    )

    Write-Host "[run] $(Format-Command $FilePath $Arguments)"
    if ($DryRun -and $AllowDryRun) {
        return
    }

    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed with exit code $LASTEXITCODE`: $(Format-Command $FilePath $Arguments)"
    }
}

function Require-Command {
    param([string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command not found in PATH: $Name"
    }
}

Require-Command "ssh"
Require-Command "scp"

if ($WebOnly -and $PayOnly) {
    throw "-WebOnly and -PayOnly cannot be used together."
}

if ([string]::IsNullOrWhiteSpace($BundlePath)) {
    $BundlePath = Get-LatestRestoreBundle
}

$resolvedBundle = Resolve-Path -LiteralPath $BundlePath
$bundleFileName = Split-Path -Leaf $resolvedBundle

if ([string]::IsNullOrWhiteSpace($RemoteBundlePath)) {
    $RemoteBundlePath = "/www/wwwroot/$bundleFileName"
}

$target = "$User@$HostName"
$sshOptions = @(
    "-p", "$Port",
    "-o", "ConnectTimeout=$ConnectTimeout",
    "-o", "StrictHostKeyChecking=accept-new"
)

if (-not [string]::IsNullOrWhiteSpace($IdentityFile)) {
    $resolvedIdentity = Resolve-Path -LiteralPath $IdentityFile
    $sshOptions += @("-o", "IdentitiesOnly=yes", "-i", "$resolvedIdentity")
}

$scpOptions = @(
    "-P", "$Port",
    "-o", "ConnectTimeout=$ConnectTimeout",
    "-o", "StrictHostKeyChecking=accept-new"
)

if (-not [string]::IsNullOrWhiteSpace($IdentityFile)) {
    $scpOptions += @("-o", "IdentitiesOnly=yes", "-i", "$resolvedIdentity")
}

$scopeArgs = @()
if ($WebOnly) {
    $scopeArgs += "--web-only"
}
if ($PayOnly) {
    $scopeArgs += "--pay-only"
}
$scopeText = if ($scopeArgs.Count -gt 0) { $scopeArgs -join " " } else { "all" }

function Get-MinimalRepairCommand {
    param(
        [switch]$Preflight,
        [switch]$Dry,
        [switch]$StrictDisabled
    )

    $args = @("scripts/linux/prod-terminal-minimal-repair.sh") + $scopeArgs
    if ($Preflight) {
        $args += "--preflight-only"
    }
    if ($Dry) {
        $args += @("--dry-run", "--no-strict")
    } elseif ($StrictDisabled) {
        $args += "--no-strict"
    }
    return "bash " + ($args -join " ")
}

Write-Host "[restore-ssh] target=$target port=$Port bundle=$resolvedBundle remoteBundle=$RemoteBundlePath remoteAppRoot=$RemoteAppRoot scope=$scopeText dryRun=$DryRun"
Write-Host "[restore-ssh] Password authentication is handled by OpenSSH prompts; this script does not accept or print passwords."

if (-not $SkipUpload) {
    Invoke-CheckedCommand "scp" ($scpOptions + @("$resolvedBundle", "${target}:$RemoteBundlePath")) -AllowDryRun
} else {
    Write-Host "[skip] upload disabled; remote bundle must already exist at $RemoteBundlePath"
}

$remoteCommands = @(
    "set -euo pipefail",
    "cd $(Quote-Bash $RemoteAppRoot)",
    "tar -xzf $(Quote-Bash $RemoteBundlePath) -C $(Quote-Bash $RemoteAppRoot)",
    "bash scripts/linux/prod-terminal-snapshot.sh"
)

if (-not $SnapshotOnly) {
    $remoteCommands += Get-MinimalRepairCommand -Preflight
}

if (-not $SnapshotOnly -and -not $PreflightOnly) {
    $remoteCommands += Get-MinimalRepairCommand -Dry
}

if (-not $SnapshotOnly -and -not $PreflightOnly -and -not $NoRepair) {
    $repairCommand = Get-MinimalRepairCommand -StrictDisabled:$NoStrict
    if ($User -ne "root") {
        $repairCommand = "sudo $repairCommand"
    }
    $remoteCommands += $repairCommand
}

$remoteScript = $remoteCommands -join "; "
Invoke-CheckedCommand "ssh" ($sshOptions + @("-tt", $target, $remoteScript)) -AllowDryRun

if (-not $NoVerify -and -not $DryRun -and -not $SnapshotOnly -and -not $PreflightOnly -and -not $NoRepair) {
    Invoke-CheckedCommand "npm" @("run", "prod:verify:public:win")
}

Write-Host "[done] SSH restore runner finished."
