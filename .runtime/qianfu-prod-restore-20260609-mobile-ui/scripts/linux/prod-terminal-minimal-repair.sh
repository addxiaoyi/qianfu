#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${APP_ROOT:-/www/wwwroot/qianfu-app}"
WEB_DOMAIN="${WEB_DOMAIN:-mc-u.top}"
PAY_DOMAIN="${PAY_DOMAIN:-pay.star-web.top}"
API_PORT="${API_PORT:-3001}"
APP_NAME="${APP_NAME:-qianfu-api}"
RUN_PM2="${RUN_PM2:-1}"
RUN_WEB="${RUN_WEB:-1}"
RUN_PAY="${RUN_PAY:-1}"
RUN_FINAL_VERIFY="${RUN_FINAL_VERIFY:-1}"
RUN_BUILD_ARTIFACTS="${RUN_BUILD_ARTIFACTS:-0}"
STRICT_PUBLIC_VERIFY="${STRICT_PUBLIC_VERIFY:-1}"
DRY_RUN="${DRY_RUN:-0}"
PREFLIGHT_ONLY="${PREFLIGHT_ONLY:-0}"

usage() {
  cat <<'EOF'
Usage: bash scripts/linux/prod-terminal-minimal-repair.sh [options]

Minimal production-terminal repair wrapper for the current public outage.
It expects the latest restore bundle or project files to already exist under APP_ROOT.

Default flow:
  1) restart qianfu-api on PORT=3000 with PORT_STRICT=true
  2) repair main web edge from existing dist/templates
  3) repair pay domain edge from existing templates/certs
  4) run strict public verification

Options:
  --dry-run             Print commands only
  --preflight-only      Check files/commands/certs and exit
  --web-only            Run only PM2 + web repair + final verify
  --pay-only            Run only PM2 + pay repair + final verify
  --skip-pm2            Do not restart PM2
  --skip-web            Do not run web repair
  --skip-pay            Do not run pay repair
  --skip-final-verify   Do not run final public verification
  --with-build          Allow repair-prod-edge.sh to rebuild artifacts
  --no-strict           Do not fail final verification on public red lights
  -h, --help            Show help

Environment:
  APP_ROOT=/www/wwwroot/qianfu-app
  WEB_DOMAIN=mc-u.top
  PAY_DOMAIN=pay.star-web.top
  API_PORT=3000
  APP_NAME=qianfu-api
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN="1"; shift ;;
    --preflight-only) PREFLIGHT_ONLY="1"; shift ;;
    --web-only) RUN_WEB="1"; RUN_PAY="0"; shift ;;
    --pay-only) RUN_WEB="0"; RUN_PAY="1"; shift ;;
    --skip-pm2) RUN_PM2="0"; shift ;;
    --skip-web) RUN_WEB="0"; shift ;;
    --skip-pay) RUN_PAY="0"; shift ;;
    --skip-final-verify) RUN_FINAL_VERIFY="0"; shift ;;
    --with-build) RUN_BUILD_ARTIFACTS="1"; shift ;;
    --no-strict) STRICT_PUBLIC_VERIFY="0"; shift ;;
    -h|--help) usage; exit 0 ;;
    *)
      echo "[FAIL] Unknown option: $1"
      usage
      exit 1
      ;;
  esac
done

log_step() { printf '\n[STEP] %s\n' "$1"; }
log_ok() { printf '[OK]   %s\n' "$1"; }
log_warn() { printf '[WARN] %s\n' "$1"; }
log_fail() { printf '[FAIL] %s\n' "$1"; exit 1; }

quote_command() {
  printf '%q ' "$@"
}

run_cmd() {
  local label="$1"
  shift

  log_step "$label"
  printf '+ '
  quote_command "$@"
  printf '\n'

  if [[ "$DRY_RUN" == "1" ]]; then
    log_warn "Dry-run mode: command not executed"
    return 0
  fi

  "$@"
}

local_api_curl() {
  local path="$1"
  curl -fsS \
    -H "Host: ${WEB_DOMAIN}" \
    -H "X-Forwarded-Host: ${WEB_DOMAIN}" \
    -H "X-Forwarded-Proto: https" \
    "http://127.0.0.1:${API_PORT}${path}"
}

check_file() {
  local path="$1"
  if [[ -f "$path" ]]; then
    printf '[OK]   file exists: %s\n' "$path"
    return 0
  fi
  printf '[FAIL] missing file: %s\n' "$path"
  return 1
}

check_optional_file() {
  local path="$1"
  if [[ -f "$path" ]]; then
    printf '[OK]   optional file exists: %s\n' "$path"
  else
    printf '[WARN] optional file missing: %s\n' "$path"
  fi
}

check_command() {
  local command_name="$1"
  if command -v "$command_name" >/dev/null 2>&1; then
    printf '[OK]   command available: %s\n' "$command_name"
    return 0
  fi
  printf '[FAIL] missing command: %s\n' "$command_name"
  return 1
}

check_optional_command() {
  local command_name="$1"
  if command -v "$command_name" >/dev/null 2>&1; then
    printf '[OK]   optional command available: %s\n' "$command_name"
  else
    printf '[WARN] optional command missing: %s\n' "$command_name"
  fi
}

