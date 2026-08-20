#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${APP_ROOT:-/www/wwwroot/qianfu-app}"
APP_CURRENT_LINK="${APP_CURRENT_LINK:-$APP_ROOT/current}"
APP_RELEASES_ROOT="${APP_RELEASES_ROOT:-/www/wwwroot/qianfu-releases}"
WEB_ROOT="${WEB_ROOT:-/www/wwwroot/mc-u.top}"
WEB_DOMAIN="${WEB_DOMAIN:-mc-u.top}"
API_PORT="${API_PORT:-3001}"
SQLITE_DB_PATH="${SQLITE_DB_PATH:-$APP_ROOT/prisma/dev.db}"
RELEASES_ROOT="${RELEASES_ROOT:-$APP_ROOT/.releases}"
ROLLBACK_ROOT="${ROLLBACK_ROOT:-$APP_ROOT/.rollback}"
FRONTEND_RELEASES_ROOT="${FRONTEND_RELEASES_ROOT:-$WEB_ROOT/releases}"

check_only=0
rollback_id=""
release_id=""

usage() {
  cat <<'EOF'
Usage: bash scripts/linux/publish-baota-release.sh --release <id> [options]

Options:
  --release <id>    Staged release directory under APP_ROOT/.releases
  --rollback <id>   Restore the retained rollback targets for this release
  --check-only      Validate paths and artifacts without changing the host
  -h, --help        Show this help text
EOF
}

fail() {
  echo "[FAIL] $*" >&2
  exit 1
}

info() {
  echo "[INFO] $*"
}

validate_release_id() {
  local value="$1"
  [[ "$value" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$ ]] || fail "invalid release id"
}

require_file() {
  [[ -s "$1" ]] || fail "required file is missing or empty: $1"
}

require_dir() {
  [[ -d "$1" ]] || fail "required directory is missing: $1"
}

same_filesystem() {
  local source="$1"
  local target_parent="$2"
  [[ "$(stat -c %d "$source")" == "$(stat -c %d "$target_parent")" ]] || fail "atomic move would cross filesystems: $source -> $target_parent"
}

safe_path() {
  local path="$1"
  local parent="$2"
  local resolved_path resolved_parent
  resolved_path="$(realpath -m "$path")"
  resolved_parent="$(realpath -m "$parent")"
  case "${resolved_path}/" in
    "${resolved_parent}/"*) ;;
    *) fail "path must stay below $resolved_parent: $resolved_path" ;;
  esac
}

stage_paths() {
  stage_dir="$RELEASES_ROOT/$release_id"
  payload_dir="$stage_dir/payload"
  rollback_dir="$ROLLBACK_ROOT/$release_id"
  next_app="$APP_RELEASES_ROOT/$release_id"
  next_frontend="$FRONTEND_RELEASES_ROOT/$release_id"
  migration_runner="$APP_ROOT/prisma/.release-$release_id"
}

resolve_previous_targets() {
  previous_app="$(readlink -f "$APP_CURRENT_LINK")"
  previous_frontend="$(readlink -f "$WEB_ROOT/current")"
  require_dir "$previous_app"
  require_dir "$previous_frontend"
  safe_path "$previous_app" "$APP_RELEASES_ROOT"
  safe_path "$previous_frontend" "$FRONTEND_RELEASES_ROOT"
}

validate_stage() {
  require_dir "$APP_ROOT"
  require_dir "$WEB_ROOT"
  require_dir "$APP_RELEASES_ROOT"
  require_dir "$FRONTEND_RELEASES_ROOT"
  [[ -L "$APP_CURRENT_LINK" ]] || fail "APP_CURRENT_LINK must be a symbolic link"
  [[ -L "$WEB_ROOT/current" ]] || fail "frontend current must be a symbolic link"
  require_dir "$stage_dir"
  require_dir "$payload_dir"
  require_file "$payload_dir/dist-server/server/index.js"
  require_file "$payload_dir/packages/shared/dist/index.js"
  require_file "$payload_dir/qianfu-liandeng/dist/index.html"
  require_file "$payload_dir/qianfu-liandeng/dist/qianfu-dist-manifest.json"
  require_file "$payload_dir/prisma/schema.prisma"
  require_dir "$payload_dir/prisma/migrations"
  require_dir "$payload_dir/dist-server/prisma/generated"
  command -v pm2 >/dev/null 2>&1 || fail "pm2 is required"
  command -v curl >/dev/null 2>&1 || fail "curl is required"
  command -v cp >/dev/null 2>&1 || fail "cp is required"
  require_file "$APP_ROOT/node_modules/.bin/prisma"
  require_file "$SQLITE_DB_PATH"
  safe_path "$stage_dir" "$RELEASES_ROOT"
  safe_path "$rollback_dir" "$ROLLBACK_ROOT"
  safe_path "$next_app" "$APP_RELEASES_ROOT"
  safe_path "$next_frontend" "$FRONTEND_RELEASES_ROOT"
  safe_path "$migration_runner" "$APP_ROOT/prisma"
  [[ ! -e "$next_app" ]] || fail "application release already exists: $release_id"
  [[ ! -e "$next_frontend" ]] || fail "frontend release already exists: $release_id"
  [[ ! -e "$migration_runner" ]] || fail "migration workspace already exists: $migration_runner"
  resolve_previous_targets
  require_file "$previous_app/dist-server/server/index.js"
  require_dir "$previous_app/node_modules"
  require_file "$previous_app/.env"
  same_filesystem "$payload_dir/dist-server" "$APP_RELEASES_ROOT"
  same_filesystem "$payload_dir/packages/shared/dist" "$APP_RELEASES_ROOT"
  same_filesystem "$payload_dir/prisma/migrations" "$APP_RELEASES_ROOT"
  same_filesystem "$payload_dir/qianfu-liandeng/dist" "$FRONTEND_RELEASES_ROOT"
}

