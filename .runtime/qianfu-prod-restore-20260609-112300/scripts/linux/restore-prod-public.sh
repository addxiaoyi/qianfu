#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${APP_ROOT:-/www/wwwroot/qianfu-app}"
WEB_DOMAIN="${WEB_DOMAIN:-mc-u.top}"
PAY_DOMAIN="${PAY_DOMAIN:-pay.star-web.top}"
APP_NAME="${APP_NAME:-qianfu-api}"
LOG_DIR="${LOG_DIR:-$APP_ROOT/logs/prod-restore}"
TS="$(date +%Y%m%d-%H%M%S)"
LOG_FILE="${LOG_FILE:-$LOG_DIR/restore-prod-public-$TS.log}"

RUN_WEB="${RUN_WEB:-1}"
RUN_PAY="${RUN_PAY:-1}"
RUN_INITIAL_DIAG="${RUN_INITIAL_DIAG:-1}"
RUN_FINAL_VERIFY="${RUN_FINAL_VERIFY:-1}"
STRICT_PUBLIC_VERIFY="${STRICT_PUBLIC_VERIFY:-1}"
RUN_FAILURE_EVIDENCE="${RUN_FAILURE_EVIDENCE:-1}"
WEB_RUN_BUILD_ARTIFACTS="${WEB_RUN_BUILD_ARTIFACTS:-1}"
PAY_RUN_BUILD_ARTIFACTS="${PAY_RUN_BUILD_ARTIFACTS:-0}"
DRY_RUN="${DRY_RUN:-0}"
PREFLIGHT_ONLY="${PREFLIGHT_ONLY:-0}"

usage() {
  cat <<'EOF'
Usage: bash scripts/linux/restore-prod-public.sh [options]

Runs the public production recovery in stages:
  1) capture current diagnosis
  2) repair/verify the main site (REPAIR_SCOPE=web)
  3) repair/verify the pay domain (REPAIR_SCOPE=pay)
  4) run strict all-scope public verification

Options:
  --dry-run                Print commands without changing production
  --preflight-only         Check required files, commands, templates, and likely production paths, then exit
  --web-only               Run only the main-site stage
  --pay-only               Run only the pay-domain stage
  --skip-web               Skip the main-site stage
  --skip-pay               Skip the pay-domain stage
  --skip-initial-diag      Skip the initial diagnosis
  --skip-final-verify      Skip final all-scope public verification
  --skip-web-build         Pass RUN_BUILD_ARTIFACTS=0 to the web stage
  --build-pay              Pass RUN_BUILD_ARTIFACTS=1 to the pay stage
  --no-strict              Do not fail stages/final verify on public red lights
  -h, --help               Show help

Environment:
  APP_ROOT=/www/wwwroot/qianfu-app
  WEB_DOMAIN=mc-u.top
  PAY_DOMAIN=pay.star-web.top
  LOG_DIR=$APP_ROOT/logs/prod-restore
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN="1"; shift ;;
    --preflight-only) PREFLIGHT_ONLY="1"; shift ;;
    --web-only) RUN_WEB="1"; RUN_PAY="0"; shift ;;
    --pay-only) RUN_WEB="0"; RUN_PAY="1"; shift ;;
    --skip-web) RUN_WEB="0"; shift ;;
    --skip-pay) RUN_PAY="0"; shift ;;
    --skip-initial-diag) RUN_INITIAL_DIAG="0"; shift ;;
    --skip-final-verify) RUN_FINAL_VERIFY="0"; shift ;;
    --skip-web-build) WEB_RUN_BUILD_ARTIFACTS="0"; shift ;;
    --build-pay) PAY_RUN_BUILD_ARTIFACTS="1"; shift ;;
    --no-strict) STRICT_PUBLIC_VERIFY="0"; shift ;;
    -h|--help) usage; exit 0 ;;
    *)
      echo "[FAIL] Unknown option: $1"
      usage
      exit 1
      ;;
  esac
