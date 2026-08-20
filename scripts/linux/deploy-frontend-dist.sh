#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${APP_ROOT:-/www/wwwroot/qianfu-app}"
WEB_ROOT="${WEB_ROOT:-$APP_ROOT/qianfu-liandeng/dist}"
WEB_DOMAIN="${WEB_DOMAIN:-mc-u.top}"
BUILD_BEFORE_DEPLOY="${BUILD_BEFORE_DEPLOY:-1}"
RUN_NGINX_RELOAD="${RUN_NGINX_RELOAD:-1}"
RUN_PUBLIC_VERIFY="${RUN_PUBLIC_VERIFY:-1}"
PUBLIC_FILE_VERIFY="${PUBLIC_FILE_VERIFY:-sample}" # 0 | sample | full
PUBLIC_FILE_SAMPLE="${PUBLIC_FILE_SAMPLE:-80}"
STRICT_PUBLIC_VERIFY="${STRICT_PUBLIC_VERIFY:-1}"
KEEP_BACKUPS="${KEEP_BACKUPS:-3}"
CHOWN_TO="${CHOWN_TO:-}"
DRY_RUN="${DRY_RUN:-0}"
TS="$(date +%Y%m%d-%H%M%S)"
STAGE_ROOT="${STAGE_ROOT:-$APP_ROOT/.deploy/frontend-$TS}"
STAGE_DIST="$STAGE_ROOT/dist"
BACKUP_ROOT="${BACKUP_ROOT:-$(dirname "$WEB_ROOT")/.qianfu-dist-backups}"
BACKUP_DIR="$BACKUP_ROOT/dist-$TS"

usage() {
  cat <<'EOF'
Usage: bash scripts/linux/deploy-frontend-dist.sh [options]

Options:
  --dry-run              Print the release plan without replacing WEB_ROOT
  --skip-build           Use SOURCE_DIST or current qianfu-liandeng/dist instead of building to a staging dir
  --skip-nginx-reload    Do not run nginx -t / systemctl reload nginx
  --skip-public-verify   Do not verify https://WEB_DOMAIN after replacement
  --public-file-full     Verify every public file listed by the dist manifest
  --public-file-sample   Verify a sample of public files listed by the dist manifest (default)
  --public-file-skip     Skip public file content verification
  --web-root <path>      Deployed static root (default: $APP_ROOT/qianfu-liandeng/dist)
  --web-domain <host>    Public host for verification (default: mc-u.top)
  -h, --help             Show help

Environment:
  APP_ROOT=/www/wwwroot/qianfu-app
  WEB_ROOT=$APP_ROOT/qianfu-liandeng/dist
  SOURCE_DIST=<path>             Used with --skip-build
  CHOWN_TO=www:www               Optional ownership after install
  STRICT_PUBLIC_VERIFY=0|1       Fail when public verify reports mismatch (default 1)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN="1"; shift ;;
    --skip-build) BUILD_BEFORE_DEPLOY="0"; shift ;;
    --skip-nginx-reload) RUN_NGINX_RELOAD="0"; shift ;;
    --skip-public-verify) RUN_PUBLIC_VERIFY="0"; shift ;;
    --public-file-full) PUBLIC_FILE_VERIFY="full"; shift ;;
    --public-file-sample) PUBLIC_FILE_VERIFY="sample"; shift ;;
    --public-file-skip) PUBLIC_FILE_VERIFY="0"; shift ;;
    --web-root) WEB_ROOT="$2"; shift 2 ;;
    --web-domain) WEB_DOMAIN="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *)
      echo "[FAIL] Unknown option: $1"
      usage
      exit 1
      ;;
  esac
done

log_step() { printf '\n[STEP] %s\n' "$1"; }
log_ok() { printf '[OK]   %s\n' "$1"; }
log_warn() { printf '[WARN] %s\n' "$1"; }
log_fail() { printf '[FAIL] %s\n' "$1"; exit 1; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || log_fail "Missing command: $1"
}

require_file() {
  local path="$1"
  [[ -f "$path" ]] || log_fail "Missing file: $path"
}

run() {
  if [[ "$DRY_RUN" == "1" ]]; then
    printf '[DRY] '
    printf '%q ' "$@"
    printf '\n'
    return
  fi
  "$@"
}

