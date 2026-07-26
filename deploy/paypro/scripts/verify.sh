#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
DEPLOY_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
ENV_FILE=${1:-"$DEPLOY_ROOT/.env"}
COMPOSE_FILE="$DEPLOY_ROOT/docker-compose.yml"
. "$SCRIPT_DIR/compose.sh"

fail() {
  echo "[FAIL] $*" >&2
  exit 1
}

read_env() {
  key=$1
  value=$(grep -E "^${key}=" "$ENV_FILE" | tail -n 1 | cut -d= -f2- || true)
  printf '%s' "$value"
}

require_value() {
  key=$1
  value=$(read_env "$key")
  [ -n "$value" ] || fail "$key is required"
  case "$value" in
    *replace-*) fail "$key still contains a placeholder" ;;
  esac
  printf '%s' "$value"
}

require_length() {
  key=$1
  minimum=$2
  value=$(require_value "$key")
  [ "${#value}" -ge "$minimum" ] || fail "$key must contain at least $minimum characters"
}

[ -f "$ENV_FILE" ] || fail "Missing environment file: $ENV_FILE"
[ -f "$COMPOSE_FILE" ] || fail "Missing Compose file: $COMPOSE_FILE"
(
  cd "$DEPLOY_ROOT/artifacts"
  sha256sum -c paypro.jar.sha256 >/dev/null
) || fail 'PayPro JAR checksum mismatch'
(
  cd "$DEPLOY_ROOT/mysql-init"
  sha256sum -c 001-schema.sql.sha256 >/dev/null
) || fail 'Schema checksum mismatch'

for key in PAYPRO_DB_PASSWORD PAYPRO_MYSQL_ROOT_PASSWORD PAYPRO_REDIS_PASSWORD; do
  require_length "$key" 24
done
for key in PAYPRO_OPENAPI_SECRET PAYPRO_ADMIN_TOKEN; do
  require_length "$key" 32
done

DB_NAME=$(read_env PAYPRO_DB_NAME)
DB_USER=$(read_env PAYPRO_DB_USER)
DB_NAME=${DB_NAME:-paypro}
DB_USER=${DB_USER:-paypro}
printf '%s' "$DB_NAME" | grep -Eq '^[A-Za-z0-9_]+$' || fail 'PAYPRO_DB_NAME contains invalid characters'
printf '%s' "$DB_USER" | grep -Eq '^[A-Za-z0-9_]+$' || fail 'PAYPRO_DB_USER contains invalid characters'

[ "$(read_env PAYPRO_ALLOW_BUNDLED_QR_CODES)" = 'false' ] || fail 'PAYPRO_ALLOW_BUNDLED_QR_CODES must remain false'
ALIPAY_ENABLED=$(read_env PAYPRO_ALIPAY_ENABLED)
WECHAT_ENABLED=$(read_env PAYPRO_WECHAT_ENABLED)

if [ "$ALIPAY_ENABLED" = 'true' ] || [ "$WECHAT_ENABLED" = 'true' ]; then
  SITE=$(require_value PAYPRO_SITE)
  printf '%s' "$SITE" | grep -Eq '^https://[^/]+' || fail 'PAYPRO_SITE must use HTTPS when payment is enabled'
  HOSTS=$(require_value PAYPRO_NOTIFY_ALLOWED_HOSTS)
  printf '%s' "$HOSTS" | grep -Eq '^[A-Za-z0-9.,-]+$' || fail 'PAYPRO_NOTIFY_ALLOWED_HOSTS contains an invalid host'
  require_value PAYPRO_MAIL_HOST >/dev/null
  require_value PAYPRO_MAIL_SENDER >/dev/null
  require_value PAYPRO_MAIL_RECEIVER >/dev/null

  if [ "$ALIPAY_ENABLED" = 'true' ]; then
    find "$DEPLOY_ROOT/payment-assets/qr/alipay" -type f -name '*.png' -print -quit 2>/dev/null | grep -q . \
      || fail 'Alipay is enabled but no confirmed PNG asset exists'
  fi
  if [ "$WECHAT_ENABLED" = 'true' ]; then
    find "$DEPLOY_ROOT/payment-assets/qr/wechat" -type f -name '*.png' -print -quit 2>/dev/null | grep -q . \
      || fail 'WeChat is enabled but no confirmed PNG asset exists'
  fi
fi

compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" config --quiet

echo '[OK] PayPro deployment configuration passed all safety gates.'
echo "Compose mode: $PAYPRO_COMPOSE_MODE"
echo "Payment methods enabled: alipay=${ALIPAY_ENABLED:-false}, wechat=${WECHAT_ENABLED:-false}"
