#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

APP_NAME="${APP_NAME:-qianfu-api}"
NODE_ENV="${NODE_ENV:-production}"
PORT="${PORT:-3000}"
RUN_PREFLIGHT="1"
RUN_PM2="1"
SKIP_MIGRATE="0"

usage() {
  cat <<'EOF'
Usage: bash scripts/linux/deploy-bt-oneclick.sh [options]

Options:
  --skip-preflight     Skip npm run release:preflight
  --skip-pm2           Do not restart/start PM2 process
  --skip-migrate       Skip Prisma migrate deploy
  --app-name <name>    PM2 process name (default: qianfu-api)
  --port <port>        Health check port (default: 3000)
  -h, --help           Show this help

Recommended (Baota):
  1) Upload project to /www/wwwroot/<project>
  2) Configure .env for production
  3) Run this script
  4) Configure Nginx with deploy/nginx/*.conf.example
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-preflight) RUN_PREFLIGHT="0"; shift ;;
    --skip-pm2) RUN_PM2="0"; shift ;;
    --skip-migrate) SKIP_MIGRATE="1"; shift ;;
    --app-name) APP_NAME="$2"; shift 2 ;;
    --port) PORT="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *)
      echo "[FAIL] Unknown option: $1"
      usage
      exit 1
      ;;
  esac
done

log_step() { echo -e "\n[STEP] $1"; }
log_ok() { echo "[OK]   $1"; }
log_warn() { echo "[WARN] $1"; }
log_fail() { echo "[FAIL] $1"; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    log_fail "Missing command: $1"
    exit 1
  }
}

log_step "Checking required commands"
require_cmd node
require_cmd npm
require_cmd npx
require_cmd curl
log_ok "Node toolchain available"

if [[ ! -f ".env" ]]; then
  if [[ -f ".env.example" ]]; then
    cp .env.example .env
    log_warn ".env not found. Copied from .env.example. Please edit secrets before public traffic."
  else
    log_fail ".env and .env.example are both missing"
    exit 1
  fi
fi

log_step "Installing dependencies"
npm ci
log_ok "Dependencies installed"

log_step "Generating Prisma client"
npx prisma generate
log_ok "Prisma client generated"

if [[ "$SKIP_MIGRATE" != "1" ]]; then
  log_step "Running Prisma migrations"
  npx prisma migrate deploy
  log_ok "Prisma migrate deploy completed"
else
  log_warn "Skipped Prisma migrations by flag"
fi

if [[ "$RUN_PREFLIGHT" == "1" ]]; then
  log_step "Running release preflight (smoke + validate + build + env)"
  npm run release:preflight
  log_ok "Release preflight passed"
else
  log_warn "Skipped release preflight by flag"
  log_step "Building server and frontend"
  npm run server:build
  npm run build
  npm run validate:env
  log_ok "Build and env validation completed"
fi

if [[ "$RUN_PM2" == "1" ]]; then
  if command -v pm2 >/dev/null 2>&1; then
    log_step "Restarting service with PM2"
    mkdir -p logs
    if [[ -f "ecosystem.config.cjs" ]]; then
      APP_NAME="$APP_NAME" PORT="$PORT" NODE_ENV="$NODE_ENV" pm2 startOrRestart ecosystem.config.cjs --only "$APP_NAME" --update-env
      log_ok "PM2 ecosystem applied: $APP_NAME"
    elif pm2 describe "$APP_NAME" >/dev/null 2>&1; then
      pm2 restart "$APP_NAME" --update-env
      log_ok "PM2 process restarted: $APP_NAME"
    else
      pm2 start dist-server/server/index.js --name "$APP_NAME" --time
      log_ok "PM2 process started: $APP_NAME"
    fi
    pm2 save >/dev/null 2>&1 || true
  else
    log_warn "PM2 not installed. Start service manually: node dist-server/server/index.js"
  fi
else
  log_warn "Skipped PM2 restart by flag"
fi

log_step "Health check"
HEALTH_OK="0"
for path in "/api/health" "/health"; do
  if curl -fsS "http://127.0.0.1:${PORT}${path}" >/dev/null 2>&1; then
    log_ok "Health endpoint reachable: http://127.0.0.1:${PORT}${path}"
    HEALTH_OK="1"
    break
  fi
done

if [[ "$HEALTH_OK" != "1" ]]; then
  log_warn "Health endpoint not reachable on port ${PORT}. Check reverse proxy / process logs."
fi

cat <<EOF

[DONE] Baota one-click deployment completed.
Next steps:
  1) Configure Nginx using templates in deploy/nginx/
  2) Verify domain routing for /api and /auth
  3) Run smoke check again: npm run smoke:api
EOF
