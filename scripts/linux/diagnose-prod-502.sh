#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${APP_NAME:-qianfu-api}"
WEB_DOMAIN="${WEB_DOMAIN:-mc-u.top}"
PAY_DOMAIN="${PAY_DOMAIN:-pay.star-web.top}"
NGINX_DIR="${NGINX_DIR:-/www/server/panel/vhost/nginx}"
WEB_CONF="${WEB_CONF:-$NGINX_DIR/${WEB_DOMAIN}.conf}"
PAY_CONF="${PAY_CONF:-$NGINX_DIR/${PAY_DOMAIN}.conf}"
PORT_CANDIDATE_LIST="${PORT_CANDIDATE_LIST:-3000 3001}"
MODE="${MODE:-full}"
LOCAL_3000_HEALTH="unknown"
LOCAL_3001_HEALTH="unknown"
PUBLIC_WEB_API_HEALTH="unknown"
PUBLIC_PAY_API_HEALTH="unknown"
PUBLIC_PAY_TLS_STATUS="unknown"
PUBLIC_PAY_CANONICAL_URL=""
PUBLIC_PAY_OG_URL=""
PUBLIC_PAY_MAIN_SITE_FALLBACK="unknown"
PUBLIC_PAY_ROOT_MARKER_MATCH="unknown"
PUBLIC_PAY_PERSONAL_FILING_DISABLED="unknown"
PUBLIC_WEB_FRONTEND_BUNDLE=""
PUBLIC_WEB_FRONTEND_ROOT_STATUS="unknown"
LOCAL_WEB_FRONTEND_BUNDLE=""
PUBLIC_WEB_FRONTEND_BUNDLE_MATCH="unknown"
PUBLIC_WEB_FRONTEND_LEGACY_HASH_MARKERS="unknown"
PUBLIC_WEB_FRONTEND_SEARCH_TARGET_MATCH="unknown"
PUBLIC_WEB_FRONTEND_ASSET_REFERENCE_MATCH="unknown"
PUBLIC_WEB_FRONTEND_ASSET_CONTENT_MATCH="unknown"
PUBLIC_WEB_FRONTEND_MISSING_OR_MISMATCHED_ASSETS=""
PUBLIC_WEB_FRONTEND_MANIFEST_MATCH="unknown"
PUBLIC_WEB_FRONTEND_MANIFEST_ERROR=""
PUBLIC_WEB_FRONTEND_MANIFEST_DIST_HASH=""
PUBLIC_MAIN_DIAGNOSIS="unknown"
PUBLIC_FRONTEND_DIAGNOSIS="unknown"
PUBLIC_PAY_DIAGNOSIS="unknown"
PAY_CONF_SERVER_NAME_MATCH="unknown"
PAY_CONF_CERT_PATH_MATCH="unknown"
WEB_CONF_PORT_3000="0"
WEB_CONF_PORT_3001="0"
PAY_CONF_PORT_3000="0"
PAY_CONF_PORT_3001="0"
SERVER_CONTEXT_AVAILABLE="0"
HAVE_WEB_CONF="0"
HAVE_PAY_CONF="0"
DIAGNOSIS_MESSAGES=()

read -r -a PORT_CANDIDATES <<< "$PORT_CANDIDATE_LIST"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --summary)
      MODE="summary"
      shift
      ;;
    --full)
      MODE="full"
      shift
      ;;
    -h|--help)
      cat <<'EOF'
Usage: bash scripts/linux/diagnose-prod-502.sh [--summary|--full]

Options:
  --summary   Print the usual checks plus a compact summary block at the end
  --full      Default mode
EOF
      exit 0
      ;;
    *)
      printf '[WARN] Unknown option: %s\n' "$1"
      exit 2
      ;;
  esac
done

section() {
  printf '\n== %s ==\n' "$1"
}

info() {
  printf '[INFO] %s\n' "$1"
}

warn() {
  printf '[WARN] %s\n' "$1"
}

record_diagnosis() {
  local message="$1"
  DIAGNOSIS_MESSAGES+=("$message")
  warn "$message"
}

