#!/usr/bin/env bash
set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

BASE_URL="${QIANFU_BASE_URL:-https://mc-u.top}"
API_PROCESS="${QIANFU_PM2_API_NAME:-qianfu-api}"
MYSQL_SERVICE="${QIANFU_MYSQL_SERVICE:-mysqld}"
MAX_PM2_DAEMONS="${QIANFU_MAX_PM2_DAEMONS:-1}"
MIN_AVAILABLE_MB="${QIANFU_MIN_AVAILABLE_MB:-512}"
MIN_SWAP_FREE_MB="${QIANFU_MIN_SWAP_FREE_MB:-256}"
RUN_PAY_DOMAIN_PROBE="${RUN_PAY_DOMAIN_PROBE:-1}"
PAY_DOMAIN_HOST="${PAY_DOMAIN_HOST:-}"
PAY_MAIN_SITE_HOST="${PAY_MAIN_SITE_HOST:-}"
PUBLIC_ONLY="${QIANFU_PUBLIC_ONLY:-0}"

usage() {
  cat <<'EOF'
Usage: bash scripts/linux/qianfu-prod-healthcheck.sh [options]

Options:
  --public-only  Skip server-local checks (PM2/MySQL/memory) and only verify deployed HTTP/pay-domain state
  -h, --help     Show help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --public-only) PUBLIC_ONLY="1"; shift ;;
    -h|--help) usage; exit 0 ;;
    *)
      echo "Unknown option: $1"
      usage
      exit 1
      ;;
  esac
done

failures=0

section() {
  printf '\n== %s ==\n' "$1"
}

fail() {
  failures=$((failures + 1))
  printf 'FAIL: %s\n' "$1"
}

pass() {
  printf 'PASS: %s\n' "$1"
}

info() {
  printf 'INFO: %s\n' "$1"
}

read_env_value() {
  local key="$1"
  if [[ ! -f ".env" ]]; then
    return 0
  fi

  local line
  line="$(grep -E "^${key}=" .env | tail -n 1 || true)"
  line="${line#${key}=}"
  line="${line%\"}"
  line="${line#\"}"
  line="${line%\'}"
  line="${line#\'}"
  printf '%s' "$line"
}

extract_host_from_value() {
  local value="$1"
  value="${value#http://}"
  value="${value#https://}"
  value="${value%%/*}"
  value="${value%%\?*}"
  value="${value%%#*}"
  value="${value%%:*}"
  printf '%s' "$value"
}

is_public_hostname() {
  local host="$1"
  [[ -n "$host" ]] || return 1
  [[ "$host" != "localhost" ]] || return 1
  [[ "$host" != "0.0.0.0" ]] || return 1
  [[ ! "$host" =~ ^127\. ]] || return 1
  return 0
}

derive_main_site_host() {
  local candidate="${PAY_MAIN_SITE_HOST:-}"
  if [[ -z "$candidate" ]]; then
    candidate="$BASE_URL"
  fi
  if [[ -z "$candidate" ]]; then
    candidate="$(read_env_value "FRONTEND_URL")"
  fi

  candidate="$(extract_host_from_value "$candidate")"
  if is_public_hostname "$candidate"; then
    printf '%s' "$candidate"
  fi
}

derive_pay_domain_host() {
  local candidate="${PAY_DOMAIN_HOST:-}"
  if [[ -z "$candidate" ]]; then
    candidate="$(read_env_value "PAY_DOMAIN_HOST")"
  fi
  if [[ -z "$candidate" ]]; then
    candidate="$(read_env_value "XPAY_PUBLIC_URL")"
  fi
  if [[ -z "$candidate" ]]; then
    candidate="$(read_env_value "XPAY_API_URL")"
  fi
  if [[ -z "$candidate" ]]; then
    candidate="$(read_env_value "XPAY_NOTIFY_URL")"
  fi

  candidate="$(extract_host_from_value "$candidate")"
  if is_public_hostname "$candidate"; then
    printf '%s' "$candidate"
  fi
}

