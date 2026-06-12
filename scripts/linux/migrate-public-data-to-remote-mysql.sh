#!/usr/bin/env bash
set -euo pipefail

# Migrate non-sensitive/public data tables from source MySQL to target MySQL.
# Default table whitelist avoids user/payment/ticket/privacy-related datasets.

SOURCE_HOST="${SOURCE_HOST:-127.0.0.1}"
SOURCE_PORT="${SOURCE_PORT:-3306}"
SOURCE_DB="${SOURCE_DB:-qianfu}"
SOURCE_USER="${SOURCE_USER:-qianfu}"
SOURCE_PASSWORD="${SOURCE_PASSWORD:-}"

TARGET_HOST="${TARGET_HOST:-192.168.1.3}"
TARGET_PORT="${TARGET_PORT:-3306}"
TARGET_DB="${TARGET_DB:-qianfu_public}"
TARGET_USER="${TARGET_USER:-steve}"
TARGET_PASSWORD="${TARGET_PASSWORD:-}"

WORK_DIR="${WORK_DIR:-/tmp/qianfu-public-migration-$(date +%Y%m%d-%H%M%S)}"

DEFAULT_TABLES=(
  "AllianceGroup"
  "TeamMember"
  "ResourceLink"
  "IntroPage"
  "IntroPageVersion"
)

if [[ -n "${TABLES:-}" ]]; then
  # shellcheck disable=SC2206
  TABLE_LIST=(${TABLES})
else
  TABLE_LIST=("${DEFAULT_TABLES[@]}")
fi

if [[ -z "$SOURCE_PASSWORD" ]]; then
  echo "[public-migrate] SOURCE_PASSWORD is required."
  exit 1
fi

if [[ -z "$TARGET_PASSWORD" ]]; then
  echo "[public-migrate] TARGET_PASSWORD is required."
  exit 1
fi

command -v mysql >/dev/null 2>&1 || { echo "[public-migrate] missing mysql client"; exit 1; }
command -v mysqldump >/dev/null 2>&1 || { echo "[public-migrate] missing mysqldump client"; exit 1; }

mkdir -p "$WORK_DIR"

mysql_source() {
  MYSQL_PWD="$SOURCE_PASSWORD" mysql \
    --default-character-set=utf8mb4 \
    --connect-timeout=10 \
    -h "$SOURCE_HOST" -P "$SOURCE_PORT" -u "$SOURCE_USER" "$@"
}

mysql_target() {
  MYSQL_PWD="$TARGET_PASSWORD" mysql \
    --default-character-set=utf8mb4 \
    --connect-timeout=10 \
    -h "$TARGET_HOST" -P "$TARGET_PORT" -u "$TARGET_USER" "$@"
}

mysqldump_source() {
  MYSQL_PWD="$SOURCE_PASSWORD" mysqldump \
    --default-character-set=utf8mb4 \
    --single-transaction \
    --quick \
    --no-tablespaces \
    --skip-lock-tables \
    --skip-add-locks \
    --skip-comments \
    --no-create-info \
    --skip-triggers \
    -h "$SOURCE_HOST" -P "$SOURCE_PORT" -u "$SOURCE_USER" "$@"
}

table_exists() {
  local mode="$1"
  local db="$2"
  local table="$3"
  if [[ "$mode" == "source" ]]; then
    mysql_source -Nse "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${db}' AND table_name='${table}'" | tr -d '\r'
  else
    mysql_target -Nse "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${db}' AND table_name='${table}'" | tr -d '\r'
  fi
}

count_rows() {
  local mode="$1"
  local db="$2"
  local table="$3"
  if [[ "$mode" == "source" ]]; then
    mysql_source -D "$db" -Nse "SELECT COUNT(*) FROM \`${table}\`" | tr -d '\r'
  else
    mysql_target -D "$db" -Nse "SELECT COUNT(*) FROM \`${table}\`" | tr -d '\r'
  fi
}

echo "[public-migrate] source=${SOURCE_USER}@${SOURCE_HOST}:${SOURCE_PORT}/${SOURCE_DB}"
echo "[public-migrate] target=${TARGET_USER}@${TARGET_HOST}:${TARGET_PORT}/${TARGET_DB}"
echo "[public-migrate] work_dir=${WORK_DIR}"
echo "[public-migrate] tables=${TABLE_LIST[*]}"

mysql_source -D "$SOURCE_DB" -e "SELECT 1 AS source_ok;" >/dev/null
mysql_target -D "$TARGET_DB" -e "SELECT 1 AS target_ok;" >/dev/null

SUMMARY_FILE="$WORK_DIR/summary.tsv"
printf "table\tsource_rows\ttarget_rows\tstatus\n" >"$SUMMARY_FILE"

for table in "${TABLE_LIST[@]}"; do
  src_exists="$(table_exists source "$SOURCE_DB" "$table")"
  dst_exists="$(table_exists target "$TARGET_DB" "$table")"

  if [[ "$src_exists" != "1" ]]; then
    echo "[public-migrate] skip ${table}: missing in source"
    printf "%s\t-\t-\tSKIP_SOURCE_MISSING\n" "$table" >>"$SUMMARY_FILE"
    continue
  fi

  if [[ "$dst_exists" != "1" ]]; then
    echo "[public-migrate] skip ${table}: missing in target"
    printf "%s\t-\t-\tSKIP_TARGET_MISSING\n" "$table" >>"$SUMMARY_FILE"
    continue
  fi

  dump_file="$WORK_DIR/${table}.sql"
  source_rows="$(count_rows source "$SOURCE_DB" "$table")"

  echo "[public-migrate] dumping ${table} (${source_rows} rows)"
  mysqldump_source "$SOURCE_DB" "$table" >"$dump_file"

  echo "[public-migrate] importing ${table}"
  {
    echo "SET FOREIGN_KEY_CHECKS=0;"
    echo "TRUNCATE TABLE \`${table}\`;"
    cat "$dump_file"
    echo "SET FOREIGN_KEY_CHECKS=1;"
  } | mysql_target -D "$TARGET_DB"

  target_rows="$(count_rows target "$TARGET_DB" "$table")"
  status="OK"
  if [[ "$source_rows" != "$target_rows" ]]; then
    status="ROW_MISMATCH"
  fi

  printf "%s\t%s\t%s\t%s\n" "$table" "$source_rows" "$target_rows" "$status" >>"$SUMMARY_FILE"
  echo "[public-migrate] ${table}: source=${source_rows}, target=${target_rows}, status=${status}"
done

echo "[public-migrate] done. summary=${SUMMARY_FILE}"
