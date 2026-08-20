#!/usr/bin/env bash
set -euo pipefail

URL_FILE="${POSTGRES_URL_FILE:-/root/.qianfu-postgres-url}"
BACKUP_DIR="${POSTGRES_BACKUP_DIR:-/www/backup/qianfu/postgres}"
KEEP_COUNT="${POSTGRES_BACKUP_KEEP_COUNT:-7}"
STATE_DIR="${QIANFU_MONITOR_STATE_DIR:-/var/lib/qianfu-monitor}"

[[ -r "$URL_FILE" ]] || { echo "PostgreSQL URL file is not readable: $URL_FILE" >&2; exit 1; }
[[ "$KEEP_COUNT" =~ ^[1-9][0-9]*$ ]] || { echo "POSTGRES_BACKUP_KEEP_COUNT must be positive" >&2; exit 1; }

install -d -m 700 "$BACKUP_DIR" "$STATE_DIR"
command -v flock >/dev/null 2>&1 || { echo "flock is required for backup locking" >&2; exit 1; }
exec 9>"$STATE_DIR/backup.lock"
if ! flock -n 9; then
  printf 'backup_skipped=true reason=already_running\n'
  exit 0
fi

database_url="$(<"$URL_FILE")"
database_url="${database_url%%\?*}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
pending="$BACKUP_DIR/.qianfu-$timestamp.dump.pending"
backup="$BACKUP_DIR/qianfu-$timestamp.dump"

cleanup() {
  rm -f "$pending"
}
trap cleanup EXIT
trap 'printf "%s backup_failed\n" "$(date -u +%FT%TZ)" > "$STATE_DIR/backup.failed"' ERR

pg_dump --format=custom --compress=6 --file="$pending" "$database_url"
pg_restore --list "$pending" >/dev/null
chmod 600 "$pending"
mv "$pending" "$backup"

mapfile -t old_backups < <(
  find "$BACKUP_DIR" -maxdepth 1 -type f -name 'qianfu-*.dump' -printf '%T@ %p\n' \
    | sort -nr \
    | awk -v keep="$KEEP_COUNT" 'NR > keep { sub(/^[^ ]+ /, ""); print }'
)

for old_backup in "${old_backups[@]}"; do
  rm -f -- "$old_backup"
done

rm -f "$STATE_DIR/backup.failed"
printf 'backup_ok=true file=%s bytes=%s kept=%s\n' "$backup" "$(stat -c %s "$backup")" "$KEEP_COUNT"