extract_probe_value() {
  local key="$1"
  local payload="$2"
  printf '%s\n' "$payload" | awk -F= -v target="$key" '$1 == target { print substr($0, length($1) + 2) }'
}

check_frontend_freshness() {
  section "Frontend freshness"

  if [[ ! -f "scripts/probe-frontend-deploy.ts" && ! -f "scripts/prod-restore-runners/probe-frontend-deploy.mjs" ]]; then
    fail "Missing frontend freshness probe script"
    return
  fi

  if [[ -f "scripts/prod-restore-runners/probe-frontend-deploy.mjs" ]] && ! command -v node >/dev/null 2>&1; then
    fail "node command not found for bundled frontend freshness probe"
    return
  fi

  if [[ ! -f "scripts/prod-restore-runners/probe-frontend-deploy.mjs" ]] && ! command -v npm >/dev/null 2>&1; then
    fail "npm command not found and bundled frontend freshness probe is missing"
    return
  fi

  local frontend_probe_output frontend_probe_status
  local remote_root_status bundle_match remote_legacy_hash_markers search_target_match
  local asset_reference_match asset_content_match missing_or_mismatched_assets
  if [[ -f "scripts/prod-restore-runners/probe-frontend-deploy.mjs" ]]; then
    frontend_probe_output="$(node scripts/prod-restore-runners/probe-frontend-deploy.mjs --report-only --kv --base "$BASE_URL" 2>/tmp/qianfu-frontend-deploy.err)"
  else
    frontend_probe_output="$(npm run --silent probe:frontend-deploy -- --report-only --kv 2>/tmp/qianfu-frontend-deploy.err)"
  fi
  frontend_probe_status=$?

  if [[ "$frontend_probe_status" -ne 0 ]]; then
    fail "frontend freshness probe failed: $(cat /tmp/qianfu-frontend-deploy.err 2>/dev/null)"
    return
  fi

  remote_root_status="$(extract_probe_value remote_root_status "$frontend_probe_output")"
  bundle_match="$(extract_probe_value bundle_match "$frontend_probe_output")"
  remote_legacy_hash_markers="$(extract_probe_value remote_legacy_hash_markers "$frontend_probe_output")"
  search_target_match="$(extract_probe_value search_target_match "$frontend_probe_output")"
  asset_reference_match="$(extract_probe_value asset_reference_match "$frontend_probe_output")"
  asset_content_match="$(extract_probe_value asset_content_match "$frontend_probe_output")"
  missing_or_mismatched_assets="$(extract_probe_value missing_or_mismatched_assets "$frontend_probe_output")"

  if [[ "$remote_root_status" == "200" ]]; then
    pass "${BASE_URL}/ returned HTTP 200 for frontend probe"
  else
    fail "${BASE_URL}/ returned HTTP ${remote_root_status:-unknown} for frontend probe"
  fi

  if [[ "$bundle_match" == "true" ]]; then
    pass "Remote frontend bundle matches the local dist build"
  else
    fail "Remote frontend bundle does not match the local dist build"
  fi

  if [[ "$remote_legacy_hash_markers" == "none" ]]; then
    pass "Remote frontend HTML no longer contains legacy hash-route markers"
  else
    fail "Remote frontend HTML still contains legacy hash-route markers: ${remote_legacy_hash_markers:-unknown}"
  fi

  if [[ "$search_target_match" == "true" ]]; then
    pass "Remote SearchAction target matches the local dist build"
  else
    fail "Remote SearchAction target does not match the local dist build"
  fi

  if [[ "$asset_reference_match" == "true" ]]; then
    pass "Remote entry asset references match the local dist build"
  else
    fail "Remote entry asset references do not match the local dist build"
  fi

  if [[ "$asset_content_match" == "true" ]]; then
    pass "Remote entry asset contents match the local dist build"
  else
    fail "Remote entry asset contents are missing or different: ${missing_or_mismatched_assets:-unknown}"
  fi
}

