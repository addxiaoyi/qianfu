param(
    [string]$BaseUrl = $(if ($env:QIANFU_BASE_URL) { $env:QIANFU_BASE_URL } else { "https://mc-u.top" }),
    [string]$PayHost = $(if ($env:PAY_DOMAIN_HOST) { $env:PAY_DOMAIN_HOST } else { "pay.star-web.top" }),
    [string]$OutDir = "output/prod-public-verify",
    [switch]$ReportOnly,
    [switch]$SkipFrontendFiles,
    [switch]$SkipPayDomain
)

$ErrorActionPreference = "Continue"

function Invoke-Step {
    param(
        [string]$Name,
        [scriptblock]$Command,
        [scriptblock]$ValidateOutput = $null
    )

    Write-Host ""
    Write-Host "[verify] $Name"
    $output = @(& $Command 2>&1)
    $code = $LASTEXITCODE
    if ($null -eq $code) {
        $code = 0
    }

    foreach ($line in $output) {
        Write-Host $line
    }

    if ($ValidateOutput) {
        $valid = & $ValidateOutput $output
        if (-not $valid) {
            $code = 1
        }
    }

    if ($code -eq 0) {
        Write-Host "[ok] $Name"
    } else {
        Write-Host "[fail] $Name exit=$code"
    }
    return [pscustomobject]@{
        Name = $Name
        ExitCode = [int]$code
        Ok = ($code -eq 0)
    }
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$diagnoseOut = Join-Path $OutDir "verify-public-$stamp.json"

$env:QIANFU_BASE_URL = $BaseUrl
$env:PAY_DOMAIN_HOST = $PayHost
$env:PAY_MAIN_SITE_HOST = ([Uri]$BaseUrl).Host

$results = @()
$results += Invoke-Step "public diagnosis" {
    npm run prod:diagnose:public -- --kv --out-file $diagnoseOut
}
$results += Invoke-Step "frontend manifest" {
    npm run prod:verify:frontend:manifest
}

if (-not $SkipFrontendFiles) {
    $results += Invoke-Step "frontend file sample" {
        npm run prod:verify:frontend:files:sample
    }
}

if (-not $SkipPayDomain) {
    $results += Invoke-Step "pay domain probe" {
        node scripts/utils/domain-cert-probe.mjs --host $PayHost --expect-host $PayHost --main-site-host ([Uri]$BaseUrl).Host
    } {
        param($output)
        $text = ($output -join "`n")
        return $text -match "(?m)^tls_status=ok$" `
            -and $text -match "(?m)^root_marker_match=true$" `
            -and $text -match "(?m)^looks_like_main_site=false$"
    }
}

$failed = @($results | Where-Object { -not $_.Ok })

Write-Host ""
Write-Host "[summary]"
Write-Host "base_url=$BaseUrl"
Write-Host "pay_host=$PayHost"
Write-Host "diagnose_report=$diagnoseOut"
Write-Host "failed_count=$($failed.Count)"
foreach ($item in $results) {
    $status = if ($item.Ok) { "PASS" } else { "FAIL" }
    Write-Host "$status $($item.Name) exit=$($item.ExitCode)"
}

if ($failed.Count -gt 0 -and -not $ReportOnly) {
    exit 1
}

exit 0
