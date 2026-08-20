param(
  [string]$AppName = 'qianfu-api',
  [string]$WebDomain = 'mc-u.top',
  [string]$PayDomain = 'pay.star-web.top',
  [string]$NginxDir = '/www/server/panel/vhost/nginx',
  [string]$WebConf = '',
  [string]$PayConf = '',
  [int[]]$Ports = @(3000, 3001),
  [switch]$IncludeLocalChecks,
  [switch]$Summary
)

$ErrorActionPreference = 'Stop'

if (-not $WebConf) { $WebConf = "$NginxDir/$WebDomain.conf" }
if (-not $PayConf) { $PayConf = "$NginxDir/$PayDomain.conf" }

$script:DiagnosisMessages = New-Object System.Collections.Generic.List[string]
$script:State = [ordered]@{
  local_3000_health = 'unknown'
  local_3001_health = 'unknown'
  public_web_api_health = 'unknown'
  public_pay_api_health = 'unknown'
  public_pay_tls = 'unknown'
  public_pay_canonical_url = ''
  public_pay_og_url = ''
  public_pay_main_site_fallback = 'unknown'
  public_pay_root_marker_match = 'unknown'
  public_pay_personal_filing_disabled = 'unknown'
  public_web_frontend_root_status = 'unknown'
  public_web_frontend_bundle = ''
  local_web_frontend_bundle = ''
  public_web_frontend_bundle_match = 'unknown'
  public_web_frontend_legacy_hash_markers = 'unknown'
  public_web_frontend_search_target_match = 'unknown'
  public_web_frontend_asset_reference_match = 'unknown'
  public_web_frontend_asset_content_match = 'unknown'
  public_web_frontend_missing_or_mismatched_assets = ''
  public_web_frontend_manifest_match = 'unknown'
  public_web_frontend_manifest_error = ''
  public_web_frontend_manifest_dist_hash = ''
  public_main_diagnosis = 'unknown'
  public_frontend_diagnosis = 'unknown'
  public_pay_diagnosis = 'unknown'
  web_conf_3000 = '0'
  web_conf_3001 = '0'
  pay_conf_3000 = '0'
  pay_conf_3001 = '0'
}

function Section([string]$Title) {
  Write-Host ""
  Write-Host "== $Title =="
}

function Info([string]$Message) {
  Write-Host "[INFO] $Message"
}

function Warn([string]$Message) {
  Write-Host "[WARN] $Message"
}

function Record-Diagnosis([string]$Message) {
  $script:DiagnosisMessages.Add($Message) | Out-Null
  Warn $Message
}

function Test-IsLocalUrl {
  param(
    [string]$Url
  )

  return $Url -match '^https?://(127\.0\.0\.1|localhost)(:\d+)?/'
}

function Invoke-CurlHttpProbe {
  param(
    [string]$Url
  )

  if (-not (Get-Command curl.exe -ErrorAction SilentlyContinue)) {
    return $null
  }

  $tmp = [System.IO.Path]::GetTempFileName()
  $tmpHeaders = [System.IO.Path]::GetTempFileName()
  $tmpErr = [System.IO.Path]::GetTempFileName()
  try {
    $cmdLine = ('curl.exe -k -sS -m 12 -D "{0}" -o "{1}" "{2}" 2> "{3}"' -f $tmpHeaders, $tmp, $Url, $tmpErr)
    $output = & cmd.exe /d /c $cmdLine
    $exitCode = $LASTEXITCODE
    $body = if (Test-Path $tmp) { [string](Get-Content -LiteralPath $tmp -Raw) } else { '' }
    $headersText = if (Test-Path $tmpHeaders) { [string](Get-Content -LiteralPath $tmpHeaders -Raw) } else { '' }
    $stderr = if (Test-Path $tmpErr) { [string](Get-Content -LiteralPath $tmpErr -Raw) } else { '' }
    $status = $null

    if ($headersText) {
      $statusLines = [regex]::Matches($headersText, 'HTTP/\d+(?:\.\d+)?\s+(\d{3})')
      if ($statusLines.Count -gt 0) {
        $status = [int]$statusLines[$statusLines.Count - 1].Groups[1].Value
      }
    }

    if ($exitCode -eq 0 -and $null -ne $status) {
      return [pscustomobject]@{
        Status = $status
        Body = $body
        Error = ''
      }
    }

    return [pscustomobject]@{
      Status = $null
      Body = $body
      Error = ([string]$stderr).Trim()
    }
  } finally {
    Remove-Item -LiteralPath $tmp -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $tmpHeaders -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $tmpErr -ErrorAction SilentlyContinue
  }
}

