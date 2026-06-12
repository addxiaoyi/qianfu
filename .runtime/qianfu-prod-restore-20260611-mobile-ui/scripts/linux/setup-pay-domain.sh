#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${1:-pay.star-web.top}"
CONF_SRC="${2:-/www/wwwroot/qianfu-app/deploy/nginx/pay.star-web.top.conf.example}"
CONF_DST="/www/server/panel/vhost/nginx/${DOMAIN}.conf"
SITES_ENABLED_DIR="${SITES_ENABLED_DIR:-/etc/nginx/sites-enabled}"
CONF_LINK="${CONF_LINK:-$SITES_ENABLED_DIR/${DOMAIN}.conf}"
ACME_ROOT="${ACME_ROOT:-/var/www/letsencrypt}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"
MAIN_SITE_HOST="${MAIN_SITE_HOST:-mc-u.top}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TMP_FULL_CONF="$(mktemp)"
TMP_HTTP_CONF="$(mktemp)"

cleanup() {
  rm -f "$TMP_FULL_CONF" "$TMP_HTTP_CONF"
}

trap cleanup EXIT

escape_sed_replacement() {
  printf '%s' "$1" | sed 's/[\/&]/\\&/g'
}

render_full_config() {
  local replacement
  replacement="$(escape_sed_replacement "$DOMAIN")"
  sed "s/pay\\.star-web\\.top/${replacement}/g" "$CONF_SRC" > "$TMP_FULL_CONF"
}

build_http_only_config() {
  cat > "$TMP_HTTP_CONF" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

    location ^~ /.well-known/acme-challenge/ {
        root $ACME_ROOT;
        default_type text/plain;
        try_files \$uri =404;
    }

    location / {
        default_type text/plain;
        return 200 "qianfu-pay-acme\n";
    }
}
EOF
}

extract_probe_value() {
  local key="$1"
  local payload="$2"
  printf '%s\n' "$payload" | awk -F= -v target="$key" '$1 == target { print substr($0, length($1) + 2) }'
}

if [[ "$(id -u)" -ne 0 ]]; then
  echo "[FAIL] Please run as root"
  exit 1
fi

if [[ ! -f "$CONF_SRC" ]]; then
  echo "[FAIL] Missing nginx template: $CONF_SRC"
  exit 1
fi

echo "[STEP] Render domain-specific nginx config"
render_full_config

echo "[STEP] Ensure DNS is ready"
if ! getent hosts "$DOMAIN" >/dev/null 2>&1; then
  echo "[FAIL] DNS not ready for $DOMAIN"
  exit 1
fi

echo "[STEP] Write temporary HTTP-only config for ACME"
build_http_only_config
mkdir -p "$SITES_ENABLED_DIR" "$ACME_ROOT/.well-known/acme-challenge"
cp "$TMP_HTTP_CONF" "$CONF_DST"
ln -sfn "$CONF_DST" "$CONF_LINK"

nginx -t
systemctl reload nginx

echo "[STEP] Request Let's Encrypt certificate"
if ! command -v certbot >/dev/null 2>&1; then
  echo "[FAIL] certbot is not installed"
  exit 1
fi

certbot_contact_args=(--register-unsafely-without-email)
if [[ -n "$CERTBOT_EMAIL" ]]; then
  certbot_contact_args=(-m "$CERTBOT_EMAIL")
fi

certbot certonly \
  --webroot \
  -w "$ACME_ROOT" \
  -d "$DOMAIN" \
  --non-interactive \
  --agree-tos \
  --keep-until-expiring \
  "${certbot_contact_args[@]}"

echo "[STEP] Restore full config template"
cp "$TMP_FULL_CONF" "$CONF_DST"
ln -sfn "$CONF_DST" "$CONF_LINK"
nginx -t
systemctl reload nginx

echo "[STEP] Verify rendered config matches requested domain"
grep -n "server_name $DOMAIN;" "$CONF_DST" >/dev/null
grep -n "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "$CONF_DST" >/dev/null
grep -n "/etc/letsencrypt/live/$DOMAIN/privkey.pem" "$CONF_DST" >/dev/null
test -L "$CONF_LINK"

echo "[STEP] Verify local health endpoints"
curl -fsS "http://127.0.0.1:3000/api/health" >/dev/null
curl -fsS "http://127.0.0.1:8889/" >/dev/null || true
curl -kfsS "https://$DOMAIN/" | grep -q 'qianfu-pay-gateway'

if [[ -f "$APP_ROOT/scripts/utils/domain-cert-probe.mjs" ]] && command -v node >/dev/null 2>&1; then
  echo "[STEP] Verify public certificate and site binding"
  probe_output="$(node "$APP_ROOT/scripts/utils/domain-cert-probe.mjs" --host "$DOMAIN" --expect-host "$DOMAIN" --main-site-host "$MAIN_SITE_HOST")"
  printf '%s\n' "$probe_output" | sed 's/^/[PROBE] /'

  tls_status="$(extract_probe_value tls_status "$probe_output")"
  main_site_fallback="$(extract_probe_value looks_like_main_site "$probe_output")"

  if [[ "$tls_status" == "wrong_principal" ]]; then
    echo "[FAIL] $DOMAIN is still presenting a certificate for another host"
    exit 1
  fi

  if [[ "$main_site_fallback" == "true" ]]; then
    echo "[FAIL] $DOMAIN is still serving HTML that looks like the main site ($MAIN_SITE_HOST)"
    exit 1
  fi
fi

echo "[OK] pay domain is configured: https://$DOMAIN"