switch_link() {
  local target="$1"
  local link="$2"
  local next_link="${link}.next-$release_id"
  ln -s "$target" "$next_link"
  mv -Tf "$next_link" "$link"
}

stop_api() {
  pm2 stop qianfu-api
}

start_api() {
  pm2 restart qianfu-api --update-env
}

restore_previous() {
  if [[ -s "$rollback_dir/app-target" ]]; then
    local rollback_app
    rollback_app="$(cat "$rollback_dir/app-target")"
    require_dir "$rollback_app"
    switch_link "$rollback_app" "$APP_CURRENT_LINK"
  fi

  if [[ -s "$rollback_dir/frontend-target" ]]; then
    local rollback_frontend
    rollback_frontend="$(cat "$rollback_dir/frontend-target")"
    require_dir "$rollback_frontend"
    switch_link "$rollback_frontend" "$WEB_ROOT/current"
  fi

  start_api
}

wait_for_api() {
  local attempt
  for attempt in {1..15}; do
    if curl --fail --silent --show-error --max-time 5 \
      -H "Host: $WEB_DOMAIN" \
      -H 'X-Forwarded-Proto: https' \
      "http://127.0.0.1:$API_PORT/api/health" | grep -q 'healthy'; then
      return 0
    fi
    sleep 1
  done
  return 1
}

verify_frontend() {
  curl --fail --silent --show-error --max-time 15 \
    --resolve "$WEB_DOMAIN:443:127.0.0.1" \
    "https://$WEB_DOMAIN/qianfu-dist-manifest.json" >/dev/null
}

prepare_next_app() {
  cp -al "$previous_app/." "$next_app"
  rm -rf "$next_app/dist-server" "$next_app/packages/shared/dist" "$next_app/prisma/migrations"
  mv "$payload_dir/dist-server" "$next_app/dist-server"
  mv "$payload_dir/packages/shared/dist" "$next_app/packages/shared/dist"
  mv "$payload_dir/prisma/migrations" "$next_app/prisma/migrations"
  mv "$payload_dir/prisma/schema.prisma" "$next_app/prisma/schema.prisma"
}

run_migrations() {
  mkdir -p "$migration_runner"
  cp "$next_app/prisma/schema.prisma" "$migration_runner/schema.prisma"
  cp -a "$next_app/prisma/migrations" "$migration_runner/migrations"
  ln -s "$SQLITE_DB_PATH" "$migration_runner/dev.db"
  (
    cd "$APP_ROOT"
    "$APP_ROOT/node_modules/.bin/prisma" migrate deploy --schema "$migration_runner/schema.prisma"
  )
  rm -rf "$migration_runner"
}

publish() {
  mkdir -p "$ROLLBACK_ROOT"
  [[ ! -e "$rollback_dir" ]] || fail "rollback directory already exists: $rollback_dir"
  mkdir -p "$rollback_dir"
  printf '%s\n' "$previous_app" > "$rollback_dir/app-target"
  printf '%s\n' "$previous_frontend" > "$rollback_dir/frontend-target"

  bash "$stage_dir/scripts/linux/snapshot-baota-release.sh" --release "$release_id"

  prepare_next_app
  stop_api
  run_migrations
  mv "$payload_dir/qianfu-liandeng/dist" "$next_frontend"
  switch_link "$next_app" "$APP_CURRENT_LINK"
  switch_link "$next_frontend" "$WEB_ROOT/current"

  start_api
  wait_for_api || return 1
  verify_frontend || return 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --release)
      [[ $# -ge 2 ]] || fail "--release requires a value"
      release_id="$2"
      shift 2
      ;;
    --rollback)
      [[ $# -ge 2 ]] || fail "--rollback requires a value"
      rollback_id="$2"
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

if [[ -n "$rollback_id" ]]; then
  validate_release_id "$rollback_id"
  release_id="$rollback_id"
  stage_paths
  require_dir "$rollback_dir"
  info "restoring release $release_id"
  restore_previous
  wait_for_api
  verify_frontend
  info "rollback complete"
  exit 0
fi

[[ -n "$release_id" ]] || fail "--release is required"
validate_release_id "$release_id"
stage_paths
validate_stage

if [[ "$check_only" == "1" ]]; then
  info "stage is ready: $release_id"
  exit 0
fi

published=0
trap 'if [[ "$published" != "1" && -d "$rollback_dir" ]]; then info "publish failed; restoring previous release"; restore_previous || true; fi' EXIT
publish
published=1
trap - EXIT
info "release published: $release_id"
