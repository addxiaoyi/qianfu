#!/usr/bin/env bash
set -euo pipefail

ROOT_BASE="${1:-/mnt/starbot-root-backups}"
ARCH_BASE="${2:-/mnt/starbot-archive}"
GDRIVE_MOUNT="${3:-/mnt/gdrive-qianfu}"
RESTORE_TOOL="/root/restore_cold_migration.sh"

count_children() {
  local base="$1"
  find "$base" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l
}

count_note_dirs() {
  local base="$1"
  find "$base" -mindepth 1 -maxdepth 1 -type d -exec test -f '{}/MIGRATION_NOTE.txt' ';' -print 2>/dev/null | wc -l
}

print_block() {
  local title="$1"
  echo
  echo "==== $title ===="
}

check_base() {
  local base="$1"
  local name="$2"
  local total noted

  print_block "$name"
  if [[ ! -d "$base" ]]; then
    echo "[FAIL] base path not found: $base"
    return 2
  fi

  total="$(count_children "$base")"
  noted="$(count_note_dirs "$base")"
  echo "base=$base"
  echo "children=$total"
  echo "with_note=$noted"

  if [[ "$total" -eq "$noted" ]]; then
    echo "[OK] all child dirs have MIGRATION_NOTE.txt"
  else
    echo "[WARN] mismatch: $((total-noted)) child dirs missing MIGRATION_NOTE.txt"
  fi
}

print_block "Timestamp"
date -u '+%F %T UTC'

print_block "Disk"
df -h / /mnt
timeout 10 df -h "$GDRIVE_MOUNT" || echo "[WARN] timeout while reading $GDRIVE_MOUNT"

print_block "Mount"
if findmnt -T "$GDRIVE_MOUNT" >/dev/null 2>&1; then
  findmnt -T "$GDRIVE_MOUNT"
else
  echo "[WARN] mount target not active: $GDRIVE_MOUNT"
fi

print_block "Restore Tool"
if [[ -x "$RESTORE_TOOL" ]]; then
  echo "[OK] restore tool present: $RESTORE_TOOL"
else
  echo "[WARN] restore tool not executable: $RESTORE_TOOL"
fi

check_base "$ROOT_BASE" "Root Backups"
check_base "$ARCH_BASE" "Archive Backups"

if [[ -x "$RESTORE_TOOL" ]]; then
  print_block "Sample Recoverable Entries"
  echo "[ROOT]"; bash "$RESTORE_TOOL" list "$ROOT_BASE" | head -n 5 || true
  echo "[ARCH]"; bash "$RESTORE_TOOL" list "$ARCH_BASE" | head -n 5 || true
fi

echo
echo "[DONE] cold migration status check finished"