function Probe-Http {
  param(
    [string]$Label,
    [string]$Url,
    [string]$Expect = '',
    [string]$StateKey = ''
  )

  $result = 'fail'
  $preferCurl = -not (Test-IsLocalUrl -Url $Url)

  if ($preferCurl) {
    $curlProbe = Invoke-CurlHttpProbe -Url $Url
    if ($curlProbe -and $null -ne $curlProbe.Status) {
      $body = $curlProbe.Body
      Write-Host "[HTTP] $Label $Url -> $($curlProbe.Status)" -NoNewline
      if ($Expect -and $body -match ('"' + [regex]::Escape($Expect) + '"')) {
        Write-Host " contains $Expect"
        $result = 'match'
      } elseif (-not $Expect) {
        Write-Host ""
        $result = 'ok'
      } else {
        Write-Host ""
      }

      if ($StateKey) {
        $script:State[$StateKey] = $result
      }
      return
    }
  }

  try {
    $response = Invoke-WebRequest -Uri $Url -TimeoutSec 12 -UseBasicParsing
    $body = $response.Content
    Write-Host "[HTTP] $Label $Url -> $($response.StatusCode)" -NoNewline
    if ($Expect -and $body -match ('"' + [regex]::Escape($Expect) + '"')) {
      Write-Host " contains $Expect"
      $result = 'match'
    } elseif (-not $Expect) {
      Write-Host ""
      $result = 'ok'
    } else {
      Write-Host ""
    }
  } catch {
    $curlProbe = if ($preferCurl) { $null } else { Invoke-CurlHttpProbe -Url $Url }
    if ($curlProbe -and $null -ne $curlProbe.Status) {
      $body = $curlProbe.Body
      Write-Host "[HTTP] $Label $Url -> $($curlProbe.Status)" -NoNewline
      if ($Expect -and $body -match ('"' + [regex]::Escape($Expect) + '"')) {
        Write-Host " contains $Expect"
        $result = 'match'
      } elseif (-not $Expect) {
        Write-Host ""
        $result = 'ok'
      } else {
        Write-Host ""
      }

      if ($StateKey) {
        $script:State[$StateKey] = $result
      }
      return
    }

    $message = $_.Exception.Message
    if ($_.Exception.Response -and $_.Exception.Response.StatusCode.value__) {
      $status = $_.Exception.Response.StatusCode.value__
      Write-Host "[HTTP] $Label $Url -> $status"
      try {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $body = $reader.ReadToEnd()
        if ($Expect -and $body -match ('"' + [regex]::Escape($Expect) + '"')) {
          $result = 'match'
        }
      } catch {
      }
    } else {
      Write-Host "[HTTP] $Label $Url -> ERR $message"
    }
  }

  if ($StateKey) {
    $script:State[$StateKey] = $result
  }
}

