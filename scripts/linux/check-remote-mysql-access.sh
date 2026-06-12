#!/usr/bin/env bash

set -euo pipefail

DB_HOST="${DB_HOST:-192.168.1.3}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-}"
DB_PASSWORD="${DB_PASSWORD:-}"
PROBE_CREATE_DB="${PROBE_CREATE_DB:-0}"
PROBE_DB_NAME_PREFIX="${PROBE_DB_NAME_PREFIX:-qianfu_probe}"

if [[ -z "$DB_USER" || -z "$DB_PASSWORD" ]]; then
  echo "[check-remote-mysql-access] Missing DB_USER or DB_PASSWORD"
  echo "Usage:"
  echo "  DB_USER=steve DB_PASSWORD='***' bash scripts/linux/check-remote-mysql-access.sh"
  exit 2
fi

if ! command -v mysql >/dev/null 2>&1; then
  echo "[check-remote-mysql-access] mysql client not found"
  exit 3
fi

run_sql() {
  local sql="$1"
  MYSQL_PWD="$DB_PASSWORD" mysql \
    -h "$DB_HOST" \
    -P "$DB_PORT" \
    -u "$DB_USER" \
    --connect-timeout=8 \
    --batch \
    --raw \
    -N \
    -e "$sql"
}

echo "[check-remote-mysql-access] target=${DB_HOST}:${DB_PORT} user=${DB_USER}"
echo "[check-remote-mysql-access] identity"
run_sql "SELECT VERSION(), CURRENT_USER(), @@hostname;"

echo "[check-remote-mysql-access] grants"
run_sql "SHOW GRANTS FOR CURRENT_USER;"

echo "[check-remote-mysql-access] databases"
run_sql "SHOW DATABASES;"

if [[ "$PROBE_CREATE_DB" == "1" ]]; then
  probe_db="${PROBE_DB_NAME_PREFIX}_$(date +%s)"
  echo "[check-remote-mysql-access] create probe: ${probe_db}"
  if run_sql "CREATE DATABASE \`${probe_db}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"; then
    echo "[check-remote-mysql-access] create probe succeeded, dropping"
    run_sql "DROP DATABASE \`${probe_db}\`;"
    echo "[check-remote-mysql-access] drop probe succeeded"
  else
    echo "[check-remote-mysql-access] create probe failed"
    exit 4
  fi
fi

echo "[check-remote-mysql-access] done"
