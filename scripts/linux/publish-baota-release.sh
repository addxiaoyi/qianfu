#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${APP_ROOT:-/www/wwwroot/qianfu-app}"
APP_CURRENT_LINK="${APP_CURRENT_LINK:-$APP_ROOT/current}"
APP_RELEASES_ROOT="${APP_RELEASES_ROOT:-/www/wwwroot/qianfu-releases}"
WEB_ROOT="${WEB_ROOT:-/www/wwwroot/mc-u.top}"
WEB_DOMAIN="${WEB_DOMAIN:-mc-u.top}"
API_PORT="${API_PORT:-3001}"
API_STARTUP_TIMEOUT_SECONDS=90
RELEASES_ROOT="${RELEASES_ROOT:-$APP_ROOT/.releases}"
ROLLBACK_ROOT="${ROLLBACK_ROOT:-$APP_ROOT/.rollback}"
FRONTEND_RELEASES_ROOT="${FRONTEND_RELEASES_ROOT:-$WEB_ROOT/releases}"
POSTGRES_REPAIR_MIGRATIONS=(
  "prisma/migrations/20260731050000_checkin_and_server_facets/migration.postgresql.sql"
  "prisma/migrations/20260731080000_checkin_history_fk_reconciliation/migration.postgresql.sql"
  "prisma/migrations/20260810100000_checkin_unique_constraint_repair/migration.postgresql.sql"
  "prisma/migrations/20260804114500_marketplace_evidence_closure/migration.postgresql.sql"
  "prisma/migrations/20260805180000_paypal_refund_review/migration.postgresql.sql"
  "prisma/migrations/20260808120000_marketplace_product_asset_columns/migration.postgresql.sql"
  "prisma/migrations/20260810120000_level_xp_events/migration.postgresql.sql"
  "prisma/migrations/20260812130000_personal_filing_announcement_cleanup/migration.postgresql.sql"
)

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
  if [[ -L "$WEB_ROOT/current" ]]; then
    safe_path "$previous_frontend" "$FRONTEND_RELEASES_ROOT"
  else
    safe_path "$previous_frontend" "$WEB_ROOT"
  fi
}

validate_frontend_current() {
  if [[ -L "$WEB_ROOT/current" ]]; then
    return 0
  fi

  require_dir "$WEB_ROOT/current"
  safe_path "$WEB_ROOT/current" "$WEB_ROOT"
  same_filesystem "$WEB_ROOT/current" "$FRONTEND_RELEASES_ROOT"
}

