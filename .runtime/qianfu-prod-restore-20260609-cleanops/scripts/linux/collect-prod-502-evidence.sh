#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

OUT_DIR="${1:-diagnostics}"
TS="$(date +%Y%m%d_%H%M%S)"
WORK_DIR="$OUT_DIR/qianfu-prod-502-evidence-$TS"
ARCHIVE="$OUT_DIR/qianfu-prod-502-evidence-$TS.tar.gz"

APP_NAME="${APP_NAME:-qianfu-api}"
WEB_DOMAIN="${WEB_DOMAIN:-mc-u.top}"
PAY_DOMAIN="${PAY_DOMAIN:-pay.star-web.top}"
RUN_BROWSER_AUDIT="${RUN_BROWSER_AUDIT:-1}"
BROWSER_AUDIT_TIMEOUT_SECONDS="${BROWSER_AUDIT_TIMEOUT_SECONDS:-180}"
BROWSER_AUDIT_NAV_TIMEOUT_MS="${BROWSER_AUDIT_NAV_TIMEOUT_MS:-12000}"
BROWSER_AUDIT_DOM_READY_TIMEOUT_MS="${BROWSER_AUDIT_DOM_READY_TIMEOUT_MS:-5000}"
BROWSER_AUDIT_ROUTE_READY_TIMEOUT_MS="${BROWSER_AUDIT_ROUTE_READY_TIMEOUT_MS:-8000}"
BROWSER_AUDIT_INTERACTION_TIMEOUT_MS="${BROWSER_AUDIT_INTERACTION_TIMEOUT_MS:-5000}"
BROWSER_AUDIT_STABLE_WAIT_MS="${BROWSER_AUDIT_STABLE_WAIT_MS:-300}"
BROWSER_AUDIT_WAIT_UNTIL="${BROWSER_AUDIT_WAIT_UNTIL:-commit}"
BROWSER_AUDIT_CONCURRENCY="${BROWSER_AUDIT_CONCURRENCY:-3}"
NGINX_DIR="${NGINX_DIR:-/www/server/panel/vhost/nginx}"
WEB_CONF="${WEB_CONF:-$NGINX_DIR/${WEB_DOMAIN}.conf}"
PAY_CONF="${PAY_CONF:-$NGINX_DIR/${PAY_DOMAIN}.conf}"

mkdir -p "$WORK_DIR"

log_step() { printf '\n[STEP] %s\n' "$1"; }
log_info() { printf '[INFO] %s\n' "$1"; }

capture_cmd() {
  local name="$1"
  shift
  {
    printf '+'
    printf ' %q' "$@"
    printf '\n'
    "$@"
  } >"$WORK_DIR/$name" 2>&1 || true
}

capture_shell() {
  local name="$1"
  shift
  {
    printf '+ bash -lc %q\n' "$*"
    bash -lc "$*"
  } >"$WORK_DIR/$name" 2>&1 || true
}

capture_http() {
  local name="$1"
  local url="$2"
  capture_cmd "$name" curl -k -i -sS -m 15 "$url"
}

copy_if_exists() {
  local src="$1"
  local dest_name="$2"
  if [[ -f "$src" ]]; then
    cp -a "$src" "$WORK_DIR/$dest_name"
  else
    printf 'missing: %s\n' "$src" >"$WORK_DIR/$dest_name"
  fi
}

log_step "Collecting host basics"
capture_cmd host-date.txt date -Is
capture_cmd host-uname.txt uname -a
capture_cmd host-hostname.txt hostname
capture_cmd host-df.txt df -h
capture_cmd host-free.txt free -m
capture_cmd host-uptime.txt uptime

log_step "Collecting PM2 and process state"
capture_cmd pm2-status.txt pm2 status "$APP_NAME" --no-color
capture_cmd pm2-describe.txt pm2 describe "$APP_NAME"
capture_cmd ps-node.txt ps -eo pid,ppid,lstart,etime,cmd
capture_shell ss-listening.txt "ss -lntp || netstat -lntp"
capture_shell pgrep-node.txt "pgrep -af 'node|pm2|java' || true"

log_step "Collecting local service probes"
capture_http local-3000-health.txt "http://127.0.0.1:3000/api/health"
capture_http local-3000-ready.txt "http://127.0.0.1:3000/api/ready"
capture_http local-3001-health.txt "http://127.0.0.1:3001/api/health"
capture_http local-3001-ready.txt "http://127.0.0.1:3001/api/ready"
capture_http local-8889-root.txt "http://127.0.0.1:8889/"

log_step "Collecting public HTTP probes"
capture_http public-web-root.txt "https://${WEB_DOMAIN}/"
capture_http public-web-api-health.txt "https://${WEB_DOMAIN}/api/health"
capture_http public-web-api-ready.txt "https://${WEB_DOMAIN}/api/ready"
capture_http public-pay-root.txt "https://${PAY_DOMAIN}/"
capture_http public-pay-health.txt "https://${PAY_DOMAIN}/health"
capture_http public-pay-api-health.txt "https://${PAY_DOMAIN}/api/health"

log_step "Collecting nginx configuration snapshots"
copy_if_exists "$WEB_CONF" "nginx-web.conf"
copy_if_exists "$PAY_CONF" "nginx-pay.conf"
capture_shell nginx-test.txt "nginx -t"
capture_shell nginx-snippets.txt "grep -R -nE 'server_name|127\\.0\\.0\\.1:3000|127\\.0\\.0\\.1:3001|127\\.0\\.0\\.1:8889|ssl_certificate|location /api/|location /auth/|location /xpay/' '$NGINX_DIR' 2>/dev/null || true"