abs_path() {
  local path="$1"
  if command -v realpath >/dev/null 2>&1; then
    realpath -m "$path"
  else
    (cd "$(dirname "$path")" && printf '%s/%s\n' "$(pwd -P)" "$(basename "$path")")
  fi
}

assert_safe_paths() {
  local app_abs web_abs stage_abs backup_abs
  app_abs="$(abs_path "$APP_ROOT")"
  web_abs="$(abs_path "$WEB_ROOT")"
  stage_abs="$(abs_path "$STAGE_ROOT")"
  backup_abs="$(abs_path "$BACKUP_ROOT")"

  [[ "$web_abs" == "$app_abs/"* ]] || log_fail "WEB_ROOT must stay under APP_ROOT: $web_abs"
  [[ "$stage_abs" == "$app_abs/"* ]] || log_fail "STAGE_ROOT must stay under APP_ROOT: $stage_abs"
  [[ "$backup_abs" == "$app_abs/"* ]] || log_fail "BACKUP_ROOT must stay under APP_ROOT: $backup_abs"
  [[ "$web_abs" != "$app_abs" ]] || log_fail "WEB_ROOT cannot be APP_ROOT"
}

build_to_stage() {
  require_file "$APP_ROOT/package.json"
  require_file "$APP_ROOT/qianfu-liandeng/package.json"

  log_step "Build frontend into staging dist"
  run rm -rf "$STAGE_ROOT"
  run mkdir -p "$STAGE_ROOT"
  if [[ "$DRY_RUN" == "1" ]]; then
    run npm --prefix "$APP_ROOT/qianfu-liandeng" run build -- --outDir "$STAGE_DIST"
  else
    (
      cd "$APP_ROOT"
      npm --prefix qianfu-liandeng run build -- --outDir "$STAGE_DIST"
      node scripts/generate-frontend-compression.mjs "$STAGE_DIST" --quiet
      node scripts/frontend-dist-manifest.mjs --dist "$STAGE_DIST" --kv
    )
  fi
}

copy_source_to_stage() {
  local source_dist="${SOURCE_DIST:-$APP_ROOT/qianfu-liandeng/dist}"
  require_file "$source_dist/index.html"

  log_step "Copy existing dist into staging"
  run rm -rf "$STAGE_ROOT"
  run mkdir -p "$STAGE_DIST"
  if command -v rsync >/dev/null 2>&1; then
    run rsync -a --delete "$source_dist/" "$STAGE_DIST/"
  else
    run cp -a "$source_dist/." "$STAGE_DIST/"
  fi
  if [[ "$DRY_RUN" != "1" ]]; then
    (
      cd "$APP_ROOT"
      node scripts/generate-frontend-compression.mjs "$STAGE_DIST" --quiet
      node scripts/frontend-dist-manifest.mjs --dist "$STAGE_DIST" --kv
    )
  fi
}

validate_stage() {
  log_step "Validate staged frontend dist"
  if [[ "$DRY_RUN" == "1" ]]; then
    log_warn "Dry-run mode: staged dist validation is informational only"
    run test -f "$STAGE_DIST/index.html"
    run test -f "$STAGE_DIST/qianfu-dist-manifest.json"
    return
  fi
  require_file "$STAGE_DIST/index.html"
  require_file "$STAGE_DIST/qianfu-dist-manifest.json"
  node "$APP_ROOT/scripts/frontend-dist-manifest.mjs" --dist "$STAGE_DIST" --kv
  log_ok "Staged dist is ready: $STAGE_DIST"
}

install_stage() {
  log_step "Atomically replace WEB_ROOT"
  run mkdir -p "$(dirname "$WEB_ROOT")" "$BACKUP_ROOT"

  if [[ -e "$WEB_ROOT" ]]; then
    run mv "$WEB_ROOT" "$BACKUP_DIR"
    log_ok "Previous WEB_ROOT moved to $BACKUP_DIR"
  fi

  run mv "$STAGE_DIST" "$WEB_ROOT"
  run rmdir "$STAGE_ROOT" 2>/dev/null || true

  if [[ -n "$CHOWN_TO" ]]; then
    run chown -R "$CHOWN_TO" "$WEB_ROOT"
  fi

  log_ok "Installed frontend dist at $WEB_ROOT"
}

