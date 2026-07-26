#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
DEPLOY_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
ENV_FILE=${1:-"$DEPLOY_ROOT/.env"}
DUMP_FILE=${2:-}
. "$SCRIPT_DIR/compose.sh"

[ "${PAYPRO_RESTORE_CONFIRM:-}" = 'restore' ] || {
  echo 'Set PAYPRO_RESTORE_CONFIRM=restore to authorize database replacement.' >&2
  exit 1
}
[ -n "$DUMP_FILE" ] || { echo 'Usage: restore.sh [env-file] <backup.sql.gz>' >&2; exit 1; }
[ -f "$DUMP_FILE" ] || { echo "Backup not found: $DUMP_FILE" >&2; exit 1; }
gzip -t "$DUMP_FILE"

if [ -f "$DUMP_FILE.sha256" ]; then
  (
    cd "$(dirname "$DUMP_FILE")"
    sha256sum -c "$(basename "$DUMP_FILE").sha256"
  )
fi

restart_paypro() {
  compose --env-file "$ENV_FILE" -f "$DEPLOY_ROOT/docker-compose.yml" up -d paypro >/dev/null 2>&1 || true
}
trap restart_paypro EXIT INT TERM

compose --env-file "$ENV_FILE" -f "$DEPLOY_ROOT/docker-compose.yml" stop paypro
compose --env-file "$ENV_FILE" -f "$DEPLOY_ROOT/docker-compose.yml" exec -T mysql sh -ec 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "DROP DATABASE IF EXISTS \`$MYSQL_DATABASE\`; CREATE DATABASE \`$MYSQL_DATABASE\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;"'
gzip -dc "$DUMP_FILE" | compose --env-file "$ENV_FILE" -f "$DEPLOY_ROOT/docker-compose.yml" exec -T mysql sh -ec 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"'
compose --env-file "$ENV_FILE" -f "$DEPLOY_ROOT/docker-compose.yml" up -d --wait --wait-timeout 240 paypro
trap - EXIT INT TERM

echo '[OK] PayPro database restored and application health check passed.'