log_step "Collecting TLS and DNS evidence"
capture_shell dns-web.txt "getent hosts '$WEB_DOMAIN' || nslookup '$WEB_DOMAIN' || true"
capture_shell dns-pay.txt "getent hosts '$PAY_DOMAIN' || nslookup '$PAY_DOMAIN' || true"
capture_shell openssl-pay-cert.txt "openssl s_client -connect '$PAY_DOMAIN:443' -servername '$PAY_DOMAIN' </dev/null 2>/dev/null | openssl x509 -noout -subject -issuer -dates -ext subjectAltName"
capture_shell openssl-web-cert.txt "openssl s_client -connect '$WEB_DOMAIN:443' -servername '$WEB_DOMAIN' </dev/null 2>/dev/null | openssl x509 -noout -subject -issuer -dates -ext subjectAltName"
capture_shell letsencrypt-pay-dir.txt "ls -lah '/etc/letsencrypt/live/$PAY_DOMAIN' 2>/dev/null || true"

log_step "Collecting repo-aware diagnostics"
if command -v bash >/dev/null 2>&1 && [[ -f "scripts/linux/diagnose-prod-502.sh" ]]; then
  capture_shell diagnose-prod-502-summary.txt "bash scripts/linux/diagnose-prod-502.sh --summary"
fi
if command -v bash >/dev/null 2>&1 && [[ -f "scripts/linux/qianfu-prod-healthcheck.sh" ]]; then
  capture_shell prod-healthcheck-public.txt "QIANFU_BASE_URL='https://$WEB_DOMAIN' PAY_DOMAIN_HOST='$PAY_DOMAIN' bash scripts/linux/qianfu-prod-healthcheck.sh --public-only"
fi
if command -v node >/dev/null 2>&1 && [[ -f "scripts/prod-restore-runners/diagnose-public-prod.mjs" ]]; then
  capture_shell prod-diagnose-public.txt "QIANFU_BASE_URL='https://$WEB_DOMAIN' PAY_DOMAIN_HOST='$PAY_DOMAIN' PAY_MAIN_SITE_HOST='$WEB_DOMAIN' node scripts/prod-restore-runners/diagnose-public-prod.mjs --report-only"
elif command -v npm >/dev/null 2>&1 && [[ -f "scripts/diagnose-public-prod.ts" ]]; then
  capture_shell prod-diagnose-public.txt "QIANFU_BASE_URL='https://$WEB_DOMAIN' PAY_DOMAIN_HOST='$PAY_DOMAIN' PAY_MAIN_SITE_HOST='$WEB_DOMAIN' npm run --silent prod:diagnose:public -- --report-only"
fi
if [[ "$RUN_BROWSER_AUDIT" == "1" ]] && command -v npm >/dev/null 2>&1 && [[ -f "scripts/public-live-browser-audit.cjs" ]]; then
  capture_shell prod-audit-browser-public.txt "timeout '${BROWSER_AUDIT_TIMEOUT_SECONDS}s' env QIANFU_BASE_URL='https://$WEB_DOMAIN' PAY_DOMAIN_HOST='$PAY_DOMAIN' npm run --silent prod:audit:browser:public -- --report-only --kv --nav-timeout-ms '$BROWSER_AUDIT_NAV_TIMEOUT_MS' --dom-ready-timeout-ms '$BROWSER_AUDIT_DOM_READY_TIMEOUT_MS' --route-ready-timeout-ms '$BROWSER_AUDIT_ROUTE_READY_TIMEOUT_MS' --interaction-timeout-ms '$BROWSER_AUDIT_INTERACTION_TIMEOUT_MS' --stable-wait-ms '$BROWSER_AUDIT_STABLE_WAIT_MS' --wait-until '$BROWSER_AUDIT_WAIT_UNTIL' --concurrency '$BROWSER_AUDIT_CONCURRENCY' --out-dir '$WORK_DIR/browser-audit'"
fi
if command -v node >/dev/null 2>&1 && [[ -f "scripts/utils/domain-cert-probe.mjs" ]]; then
  capture_shell pay-domain-probe.txt "node scripts/utils/domain-cert-probe.mjs --host '$PAY_DOMAIN' --expect-host '$PAY_DOMAIN' --main-site-host '$WEB_DOMAIN'"
fi
if command -v node >/dev/null 2>&1 && [[ -f "scripts/prod-restore-runners/probe-frontend-deploy.mjs" ]]; then
  capture_shell frontend-probe-kv.txt "QIANFU_BASE_URL='https://$WEB_DOMAIN' node scripts/prod-restore-runners/probe-frontend-deploy.mjs --report-only --kv"
elif command -v npm >/dev/null 2>&1 && [[ -f "package.json" ]]; then
  capture_shell frontend-probe-kv.txt "npm run --silent probe:frontend-deploy -- --report-only --kv"
fi

log_step "Archiving evidence"
tar -czf "$ARCHIVE" -C "$OUT_DIR" "$(basename "$WORK_DIR")"

log_info "Evidence directory: $WORK_DIR"
log_info "Evidence archive: $ARCHIVE"
