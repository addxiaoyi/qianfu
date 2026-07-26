#!/usr/bin/env sh
set -eu
umask 077

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
DEPLOY_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
ENV_FILE=${1:-"$DEPLOY_ROOT/.env"}
. "$SCRIPT_DIR/compose.sh"
RETENTION_DAYS=${PAYPRO_BACKUP_RETENTION_DAYS:-14}
TIMESTAMP=$(date -u '+%Y%m%dT%H%M%SZ')
BACKUP_DIR="$DEPLOY_ROOT/backups"
BACKUP_FILE="$BACKUP_DIR/paypro-${TIMESTAMP}.sql.gz"

case "$RETENTION_DAYS" in
  ''|*[!0-9]*) echo 'PAYPRO_BACKUP_RETENTION_DAYS must be a non-negative integer' >&2; exit 1 ;;
esac

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
compose --env-file "$ENV_FILE" -f "$DEPLOY_ROOT/docker-compose.yml" exec -T mysql sh -ec 'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --quick --routines --triggers --events "$MYSQL_DATABASE"' \
  | gzip -9 > "$BACKUP_FILE"

gzip -t "$BACKUP_FILE"
(
  cd "$BACKUP_DIR"
  sha256sum "$(basename "$BACKUP_FILE")" > "$(basename "$BACKUP_FILE").sha256"
)
find "$BACKUP_DIR" -type f \( -name 'paypro-*.sql.gz' -o -name 'paypro-*.sql.gz.sha256' \) -mtime "+$RETENTION_DAYS" -delete

echo "[OK] Backup created: $BACKUP_FILE"
