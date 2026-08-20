#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${APP_ROOT:-/www/wwwroot/qianfu-app}"
APP_CURRENT="${APP_CURRENT:-$APP_ROOT/current}"
WEB_ROOT="${WEB_ROOT:-/www/wwwroot/mc-u.top}"
BACKUP_ROOT="${BACKUP_ROOT:-/www/backup/qianfu/releases}"
NGINX_CONF="${NGINX_CONF:-/www/server/panel/vhost/nginx/mc-u.top.conf}"
CERT_DIR="${CERT_DIR:-/www/server/panel/vhost/letsencrypt/mc-u.top}"
MYSQLDUMP_BIN="${MYSQLDUMP_BIN:-mysqldump}"
SQLITE_DB_PATH="${SQLITE_DB_PATH:-$APP_ROOT/prisma/dev.db}"
DATABASE_BACKUP_MODE="${DATABASE_BACKUP_MODE:-auto}"

check_only=0
release_id="$(date -u +%Y%m%d-%H%M%S)"
database_backend=""
database_backup_file=""

usage() {
  cat <<'EOF'
Usage: bash scripts/linux/snapshot-baota-release.sh [options]

Options:
  --release <id>    Snapshot label (letters, digits, dots, underscores, dashes)
  --check-only      Verify required paths and commands without writing a backup
  -h, --help        Show this help text
EOF
}

fail() {
  echo "[FAIL] $*" >&2
  exit 1
}

require_file() {
  [[ -s "$1" ]] || fail "required file is missing or empty: $1"
}

require_dir() {
  [[ -d "$1" ]] || fail "required directory is missing: $1"
}

safe_backup_root() {
  local resolved
  resolved="$(realpath -m "$BACKUP_ROOT")"
  case "${resolved}/" in
    /www/backup/qianfu/releases/*) ;;
    *) fail "BACKUP_ROOT must stay below /www/backup/qianfu/releases" ;;
  esac
  BACKUP_ROOT="$resolved"
}

validate_release_id() {
  [[ "$release_id" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$ ]] || fail "invalid release id"
}

select_database_backup() {
  if [[ "$DATABASE_BACKUP_MODE" == "sqlite" ]] || { [[ "$DATABASE_BACKUP_MODE" == "auto" ]] && [[ -s "$SQLITE_DB_PATH" ]]; }; then
    require_file "$SQLITE_DB_PATH"
    command -v sqlite3 >/dev/null 2>&1 || fail "sqlite3 is required for SQLite backup"
    database_backend="sqlite"
    return
  fi

  if [[ "$DATABASE_BACKUP_MODE" == "mysql" ]] || [[ "$DATABASE_BACKUP_MODE" == "auto" ]]; then
    command -v "$MYSQLDUMP_BIN" >/dev/null 2>&1 || fail "mysqldump is required"
    database_backend="mysql"
    return
  fi

  fail "DATABASE_BACKUP_MODE must be auto, sqlite, or mysql"
}

backup_sqlite() {
  database_backup_file="$snapshot_dir/sqlite-dev.db"
  sqlite3 "$SQLITE_DB_PATH" ".backup '$database_backup_file'"
}

backup_mysql() {
  database_backup_file="$snapshot_dir/mysql-all.sql.gz"
  "$MYSQLDUMP_BIN" --single-transaction --routines --events --all-databases | gzip -c > "$database_backup_file"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --release)
      [[ $# -ge 2 ]] || fail "--release requires a value"
      release_id="$2"
      shift 2
      ;;
    --check-only)
      check_only=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "unknown option: $1"
      ;;
  esac
done

validate_release_id
safe_backup_root
require_dir "$APP_ROOT"
require_dir "$APP_CURRENT"
require_dir "$WEB_ROOT"
require_file "$NGINX_CONF"
require_dir "$CERT_DIR"
require_file "$CERT_DIR/fullchain.pem"
require_file "$CERT_DIR/privkey.pem"
require_file "$WEB_ROOT/current/index.html"
command -v pm2 >/dev/null 2>&1 || fail "pm2 is required"
select_database_backup

if [[ "$check_only" == "1" ]]; then
  printf '[OK] app=%s\n' "$APP_ROOT"
  printf '[OK] app_current=%s\n' "$(readlink -f "$APP_CURRENT")"
  printf '[OK] web=%s\n' "$WEB_ROOT"
  printf '[OK] backup=%s\n' "$BACKUP_ROOT"
  printf '[OK] release=%s\n' "$release_id"
  printf '[OK] database_backup=%s\n' "$database_backend"
  exit 0
fi

snapshot_dir="$BACKUP_ROOT/$release_id"
[[ ! -e "$snapshot_dir" ]] || fail "snapshot already exists: $snapshot_dir"

install -d -m 700 "$snapshot_dir/nginx" "$snapshot_dir/cert"
cp -a "$NGINX_CONF" "$snapshot_dir/nginx/mc-u.top.conf"
tar -C "$(dirname "$CERT_DIR")" -czf "$snapshot_dir/cert/mc-u.top.tar.gz" "$(basename "$CERT_DIR")"
tar --dereference -C "$WEB_ROOT" -czf "$snapshot_dir/frontend-current.tar.gz" current

if [[ -f "$APP_CURRENT/.env" ]]; then
  grep -Ev '^[[:space:]]*(#|$)' "$APP_CURRENT/.env" | cut -d= -f1 | sort -u > "$snapshot_dir/env-key-manifest.txt"
else
  : > "$snapshot_dir/env-key-manifest.txt"
fi

pm2 jlist | node -e '
let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => { raw += chunk; });
process.stdin.on("end", () => {
  const apps = JSON.parse(raw).map((app) => ({
    name: app.name,
    pm_id: app.pm_id,
    status: app.pm2_env?.status,
    exec_path: app.pm2_env?.pm_exec_path,
    cwd: app.pm2_env?.pm_cwd,
    instances: app.pm2_env?.instances,
    watch: app.pm2_env?.watch,
  }));
  process.stdout.write(`${JSON.stringify(apps, null, 2)}\n`);
});
' > "$snapshot_dir/pm2-processes.json"

if [[ "$database_backend" == "sqlite" ]]; then
  backup_sqlite
else
  backup_mysql
fi

chmod 700 "$snapshot_dir" "$snapshot_dir/nginx" "$snapshot_dir/cert"
chmod 600 "$snapshot_dir"/env-key-manifest.txt "$snapshot_dir"/frontend-current.tar.gz \
  "$database_backup_file" "$snapshot_dir"/pm2-processes.json \
  "$snapshot_dir"/nginx/mc-u.top.conf "$snapshot_dir"/cert/mc-u.top.tar.gz
(cd "$snapshot_dir" && find . -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS)

printf '[OK] snapshot=%s\n' "$snapshot_dir"