check_frontend_manifest() {
  section "Frontend dist manifest"

  if [[ ! -f "scripts/frontend-dist-manifest.mjs" ]]; then
    fail "Missing scripts/frontend-dist-manifest.mjs for frontend dist manifest verification"
    return
  fi

  if ! command -v node >/dev/null 2>&1; then
    fail "node command not found for frontend dist manifest verification"
    return
  fi

  local manifest_output manifest_status manifest_checked manifest_match manifest_error dist_hash
  manifest_output="$(node scripts/frontend-dist-manifest.mjs --check-remote "$BASE_URL" --report-only --kv 2>/tmp/qianfu-frontend-manifest.err)"
  manifest_status=$?

  manifest_checked="$(extract_probe_value remote_manifest_checked "$manifest_output")"
  manifest_match="$(extract_probe_value remote_manifest_match "$manifest_output")"
  manifest_error="$(extract_probe_value remote_manifest_error "$manifest_output")"
  dist_hash="$(extract_probe_value dist_hash "$manifest_output")"

  if [[ "$manifest_status" -ne 0 && "$manifest_match" != "false" ]]; then
    fail "frontend dist manifest probe failed: $(cat /tmp/qianfu-frontend-manifest.err 2>/dev/null)"
    return
  fi

  if [[ "$manifest_checked" == "true" ]]; then
    pass "Remote frontend dist manifest was checked"
  else
    fail "Remote frontend dist manifest was not checked"
  fi

  if [[ "$manifest_match" == "true" ]]; then
    pass "Remote frontend dist manifest matches local dist (${dist_hash:-unknown})"
  else
    fail "Remote frontend dist manifest does not match local dist: ${manifest_error:-unknown}"
  fi
}

check_http_contains_url() {
  local url="$1"
  local expect="$2"
  local tmp
  tmp="$(mktemp)"
  local code
  code="$(curl -k -sS -m 15 -o "$tmp" -w '%{http_code}' "$url" 2>/tmp/qianfu-health-curl.err || true)"
  if [ "$code" != "200" ]; then
    fail "$url returned HTTP ${code:-curl-error}: $(cat /tmp/qianfu-health-curl.err 2>/dev/null)"
    rm -f "$tmp"
    return
  fi
  if grep -q "$expect" "$tmp"; then
    pass "$url contains ${expect}"
  else
    fail "$url returned 200 but did not contain ${expect}: $(head -c 220 "$tmp")"
  fi
  rm -f "$tmp"
}

check_http_json() {
  local path="$1"
  local expect="$2"
  check_http_contains_url "${BASE_URL}${path}" "\"${expect}\""
}

section "HTTP"
check_http_json "/api/health" "healthy"
check_http_json "/api/ready" "ready"
check_frontend_freshness
check_frontend_manifest

if [[ "$RUN_PAY_DOMAIN_PROBE" == "1" ]]; then
  PAY_HOST="$(derive_pay_domain_host || true)"
  MAIN_SITE_HOST="$(derive_main_site_host || true)"

  section "Pay domain"
  if [[ -z "$PAY_HOST" ]]; then
    info "No dedicated public pay host configured; skipped pay-domain probe."
  elif [[ -n "$MAIN_SITE_HOST" && "$PAY_HOST" == "$MAIN_SITE_HOST" ]]; then
    info "Pay host ${PAY_HOST} matches main site host; skipped dedicated pay-domain probe."
  else
    check_http_contains_url "https://${PAY_HOST}/" "qianfu-pay-gateway"
    check_http_contains_url "https://${PAY_HOST}/health" "\"healthy\""
    check_http_contains_url "https://${PAY_HOST}/api/health" "\"healthy\""

    if [[ ! -f "scripts/utils/domain-cert-probe.mjs" ]]; then
      fail "Missing scripts/utils/domain-cert-probe.mjs for pay-domain certificate probe"
    elif ! command -v node >/dev/null 2>&1; then
      fail "node command not found for pay-domain certificate probe"
    else
      pay_probe_args=(--host "$PAY_HOST" --expect-host "$PAY_HOST")
      if [[ -n "$MAIN_SITE_HOST" ]]; then
        pay_probe_args+=(--main-site-host "$MAIN_SITE_HOST")
      fi

      if pay_probe_output="$(node scripts/utils/domain-cert-probe.mjs "${pay_probe_args[@]}" 2>/tmp/qianfu-pay-domain.err)"; then
        pay_tls_status="$(extract_probe_value tls_status "$pay_probe_output")"
        pay_main_site_fallback="$(extract_probe_value looks_like_main_site "$pay_probe_output")"
        pay_root_marker="$(extract_probe_value root_marker_match "$pay_probe_output")"

        if [[ "$pay_tls_status" == "wrong_principal" ]]; then
          fail "${PAY_HOST} is presenting a certificate for another host"
        else
          pass "${PAY_HOST} certificate matches the requested host"
        fi

        if [[ "$pay_main_site_fallback" == "true" ]]; then
          fail "${PAY_HOST} is serving HTML that looks like the main site"
        else
          pass "${PAY_HOST} is not falling back to the main site HTML"
        fi

        if [[ "$pay_root_marker" == "true" ]]; then
          pass "${PAY_HOST} root marker matches qianfu-pay-gateway"
        else
          fail "${PAY_HOST} root marker does not match qianfu-pay-gateway"
        fi
      else
        fail "pay-domain probe failed: $(cat /tmp/qianfu-pay-domain.err 2>/dev/null)"
      fi
    fi
  fi