show_cmd() {
  printf '+ %s\n' "$*"
  "$@" || true
}

probe_http() {
  local label="$1"
  local url="$2"
  local expect="${3:-}"
  local result_var="${4:-}"
  local tmp
  local code

  tmp="$(mktemp)"
  code="$(curl -k -sS -m 12 -o "$tmp" -w '%{http_code}' "$url" 2>/tmp/qianfu-diagnose-curl.err || true)"

  local result="fail"
  if [[ "$code" == "200" || "$code" == "503" ]]; then
    printf '[HTTP] %s %s -> %s' "$label" "$url" "$code"
    if [[ -n "$expect" ]] && grep -q "\"${expect}\"" "$tmp"; then
      printf ' contains %s' "$expect"
      result="match"
    elif [[ -z "$expect" ]]; then
      result="ok"
    fi
    printf '\n'
  else
    printf '[HTTP] %s %s -> %s %s\n' "$label" "$url" "${code:-curl-error}" "$(cat /tmp/qianfu-diagnose-curl.err 2>/dev/null || true)"
  fi

  if [[ -n "$result_var" ]]; then
    printf -v "$result_var" '%s' "$result"
  fi

  rm -f "$tmp"
}

probe_pay_domain() {
  section "Pay Domain Probe"

  if ! command -v node >/dev/null 2>&1; then
    warn "node command not found; skipping pay-domain cert/site probe"
    return
  fi

  local output
  if ! output="$(node scripts/utils/domain-cert-probe.mjs --host "$PAY_DOMAIN" --expect-host "$PAY_DOMAIN" --main-site-host "$WEB_DOMAIN" 2>/tmp/qianfu-diagnose-pay-probe.err)"; then
    warn "pay-domain probe failed: $(cat /tmp/qianfu-diagnose-pay-probe.err 2>/dev/null || true)"
    printf '%s\n' "$output" | sed 's/^/[PAY-PROBE] /'
    return
  fi

  printf '%s\n' "$output" | sed 's/^/[PAY-PROBE] /'
  while IFS='=' read -r key value; do
    case "$key" in
      tls_status)
        PUBLIC_PAY_TLS_STATUS="$value"
        ;;
      canonical_url)
        PUBLIC_PAY_CANONICAL_URL="$value"
        ;;
      og_url)
        PUBLIC_PAY_OG_URL="$value"
        ;;
      looks_like_main_site)
        PUBLIC_PAY_MAIN_SITE_FALLBACK="$value"
        ;;
      root_marker_match)
        PUBLIC_PAY_ROOT_MARKER_MATCH="$value"
        ;;
      personal_filing_disabled)
        PUBLIC_PAY_PERSONAL_FILING_DISABLED="$value"
        ;;
    esac
  done <<< "$output"
}

