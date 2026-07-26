#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
DEPLOY_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
ENV_FILE=${1:-"$DEPLOY_ROOT/.env"}
MIGRATION_FILE=${2:-"$DEPLOY_ROOT/mysql-migrations/002-order-expiry-decrement.sql"}
COMPOSE_FILE="$DEPLOY_ROOT/docker-compose.yml"
. "$SCRIPT_DIR/compose.sh"

[ -f "$ENV_FILE" ] || { echo "Missing environment file: $ENV_FILE" >&2; exit 1; }
[ -f "$MIGRATION_FILE" ] || { echo "Missing migration file: $MIGRATION_FILE" >&2; exit 1; }

compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T mysql sh -ec \
  'exec mysql --protocol=TCP -h127.0.0.1 -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' \
  < "$MIGRATION_FILE"

verification=$(
  compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T mysql sh -ec \
    'exec mysql --protocol=TCP -h127.0.0.1 -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" --batch --skip-column-names' <<'SQL'
SELECT COUNT(*)
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 't_order'
  AND COLUMN_NAME IN ('match_mode', 'actual_amount', 'decrement_index', 'order_source', 'notify_url', 'expire_time');
SELECT COUNT(DISTINCT INDEX_NAME)
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 't_order'
  AND INDEX_NAME IN ('idx_actual_amount_state', 'idx_pay_num_create_time');
SELECT COALESCE(MAX(CHARACTER_MAXIMUM_LENGTH), 0)
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 't_order'
  AND COLUMN_NAME = 'notify_url';
SQL
)

set -- $verification
[ "${1:-0}" = '6' ] || { echo 'Required order columns were not created.' >&2; exit 1; }
[ "${2:-0}" = '2' ] || { echo 'Required order indexes were not created.' >&2; exit 1; }
[ "${3:-0}" -ge 512 ] 2>/dev/null || { echo 'notify_url is shorter than 512 characters.' >&2; exit 1; }

echo '[OK] PayPro database migration 002 is applied and verified.'