function Probe-CurlTls {
  param(
    [string]$Label,
    [string]$Url,
    [string]$StateKey = ''
  )

  $result = 'fail'

  if (-not (Get-Command curl.exe -ErrorAction SilentlyContinue)) {
    Warn 'curl.exe not found; skipping TLS hostname probe.'
    if ($StateKey) {
      $script:State[$StateKey] = 'skipped'
    }
    return
  }

  try {
    $output = & curl.exe -I --max-time 12 $Url 2>&1
    $exitCode = $LASTEXITCODE
    $text = ($output | Out-String)

    if ($exitCode -eq 0) {
      Write-Host "[TLS] $Label $Url -> ok"
      $result = 'ok'
    } elseif ($text -match 'WRONG_PRINCIPAL|CERT_ALTNAME|subject name') {
      Write-Host "[TLS] $Label $Url -> wrong_principal"
      $result = 'wrong_principal'
    } elseif ($text -match 'certificate|SSL/TLS') {
      Write-Host "[TLS] $Label $Url -> cert_error"
      $result = 'cert_error'
    } else {
      Write-Host "[TLS] $Label $Url -> fail"
    }
  } catch {
    Write-Host "[TLS] $Label $Url -> ERR $($_.Exception.Message)"
  }

  if ($StateKey) {
    $script:State[$StateKey] = $result
  }
}

function Probe-NodePayDomain {
  param(
    [string]$DomainName,
    [string]$MainSiteHost
  )

  Section 'Pay Domain Probe'

  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Warn 'node command not found; skipping pay-domain cert/site probe.'
    return
  }

  try {
    $output = & node scripts/utils/domain-cert-probe.mjs --host $DomainName --expect-host $DomainName --main-site-host $MainSiteHost 2>&1
    if ($LASTEXITCODE -ne 0) {
      Warn "pay-domain probe failed: $($output | Out-String)"
      return
    }

    foreach ($line in $output) {
      Write-Host "[PAY-PROBE] $line"
      if ($line -match '^(?<key>[^=]+)=(?<value>.*)$') {
        $key = $Matches.key
        $value = $Matches.value
        switch ($key) {
          'tls_status' { $script:State.public_pay_tls = $value }
          'canonical_url' { $script:State.public_pay_canonical_url = $value }
          'og_url' { $script:State.public_pay_og_url = $value }
          'looks_like_main_site' { $script:State.public_pay_main_site_fallback = $value }
          'root_marker_match' { $script:State.public_pay_root_marker_match = $value }
          'personal_filing_disabled' { $script:State.public_pay_personal_filing_disabled = $value }
        }
      }
    }
  } catch {
    Warn $_.Exception.Message
  }
}

function Probe-FrontendDeploy {
  Section 'Frontend Deploy Probe'

  if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Warn 'npm command not found; skipping frontend deploy freshness probe.'
    return
  }

  try {
    $output = & npm run --silent probe:frontend-deploy -- --report-only --kv 2>&1
    if ($LASTEXITCODE -ne 0) {
      Warn "frontend deploy probe failed: $($output | Out-String)"
      return
    }

    foreach ($line in $output) {
      Write-Host "[FRONTEND-PROBE] $line"
      if ($line -match '^(?<key>[^=]+)=(?<value>.*)$') {
        $key = $Matches.key
        $value = $Matches.value
        switch ($key) {
          'remote_root_status' { $script:State.public_web_frontend_root_status = $value }
          'remote_bundle' { $script:State.public_web_frontend_bundle = $value }
          'local_bundle' { $script:State.local_web_frontend_bundle = $value }
          'bundle_match' { $script:State.public_web_frontend_bundle_match = $value }
          'remote_legacy_hash_markers' { $script:State.public_web_frontend_legacy_hash_markers = $value }
          'search_target_match' { $script:State.public_web_frontend_search_target_match = $value }
          'asset_reference_match' { $script:State.public_web_frontend_asset_reference_match = $value }
          'asset_content_match' { $script:State.public_web_frontend_asset_content_match = $value }
          'missing_or_mismatched_assets' { $script:State.public_web_frontend_missing_or_mismatched_assets = $value }
        }
      }
    }
  } catch {
    Warn $_.Exception.Message
  }
}