probe_frontend_deploy() {
  section "Frontend Deploy Probe"

  if [[ -f "scripts/prod-restore-runners/probe-frontend-deploy.mjs" ]] && ! command -v node >/dev/null 2>&1; then
    warn "node command not found; skipping bundled frontend deploy freshness probe"
    return
  fi

  if [[ ! -f "scripts/prod-restore-runners/probe-frontend-deploy.mjs" ]] && ! command -v npm >/dev/null 2>&1; then
    warn "npm command not found and bundled frontend probe is missing; skipping frontend deploy freshness probe"
    return
  fi

  local output
  if [[ -f "scripts/prod-restore-runners/probe-frontend-deploy.mjs" ]]; then
    output="$(node scripts/prod-restore-runners/probe-frontend-deploy.mjs --report-only --kv --base "https://${WEB_DOMAIN}" 2>/tmp/qianfu-diagnose-frontend-probe.err)" || {
      warn "frontend deploy probe failed: $(cat /tmp/qianfu-diagnose-frontend-probe.err 2>/dev/null || true)"
      printf '%s\n' "$output" | sed 's/^/[FRONTEND-PROBE] /'
      return
    }
  elif ! output="$(npm run --silent probe:frontend-deploy -- --report-only --kv 2>/tmp/qianfu-diagnose-frontend-probe.err)"; then
    warn "frontend deploy probe failed: $(cat /tmp/qianfu-diagnose-frontend-probe.err 2>/dev/null || true)"
    printf '%s\n' "$output" | sed 's/^/[FRONTEND-PROBE] /'
    return
  fi

  printf '%s\n' "$output" | sed 's/^/[FRONTEND-PROBE] /'
  while IFS='=' read -r key value; do
    case "$key" in
      remote_bundle)
        PUBLIC_WEB_FRONTEND_BUNDLE="$value"
        ;;
      remote_root_status)
        PUBLIC_WEB_FRONTEND_ROOT_STATUS="$value"
        ;;
      local_bundle)
        LOCAL_WEB_FRONTEND_BUNDLE="$value"
        ;;
      bundle_match)
        PUBLIC_WEB_FRONTEND_BUNDLE_MATCH="$value"
        ;;
      remote_legacy_hash_markers)
        PUBLIC_WEB_FRONTEND_LEGACY_HASH_MARKERS="$value"
        ;;
      search_target_match)
        PUBLIC_WEB_FRONTEND_SEARCH_TARGET_MATCH="$value"
        ;;
      asset_reference_match)
        PUBLIC_WEB_FRONTEND_ASSET_REFERENCE_MATCH="$value"
        ;;
      asset_content_match)
        PUBLIC_WEB_FRONTEND_ASSET_CONTENT_MATCH="$value"
        ;;
      missing_or_mismatched_assets)
        PUBLIC_WEB_FRONTEND_MISSING_OR_MISMATCHED_ASSETS="$value"
        ;;
    esac
  done <<< "$output"
}