reload_nginx() {
  if [[ "$RUN_NGINX_RELOAD" != "1" ]]; then
    log_warn "Skipping nginx reload by flag"
    return
  fi

  if ! command -v nginx >/dev/null 2>&1; then
    log_warn "nginx command not found; skipping reload"
    return
  fi

  log_step "Validate and reload nginx"
  run nginx -t
  if command -v systemctl >/dev/null 2>&1; then
    run systemctl reload nginx
  else
    run nginx -s reload
  fi
  log_ok "Nginx reload complete"
}

verify_public() {
  if [[ "$RUN_PUBLIC_VERIFY" != "1" ]]; then
    log_warn "Skipping public frontend verification by flag"
    return
  fi

  if [[ "$DRY_RUN" == "1" ]]; then
    log_warn "Skipping public verification in dry-run mode"
    return
  fi

  local base="https://${WEB_DOMAIN}"
  local manifest_output file_output probe_status manifest_status files_status

  log_step "Verify public manifest"
  set +e
  manifest_output="$(cd "$APP_ROOT" && node scripts/frontend-dist-manifest.mjs --dist "$WEB_ROOT" --check-remote "$base" --kv)"
  manifest_status=$?
  set -e
  printf '%s\n' "$manifest_output" | sed 's/^/[MANIFEST] /'

  if [[ "$manifest_status" -ne 0 && "$STRICT_PUBLIC_VERIFY" == "1" ]]; then
    log_fail "Public manifest verification failed for $base"
  elif [[ "$manifest_status" -ne 0 ]]; then
    log_warn "Public manifest verification failed for $base"
  fi

  if [[ "$PUBLIC_FILE_VERIFY" != "0" ]]; then
    log_step "Verify public files"
    local file_args=(scripts/frontend-dist-manifest.mjs --dist "$WEB_ROOT" --verify-remote-files "$base" --kv)
    if [[ "$PUBLIC_FILE_VERIFY" == "sample" ]]; then
      file_args+=(--max-files "$PUBLIC_FILE_SAMPLE" --allow-partial)
    fi

    set +e
    file_output="$(cd "$APP_ROOT" && node "${file_args[@]}")"
    files_status=$?
    set -e
    printf '%s\n' "$file_output" | sed 's/^/[FILES] /'

    if [[ "$files_status" -ne 0 && "$STRICT_PUBLIC_VERIFY" == "1" ]]; then
      log_fail "Public file verification failed for $base"
    elif [[ "$files_status" -ne 0 ]]; then
      log_warn "Public file verification failed for $base"
    fi
  fi

  log_step "Verify entrypoint freshness"
  set +e
  (
    cd "$APP_ROOT"
    QIANFU_BASE_URL="$base" npm run --silent prod:verify:frontend:report
  )
  probe_status=$?
  set -e
  if [[ "$probe_status" -ne 0 && "$STRICT_PUBLIC_VERIFY" == "1" ]]; then
    log_fail "Public entrypoint verification failed for $base"
  elif [[ "$probe_status" -ne 0 ]]; then
    log_warn "Public entrypoint verification failed for $base"
  else
    log_ok "Public frontend verification passed for $base"
  fi
}

cleanup_old_backups() {
  if [[ "$KEEP_BACKUPS" == "0" || "$DRY_RUN" == "1" || ! -d "$BACKUP_ROOT" ]]; then
    return
  fi

  log_step "Prune old frontend dist backups"
  find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -name 'dist-*' \
    | sort -r \
    | awk -v keep="$KEEP_BACKUPS" 'NR > keep { print }' \
    | while IFS= read -r old_backup; do
        rm -rf "$old_backup"
      done
  log_ok "Kept latest $KEEP_BACKUPS frontend backup(s)"
}

require_cmd node
require_cmd npm
assert_safe_paths

if [[ "$BUILD_BEFORE_DEPLOY" == "1" ]]; then
  build_to_stage
else
  copy_source_to_stage
fi

validate_stage
install_stage
reload_nginx
verify_public
cleanup_old_backups

cat <<EOF

[DONE] Frontend dist deployment finished.
WEB_ROOT:
  $WEB_ROOT
Backup:
  $BACKUP_DIR
Public host:
  https://$WEB_DOMAIN
EOF
