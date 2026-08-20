#!/usr/bin/env bash
set -Eeuo pipefail

DB_PATH="${QIANFU_LOCAL_DB_PATH:-/www/wwwroot/qianfu-app/prisma/dev.db}"
BACKUP_DIR="${QIANFU_SQLITE_BACKUP_DIR:-/www/backup/qianfu/sqlite}"
STATE_DIR="${QIANFU_MONITOR_STATE_DIR:-/var/lib/qianfu-monitor}"
KEEP_COUNT="${QIANFU_SQLITE_BACKUP_KEEP_COUNT:-14}"

[[ "$KEEP_COUNT" =~ ^[1-9][0-9]*$ ]] || { echo "QIANFU_SQLITE_BACKUP_KEEP_COUNT must be positive" >&2; exit 1; }
install -d -m 700 "$BACKUP_DIR" "$STATE_DIR"

on_error() {
  local code=$?
  printf '%s backup failed with exit=%s\n' "$(date -Is)" "$code" > "$STATE_DIR/sqlite-backup.failed"
  logger -t qianfu-sqlite-backup -- "backup failed exit=$code"
  exit "$code"
}
trap on_error ERR

[[ -s "$DB_PATH" ]] || { echo "SQLite database missing or empty: $DB_PATH" >&2; exit 1; }
command -v sqlite3 >/dev/null || { echo "sqlite3 CLI is required" >&2; exit 1; }

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
final="$BACKUP_DIR/qianfu-local-$timestamp.db"
tmp="$BACKUP_DIR/.qianfu-local-$timestamp.db.tmp"
rm -f "$tmp"

sqlite3 -readonly "$DB_PATH" ".timeout 30000" ".backup '$tmp'"
integrity="$(sqlite3 "$tmp" 'PRAGMA integrity_check;')"
[[ "$integrity" == "ok" ]] || { echo "SQLite integrity_check failed: $integrity" >&2; exit 1; }

chmod 600 "$tmp"
mv -f "$tmp" "$final"
sha256sum "$final" > "$final.sha256"
chmod 600 "$final" "$final.sha256"

mapfile -t backups < <(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'qianfu-local-*.db' -printf '%T@ %p\n' | sort -nr | cut -d' ' -f2-)
for ((index=KEEP_COUNT; index<${#backups[@]}; index++)); do
  rm -f -- "${backups[$index]}" "${backups[$index]}.sha256"
done

rm -f "$STATE_DIR/sqlite-backup.failed"
printf 'backup=%s bytes=%s\n' "$final" "$(stat -c %s "$final")"