probe_unified_public_diagnose() {
  section "Unified Public Diagnose"

  if [[ -f "scripts/prod-restore-runners/diagnose-public-prod.mjs" ]] && ! command -v node >/dev/null 2>&1; then
    warn "node command not found; skipping bundled unified public diagnosis"
    return
  fi

  if [[ ! -f "scripts/prod-restore-runners/diagnose-public-prod.mjs" ]] && ! command -v npm >/dev/null 2>&1; then
    warn "npm command not found and bundled public diagnosis is missing; skipping unified public diagnosis"
    return
  fi

  local output
  if [[ -f "scripts/prod-restore-runners/diagnose-public-prod.mjs" ]]; then
    output="$(QIANFU_BASE_URL="https://${WEB_DOMAIN}" PAY_DOMAIN_HOST="${PAY_DOMAIN}" PAY_MAIN_SITE_HOST="${WEB_DOMAIN}" node scripts/prod-restore-runners/diagnose-public-prod.mjs --report-only --kv 2>/tmp/qianfu-diagnose-public.err)" || {
      warn "unified public diagnosis failed: $(cat /tmp/qianfu-diagnose-public.err 2>/dev/null || true)"
      printf '%s\n' "$output" | sed 's/^/[PUBLIC-DIAG] /'
      return
    }
  elif ! output="$(QIANFU_BASE_URL="https://${WEB_DOMAIN}" PAY_DOMAIN_HOST="${PAY_DOMAIN}" PAY_MAIN_SITE_HOST="${WEB_DOMAIN}" npm run --silent prod:diagnose:public -- --report-only --kv 2>/tmp/qianfu-diagnose-public.err)"; then
    warn "unified public diagnosis failed: $(cat /tmp/qianfu-diagnose-public.err 2>/dev/null || true)"
    printf '%s\n' "$output" | sed 's/^/[PUBLIC-DIAG] /'
    return
  fi

  printf '%s\n' "$output" | sed 's/^/[PUBLIC-DIAG] /'
  while IFS='=' read -r key value; do
    case "$key" in
      main_api_health_status)
        if [[ "$value" == "200" ]]; then
          PUBLIC_WEB_API_HEALTH="match"
        elif [[ -n "$value" ]]; then
          PUBLIC_WEB_API_HEALTH="fail"
        fi
        ;;
      pay_api_health_status)
        if [[ "$value" == "200" ]]; then
          PUBLIC_PAY_API_HEALTH="match"
        elif [[ -n "$value" ]]; then
          PUBLIC_PAY_API_HEALTH="fail"
        fi
        ;;
      main_root_status)
        PUBLIC_WEB_FRONTEND_ROOT_STATUS="$value"
        ;;
      frontend_remote_bundle)
        PUBLIC_WEB_FRONTEND_BUNDLE="$value"
        ;;
      frontend_local_bundle)
        LOCAL_WEB_FRONTEND_BUNDLE="$value"
        ;;
      frontend_bundle_match)
        PUBLIC_WEB_FRONTEND_BUNDLE_MATCH="$value"
        ;;
      frontend_legacy_hash_markers)
        PUBLIC_WEB_FRONTEND_LEGACY_HASH_MARKERS="$value"
        ;;
      frontend_search_target_match)
        PUBLIC_WEB_FRONTEND_SEARCH_TARGET_MATCH="$value"
        ;;
      frontend_asset_reference_match)
        PUBLIC_WEB_FRONTEND_ASSET_REFERENCE_MATCH="$value"
        ;;
      frontend_asset_content_match)
        PUBLIC_WEB_FRONTEND_ASSET_CONTENT_MATCH="$value"
        ;;
      frontend_missing_or_mismatched_assets)
        PUBLIC_WEB_FRONTEND_MISSING_OR_MISMATCHED_ASSETS="$value"
        ;;
      frontend_manifest_match)
        PUBLIC_WEB_FRONTEND_MANIFEST_MATCH="$value"
        ;;
      frontend_manifest_error)
        PUBLIC_WEB_FRONTEND_MANIFEST_ERROR="$value"
        ;;
      frontend_manifest_dist_hash)
        PUBLIC_WEB_FRONTEND_MANIFEST_DIST_HASH="$value"
        ;;
      main_diagnosis)
        PUBLIC_MAIN_DIAGNOSIS="$value"
        ;;
      frontend_diagnosis)
        PUBLIC_FRONTEND_DIAGNOSIS="$value"
        ;;
      pay_tls_status)
        PUBLIC_PAY_TLS_STATUS="$value"
        ;;
      pay_canonical_url)
        PUBLIC_PAY_CANONICAL_URL="$value"
        ;;
      pay_og_url)
        PUBLIC_PAY_OG_URL="$value"
        ;;
      pay_looks_like_main_site)
        PUBLIC_PAY_MAIN_SITE_FALLBACK="$value"
        ;;
      pay_root_marker_match)
        PUBLIC_PAY_ROOT_MARKER_MATCH="$value"
        ;;
      pay_personal_filing_disabled)
        PUBLIC_PAY_PERSONAL_FILING_DISABLED="$value"
        ;;
      pay_diagnosis)
        PUBLIC_PAY_DIAGNOSIS="$value"
        ;;
    esac
  done <<< "$output"
}

inspect_conf() {
  local label="$1"
  local file="$2"
  local port3000_var="${3:-}"
  local port3001_var="${4:-}"

  section "$label"
  if [[ ! -f "$file" ]]; then
    warn "missing config: $file"
    return
  fi

  SERVER_CONTEXT_AVAILABLE="1"
  if [[ "$file" == "$WEB_CONF" ]]; then
    HAVE_WEB_CONF="1"
  fi
  if [[ "$file" == "$PAY_CONF" ]]; then
    HAVE_PAY_CONF="1"
  fi

  info "config file: $file"
  grep -nE 'server_name|upstream (qianfu_api|qianfu_web_api|qianfu_pay_api|qianfu_pay_xpay)|127\.0\.0\.1:3000|127\.0\.0\.1:3001|127\.0\.0\.1:8889|location /api/|location /auth/|location /xpay/|ssl_certificate' "$file" || true

  if [[ -n "$port3000_var" ]] && grep -q '127\.0\.0\.1:3000' "$file"; then
    printf -v "$port3000_var" '1'
  fi
  if [[ -n "$port3001_var" ]] && grep -q '127\.0\.0\.1:3001' "$file"; then
    printf -v "$port3001_var" '1'
  fi
}