function Probe-UnifiedPublicDiagnosis {
  Section 'Unified Public Diagnose'

  if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Warn 'npm command not found; skipping unified public diagnosis.'
    return
  }

  try {
    $output = & npm run --silent prod:diagnose:public -- --report-only --kv --base "https://$WebDomain" --pay-host $PayDomain --main-site-host $WebDomain 2>&1
    if ($LASTEXITCODE -ne 0) {
      Warn "unified public diagnosis failed: $($output | Out-String)"
      return
    }

    foreach ($line in $output) {
      Write-Host "[PUBLIC-DIAG] $line"
      if ($line -match '^(?<key>[^=]+)=(?<value>.*)$') {
        $key = $Matches.key
        $value = $Matches.value
        switch ($key) {
          'main_api_health_status' {
            if ($value -eq '200') { $script:State.public_web_api_health = 'match' }
            elseif ($value) { $script:State.public_web_api_health = 'fail' }
          }
          'pay_api_health_status' {
            if ($value -eq '200') { $script:State.public_pay_api_health = 'match' }
            elseif ($value) { $script:State.public_pay_api_health = 'fail' }
          }
          'main_root_status' { $script:State.public_web_frontend_root_status = $value }
          'frontend_remote_bundle' { $script:State.public_web_frontend_bundle = $value }
          'frontend_local_bundle' { $script:State.local_web_frontend_bundle = $value }
          'frontend_bundle_match' { $script:State.public_web_frontend_bundle_match = $value }
          'frontend_legacy_hash_markers' { $script:State.public_web_frontend_legacy_hash_markers = $value }
          'frontend_search_target_match' { $script:State.public_web_frontend_search_target_match = $value }
          'frontend_asset_reference_match' { $script:State.public_web_frontend_asset_reference_match = $value }
          'frontend_asset_content_match' { $script:State.public_web_frontend_asset_content_match = $value }
          'frontend_missing_or_mismatched_assets' { $script:State.public_web_frontend_missing_or_mismatched_assets = $value }
          'frontend_manifest_match' { $script:State.public_web_frontend_manifest_match = $value }
          'frontend_manifest_error' { $script:State.public_web_frontend_manifest_error = $value }
          'frontend_manifest_dist_hash' { $script:State.public_web_frontend_manifest_dist_hash = $value }
          'main_diagnosis' { $script:State.public_main_diagnosis = $value }
          'frontend_diagnosis' { $script:State.public_frontend_diagnosis = $value }
          'pay_tls_status' { $script:State.public_pay_tls = $value }
          'pay_canonical_url' { $script:State.public_pay_canonical_url = $value }
          'pay_og_url' { $script:State.public_pay_og_url = $value }
          'pay_looks_like_main_site' { $script:State.public_pay_main_site_fallback = $value }
          'pay_root_marker_match' { $script:State.public_pay_root_marker_match = $value }
          'pay_personal_filing_disabled' { $script:State.public_pay_personal_filing_disabled = $value }
          'pay_diagnosis' { $script:State.public_pay_diagnosis = $value }
        }
      }
    }
  } catch {
    Warn $_.Exception.Message
  }
}

function Show-Command([string]$Command) {
  Write-Host "+ $Command"
  try {
    Invoke-Expression $Command
  } catch {
    Warn $_.Exception.Message
  }
}

function Inspect-RemoteConf {
  param(
    [string]$Label,
    [string]$PathValue,
    [string]$Port3000Key,
    [string]$Port3001Key
  )

  Section $Label
  Info "remote config path: $PathValue"
  Warn 'Remote nginx config cannot be read from this Windows workspace directly; verify on the server with the Linux runbook commands.'
}