done

if mkdir -p "$LOG_DIR" 2>/tmp/qianfu-restore-logdir.err; then
  exec > >(tee -a "$LOG_FILE") 2>&1
else
  log_dir_error="$(cat /tmp/qianfu-restore-logdir.err 2>/dev/null || true)"
  if [[ "$PREFLIGHT_ONLY" == "1" || "$DRY_RUN" == "1" ]]; then
    printf '[WARN] Could not create log dir %s; continuing without log tee. %s\n' "$LOG_DIR" "$log_dir_error"
    LOG_FILE="stdout"
  else
    printf '[FAIL] Could not create log dir %s. %s\n' "$LOG_DIR" "$log_dir_error"
    exit 1
  fi
fi
rm -f /tmp/qianfu-restore-logdir.err

log_step() { printf '\n[STEP] %s\n' "$1"; }
log_ok() { printf '[OK]   %s\n' "$1"; }
log_warn() { printf '[WARN] %s\n' "$1"; }
log_fail() { printf '[FAIL] %s\n' "$1"; exit 1; }

require_file() {
  local path="$1"
  [[ -f "$path" ]] || log_fail "Missing file: $path"
}

preflight_required_file() {
  local path="$1"
  if [[ -f "$path" ]]; then
    printf '[OK]   file exists: %s\n' "$path"
    return 0
  fi
  printf '[FAIL] missing file: %s\n' "$path"
  return 1
}

preflight_optional_file() {
  local path="$1"
  if [[ -f "$path" ]]; then
    printf '[OK]   optional file exists: %s\n' "$path"
  else
    printf '[WARN] optional file missing: %s\n' "$path"
  fi
}

preflight_command() {
  local command_name="$1"
  if command -v "$command_name" >/dev/null 2>&1; then
    printf '[OK]   command available: %s\n' "$command_name"
    return 0
  fi
  printf '[FAIL] missing command: %s\n' "$command_name"
  return 1
}

preflight_optional_command() {
  local command_name="$1"
  if command -v "$command_name" >/dev/null 2>&1; then
    printf '[OK]   optional command available: %s\n' "$command_name"
  else
    printf '[WARN] optional command missing: %s\n' "$command_name"
  fi
}

