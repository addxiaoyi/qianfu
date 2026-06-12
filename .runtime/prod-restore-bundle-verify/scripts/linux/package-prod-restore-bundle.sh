#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${APP_ROOT:-$(pwd)}"
OUT_DIR="${OUT_DIR:-$APP_ROOT/output/prod-restore-bundles}"
TS="$(date +%Y%m%d-%H%M%S)"
BUNDLE_NAME="${BUNDLE_NAME:-qianfu-prod-restore-$TS}"
STAGE_ROOT="${STAGE_ROOT:-$APP_ROOT/.runtime/$BUNDLE_NAME}"
BUNDLE_TAR="$OUT_DIR/$BUNDLE_NAME.tar.gz"
BUNDLE_SHA="$BUNDLE_TAR.sha256"
INCLUDE_FRONTEND_DIST="${INCLUDE_FRONTEND_DIST:-1}"
INCLUDE_DIST_SERVER="${INCLUDE_DIST_SERVER:-0}"
DRY_RUN="${DRY_RUN:-0}"

usage() {
  cat <<'EOF'
Usage: bash scripts/linux/package-prod-restore-bundle.sh [options]

Creates a tar.gz bundle for Baota/manual upload when SSH is unavailable.
The bundle contains the production recovery scripts, nginx templates,
diagnostics, and optionally the current frontend dist.

Options:
  --no-frontend-dist   Do not include qianfu-liandeng/dist
  --include-dist-server Include dist-server in the bundle
  --out-dir <path>     Output directory
  --name <name>        Bundle base name without .tar.gz
  --dry-run            Print the plan without creating a bundle
  -h, --help           Show help

Upload/run on production:
  cd /www/wwwroot/qianfu-app
  tar -xzf /path/to/qianfu-prod-restore-<timestamp>.tar.gz -C /www/wwwroot/qianfu-app
  bash scripts/linux/restore-prod-public.sh --preflight-only
  bash scripts/linux/restore-prod-public.sh --dry-run
  sudo RUN_BUILD_ARTIFACTS=0 bash scripts/linux/restore-prod-public.sh
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-frontend-dist) INCLUDE_FRONTEND_DIST="0"; shift ;;
    --include-dist-server) INCLUDE_DIST_SERVER="1"; shift ;;
    --out-dir) OUT_DIR="$2"; BUNDLE_TAR="$OUT_DIR/$BUNDLE_NAME.tar.gz"; BUNDLE_SHA="$BUNDLE_TAR.sha256"; shift 2 ;;
    --name) BUNDLE_NAME="$2"; STAGE_ROOT="$APP_ROOT/.runtime/$BUNDLE_NAME"; BUNDLE_TAR="$OUT_DIR/$BUNDLE_NAME.tar.gz"; BUNDLE_SHA="$BUNDLE_TAR.sha256"; shift 2 ;;
    --dry-run) DRY_RUN="1"; shift ;;
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

require_file() {
  local path="$1"
  [[ -f "$APP_ROOT/$path" ]] || log_fail "Missing required file: $path"
}

require_dir() {
  local path="$1"
  [[ -d "$APP_ROOT/$path" ]] || log_fail "Missing required directory: $path"
}

copy_path() {
  local path="$1"
  local src="$APP_ROOT/$path"
  local dst="$STAGE_ROOT/$path"

  if [[ "$DRY_RUN" == "1" ]]; then
    printf '[DRY] include %s\n' "$path"
    return
  fi

  mkdir -p "$(dirname "$dst")"
  if [[ -d "$src" ]]; then
    cp -a "$src" "$dst"
  else
    cp -a "$src" "$dst"
  fi
}

write_bundle_readme() {
  local readme="$STAGE_ROOT/README-PROD-RESTORE.txt"
  if [[ "$DRY_RUN" == "1" ]]; then
    return
  fi

  cat > "$readme" <<EOF
Qianfu production restore bundle
Generated: $TS

This bundle is intended for Baota/manual upload when SSH is unavailable.

Install on production:

  cd /www/wwwroot/qianfu-app
  tar -xzf /path/to/$BUNDLE_NAME.tar.gz -C /www/wwwroot/qianfu-app
  bash scripts/linux/restore-prod-public.sh --preflight-only
  bash scripts/linux/restore-prod-public.sh --dry-run
  sudo RUN_BUILD_ARTIFACTS=0 bash scripts/linux/restore-prod-public.sh

Notes:
- RUN_BUILD_ARTIFACTS=0 is recommended when using this bundle because the
  package already includes qianfu-liandeng/dist if INCLUDE_FRONTEND_DIST=1.
- If you want production to rebuild from source instead, omit
  RUN_BUILD_ARTIFACTS=0 and make sure dependencies are installed.
- Final success still requires public checks to pass:
  main API health, frontend bundle/manifest/files, and pay-domain TLS/vhost.
EOF
}