if ($IncludeLocalChecks) {
  Section 'PM2'
  Show-Command "pm2 status $AppName --no-color"
  Show-Command "pm2 describe $AppName"

  Section 'Listening Ports'
  Show-Command 'netstat -ano | findstr LISTENING'
  foreach ($port in $Ports) {
    Show-Command "netstat -ano | findstr :$port"
  }

  Section 'Local Health'
  foreach ($port in $Ports) {
    if ($port -eq 3000) {
      Probe-Http -Label 'local-health' -Url "http://127.0.0.1:$port/api/health" -Expect 'healthy' -StateKey 'local_3000_health'
    } elseif ($port -eq 3001) {
      Probe-Http -Label 'local-health' -Url "http://127.0.0.1:$port/api/health" -Expect 'healthy' -StateKey 'local_3001_health'
    } else {
      Probe-Http -Label 'local-health' -Url "http://127.0.0.1:$port/api/health" -Expect 'healthy'
    }
    Probe-Http -Label 'local-ready' -Url "http://127.0.0.1:$port/api/ready" -Expect 'ready'
  }
} else {
  Section 'Local Checks'
  Info 'Skipped PM2 / listening-port / local-health checks. Re-run with -IncludeLocalChecks only when this Windows machine is the actual target host.'
}

Inspect-RemoteConf -Label 'Web Nginx' -PathValue $WebConf -Port3000Key 'web_conf_3000' -Port3001Key 'web_conf_3001'
Inspect-RemoteConf -Label 'Pay Nginx' -PathValue $PayConf -Port3000Key 'pay_conf_3000' -Port3001Key 'pay_conf_3001'

Section 'Public Health'
Probe-Http -Label 'public-web' -Url "https://$WebDomain/"
Probe-Http -Label 'public-api-health' -Url "https://$WebDomain/api/health" -Expect 'healthy' -StateKey 'public_web_api_health'
Probe-Http -Label 'public-api-ready' -Url "https://$WebDomain/api/ready" -Expect 'ready'
Probe-NodePayDomain -DomainName $PayDomain -MainSiteHost $WebDomain
Probe-FrontendDeploy
Probe-UnifiedPublicDiagnosis
if ($script:State.public_pay_tls -eq 'unknown') {
  Probe-CurlTls -Label 'public-pay-tls' -Url "https://$PayDomain/" -StateKey 'public_pay_tls'
}