run_preflight() {
  log_step "Preflight minimal repair inputs"
  local failures=0

  check_file "$APP_ROOT/scripts/linux/repair-prod-edge.sh" || failures=$((failures + 1))
  check_file "$APP_ROOT/deploy/nginx/mc-u.top.conf.example" || failures=$((failures + 1))
  check_file "$APP_ROOT/deploy/nginx/pay.star-web.top.conf.example" || failures=$((failures + 1))
  check_file "$APP_ROOT/deploy/nginx/qianfu-spa-security-headers.conf.example" || failures=$((failures + 1))
  check_file "$APP_ROOT/scripts/frontend-dist-manifest.mjs" || failures=$((failures + 1))

  if [[ "$RUN_WEB" == "1" ]]; then
    check_file "$APP_ROOT/qianfu-liandeng/dist/index.html" || failures=$((failures + 1))
    check_file "$APP_ROOT/qianfu-liandeng/dist/qianfu-dist-manifest.json" || failures=$((failures + 1))
    check_optional_file "/etc/letsencrypt/live/${WEB_DOMAIN}/fullchain.pem"
    check_optional_file "/etc/letsencrypt/live/${WEB_DOMAIN}/privkey.pem"
  fi

  if [[ "$RUN_PAY" == "1" ]]; then
    check_optional_file "/etc/letsencrypt/live/${PAY_DOMAIN}/fullchain.pem"
    check_optional_file "/etc/letsencrypt/live/${PAY_DOMAIN}/privkey.pem"
  fi

  check_command bash || failures=$((failures + 1))
  check_command node || failures=$((failures + 1))
  check_optional_command npm
  check_optional_command pm2
  check_optional_command nginx
  check_optional_command systemctl
  check_optional_command curl
  check_optional_command ss

  if [[ "$(id -u 2>/dev/null || printf 1)" -eq 0 ]]; then
    log_ok "Running as root."
  else
    log_warn "Real repair should be run as root or via sudo."
  fi

  if [[ "$failures" -gt 0 ]]; then
    log_fail "Preflight found $failures required problem(s)."
  fi

  log_ok "Preflight passed required checks."
}

run_quick_status() {
  log_step "Quick local status snapshot"
  if [[ "$DRY_RUN" == "1" ]]; then
    log_warn "Dry-run mode: local status probes skipped"
    return
  fi
  if command -v ss >/dev/null 2>&1; then
    ss -lntp | grep -E ':80|:443|:3000|:3001|:8889' || true
  fi
  if command -v curl >/dev/null 2>&1; then
    local_api_curl "/api/health" || true
    printf '\n'
    local_api_curl "/api/ready" || true
    printf '\n'
  fi
  if command -v pm2 >/dev/null 2>&1; then
    pm2 status "$APP_NAME" --no-color || true
  fi
}

restart_pm2() {
  if [[ "$RUN_PM2" != "1" ]]; then
    log_warn "Skipping PM2 restart by flag"
    return
  fi
  if ! command -v pm2 >/dev/null 2>&1; then
    log_warn "pm2 command not found; skipping PM2 restart"
    return
  fi
  check_file "$APP_ROOT/ecosystem.config.cjs" >/dev/null
  run_cmd "Restart PM2 app on fixed port ${API_PORT}" \
    env APP_NAME="$APP_NAME" QIANFU_API_PORT="$API_PORT" PORT="$API_PORT" PORT_STRICT=true NODE_ENV=production \
    pm2 startOrRestart ecosystem.config.cjs --only "$APP_NAME" --update-env
  run_cmd "Persist PM2 process list" pm2 save
}

run_repair_scope() {
  local scope="$1"
  run_cmd "Run ${scope} edge repair" \
    env REPAIR_SCOPE="$scope" \
      RUN_BUILD_ARTIFACTS="$RUN_BUILD_ARTIFACTS" \
      RUN_PM2=0 \
      RUN_EVIDENCE=0 \
      RUN_DIAG=0 \
      RUN_PUBLIC_VERIFY=0 \
      STRICT_PUBLIC_VERIFY=0 \
      WEB_DOMAIN="$WEB_DOMAIN" \
      PAY_DOMAIN="$PAY_DOMAIN" \
      API_PORT="$API_PORT" \
      APP_NAME="$APP_NAME" \
      bash scripts/linux/repair-prod-edge.sh
}

run_final_verify() {
  if [[ "$RUN_FINAL_VERIFY" != "1" ]]; then
    log_warn "Skipping final public verification by flag"
    return
  fi
  run_cmd "Run strict public verification" \
    env VERIFY_ONLY=1 \
      REPAIR_SCOPE=all \
      STRICT_PUBLIC_VERIFY="$STRICT_PUBLIC_VERIFY" \
      RUN_FAILURE_EVIDENCE=0 \
      WEB_DOMAIN="$WEB_DOMAIN" \
      PAY_DOMAIN="$PAY_DOMAIN" \
      API_PORT="$API_PORT" \
      APP_NAME="$APP_NAME" \
      bash scripts/linux/repair-prod-edge.sh
}

run_preflight
if [[ "$PREFLIGHT_ONLY" == "1" ]]; then
  exit 0
fi

cd "$APP_ROOT"

cat <<EOF
[MINIMAL-REPAIR] Qianfu production terminal repair
APP_ROOT=$APP_ROOT
WEB_DOMAIN=$WEB_DOMAIN
PAY_DOMAIN=$PAY_DOMAIN
API_PORT=$API_PORT
APP_NAME=$APP_NAME
RUN_PM2=$RUN_PM2
RUN_WEB=$RUN_WEB
RUN_PAY=$RUN_PAY
RUN_BUILD_ARTIFACTS=$RUN_BUILD_ARTIFACTS
STRICT_PUBLIC_VERIFY=$STRICT_PUBLIC_VERIFY
DRY_RUN=$DRY_RUN
EOF

run_quick_status
restart_pm2
if [[ "$RUN_WEB" == "1" ]]; then
  run_repair_scope web
fi
if [[ "$RUN_PAY" == "1" ]]; then
  run_repair_scope pay
fi
run_final_verify

cat <<'EOF'

[DONE] Minimal production repair wrapper finished.
Check the final verification output above before declaring production recovered.
EOF