run_preflight() {
  log_step "Preflight production recovery inputs"
  local failures=0
  local has_bundled_diagnose="0"
  local has_bundled_frontend_probe="0"

  if [[ -f "$APP_ROOT/scripts/prod-restore-runners/diagnose-public-prod.mjs" ]]; then
    has_bundled_diagnose="1"
  fi
  if [[ -f "$APP_ROOT/scripts/prod-restore-runners/probe-frontend-deploy.mjs" ]]; then
    has_bundled_frontend_probe="1"
  fi

  if [[ "$has_bundled_diagnose" == "1" && "$has_bundled_frontend_probe" == "1" ]]; then
    preflight_optional_file "$APP_ROOT/package.json"
    preflight_optional_file "$APP_ROOT/qianfu-liandeng/package.json"
  else
    preflight_required_file "$APP_ROOT/package.json" || failures=$((failures + 1))
    preflight_required_file "$APP_ROOT/qianfu-liandeng/package.json" || failures=$((failures + 1))
  fi
  preflight_required_file "$APP_ROOT/scripts/linux/repair-prod-edge.sh" || failures=$((failures + 1))
  preflight_required_file "$APP_ROOT/scripts/linux/deploy-frontend-dist.sh" || failures=$((failures + 1))
  if [[ "$has_bundled_diagnose" == "1" ]]; then
    preflight_optional_file "$APP_ROOT/scripts/diagnose-public-prod.ts"
  else
    preflight_required_file "$APP_ROOT/scripts/diagnose-public-prod.ts" || failures=$((failures + 1))
  fi
  preflight_required_file "$APP_ROOT/scripts/frontend-dist-manifest.mjs" || failures=$((failures + 1))
  preflight_required_file "$APP_ROOT/deploy/nginx/mc-u.top.conf.example" || failures=$((failures + 1))
  preflight_required_file "$APP_ROOT/deploy/nginx/pay.star-web.top.conf.example" || failures=$((failures + 1))
  preflight_required_file "$APP_ROOT/deploy/nginx/qianfu-spa-security-headers.conf.example" || failures=$((failures + 1))
  preflight_optional_file "$APP_ROOT/scripts/prod-restore-runners/diagnose-public-prod.mjs"
  preflight_optional_file "$APP_ROOT/scripts/prod-restore-runners/probe-frontend-deploy.mjs"

  preflight_command bash || failures=$((failures + 1))
  preflight_command node || failures=$((failures + 1))
  if [[ "$has_bundled_diagnose" == "1" && "$has_bundled_frontend_probe" == "1" ]]; then
    preflight_optional_command npm
  else
    preflight_command npm || failures=$((failures + 1))
  fi
  preflight_optional_command curl
  preflight_optional_command pm2
  preflight_optional_command nginx
  preflight_optional_command systemctl

  preflight_optional_file "/etc/letsencrypt/live/${WEB_DOMAIN}/fullchain.pem"
  preflight_optional_file "/etc/letsencrypt/live/${WEB_DOMAIN}/privkey.pem"
  preflight_optional_file "/etc/letsencrypt/live/${PAY_DOMAIN}/fullchain.pem"
  preflight_optional_file "/etc/letsencrypt/live/${PAY_DOMAIN}/privkey.pem"
  preflight_optional_file "/www/server/panel/vhost/nginx/${WEB_DOMAIN}.conf"
  preflight_optional_file "/www/server/panel/vhost/nginx/${PAY_DOMAIN}.conf"

  if [[ "$(id -u 2>/dev/null || printf 1)" -eq 0 ]]; then
    log_ok "Running as root; repair stages can modify nginx and reload services."
  else
    log_warn "Not running as root. Preflight is fine, but real repair should be run with sudo."
  fi

  if [[ "$failures" -gt 0 ]]; then
    log_fail "Preflight found $failures required problem(s). Fix them before running restore-prod-public.sh."
  fi

  log_ok "Preflight passed required checks. Review warnings before running the real restore."
}

run_initial_public_diagnosis() {
  if [[ -f "$APP_ROOT/scripts/prod-restore-runners/diagnose-public-prod.mjs" ]] && command -v node >/dev/null 2>&1; then
    env QIANFU_BASE_URL="https://${WEB_DOMAIN}" PAY_DOMAIN_HOST="$PAY_DOMAIN" PAY_MAIN_SITE_HOST="$WEB_DOMAIN" \
      node "$APP_ROOT/scripts/prod-restore-runners/diagnose-public-prod.mjs" --report-only --kv
    return
  fi

  env QIANFU_BASE_URL="https://${WEB_DOMAIN}" PAY_DOMAIN_HOST="$PAY_DOMAIN" PAY_MAIN_SITE_HOST="$WEB_DOMAIN" \
    npm run --silent prod:diagnose:public -- --report-only --kv
}

quote_command() {
  printf '%q ' "$@"
}

run_logged() {
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

  set +e
  "$@"
  local status=$?
  set -e
  if [[ "$status" -eq 0 ]]; then
    log_ok "$label completed"
  else
    log_warn "$label failed with exit code $status"
  fi
  return "$status"
}

if [[ "$PREFLIGHT_ONLY" == "1" ]]; then
  run_preflight
  exit 0
fi

require_file "$APP_ROOT/scripts/linux/repair-prod-edge.sh"

cd "$APP_ROOT"