inspect_pay_conf_alignment() {
  if [[ ! -f "$PAY_CONF" ]]; then
    return
  fi

  if grep -Eq "server_name[[:space:]]+${PAY_DOMAIN//./\\.}([[:space:];]|$)" "$PAY_CONF"; then
    PAY_CONF_SERVER_NAME_MATCH="true"
  else
    PAY_CONF_SERVER_NAME_MATCH="false"
  fi

  if grep -Fq "/etc/letsencrypt/live/${PAY_DOMAIN}/fullchain.pem" "$PAY_CONF" &&
     grep -Fq "/etc/letsencrypt/live/${PAY_DOMAIN}/privkey.pem" "$PAY_CONF"; then
    PAY_CONF_CERT_PATH_MATCH="true"
  else
    PAY_CONF_CERT_PATH_MATCH="false"
  fi
}

section "PM2"
if command -v pm2 >/dev/null 2>&1; then
  SERVER_CONTEXT_AVAILABLE="1"
  show_cmd pm2 status "$APP_NAME" --no-color
  show_cmd pm2 describe "$APP_NAME"
else
  warn "pm2 command not found"
fi

section "Listening Ports"
if command -v ss >/dev/null 2>&1; then
  SERVER_CONTEXT_AVAILABLE="1"
  show_cmd ss -lntp
  for port in "${PORT_CANDIDATES[@]}"; do
    show_cmd bash -lc "ss -lntp | grep ':${port}\b'"
  done
  show_cmd bash -lc "ss -lntp | grep ':8889\b'"
else
  warn "ss command not found"
fi

section "Local Health"
for port in "${PORT_CANDIDATES[@]}"; do
  if [[ "$port" == "3000" ]]; then
    probe_http "local-health" "http://127.0.0.1:${port}/api/health" "healthy" LOCAL_3000_HEALTH
  elif [[ "$port" == "3001" ]]; then
    probe_http "local-health" "http://127.0.0.1:${port}/api/health" "healthy" LOCAL_3001_HEALTH
  else
    probe_http "local-health" "http://127.0.0.1:${port}/api/health" "healthy"
  fi
  probe_http "local-ready" "http://127.0.0.1:${port}/api/ready" "ready"
done

inspect_conf "Web Nginx" "$WEB_CONF" WEB_CONF_PORT_3000 WEB_CONF_PORT_3001
inspect_conf "Pay Nginx" "$PAY_CONF" PAY_CONF_PORT_3000 PAY_CONF_PORT_3001
inspect_pay_conf_alignment

section "Public Health"
probe_http "public-web" "https://${WEB_DOMAIN}/"
probe_http "public-api-health" "https://${WEB_DOMAIN}/api/health" "healthy" PUBLIC_WEB_API_HEALTH
probe_http "public-api-ready" "https://${WEB_DOMAIN}/api/ready" "ready"
# The retained pay hostname is validated by domain-cert-probe so HTTP 410 is
# treated as an intentional closure rather than an upstream outage.
probe_pay_domain
probe_frontend_deploy
probe_unified_public_diagnose

section "Diagnosis"
if [[ "$LOCAL_3000_HEALTH" == "match" && "$PUBLIC_WEB_API_HEALTH" == "fail" && "$WEB_CONF_PORT_3001" == "1" && "$WEB_CONF_PORT_3000" == "0" ]]; then
  record_diagnosis "Likely root cause: web nginx upstream still points to 127.0.0.1:3001 while local 3000 health is OK."
fi
if [[ "$LOCAL_3001_HEALTH" == "match" && "$PUBLIC_WEB_API_HEALTH" == "fail" && "$WEB_CONF_PORT_3000" == "1" && "$WEB_CONF_PORT_3001" == "0" ]]; then
  record_diagnosis "Likely root cause: web nginx upstream points to 127.0.0.1:3000 while local 3001 health is the one responding."