if [[ "$DRY_RUN" != "1" ]]; then
  mkdir -p "$OUT_DIR"
fi

log_step "Validate bundle inputs"
require_file package.json
require_file package-lock.json
require_file qianfu-liandeng/package.json
require_file scripts/linux/restore-prod-public.sh
require_file scripts/linux/package-prod-restore-bundle.sh
require_file scripts/linux/repair-prod-edge.sh
require_file scripts/linux/deploy-frontend-dist.sh
require_file scripts/linux/diagnose-prod-502.sh
require_file scripts/linux/qianfu-prod-healthcheck.sh
require_file scripts/linux/collect-prod-502-evidence.sh
require_file scripts/linux/setup-pay-domain.sh
require_file scripts/diagnose-public-prod.ts
require_file scripts/probe-frontend-deploy.ts
require_file scripts/frontend-dist-manifest.mjs
require_file scripts/run-bash-script.mjs
require_file scripts/utils/domain-cert-probe.mjs
require_file deploy/nginx/mc-u.top.conf.example
require_file deploy/nginx/pay.star-web.top.conf.example
require_file deploy/nginx/qianfu-spa-security-headers.conf.example

if [[ "$INCLUDE_FRONTEND_DIST" == "1" ]]; then
  require_dir qianfu-liandeng/dist
  require_file qianfu-liandeng/dist/index.html
  if [[ ! -f "$APP_ROOT/qianfu-liandeng/dist/qianfu-dist-manifest.json" ]]; then
    if [[ "$DRY_RUN" == "1" ]]; then
      log_warn "qianfu-liandeng/dist/qianfu-dist-manifest.json is missing; dry-run will not generate it"
    else
      log_step "Generate frontend dist manifest"
      (cd "$APP_ROOT" && node scripts/frontend-dist-manifest.mjs --kv)
    fi
  fi
  require_file qianfu-liandeng/dist/qianfu-dist-manifest.json
fi

if [[ "$INCLUDE_DIST_SERVER" == "1" ]]; then
  require_dir dist-server
fi
log_ok "Bundle inputs validated"

log_step "Stage bundle"
if [[ "$DRY_RUN" == "1" ]]; then
  printf '[DRY] stage root: %s\n' "$STAGE_ROOT"
else
  rm -rf "$STAGE_ROOT"
  mkdir -p "$STAGE_ROOT"
fi

copy_path package.json
copy_path package-lock.json
copy_path qianfu-liandeng/package.json
copy_path scripts/linux/restore-prod-public.sh
copy_path scripts/linux/package-prod-restore-bundle.sh
copy_path scripts/linux/repair-prod-edge.sh
copy_path scripts/linux/deploy-frontend-dist.sh
copy_path scripts/linux/diagnose-prod-502.sh
copy_path scripts/linux/qianfu-prod-healthcheck.sh
copy_path scripts/linux/collect-prod-502-evidence.sh
copy_path scripts/linux/setup-pay-domain.sh
copy_path scripts/diagnose-public-prod.ts
copy_path scripts/probe-frontend-deploy.ts
copy_path scripts/frontend-dist-manifest.mjs
copy_path scripts/run-bash-script.mjs
copy_path scripts/utils/domain-cert-probe.mjs
copy_path deploy/nginx/mc-u.top.conf.example
copy_path deploy/nginx/pay.star-web.top.conf.example
copy_path deploy/nginx/qianfu-spa-security-headers.conf.example

if [[ "$INCLUDE_FRONTEND_DIST" == "1" ]]; then
  copy_path qianfu-liandeng/dist
fi

if [[ "$INCLUDE_DIST_SERVER" == "1" ]]; then
  copy_path dist-server
fi

write_bundle_readme
log_ok "Bundle staged"

if [[ "$DRY_RUN" == "1" ]]; then
  cat <<EOF

[DRY] Bundle would be written to:
  $BUNDLE_TAR
EOF
  exit 0
fi

log_step "Create tarball"
tar -C "$STAGE_ROOT" -czf "$BUNDLE_TAR" .

if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$BUNDLE_TAR" > "$BUNDLE_SHA"
elif command -v shasum >/dev/null 2>&1; then
  shasum -a 256 "$BUNDLE_TAR" > "$BUNDLE_SHA"
else
  log_warn "No sha256sum/shasum command found; checksum not written"
fi

log_ok "Created restore bundle"
cat <<EOF
bundle=$BUNDLE_TAR
checksum=$BUNDLE_SHA
include_frontend_dist=$INCLUDE_FRONTEND_DIST
include_dist_server=$INCLUDE_DIST_SERVER
EOF
