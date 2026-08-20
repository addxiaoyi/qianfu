param(
    [string]$BaseUrl = $(if ($env:QIANFU_BASE_URL) { $env:QIANFU_BASE_URL } else { "https://mc-u.top" }),
    [string]$PayHost = $(if ($env:PAY_DOMAIN_HOST) { $env:PAY_DOMAIN_HOST } else { "pay.star-web.top" }),
    [string]$OutDir = "output/prod-public-verify",
    [switch]$ReportOnly,
    [switch]$SkipFrontendFiles,
    [switch]$SkipPayDomain,
    [switch]$SkipBrowserAudit,
    [switch]$SkipReachabilityPreflight,
    [int]$ConnectTimeoutMs = $(if ($env:QIANFU_CONNECT_TIMEOUT_MS) { [int]$env:QIANFU_CONNECT_TIMEOUT_MS } else { 8000 })
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

function Test-TcpConnect {
    param(
        [string]$HostName,
        [int]$Port,
        [int]$TimeoutMs
    )

    $client = [System.Net.Sockets.TcpClient]::new()
    try {
        $async = $client.BeginConnect($HostName, $Port, $null, $null)
        if (-not $async.AsyncWaitHandle.WaitOne($TimeoutMs, $false)) {
            return $false
        }
        $client.EndConnect($async)
        return $true
    } catch {
        return $false
    } finally {
        $client.Close()
    }
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$diagnoseOut = Join-Path $OutDir "verify-public-$stamp.json"

$env:QIANFU_BASE_URL = $BaseUrl
$env:PAY_DOMAIN_HOST = $PayHost
$env:PAY_MAIN_SITE_HOST = ([Uri]$BaseUrl).Host

if (-not $SkipReachabilityPreflight) {
    $baseUri = [Uri]$BaseUrl
    $basePort = if ($baseUri.IsDefaultPort) {
        if ($baseUri.Scheme -eq "https") { 443 } else { 80 }
    } else {
        $baseUri.Port
    }

    Write-Host ""
    Write-Host "[verify] reachability preflight"
    $reachable = Test-TcpConnect -HostName $baseUri.Host -Port $basePort -TimeoutMs $ConnectTimeoutMs
    if ($reachable) {
        Write-Host "[ok] reachability preflight"
    } else {
        $preflightReport = [pscustomobject]@{
            ok = $false
            kind = "reachability_preflight"
            base_url = $BaseUrl
            host = $baseUri.Host
            port = $basePort
            timeout_ms = $ConnectTimeoutMs
            timestamp = (Get-Date).ToUniversalTime().ToString("o")
            message = "TCP connection failed before public verification steps."
        }
        $preflightReport | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $diagnoseOut -Encoding UTF8

        Write-Host "[fail] reachability preflight host=$($baseUri.Host) port=$basePort timeout_ms=$ConnectTimeoutMs"
        Write-Host ""
        Write-Host "[summary]"
        Write-Host "base_url=$BaseUrl"
        Write-Host "pay_host=$PayHost"
        Write-Host "diagnose_report=$diagnoseOut"
        Write-Host "failed_count=1"
        Write-Host "FAIL reachability preflight exit=1"

        if (-not $ReportOnly) {
            exit 1
        }
        exit 0
    }
}

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

if (-not $SkipBrowserAudit) {
    $browserAuditOut = Join-Path $OutDir "browser-audit-nonpay-$stamp"
    $results += Invoke-Step "non-payment browser audit" {
        node scripts/public-live-browser-audit.cjs --report-only --kv --skip-pay --out-dir $browserAuditOut
    } {
        param($output)
        $text = ($output -join "`n")
        return $text -match "(?m)^failed_routes=0$"
    }
}

if (-not $SkipPayDomain -and $PayHost) {
    $results += Invoke-Step "pay domain probe" {
        node scripts/utils/domain-cert-probe.mjs --host $PayHost --expect-host $PayHost --main-site-host ([Uri]$BaseUrl).Host
    } {
        param($output)
        $text = ($output -join "`n")
        return $text -match "(?m)^tls_status=ok$" `
            -and $text -match "(?m)^personal_filing_disabled=true$"
    }
} elseif (-not $PayHost) {
    Write-Host ""
    Write-Host "[verify] pay domain probe"
    Write-Host "[skip] PAY_DOMAIN_HOST is not configured"
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

if ($failed.Count -gt 0) {
    exit 1
}

exit 0