fi
if [[ "$SERVER_CONTEXT_AVAILABLE" == "1" && "$LOCAL_3000_HEALTH" == "fail" && "$LOCAL_3001_HEALTH" == "fail" ]]; then
  record_diagnosis "Likely root cause: API is not healthy on either 3000 or 3001. Check pm2 logs, .env, database, and Prisma/runtime startup."
fi
if [[ "$PUBLIC_WEB_FRONTEND_ROOT_STATUS" == "200" && "$PUBLIC_WEB_API_HEALTH" == "fail" ]]; then
  record_diagnosis "Main site static HTML is still serving HTTP 200 while the public API is failing. This usually means the frontend vhost/root is alive, but the API upstream or app process behind /api is broken."
fi
if [[ "$PUBLIC_PAY_PERSONAL_FILING_DISABLED" != "true" && "$HAVE_PAY_CONF" == "1" && "$PUBLIC_PAY_API_HEALTH" == "fail" && "$PAY_CONF_PORT_3001" == "1" && "$PAY_CONF_PORT_3000" == "0" && "$LOCAL_3000_HEALTH" == "match" ]]; then
  record_diagnosis "Likely root cause: pay domain nginx still points to 127.0.0.1:3001 while local 3000 health is OK."
fi
if [[ "$PUBLIC_PAY_PERSONAL_FILING_DISABLED" != "true" && "$HAVE_PAY_CONF" == "1" && "$PUBLIC_PAY_API_HEALTH" == "fail" && "$PAY_CONF_PORT_3000" == "0" && "$PAY_CONF_PORT_3001" == "0" ]]; then
  record_diagnosis "Pay domain config does not expose a visible qianfu_api upstream match in the inspected file. Re-check pay nginx config path."
fi
if [[ "$PUBLIC_PAY_PERSONAL_FILING_DISABLED" != "true" && "$HAVE_PAY_CONF" == "1" && "$PUBLIC_PAY_API_HEALTH" == "fail" && "$PAY_CONF_PORT_3000" == "1" && "$LOCAL_3000_HEALTH" == "match" ]]; then
  record_diagnosis "If pay domain still fails while local 3000 is healthy and nginx points to 3000, inspect DNS, certificate, and server_name / TLS binding."
fi
if [[ "$HAVE_PAY_CONF" == "1" && "$PAY_CONF_SERVER_NAME_MATCH" == "false" ]]; then
  record_diagnosis "Pay nginx config does not contain a matching server_name for ${PAY_DOMAIN}. The host may be falling through to another site block."
fi
if [[ "$HAVE_PAY_CONF" == "1" && "$PAY_CONF_CERT_PATH_MATCH" == "false" ]]; then
  record_diagnosis "Pay nginx config certificate paths do not point to /etc/letsencrypt/live/${PAY_DOMAIN}/. Verify the TLS binding before changing upstream ports."
fi
if [[ "$PUBLIC_PAY_TLS_STATUS" == "wrong_principal" ]]; then
  record_diagnosis "Pay domain certificate does not match ${PAY_DOMAIN}. Check nginx server_name, TLS certificate binding, and whether the pay host is falling back to the mc-u.top certificate."
fi
if [[ "$PUBLIC_PAY_MAIN_SITE_FALLBACK" == "true" ]]; then
  record_diagnosis "Pay domain is serving HTML that looks like the main mc-u.top site. Check the pay-domain 443 vhost, default_server ordering, and site binding in nginx / hosting panel."
fi
if [[ "$PUBLIC_PAY_TLS_STATUS" == "wrong_principal" && "$PUBLIC_PAY_MAIN_SITE_FALLBACK" == "true" ]]; then
  record_diagnosis "Pay domain is almost certainly landing on the main-site TLS/vhost instead of a dedicated pay-site block. Prioritize pay.star-web.top server_name matching, certificate binding, and hosting-panel site assignment before adjusting app ports."
fi
if [[ "$PUBLIC_PAY_PERSONAL_FILING_DISABLED" == "true" ]]; then
  info "Pay domain is intentionally closed under personal filing mode (410 PERSONAL_FILING_DISABLED)."
