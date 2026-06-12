#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${APP_ROOT:-/www/wwwroot/qianfu-app}"
WEB_DOMAIN="${WEB_DOMAIN:-mc-u.top}"
PAY_DOMAIN="${PAY_DOMAIN:-pay.star-web.top}"
API_PORT="${API_PORT:-3001}"
XPAY_PORT="${XPAY_PORT:-8889}"
APP_NAME="${APP_NAME:-qianfu-api}"
NGINX_DIR="${NGINX_DIR:-/www/server/panel/vhost/nginx}"

section() {
  printf '\n===== %s =====\n' "$1"
}

run_optional() {
  printf '+ '
  printf '%q ' "$@"
  printf '\n'
  "$@" || true
}

section "basic"
date -Is || true
hostname || true
pwd || true
printf 'APP_ROOT=%s\nWEB_DOMAIN=%s\nPAY_DOMAIN=%s\nAPI_PORT=%s\nXPAY_PORT=%s\nAPP_NAME=%s\n' \
  "$APP_ROOT" "$WEB_DOMAIN" "$PAY_DOMAIN" "$API_PORT" "$XPAY_PORT" "$APP_NAME"

section "files"
run_optional test -d "$APP_ROOT"
run_optional test -f "$APP_ROOT/qianfu-liandeng/dist/index.html"
run_optional test -f "$APP_ROOT/qianfu-liandeng/dist/qianfu-dist-manifest.json"
run_optional test -f "$APP_ROOT/scripts/linux/prod-terminal-minimal-repair.sh"
run_optional test -f "$APP_ROOT/deploy/nginx/mc-u.top.conf.example"
run_optional test -f "$APP_ROOT/deploy/nginx/pay.star-web.top.conf.example"

section "pm2"
if command -v pm2 >/dev/null 2>&1; then
  run_optional pm2 status "$APP_NAME" --no-color
  run_optional pm2 describe "$APP_NAME" --no-color
else
  echo "pm2 not found"
fi

section "listeners"
if command -v ss >/dev/null 2>&1; then
  run_optional ss -lntp
else
  echo "ss not found"
fi

section "local api"
if command -v curl >/dev/null 2>&1; then
  run_optional curl -fsS "http://127.0.0.1:${API_PORT}/api/health"
  run_optional curl -fsS "http://127.0.0.1:${API_PORT}/api/ready"
  run_optional curl -fsS "http://127.0.0.1:${API_PORT}/health"
else
  echo "curl not found"
fi

section "nginx"
if command -v nginx >/dev/null 2>&1; then
  run_optional nginx -t
else
  echo "nginx not found"
fi
for conf in "$NGINX_DIR/${WEB_DOMAIN}.conf" "$NGINX_DIR/${PAY_DOMAIN}.conf"; do
  if [[ -f "$conf" ]]; then
    printf '\n--- %s ---\n' "$conf"
    grep -nE 'server_name|root |ssl_certificate|proxy_pass|127\.0\.0\.1:|qianfu-pay-gateway' "$conf" || true
  else
    echo "missing nginx conf: $conf"
  fi
done

section "certificates"
for domain in "$WEB_DOMAIN" "$PAY_DOMAIN"; do
  cert="/etc/letsencrypt/live/${domain}/fullchain.pem"
  key="/etc/letsencrypt/live/${domain}/privkey.pem"
  if [[ -f "$cert" && -f "$key" ]]; then
    echo "cert pair exists: /etc/letsencrypt/live/${domain}/"
    if command -v openssl >/dev/null 2>&1; then
      openssl x509 -in "$cert" -noout -subject -issuer -dates || true
    fi
  else
    echo "missing cert pair: /etc/letsencrypt/live/${domain}/"
  fi
done

section "public probes"
if command -v curl >/dev/null 2>&1; then
  for url in \
    "https://${WEB_DOMAIN}/api/health" \
    "https://${WEB_DOMAIN}/api/ready" \
    "https://${WEB_DOMAIN}/qianfu-dist-manifest.json" \
    "https://${WEB_DOMAIN}/assets/index-CHZmvcH-.js" \
    "https://${PAY_DOMAIN}/" \
    "https://${PAY_DOMAIN}/api/health"; do
    printf '%s -> ' "$url"
    curl -k -I --connect-timeout 10 --max-time 20 -s -o /dev/null -w '%{http_code} %{content_type}\n' "$url" || true
  done
fi

section "bundled public diagnosis"
if [[ -f "$APP_ROOT/scripts/prod-restore-runners/diagnose-public-prod.mjs" ]] && command -v node >/dev/null 2>&1; then
  (
    cd "$APP_ROOT"
    QIANFU_BASE_URL="https://${WEB_DOMAIN}" \
    PAY_DOMAIN_HOST="$PAY_DOMAIN" \
    PAY_MAIN_SITE_HOST="$WEB_DOMAIN" \
    node scripts/prod-restore-runners/diagnose-public-prod.mjs --report-only --kv || true
  )
else
  echo "bundled diagnose runner missing or node not found"
fi