Section 'Diagnosis'
if ($IncludeLocalChecks -and $script:State.local_3000_health -eq 'match' -and $script:State.public_web_api_health -eq 'fail') {
  Record-Diagnosis 'Current machine can reach local port 3000, while public web API is still failing. The strongest next check is the production nginx upstream and server-side PM2 port.'
}
if ($IncludeLocalChecks -and $script:State.local_3000_health -eq 'fail' -and $script:State.local_3001_health -eq 'fail') {
  Record-Diagnosis 'Current machine does not see a healthy API on 3000 or 3001. If this mirrors the server, check PM2, .env, database, and startup logs first.'
}
if ($script:State.public_web_frontend_root_status -eq '200' -and $script:State.public_web_api_health -eq 'fail') {
  Record-Diagnosis 'Main site static HTML is still serving HTTP 200 while the public API is failing. This usually means the frontend vhost/root is alive, but the API upstream or app process behind /api is broken.'
}
if ($script:State.public_pay_tls -eq 'wrong_principal') {
  Record-Diagnosis 'Pay domain is presenting a certificate that does not match pay.star-web.top. Check nginx server_name, certificate binding, and whether the pay host is accidentally serving the mc-u.top site/cert.'
}
if ($script:State.public_pay_main_site_fallback -eq 'true') {
  Record-Diagnosis 'Pay domain is serving HTML that looks like the main mc-u.top site. Check the pay-domain 443 vhost, default_server ordering, and site binding in nginx or the hosting panel.'
}
if ($script:State.public_pay_tls -eq 'wrong_principal' -and $script:State.public_pay_main_site_fallback -eq 'true') {
  Record-Diagnosis 'Pay domain is almost certainly landing on the main-site TLS/vhost instead of a dedicated pay-site block. Prioritize pay.star-web.top server_name matching, certificate binding, and hosting-panel site assignment before adjusting app ports.'
}
if ($script:State.public_pay_personal_filing_disabled -eq 'true') {
  Info 'Pay domain is intentionally closed under personal filing mode (410 PERSONAL_FILING_DISABLED).'
} elseif ($script:State.public_pay_main_site_fallback -ne 'true' -and $script:State.public_pay_personal_filing_disabled -eq 'false') {
  Record-Diagnosis 'Pay domain did not return the expected PERSONAL_FILING_DISABLED closure. The retained hostname may still have an old vhost or upstream.'
}
if ($script:State.public_pay_personal_filing_disabled -ne 'true' -and $script:State.public_pay_api_health -eq 'fail') {
  Record-Diagnosis 'Pay domain is still failing from the outside. Check production nginx, DNS, and TLS certificate state for pay.star-web.top.'
}
if ($script:State.public_web_frontend_bundle_match -eq 'false') {
  Record-Diagnosis "Main site frontend bundle does not match the current local build ($($script:State.public_web_frontend_bundle) vs $($script:State.local_web_frontend_bundle)). The deployed static site is stale."
}
if ($script:State.public_web_frontend_root_status -ne 'unknown' -and $script:State.public_web_frontend_root_status -ne '200') {
  Record-Diagnosis "Main site frontend root is returning HTTP $($script:State.public_web_frontend_root_status). Check the static site vhost, root path, and site binding before focusing only on API upstreams."
}
if ($script:State.public_web_frontend_legacy_hash_markers -ne 'unknown' -and $script:State.public_web_frontend_legacy_hash_markers -ne 'none') {
  Record-Diagnosis "Main site HTML still exposes legacy hash-route SEO markers ($($script:State.public_web_frontend_legacy_hash_markers)). The deployed frontend is older than the current repo build."
}
if ($script:State.public_web_frontend_search_target_match -eq 'false') {
  Record-Diagnosis 'Main site SearchAction target still uses the legacy hash route shape. A fresh frontend deploy is still pending even aside from the API 502.'
}
if ($script:State.public_web_frontend_asset_reference_match -eq 'false') {
  Record-Diagnosis 'Main site entry asset references do not match the current local dist. Redeploy the full frontend dist, not only index.html.'
}
if ($script:State.public_web_frontend_asset_content_match -eq 'false') {
  Record-Diagnosis "Main site entry assets are missing or different ($($script:State.public_web_frontend_missing_or_mismatched_assets)). The deployed frontend dist is incomplete."
}
if ($script:State.public_web_frontend_manifest_match -eq 'false') {
  Record-Diagnosis "Main site qianfu-dist-manifest.json is missing or does not match local dist ($($script:State.public_web_frontend_manifest_error)). Use deploy-frontend-dist.sh and verify the public manifest."
}
if ($script:DiagnosisMessages.Count -eq 0) {
  Info 'No high-confidence diagnosis rule fired from the current machine. Use the Linux script on the production server for stronger signals.'
}

Section 'Quick Read'
Info 'Use scripts/linux/diagnose-prod-502.sh on the production server for nginx upstream and PM2-to-port diagnosis.'
Info 'This PowerShell script is mainly for public reachability checks when WSL bash is unavailable.'
Info 'Re-run with -IncludeLocalChecks only when this Windows machine is the actual target host.'
Info 'If the main site root stays 200 while /api stays 502, focus on the API upstream/process rather than the static frontend vhost.'
Info 'If the frontend probe reports bundle mismatch or legacy hash-route markers, redeploy the latest frontend dist after fixing the API edge.'
Info 'If manifest or asset SHA checks fail, run scripts/linux/deploy-frontend-dist.sh on the production host and verify prod:verify:frontend:manifest.'

if ($Summary) {
  Section 'Summary'
  foreach ($entry in $script:State.GetEnumerator()) {
    Write-Host "$($entry.Key)=$($entry.Value)"
  }
  if ($script:DiagnosisMessages.Count -eq 0) {
    Write-Host 'diagnosis=none'
  } else {
    foreach ($message in $script:DiagnosisMessages) {
      Write-Host "diagnosis=$message"
    }
  }
}