elif [[ "$PUBLIC_PAY_MAIN_SITE_FALLBACK" != "true" && "$PUBLIC_PAY_PERSONAL_FILING_DISABLED" == "false" ]]; then
  record_diagnosis "Pay domain did not return the expected PERSONAL_FILING_DISABLED closure. The retained hostname may still have an old vhost or upstream."
fi
if [[ "$PUBLIC_WEB_FRONTEND_BUNDLE_MATCH" == "false" ]]; then
  record_diagnosis "Main site frontend bundle does not match the current local build (${PUBLIC_WEB_FRONTEND_BUNDLE} vs ${LOCAL_WEB_FRONTEND_BUNDLE}). The deployed static site is stale."
fi
if [[ "$PUBLIC_WEB_FRONTEND_ROOT_STATUS" != "unknown" && "$PUBLIC_WEB_FRONTEND_ROOT_STATUS" != "200" ]]; then
  record_diagnosis "Main site frontend root is returning HTTP ${PUBLIC_WEB_FRONTEND_ROOT_STATUS}. Check the static site vhost, root path, and site binding before focusing only on API upstreams."
fi
if [[ "$PUBLIC_WEB_FRONTEND_LEGACY_HASH_MARKERS" != "unknown" && "$PUBLIC_WEB_FRONTEND_LEGACY_HASH_MARKERS" != "none" ]]; then
  record_diagnosis "Main site HTML still exposes legacy hash-route SEO markers (${PUBLIC_WEB_FRONTEND_LEGACY_HASH_MARKERS}). The deployed frontend is older than the current repo build."
fi
if [[ "$PUBLIC_WEB_FRONTEND_SEARCH_TARGET_MATCH" == "false" ]]; then
  record_diagnosis "Main site SearchAction target still uses the legacy hash route shape. A fresh frontend deploy is still pending even aside from the API 502."
fi
if [[ "$PUBLIC_WEB_FRONTEND_ASSET_REFERENCE_MATCH" == "false" ]]; then
  record_diagnosis "Main site entry asset references do not match the current local dist. Redeploy the full frontend dist, not only index.html."
fi
if [[ "$PUBLIC_WEB_FRONTEND_ASSET_CONTENT_MATCH" == "false" ]]; then
  record_diagnosis "Main site entry assets are missing or different (${PUBLIC_WEB_FRONTEND_MISSING_OR_MISMATCHED_ASSETS}). The deployed frontend dist is incomplete."
fi
if [[ "$PUBLIC_WEB_FRONTEND_MANIFEST_MATCH" == "false" ]]; then
  record_diagnosis "Main site qianfu-dist-manifest.json is missing or does not match local dist (${PUBLIC_WEB_FRONTEND_MANIFEST_ERROR}). Use deploy-frontend-dist.sh and verify the public manifest."
fi

section "Quick Read"
info "If local 3000 is healthy but nginx config still points to 127.0.0.1:3001, update upstream and reload nginx."
info "If neither 3000 nor 3001 is healthy, inspect pm2 logs and .env / database state first."
info "If the main site root stays 200 while /api stays 502, focus on the API upstream/process rather than the static frontend vhost."
info "If pay domain HTTPS fails before HTTP status returns, inspect DNS and certificate files under /etc/letsencrypt/live/${PAY_DOMAIN}/."
info "If pay domain returns main-site HTML or the mc-u.top certificate, inspect the pay-domain server_name and certificate binding before changing upstream ports."
info "If frontend probe reports bundle mismatch or legacy hash-route markers, redeploy the latest frontend dist after fixing the API edge."
info "If manifest or asset SHA checks fail, run scripts/linux/deploy-frontend-dist.sh on the production host and verify prod:verify:frontend:manifest."
if [[ "$SERVER_CONTEXT_AVAILABLE" != "1" ]]; then
  info "This machine does not look like the production host. Prefer npm run prod:diagnose:public or the Windows public diagnosis wrapper for off-server checks."
fi

