#!/usr/bin/env bash
set -euo pipefail

APPLY=0
APP_ROOT="${QF_APP_ROOT:-/www/wwwroot/qianfu-app}"
RELEASE_ROOT="${QF_RELEASE_ROOT:-/www/wwwroot/qianfu-releases}"
WEB_ROOT="${QF_WEB_ROOT:-/www/wwwroot/mc-u.top}"
FRONTEND_RELEASE_ROOT="${QF_FRONTEND_RELEASE_ROOT:-$WEB_ROOT/releases}"
BACKUP_ROOT="${QF_BACKUP_ROOT:-/mnt/qianfu-data/backups}"
RELEASE_KEEP="${QF_RELEASE_KEEP:-3}"
ROLLBACK_KEEP="${QF_ROLLBACK_KEEP:-2}"
INCOMING_KEEP_DAYS="${QF_INCOMING_KEEP_DAYS:-1}"
LOG_KEEP_DAYS="${QF_LOG_KEEP_DAYS:-14}"
rollback_targets=()
protected_targets=()

usage() {
  cat <<'EOF'
Usage: bash scripts/linux/optimize-prod-disk.sh [--apply]

Default mode is read-only. --apply removes only old release directories,
old incoming release archives, and rotated application logs. Database backups
are report-only and are never removed by this script.
EOF
}

fail() {
  printf '[FAIL] %s\n' "$1" >&2
  exit 1
}

positive_int() {
  [[ "$1" =~ ^[1-9][0-9]*$ ]] || fail "Expected a positive integer, got: $1"
}

is_release_name() {
  local path="$1"
  local name="${path##*/}"

  [[ "$name" =~ ^[0-9]{8}-[A-Za-z0-9][A-Za-z0-9._-]*$ ]]
}

safe_child() {
  local candidate="$1"
  local root="$2"
  local resolved_candidate
  local resolved_root

  resolved_candidate="$(realpath -m -- "$candidate")"
  resolved_root="$(realpath -m -- "$root")"
  case "${resolved_candidate}/" in
    "${resolved_root}/"*) ;;
    *) fail "Refusing path outside cleanup root: $resolved_candidate" ;;
  esac
}

queue_delete() {
  local kind="$1"
  local path="$2"
  local root="$3"

  safe_child "$path" "$root"
  printf '[CANDIDATE] %s %s\n' "$kind" "$path"
  if [[ "$APPLY" != "1" ]]; then
    return 0
  fi

  case "$kind" in
    directory) rm -rf --one-file-system -- "$path" ;;
    file) rm -f -- "$path" ;;
    *) fail "Unknown cleanup item type: $kind" ;;
  esac
  printf '[REMOVED] %s\n' "$path"
}

collect_old_directories() {
  local root="$1"
  local keep="$2"
  local kept=0
  local entry
  local path
  local -a entries=()

  [[ -d "$root" ]] || return 0
  mapfile -t entries < <(
    find "$root" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' |
      sort -nr
  )

  for entry in "${entries[@]}"; do
    path="${entry#* }"
    is_release_name "$path" || continue
    if (( kept < keep )); then
      kept=$((kept + 1))
      continue
    fi
    if is_protected_path "$path"; then
      continue
    fi
    queue_delete directory "$path" "$root"
  done
}

is_protected_path() {
  local path="$1"
  local target

  for target in "${protected_targets[@]}"; do
    [[ "$path" == "$target" ]] && return 0
  done
  return 1
}

load_rollback_targets() {
  local rollback_dir target_file target entry
  local rollback_kept=0
  local -a entries=()

  [[ -d "$APP_ROOT/.rollback" ]] || return 0

  mapfile -t entries < <(
    find "$APP_ROOT/.rollback" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' |
      sort -nr
  )

  for entry in "${entries[@]}"; do
    (( rollback_kept < ROLLBACK_KEEP )) || break
    rollback_dir="${entry#* }"
    rollback_kept=$((rollback_kept + 1))

    for target_file in app-target frontend-target; do
      target_file="$rollback_dir/$target_file"
      [[ -s "$target_file" ]] || continue
      target="$(readlink -f -- "$(head -n 1 "$target_file")" 2>/dev/null || true)"
      [[ -n "$target" ]] || continue
      rollback_targets+=("$target")
    done
  done
}

collect_old_files() {
  local root="$1"
  local days="$2"
  local pattern="$3"
  local path

  [[ -d "$root" ]] || return 0
  while IFS= read -r path; do
    [[ -n "$path" ]] || continue
    queue_delete file "$path" "$root"
  done < <(find "$root" -mindepth 1 -maxdepth 1 -type f -name "$pattern" -mtime +"$days" -print)
}

report_database_backups() {
  printf '[INFO] database backups are report-only: %s\n' "$BACKUP_ROOT"
  if [[ -d "$BACKUP_ROOT" ]]; then
    du -sh -- "$BACKUP_ROOT" || true
    find "$BACKUP_ROOT" -mindepth 1 -maxdepth 2 -type f -printf '%T@ %s %p\n' |
      sort -nr | head -n 10 || true
  else
    printf '[INFO] database backup directory is absent\n'
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --apply) APPLY=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) usage; fail "Unknown option: $1" ;;
  esac
done

positive_int "$RELEASE_KEEP"
positive_int "$ROLLBACK_KEEP"
positive_int "$INCOMING_KEEP_DAYS"
positive_int "$LOG_KEEP_DAYS"

[[ -d "$APP_ROOT" ]] || fail "Application root is missing: $APP_ROOT"
[[ -d "$WEB_ROOT" ]] || fail "Web root is missing: $WEB_ROOT"

current_app="$(readlink -f -- "$APP_ROOT/current" 2>/dev/null || true)"
current_release="$(readlink -f -- "$RELEASE_ROOT/current" 2>/dev/null || true)"
current_web="$(readlink -f -- "$WEB_ROOT/current" 2>/dev/null || true)"
load_rollback_targets
protected_targets=("$current_app" "$current_release" "$current_web" "${rollback_targets[@]}")

printf '[INFO] mode=%s\n' "$([[ "$APPLY" == "1" ]] && printf apply || printf dry-run)"
printf '[INFO] filesystem summary\n'
df -h -- / "$APP_ROOT" "$WEB_ROOT" "$BACKUP_ROOT" 2>/dev/null || true

collect_old_directories "$APP_ROOT/.releases" "$RELEASE_KEEP"
collect_old_directories "$RELEASE_ROOT" "$RELEASE_KEEP"
collect_old_directories "$FRONTEND_RELEASE_ROOT" "$RELEASE_KEEP"
collect_old_directories "$APP_ROOT/.rollback" "$ROLLBACK_KEEP"
collect_old_files "$APP_ROOT/.incoming" "$INCOMING_KEEP_DAYS" 'qianfu-baota-release-*.tar.gz'
collect_old_files "$APP_ROOT/logs" "$LOG_KEEP_DAYS" '*.log.*'
collect_old_files "$APP_ROOT/logs" "$LOG_KEEP_DAYS" '*.gz'

safe_child "$APP_ROOT/.releases" "$APP_ROOT" 2>/dev/null || true
safe_child "$RELEASE_ROOT" "$RELEASE_ROOT" 2>/dev/null || true
safe_child "$WEB_ROOT/current" "$WEB_ROOT" 2>/dev/null || true
report_database_backups

printf '[INFO] filesystem summary after scan\n'
df -h -- / "$APP_ROOT" "$WEB_ROOT" "$BACKUP_ROOT" 2>/dev/null || true