cat <<EOF
[RESTORE] Qianfu public production recovery
APP_ROOT=$APP_ROOT
WEB_DOMAIN=$WEB_DOMAIN
PAY_DOMAIN=$PAY_DOMAIN
APP_NAME=$APP_NAME
RUN_WEB=$RUN_WEB
RUN_PAY=$RUN_PAY
STRICT_PUBLIC_VERIFY=$STRICT_PUBLIC_VERIFY
DRY_RUN=$DRY_RUN
LOG_FILE=$LOG_FILE
EOF

initial_status=0
web_status=0
pay_status=0
final_status=0

if [[ "$RUN_INITIAL_DIAG" == "1" ]]; then
  run_logged "Initial public diagnosis" run_initial_public_diagnosis || initial_status=$?

  if [[ -f "$APP_ROOT/scripts/linux/diagnose-prod-502.sh" ]]; then
    run_logged "Initial production summary diagnosis" \
      env WEB_DOMAIN="$WEB_DOMAIN" PAY_DOMAIN="$PAY_DOMAIN" APP_NAME="$APP_NAME" \
      bash scripts/linux/diagnose-prod-502.sh --summary || true
  fi
else
  log_warn "Skipping initial diagnosis by flag"
fi

if [[ "$RUN_WEB" == "1" ]]; then
  run_logged "Repair main site and frontend dist" \
    env REPAIR_SCOPE=web STRICT_PUBLIC_VERIFY="$STRICT_PUBLIC_VERIFY" RUN_FAILURE_EVIDENCE="$RUN_FAILURE_EVIDENCE" \
    RUN_BUILD_ARTIFACTS="$WEB_RUN_BUILD_ARTIFACTS" WEB_DOMAIN="$WEB_DOMAIN" PAY_DOMAIN="$PAY_DOMAIN" APP_NAME="$APP_NAME" \
    bash scripts/linux/repair-prod-edge.sh || web_status=$?
else
  log_warn "Skipping web repair stage by flag"
fi

if [[ "$RUN_PAY" == "1" ]]; then
  run_logged "Repair pay domain edge" \
    env REPAIR_SCOPE=pay STRICT_PUBLIC_VERIFY="$STRICT_PUBLIC_VERIFY" RUN_FAILURE_EVIDENCE="$RUN_FAILURE_EVIDENCE" \
    RUN_BUILD_ARTIFACTS="$PAY_RUN_BUILD_ARTIFACTS" WEB_DOMAIN="$WEB_DOMAIN" PAY_DOMAIN="$PAY_DOMAIN" APP_NAME="$APP_NAME" \
    bash scripts/linux/repair-prod-edge.sh || pay_status=$?
else
  log_warn "Skipping pay repair stage by flag"
fi

if [[ "$RUN_FINAL_VERIFY" == "1" ]]; then
  run_logged "Final all-scope public verification" \
    env VERIFY_ONLY=1 REPAIR_SCOPE=all STRICT_PUBLIC_VERIFY="$STRICT_PUBLIC_VERIFY" RUN_FAILURE_EVIDENCE=0 \
    WEB_DOMAIN="$WEB_DOMAIN" PAY_DOMAIN="$PAY_DOMAIN" APP_NAME="$APP_NAME" \
    bash scripts/linux/repair-prod-edge.sh || final_status=$?
else
  log_warn "Skipping final public verification by flag"
fi

cat <<EOF

[SUMMARY]
initial_status=$initial_status
web_status=$web_status
pay_status=$pay_status
final_status=$final_status
log_file=$LOG_FILE
EOF

if [[ "$initial_status" -ne 0 || "$web_status" -ne 0 || "$pay_status" -ne 0 || "$final_status" -ne 0 ]]; then
  log_fail "Public production recovery did not fully pass. Review $LOG_FILE and the diagnostics/failure evidence directories."
fi

if [[ "$DRY_RUN" == "1" ]]; then
  log_warn "Dry-run completed; no production changes or live verification were performed."
  exit 0
fi

log_ok "Public production recovery passed"