if [[ "$MODE" == "summary" ]]; then
  section "Summary"
  printf 'local_3000_health=%s\n' "$LOCAL_3000_HEALTH"
  printf 'local_3001_health=%s\n' "$LOCAL_3001_HEALTH"
  printf 'public_web_api_health=%s\n' "$PUBLIC_WEB_API_HEALTH"
  printf 'public_pay_api_health=%s\n' "$PUBLIC_PAY_API_HEALTH"
  printf 'public_pay_tls_status=%s\n' "$PUBLIC_PAY_TLS_STATUS"
  printf 'public_pay_canonical_url=%s\n' "$PUBLIC_PAY_CANONICAL_URL"
  printf 'public_pay_og_url=%s\n' "$PUBLIC_PAY_OG_URL"
  printf 'public_pay_main_site_fallback=%s\n' "$PUBLIC_PAY_MAIN_SITE_FALLBACK"
  printf 'public_pay_personal_filing_disabled=%s\n' "$PUBLIC_PAY_PERSONAL_FILING_DISABLED"
  printf 'public_web_frontend_root_status=%s\n' "$PUBLIC_WEB_FRONTEND_ROOT_STATUS"
  printf 'public_web_frontend_bundle=%s\n' "$PUBLIC_WEB_FRONTEND_BUNDLE"
  printf 'local_web_frontend_bundle=%s\n' "$LOCAL_WEB_FRONTEND_BUNDLE"
  printf 'public_web_frontend_bundle_match=%s\n' "$PUBLIC_WEB_FRONTEND_BUNDLE_MATCH"
  printf 'public_web_frontend_legacy_hash_markers=%s\n' "$PUBLIC_WEB_FRONTEND_LEGACY_HASH_MARKERS"
  printf 'public_web_frontend_search_target_match=%s\n' "$PUBLIC_WEB_FRONTEND_SEARCH_TARGET_MATCH"
  printf 'public_web_frontend_asset_reference_match=%s\n' "$PUBLIC_WEB_FRONTEND_ASSET_REFERENCE_MATCH"
  printf 'public_web_frontend_asset_content_match=%s\n' "$PUBLIC_WEB_FRONTEND_ASSET_CONTENT_MATCH"
  printf 'public_web_frontend_missing_or_mismatched_assets=%s\n' "$PUBLIC_WEB_FRONTEND_MISSING_OR_MISMATCHED_ASSETS"
  printf 'public_web_frontend_manifest_match=%s\n' "$PUBLIC_WEB_FRONTEND_MANIFEST_MATCH"
  printf 'public_web_frontend_manifest_error=%s\n' "$PUBLIC_WEB_FRONTEND_MANIFEST_ERROR"
  printf 'public_web_frontend_manifest_dist_hash=%s\n' "$PUBLIC_WEB_FRONTEND_MANIFEST_DIST_HASH"
  printf 'public_main_diagnosis=%s\n' "$PUBLIC_MAIN_DIAGNOSIS"
  printf 'public_frontend_diagnosis=%s\n' "$PUBLIC_FRONTEND_DIAGNOSIS"
  printf 'public_pay_diagnosis=%s\n' "$PUBLIC_PAY_DIAGNOSIS"
  printf 'pay_conf_server_name_match=%s\n' "$PAY_CONF_SERVER_NAME_MATCH"
  printf 'pay_conf_cert_path_match=%s\n' "$PAY_CONF_CERT_PATH_MATCH"
  printf 'web_conf_3000=%s\n' "$WEB_CONF_PORT_3000"
  printf 'web_conf_3001=%s\n' "$WEB_CONF_PORT_3001"
  printf 'pay_conf_3000=%s\n' "$PAY_CONF_PORT_3000"
  printf 'pay_conf_3001=%s\n' "$PAY_CONF_PORT_3001"
  if [[ "${#DIAGNOSIS_MESSAGES[@]}" -eq 0 ]]; then
    printf 'diagnosis=none\n'
  else
    for message in "${DIAGNOSIS_MESSAGES[@]}"; do
      printf 'diagnosis=%s\n' "$message"
    done
  fi
fi
