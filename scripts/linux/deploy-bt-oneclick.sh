#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

APP_NAME="${APP_NAME:-qianfu-api}"
NODE_ENV="${NODE_ENV:-production}"
PORT="${PORT:-3001}"
RUN_PREFLIGHT="1"
RUN_PM2="1"
SKIP_MIGRATE="0"
RUN_PUBLIC_SMOKE="${RUN_PUBLIC_SMOKE:-1}"
RUN_PAY_DOMAIN_PROBE="${RUN_PAY_DOMAIN_PROBE:-1}"
PUBLIC_SMOKE_BASE_URL="${PUBLIC_SMOKE_BASE_URL:-}"
SMOKE_STRICT_READY="${SMOKE_STRICT_READY:-0}"
STRICT_PUBLIC_SMOKE="${STRICT_PUBLIC_SMOKE:-0}"
RUN_FAILURE_EVIDENCE="${RUN_FAILURE_EVIDENCE:-1}"
FAILURE_EVIDENCE_DIR="${FAILURE_EVIDENCE_DIR:-diagnostics}"
PAY_DOMAIN_HOST="${PAY_DOMAIN_HOST:-}"
PAY_MAIN_SITE_HOST="${PAY_MAIN_SITE_HOST:-}"

usage() {
  cat <<'EOF'
Usage: bash scripts/linux/deploy-bt-oneclick.sh [options]

Options:
  --skip-preflight     Skip npm run release:preflight
  --skip-pm2           Do not restart/start PM2 process
  --skip-migrate       Skip Prisma migrate deploy
  --skip-public-smoke  Skip public smoke validation
  --skip-pay-domain-probe  Skip dedicated pay-domain validation
  --strict-public-smoke  Fail the deployment when public smoke cannot run or reports issues
  --app-name <name>    PM2 process name (default: qianfu-api)
  --port <port>        Health check port (default: 3001)
  -h, --help           Show this help

Recommended (Baota):
  1) Upload project to /www/wwwroot/<project>
  2) Configure .env for production
  3) Run this script
  4) Configure Nginx with deploy/nginx/*.conf.example
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-preflight) RUN_PREFLIGHT="0"; shift ;;
    --skip-pm2) RUN_PM2="0"; shift ;;
    --skip-migrate) SKIP_MIGRATE="1"; shift ;;
    --skip-public-smoke) RUN_PUBLIC_SMOKE="0"; shift ;;
    --skip-pay-domain-probe) RUN_PAY_DOMAIN_PROBE="0"; shift ;;
    --strict-public-smoke) STRICT_PUBLIC_SMOKE="1"; shift ;;
    --app-name) APP_NAME="$2"; shift 2 ;;
    --port) PORT="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *)
      echo "[FAIL] Unknown option: $1"
      usage
      exit 1
      ;;
  esac
done

log_step() { echo -e "\n[STEP] $1"; }
log_ok() { echo "[OK]   $1"; }
log_warn() { echo "[WARN] $1"; }
log_fail() { echo "[FAIL] $1"; }

run_failure_evidence_capture() {
  local reason="$1"
  local web_domain="${2:-}"
  local pay_domain="${3:-}"

  if [[ "$RUN_FAILURE_EVIDENCE" != "1" ]]; then
    log_warn "Skipping failure evidence capture by flag"
    return
  fi

  if [[ ! -f "scripts/linux/collect-prod-502-evidence.sh" ]]; then
    log_warn "Failure evidence capture skipped because scripts/linux/collect-prod-502-evidence.sh is missing."
    return
  fi

  if [[ -z "$web_domain" ]]; then
    web_domain="$(derive_main_site_host || true)"
  fi
  if [[ -z "$pay_domain" ]]; then
    pay_domain="$(derive_pay_domain_host || true)"
  fi
  if [[ -z "$web_domain" ]]; then
    web_domain="mc-u.top"
  fi
  if [[ -z "$pay_domain" ]]; then
    pay_domain="pay.star-web.top"
  fi

  log_step "Capture deployment failure evidence"
  log_warn "$reason"
  WEB_DOMAIN="$web_domain" \
  PAY_DOMAIN="$pay_domain" \
  APP_NAME="$APP_NAME" \
  bash scripts/linux/collect-prod-502-evidence.sh "$FAILURE_EVIDENCE_DIR" || true
  log_ok "Failure evidence capture completed"
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

normalize_public_base() {
  local base="$1"
  base="${base%/}"
  base="${base%/api/v1}"
  base="${base%/api}"
  printf '%s' "$base"
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

is_public_host() {
  local base="$1"
  [[ -n "$base" ]] || return 1
  [[ "$base" =~ ^https?:// ]] || return 1
  [[ ! "$base" =~ localhost ]] || return 1
  [[ ! "$base" =~ 127\.0\.0\.1 ]] || return 1
  return 0
}

is_public_hostname() {
  local host="$1"
  [[ -n "$host" ]] || return 1
  [[ "$host" != "localhost" ]] || return 1
  [[ "$host" != "0.0.0.0" ]] || return 1
  [[ ! "$host" =~ ^127\. ]] || return 1
  return 0
}

derive_public_smoke_base() {
  local candidate="${PUBLIC_SMOKE_BASE_URL:-}"
  if [[ -z "$candidate" ]]; then
    candidate="$(read_env_value "API_PUBLIC_URL")"
  fi
  if [[ -z "$candidate" ]]; then
    candidate="$(read_env_value "FRONTEND_URL")"
  fi

  candidate="$(normalize_public_base "$candidate")"
  if is_public_host "$candidate"; then
    printf '%s' "$candidate"
  fi
}

derive_main_site_host() {
  local candidate="${PAY_MAIN_SITE_HOST:-}"
  if [[ -z "$candidate" ]]; then
    candidate="${PUBLIC_SMOKE_BASE_URL:-}"
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

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    log_fail "Missing command: $1"
    exit 1
  }
}

log_step "Checking required commands"
require_cmd node
require_cmd npm
require_cmd npx
require_cmd curl
log_ok "Node toolchain available"

if [[ ! -f ".env" ]]; then
  if [[ -f ".env.example" ]]; then
    cp .env.example .env
    log_warn ".env not found. Copied from .env.example. Please edit secrets before public traffic."
  else
    log_fail ".env and .env.example are both missing"
    exit 1
  fi
fi

log_step "Installing dependencies"
npm ci
log_ok "Dependencies installed"

log_step "Generating Prisma client"
npx prisma generate
log_ok "Prisma client generated"

if [[ "$SKIP_MIGRATE" != "1" ]]; then
  log_step "Running Prisma migrations"
  npx prisma migrate deploy
  log_ok "Prisma migrate deploy completed"
else
  log_warn "Skipped Prisma migrations by flag"
fi

if [[ "$RUN_PREFLIGHT" == "1" ]]; then
  log_step "Running release preflight (smoke + validate + build + env)"
  npm run release:preflight
  log_ok "Release preflight passed"
else
  log_warn "Skipped release preflight by flag"
  log_step "Building server and frontend"
  npm run server:build
  npm run build
  npm run validate:env
  log_ok "Build and env validation completed"
fi

if [[ "$RUN_PM2" == "1" ]]; then
  if command -v pm2 >/dev/null 2>&1; then
    log_step "Restarting service with PM2"
    mkdir -p logs
    if [[ -f "ecosystem.config.cjs" ]]; then
      APP_NAME="$APP_NAME" PORT="$PORT" NODE_ENV="$NODE_ENV" pm2 startOrRestart ecosystem.config.cjs --only "$APP_NAME" --update-env
      log_ok "PM2 ecosystem applied: $APP_NAME"
    elif pm2 describe "$APP_NAME" >/dev/null 2>&1; then
      pm2 restart "$APP_NAME" --update-env
      log_ok "PM2 process restarted: $APP_NAME"
    else
      pm2 start dist-server/server/index.js --name "$APP_NAME" --time
      log_ok "PM2 process started: $APP_NAME"
    fi
    pm2 save >/dev/null 2>&1 || true
  else
    log_warn "PM2 not installed. Start service manually: node dist-server/server/index.js"
  fi
else
  log_warn "Skipped PM2 restart by flag"
fi

log_step "Health check"
HEALTH_OK="0"
LOCAL_HEALTH_HOST="${LOCAL_HEALTH_HOST:-$(derive_main_site_host || true)}"
if [[ -z "$LOCAL_HEALTH_HOST" ]]; then
  log_warn "Skipped loopback health check because no trusted public host could be derived."
else
  for path in "/api/health" "/health"; do
    if curl -fsS -H "Host: ${LOCAL_HEALTH_HOST}" "http://127.0.0.1:${PORT}${path}" >/dev/null 2>&1; then
      log_ok "Health endpoint reachable: http://127.0.0.1:${PORT}${path} (Host: ${LOCAL_HEALTH_HOST})"
      HEALTH_OK="1"
      break
    fi
  done
fi

if [[ "$HEALTH_OK" != "1" ]]; then
  log_warn "Health endpoint not reachable on port ${PORT}. Check reverse proxy / process logs."
fi

if [[ "$RUN_PUBLIC_SMOKE" == "1" ]]; then
  PUBLIC_BASE="$(derive_public_smoke_base || true)"
  if [[ -n "$PUBLIC_BASE" ]]; then
    PUBLIC_HOST="$(extract_host_from_value "$PUBLIC_BASE")"
    log_step "Public smoke validation"
    SMOKE_ARGS=()
    if [[ "$SMOKE_STRICT_READY" == "1" ]]; then
      SMOKE_ARGS+=(--strict-ready)
    fi

    if SMOKE_API_BASE_URL="$PUBLIC_BASE" SMOKE_WEB_BASE_URL="$PUBLIC_BASE" npm run --silent smoke:deploy -- "${SMOKE_ARGS[@]}"; then
      log_ok "Public smoke passed for ${PUBLIC_BASE}"
    else
      if [[ "$STRICT_PUBLIC_SMOKE" == "1" ]]; then
        run_failure_evidence_capture "Public smoke reported issues for ${PUBLIC_BASE}. Deployment stopped because --strict-public-smoke is enabled." "$PUBLIC_HOST"
        log_fail "Public smoke reported issues for ${PUBLIC_BASE}. Deployment stopped because --strict-public-smoke is enabled."
        exit 1
      fi
      log_warn "Public smoke reported issues for ${PUBLIC_BASE}. Review the smoke output before considering deployment complete."
    fi
  else
    if [[ "$STRICT_PUBLIC_SMOKE" == "1" ]]; then
      run_failure_evidence_capture "Public smoke base could not be derived while strict public smoke is enabled."
      log_fail "Public smoke base could not be derived. Set PUBLIC_SMOKE_BASE_URL or a public API_PUBLIC_URL/FRONTEND_URL in .env before using --strict-public-smoke."
      exit 1
    fi
    log_warn "Skipped public smoke. Set PUBLIC_SMOKE_BASE_URL or a public API_PUBLIC_URL/FRONTEND_URL in .env to validate the deployed domain automatically."
  fi
else
  log_warn "Skipped public smoke by flag"
fi

if [[ "$RUN_PAY_DOMAIN_PROBE" == "1" ]]; then
  PAY_HOST="$(derive_pay_domain_host || true)"
  MAIN_SITE_HOST="$(derive_main_site_host || true)"

  if [[ -z "$PAY_HOST" ]]; then
    log_warn "Skipped pay-domain validation. Set PAY_DOMAIN_HOST or a public XPAY_PUBLIC_URL/XPAY_API_URL/XPAY_NOTIFY_URL to probe the deployed pay host automatically."
  elif [[ -n "$MAIN_SITE_HOST" && "$PAY_HOST" == "$MAIN_SITE_HOST" ]]; then
    log_warn "Skipped dedicated pay-domain validation because pay host ${PAY_HOST} matches the main site host."
  elif [[ ! -f "scripts/utils/domain-cert-probe.mjs" ]]; then
    if [[ "$STRICT_PUBLIC_SMOKE" == "1" ]]; then
      run_failure_evidence_capture "Missing scripts/utils/domain-cert-probe.mjs while strict public smoke is enabled." "$MAIN_SITE_HOST" "$PAY_HOST"
      log_fail "Missing scripts/utils/domain-cert-probe.mjs while strict public smoke is enabled."
      exit 1
    fi
    log_warn "Skipped pay-domain validation because scripts/utils/domain-cert-probe.mjs is missing."
  else
    log_step "Pay-domain validation"
    PAY_PROBE_ARGS=(--host "$PAY_HOST" --expect-host "$PAY_HOST")
    if [[ -n "$MAIN_SITE_HOST" ]]; then
      PAY_PROBE_ARGS+=(--main-site-host "$MAIN_SITE_HOST")
    fi

    if pay_probe_output="$(node scripts/utils/domain-cert-probe.mjs "${PAY_PROBE_ARGS[@]}")"; then
      printf '%s\n' "$pay_probe_output" | sed 's/^/[PAY-PROBE] /'

      pay_tls_status="$(extract_probe_value tls_status "$pay_probe_output")"
      pay_html_status="$(extract_probe_value html_status "$pay_probe_output")"
      pay_closed="$(extract_probe_value personal_filing_disabled "$pay_probe_output")"

      pay_probe_error=""
      if [[ "$pay_closed" == "true" ]]; then
        log_ok "Pay-domain personal_filing_closed: ${PAY_HOST} returns PERSONAL_FILING_DISABLED"
      elif [[ "$pay_tls_status" == "wrong_principal" ]]; then
        pay_probe_error="${PAY_HOST} is presenting a certificate for another host."
      else
        pay_probe_error="${PAY_HOST} did not return PERSONAL_FILING_DISABLED; got html_status=${pay_html_status:-unknown}."
      fi

      if [[ -n "$pay_probe_error" ]]; then
        if [[ "$STRICT_PUBLIC_SMOKE" == "1" ]]; then
          run_failure_evidence_capture "Pay-domain validation failed: $pay_probe_error" "$MAIN_SITE_HOST" "$PAY_HOST"
          log_fail "Pay-domain validation failed: $pay_probe_error"
          exit 1
        fi
        log_warn "Pay-domain validation reported issues: $pay_probe_error"
      elif [[ "$pay_closed" != "true" ]]; then
        log_ok "Pay-domain probe passed for ${PAY_HOST}"
      fi
    else
      if [[ "$STRICT_PUBLIC_SMOKE" == "1" ]]; then
        run_failure_evidence_capture "Pay-domain probe failed for ${PAY_HOST}. Deployment stopped because --strict-public-smoke is enabled." "$MAIN_SITE_HOST" "$PAY_HOST"
        log_fail "Pay-domain probe failed for ${PAY_HOST}. Deployment stopped because --strict-public-smoke is enabled."
        exit 1
      fi
      log_warn "Pay-domain probe failed for ${PAY_HOST}. Review the probe output before considering deployment complete."
    fi
  fi
else
  log_warn "Skipped pay-domain validation by flag"
fi

cat <<EOF

[DONE] Baota one-click deployment completed.
Next steps:
  1) Configure Nginx using templates in deploy/nginx/
  2) Verify domain routing for /api and /auth
  3) If public smoke was skipped, run: SMOKE_API_BASE_URL=https://your-domain.example npm run smoke:deploy
  4) If you retain the legacy pay host, set PAY_DOMAIN_HOST so deploy-time probes can verify PERSONAL_FILING_DISABLED.
  5) To block completion on deployed-domain failures, rerun with: PUBLIC_SMOKE_BASE_URL=https://your-domain.example bash scripts/linux/deploy-bt-oneclick.sh --strict-public-smoke
EOF
