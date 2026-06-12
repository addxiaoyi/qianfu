#!/usr/bin/env bash

set -euo pipefail

APP_ENV_FILE="${APP_ENV_FILE:-/www/wwwroot/qianfu-app/.env}"
SOURCE_DATABASE_URL="${SOURCE_DATABASE_URL:-}"
TARGET_HOST="${TARGET_HOST:-192.168.1.3}"
TARGET_PORT="${TARGET_PORT:-3306}"
TARGET_DB="${TARGET_DB:-qianfu_public}"
TARGET_USER="${TARGET_USER:-steve}"
TARGET_PASSWORD="${TARGET_PASSWORD:-}"
TARGET_ROOT_USER="${TARGET_ROOT_USER:-root}"
TARGET_ROOT_PASSWORD="${TARGET_ROOT_PASSWORD:-}"
TABLES_CSV="${TABLES_CSV:-Server,ServerStatus,ServerVersion,TeamMember,AllianceGroup,ResourceLink,IntroPage,IntroPageVersion}"

if [[ -z "$TARGET_PASSWORD" ]]; then
  echo "[sync-nonprivate] Missing TARGET_PASSWORD"
  echo "Usage example:"
  echo "  TARGET_PASSWORD='***' TARGET_ROOT_PASSWORD='***' bash scripts/linux/sync-nonprivate-to-remote-mysql.sh"
  exit 2
fi

if [[ -z "$SOURCE_DATABASE_URL" ]]; then
  if [[ ! -f "$APP_ENV_FILE" ]]; then
    echo "[sync-nonprivate] App env file not found: $APP_ENV_FILE"
    exit 3
  fi
  SOURCE_DATABASE_URL="$(grep -E '^DATABASE_URL=' "$APP_ENV_FILE" | tail -n 1 | cut -d= -f2-)"
fi

if [[ -z "$SOURCE_DATABASE_URL" ]]; then
  echo "[sync-nonprivate] Missing SOURCE_DATABASE_URL and DATABASE_URL from app env"
  exit 4
fi

for cmd in mysql mysqldump node base64; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "[sync-nonprivate] Required command not found: $cmd"
    exit 5
  fi
done

eval "$(
  SOURCE_DATABASE_URL="$SOURCE_DATABASE_URL" node - <<'NODE'
const raw = process.env.SOURCE_DATABASE_URL || "";
try {
  const u = new URL(raw);
  if (u.protocol !== "mysql:") {
    throw new Error(`expected mysql:// url, got ${u.protocol || "unknown"}`);
  }
  const out = {
    host: u.hostname || "127.0.0.1",
    port: u.port || "3306",
    user: decodeURIComponent(u.username || ""),
    pass: decodeURIComponent(u.password || ""),
    db: decodeURIComponent((u.pathname || "").replace(/^\/+/, "")),
  };
  if (!out.user || !out.pass || !out.db) {
    throw new Error("database url missing user/password/db");
  }
  for (const [k, v] of Object.entries(out)) {
    const b64 = Buffer.from(String(v), "utf8").toString("base64");
    console.log(`SOURCE_${k.toUpperCase()}_B64=${b64}`);
  }
} catch (err) {
  console.error(`[sync-nonprivate] invalid source database url: ${err.message}`);
  process.exit(1);
}
NODE
)"

SOURCE_HOST="$(printf '%s' "$SOURCE_HOST_B64" | base64 -d)"
SOURCE_PORT="$(printf '%s' "$SOURCE_PORT_B64" | base64 -d)"
SOURCE_USER="$(printf '%s' "$SOURCE_USER_B64" | base64 -d)"
SOURCE_PASS="$(printf '%s' "$SOURCE_PASS_B64" | base64 -d)"
SOURCE_DB="$(printf '%s' "$SOURCE_DB_B64" | base64 -d)"

echo "[sync-nonprivate] source=${SOURCE_HOST}:${SOURCE_PORT}/${SOURCE_DB}"
echo "[sync-nonprivate] target=${TARGET_HOST}:${TARGET_PORT}/${TARGET_DB} user=${TARGET_USER}"