fi

if [[ "$PUBLIC_ONLY" == "1" ]]; then
  section "Host checks"
  info "Skipped MySQL / PM2 / memory checks because --public-only is enabled."
else
  section "MySQL"
  if systemctl is-active --quiet "$MYSQL_SERVICE"; then
    pass "$MYSQL_SERVICE is active"
  else
    fail "$MYSQL_SERVICE is not active"
  fi

  if ss -lntp 2>/dev/null | grep -q ':3306'; then
    pass "3306 is listening"
  else
    fail "3306 is not listening"
  fi

  section "PM2"
  if command -v pm2 >/dev/null 2>&1; then
    if pm2 status "$API_PROCESS" --no-color 2>/dev/null | grep -q "$API_PROCESS.*online"; then
      pass "PM2 process $API_PROCESS is online"
    else
      fail "PM2 process $API_PROCESS is not online"
    fi
  else
    fail "pm2 command not found"
  fi

  pm2_daemons="$(ps -eo cmd --no-headers | grep -F "PM2 v" | grep -F "God Daemon" | wc -l | tr -d ' ')"
  if [ "${pm2_daemons:-0}" -le "$MAX_PM2_DAEMONS" ]; then
    pass "PM2 daemon count is $pm2_daemons"
  else
    fail "PM2 daemon count is $pm2_daemons, expected <= $MAX_PM2_DAEMONS"
  fi

  pm2_update_count="$(pgrep -fc '^node /usr/local/bin/pm2 update$' 2>/dev/null || true)"
  if [ "${pm2_update_count:-0}" -eq 0 ]; then
    pass "No stale pm2 update process"
  else
    fail "Found $pm2_update_count stale pm2 update process(es)"
  fi

  section "Memory"
  available_mb="$(awk '/MemAvailable:/ {print int($2 / 1024)}' /proc/meminfo)"
  if [ "${available_mb:-0}" -ge "$MIN_AVAILABLE_MB" ]; then
    pass "available memory ${available_mb}MB"
  else
    fail "available memory ${available_mb}MB below ${MIN_AVAILABLE_MB}MB"
  fi

  swap_free_mb="$(awk '/SwapFree:/ {print int($2 / 1024)}' /proc/meminfo)"
  if [ "${swap_free_mb:-0}" -ge "$MIN_SWAP_FREE_MB" ]; then
    pass "free swap ${swap_free_mb}MB"
  else
    fail "free swap ${swap_free_mb}MB below ${MIN_SWAP_FREE_MB}MB"
  fi
fi

section "Summary"
if [ "$failures" -eq 0 ]; then
  printf 'OK: all checks passed for %s\n' "$BASE_URL"
  exit 0
fi

printf 'ERROR: %s check(s) failed for %s\n' "$failures" "$BASE_URL"
exit 1