validate_stage() {
  require_dir "$APP_ROOT"
  require_dir "$WEB_ROOT"
  require_dir "$APP_RELEASES_ROOT"
  require_dir "$FRONTEND_RELEASES_ROOT"
  [[ -L "$APP_CURRENT_LINK" ]] || fail "APP_CURRENT_LINK must be a symbolic link"
  validate_frontend_current
  require_dir "$stage_dir"
  require_dir "$payload_dir"
  require_file "$payload_dir/dist-server/server/index.js"
  require_file "$payload_dir/packages/shared/dist/index.js"
  require_file "$payload_dir/qianfu-liandeng/dist/index.html"
  require_file "$payload_dir/qianfu-liandeng/dist/qianfu-dist-manifest.json"
  require_file "$payload_dir/node_modules/@aws-sdk/s3-request-presigner/package.json"
  require_file "$payload_dir/node_modules/optimist/package.json"
  require_file "$payload_dir/node_modules/poplib/package.json"
  require_file "$payload_dir/prisma/schema.prisma"
  require_file "$payload_dir/prisma/schema.postgresql.prisma"
  for repair_migration_relative in "${POSTGRES_REPAIR_MIGRATIONS[@]}"; do
    require_file "$payload_dir/$repair_migration_relative"
  done
  require_dir "$payload_dir/prisma/migrations"
  require_dir "$payload_dir/dist-server/prisma/generated"
  command -v pm2 >/dev/null 2>&1 || fail "pm2 is required"
  command -v curl >/dev/null 2>&1 || fail "curl is required"
  command -v cp >/dev/null 2>&1 || fail "cp is required"
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
  require_file "$previous_app/node_modules/.bin/prisma"
  same_filesystem "$payload_dir/dist-server" "$APP_RELEASES_ROOT"
  same_filesystem "$payload_dir/node_modules/optimist" "$APP_RELEASES_ROOT"
  same_filesystem "$payload_dir/node_modules/poplib" "$APP_RELEASES_ROOT"
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

migrate_legacy_frontend() {
  local legacy_backup="$FRONTEND_RELEASES_ROOT/current-backup-$release_id"

  [[ -L "$WEB_ROOT/current" ]] && return 0
  [[ -d "$WEB_ROOT/current" ]] || fail "legacy frontend current directory is missing"
  [[ ! -e "$legacy_backup" ]] || fail "legacy frontend backup already exists: $legacy_backup"
  safe_path "$legacy_backup" "$FRONTEND_RELEASES_ROOT"
  same_filesystem "$WEB_ROOT/current" "$FRONTEND_RELEASES_ROOT"

  mv "$WEB_ROOT/current" "$legacy_backup"
  if ! ln -s "$legacy_backup" "$WEB_ROOT/current"; then
    mv "$legacy_backup" "$WEB_ROOT/current"
    fail "failed to convert legacy frontend current directory to a symbolic link"
  fi
  previous_frontend="$legacy_backup"
}

stop_api() {
  pm2 stop qianfu-api
}

start_api() {
  local current_app
  current_app="$(readlink -f "$APP_CURRENT_LINK")"
  require_dir "$current_app"
  require_file "$current_app/ecosystem.config.cjs"
  pm2 delete qianfu-api >/dev/null 2>&1 || true
  (
    cd "$current_app"
    APP_NAME=qianfu-api NODE_ENV=production QIANFU_API_PORT="$API_PORT" \
      pm2 start ecosystem.config.cjs --only qianfu-api --update-env
  )
  pm2 save
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
  for ((attempt = 1; attempt <= API_STARTUP_TIMEOUT_SECONDS; attempt++)); do
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

apply_personal_filing_env() {
  local env_file="$1"
  local tmp_file="${env_file}.personal-filing-$release_id"

  awk '
    BEGIN {
      values["PERSONAL_FILING_MODE"] = "true"
      values["QIANFU_ENABLED"] = "false"
      values["PAYPRO_ENABLED"] = "false"
      values["DEFAULT_PAYMENT_UPSTREAM_PROVIDER"] = ""
      values["DEFAULT_PAYMENT_BACKUP_PROVIDER"] = ""
      values["PAY_DOMAIN_HOST"] = ""
      values["VITE_ALLOWED_PAYMENT_REDIRECT_HOSTS"] = ""
      values["TRUSTED_REDIRECT_HOSTS"] = ""
    }
    /^[[:space:]]*#/ || $0 !~ /^[A-Za-z_][A-Za-z0-9_]*=/ { print; next }
    {
      key = $0
      sub(/=.*/, "", key)
      if (key in values) {
        print key "=" values[key]
        seen[key] = 1
        next
      }
      print
    }
    END {
      for (key in values) {
        if (!seen[key]) print key "=" values[key]
      }
    }
  ' "$env_file" > "$tmp_file"
  mv -f "$tmp_file" "$env_file"
}

prepare_next_app() {
  cp -al "$previous_app/." "$next_app"
  cp -p "$previous_app/.env" "$next_app/.env.next-$release_id"
  mv -f "$next_app/.env.next-$release_id" "$next_app/.env"
  apply_personal_filing_env "$next_app/.env"
  require_dir "$next_app/scripts/linux"
  # Break hard links before replacing release-local operational scripts.
  rm -f "$next_app/scripts/linux/publish-baota-release.sh"
  rm -f "$next_app/scripts/linux/snapshot-baota-release.sh"
  rm -f "$next_app/scripts/linux/optimize-prod-disk.sh"
  cp -p "$stage_dir/scripts/linux/publish-baota-release.sh" "$next_app/scripts/linux/publish-baota-release.sh"
  cp -p "$stage_dir/scripts/linux/snapshot-baota-release.sh" "$next_app/scripts/linux/snapshot-baota-release.sh"
  cp -p "$stage_dir/scripts/linux/optimize-prod-disk.sh" "$next_app/scripts/linux/optimize-prod-disk.sh"
  rm -rf "$next_app/dist-server" "$next_app/packages/shared/dist" "$next_app/prisma/migrations"
  rm -rf "$next_app/node_modules/@aws-sdk/s3-request-presigner"
  rm -rf "$next_app/node_modules/optimist"
  rm -rf "$next_app/node_modules/poplib"
  mv "$payload_dir/dist-server" "$next_app/dist-server"
  mv "$payload_dir/packages/shared/dist" "$next_app/packages/shared/dist"
  mkdir -p "$next_app/node_modules/@aws-sdk"
  mv "$payload_dir/node_modules/@aws-sdk/s3-request-presigner" "$next_app/node_modules/@aws-sdk/s3-request-presigner"
  mv "$payload_dir/node_modules/optimist" "$next_app/node_modules/optimist"
  mv "$payload_dir/node_modules/poplib" "$next_app/node_modules/poplib"
  mv "$payload_dir/prisma/migrations" "$next_app/prisma/migrations"
  mv "$payload_dir/prisma/schema.prisma" "$next_app/prisma/schema.prisma"
  mv "$payload_dir/prisma/schema.postgresql.prisma" "$next_app/prisma/schema.postgresql.prisma"
}

read_database_url() {
  local env_file="$1"
  awk -F= '$1 == "DATABASE_URL" { sub(/^[^=]*=/, ""); gsub(/^"|"$/, ""); print; exit }' "$env_file"
}

normalize_postgres_url() {
  local database_url="$1"
  DATABASE_URL="$database_url" node <<'NODE'
const url = new URL(process.env.DATABASE_URL || '');
for (const key of ['schema', 'connection_limit', 'pool_timeout', 'statement_timeout', 'idle_in_transaction_session_timeout']) {
  url.searchParams.delete(key);
}
process.stdout.write(url.toString());
NODE
}

run_migrations() {
  local database_url postgres_url migration_state repair_migration_relative repair_migration
  require_file "$next_app/prisma/schema.postgresql.prisma"
  for repair_migration_relative in "${POSTGRES_REPAIR_MIGRATIONS[@]}"; do
    require_file "$next_app/$repair_migration_relative"
  done
  command -v node >/dev/null 2>&1 || fail "node is required for PostgreSQL URL normalization"
  command -v psql >/dev/null 2>&1 || fail "psql is required for PostgreSQL migrations"

  database_url="$(read_database_url "$next_app/.env")"
  [[ "$database_url" =~ ^(postgres|postgresql):// ]] || fail "DATABASE_URL must use PostgreSQL for this release"
  postgres_url="$(normalize_postgres_url "$database_url")"
  migration_state="$(psql "$postgres_url" -Atqc 'select coalesce(to_regclass($$public."_prisma_migrations"$$)::text, $$missing$$);')"

  if [[ "$migration_state" == "_prisma_migrations" ]]; then
    mkdir -p "$migration_runner"
    cp "$next_app/prisma/schema.postgresql.prisma" "$migration_runner/schema.postgresql.prisma"
    cp -a "$next_app/prisma/migrations" "$migration_runner/migrations"
    require_file "$next_app/node_modules/.bin/prisma"
    (
      cd "$next_app"
      "$next_app/node_modules/.bin/prisma" migrate deploy --schema "$migration_runner/schema.postgresql.prisma"
    )
    rm -rf "$migration_runner"
    return 0
  fi

  info "PostgreSQL migration history is unmanaged; applying PostgreSQL repair migrations"
  for repair_migration_relative in "${POSTGRES_REPAIR_MIGRATIONS[@]}"; do
    repair_migration="$next_app/$repair_migration_relative"
    psql "$postgres_url" -v ON_ERROR_STOP=1 -f "$repair_migration"
  done
}

publish() {
  mkdir -p "$ROLLBACK_ROOT"
  [[ ! -e "$rollback_dir" ]] || fail "rollback directory already exists: $rollback_dir"
  mkdir -p "$rollback_dir"
  printf '%s\n' "$previous_app" > "$rollback_dir/app-target"

  bash "$stage_dir/scripts/linux/snapshot-baota-release.sh" --release "$release_id"

  migrate_legacy_frontend
  printf '%s\n' "$previous_frontend" > "$rollback_dir/frontend-target"
  prepare_next_app
  stop_api
  run_migrations
  migrate_legacy_frontend
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