import_user="$TARGET_USER"
import_password="$TARGET_PASSWORD"

if [[ -n "$TARGET_ROOT_PASSWORD" ]]; then
  setup_sql="CREATE DATABASE IF NOT EXISTS \`${TARGET_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON \`${TARGET_DB}\`.* TO '${TARGET_USER}'@'%';
FLUSH PRIVILEGES;"
  MYSQL_PWD="$TARGET_ROOT_PASSWORD" mysql \
    -h "$TARGET_HOST" \
    -P "$TARGET_PORT" \
    -u "$TARGET_ROOT_USER" \
    --connect-timeout=8 \
    -e "$setup_sql"
  echo "[sync-nonprivate] ensured target db and grants"
  import_user="$TARGET_ROOT_USER"
  import_password="$TARGET_ROOT_PASSWORD"
fi

MYSQL_PWD="$TARGET_PASSWORD" mysql \
  -h "$TARGET_HOST" \
  -P "$TARGET_PORT" \
  -u "$TARGET_USER" \
  --connect-timeout=8 \
  "$TARGET_DB" \
  -e "CREATE TABLE IF NOT EXISTS __sync_probe(id INT PRIMARY KEY); DROP TABLE __sync_probe;"

echo "[sync-nonprivate] target write probe passed"

mapfile -t source_tables < <(
  MYSQL_PWD="$SOURCE_PASS" mysql \
    -h "$SOURCE_HOST" \
    -P "$SOURCE_PORT" \
    -u "$SOURCE_USER" \
    --batch \
    --raw \
    -N \
    -e "SHOW TABLES FROM \`${SOURCE_DB}\`;"
)

selected_tables=()
IFS=',' read -r -a requested_tables <<< "$TABLES_CSV"
for table in "${requested_tables[@]}"; do
  table_trimmed="$(echo "$table" | xargs)"
  [[ -z "$table_trimmed" ]] && continue
  if printf '%s\n' "${source_tables[@]}" | grep -Fxq "$table_trimmed"; then
    selected_tables+=("$table_trimmed")
  else
    echo "[sync-nonprivate] skip missing source table: $table_trimmed"
  fi
done

if [[ "${#selected_tables[@]}" -eq 0 ]]; then
  echo "[sync-nonprivate] no selected tables exist in source database"
  exit 6
fi

for table in "${selected_tables[@]}"; do
  echo "[sync-nonprivate] syncing table: $table"
  MYSQL_PWD="$SOURCE_PASS" mysqldump \
    -h "$SOURCE_HOST" \
    -P "$SOURCE_PORT" \
    -u "$SOURCE_USER" \
    --single-transaction \
    --skip-lock-tables \
    --set-gtid-purged=OFF \
    --no-tablespaces \
    "$SOURCE_DB" \
    "$table" \
    | MYSQL_PWD="$import_password" mysql \
      -h "$TARGET_HOST" \
      -P "$TARGET_PORT" \
      -u "$import_user" \
      "$TARGET_DB"
done

echo "[sync-nonprivate] row-count check"
for table in "${selected_tables[@]}"; do
  source_count="$(
    MYSQL_PWD="$SOURCE_PASS" mysql \
      -h "$SOURCE_HOST" \
      -P "$SOURCE_PORT" \
      -u "$SOURCE_USER" \
      --batch --raw -N \
      -e "SELECT COUNT(*) FROM \`${SOURCE_DB}\`.\`${table}\`;"
  )"
  target_count="$(
    MYSQL_PWD="$TARGET_PASSWORD" mysql \
      -h "$TARGET_HOST" \
      -P "$TARGET_PORT" \
      -u "$TARGET_USER" \
      --batch --raw -N \
      -e "SELECT COUNT(*) FROM \`${TARGET_DB}\`.\`${table}\`;"
  )"
  echo "  - ${table}: source=${source_count} target=${target_count}"
done

echo "[sync-nonprivate] done"
