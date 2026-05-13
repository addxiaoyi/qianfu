#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

log() { echo "[INFO] $*"; }
ok() { echo "[OK]   $*"; }
warn() { echo "[WARN] $*"; }
fail() { echo "[FAIL] $*"; exit 1; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "missing command: $1"
}

check_port_free() {
  local port="$1"
  if ss -lnt "( sport = :$port )" 2>/dev/null | grep -q ":$port"; then
    return 1
  fi
  return 0
}

log "Checking required commands..."
require_cmd docker
docker compose version >/dev/null 2>&1 || fail "docker compose plugin not found"
ok "Docker + Compose detected"

if [[ ! -f docker-compose.offline.yml ]]; then
  fail "docker-compose.offline.yml not found in current package"
fi
if [[ ! -d images ]]; then
  fail "images/ directory not found"
fi

if [[ ! -f .env.offline ]]; then
  if [[ -f .env.offline.example ]]; then
    cp .env.offline.example .env.offline
  else
    fail ".env.offline.example not found"
  fi
fi

echo
echo "==== Offline Install Wizard ===="
read -r -p "MySQL root password [xpay_root_123]: " MYSQL_ROOT_PASSWORD
read -r -p "JWT secret [replace-with-32-char-secret-1234567890]: " JWT_SECRET
read -r -p "Admin token [replace-admin-token-123456]: " ADMIN_TOKEN
read -r -p "XPay token [replace-xpay-sign-token-123456]: " XPAY_TOKEN

MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-xpay_root_123}"
JWT_SECRET="${JWT_SECRET:-replace-with-32-char-secret-1234567890}"
ADMIN_TOKEN="${ADMIN_TOKEN:-replace-admin-token-123456}"
XPAY_TOKEN="${XPAY_TOKEN:-replace-xpay-sign-token-123456}"

sed -i "s|^MYSQL_ROOT_PASSWORD=.*|MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD}|g" .env.offline
sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET}|g" .env.offline
sed -i "s|^ADMIN_TOKEN=.*|ADMIN_TOKEN=${ADMIN_TOKEN}|g" .env.offline
sed -i "s|^XPAY_TOKEN=.*|XPAY_TOKEN=${XPAY_TOKEN}|g" .env.offline
ok "Secrets updated in .env.offline"

for p in 80 443 3001 3306 6379 8888; do
  if ! check_port_free "$p"; then
    warn "Port $p appears in use; compose may fail to bind"
  fi
done

log "Loading offline images..."
for img in images/*.tar; do
  echo " - $img"
  docker load -i "$img" >/dev/null
done
ok "All images loaded"

log "Starting stack..."
docker compose --env-file .env.offline -f docker-compose.offline.yml up -d
ok "Stack started"

log "Running acceptance verification..."
sleep 10
if [[ -x scripts/linux/verify-offline-stack.sh ]]; then
  if bash scripts/linux/verify-offline-stack.sh reports; then
    ok "Acceptance verification passed"
  else
    warn "Acceptance verification failed, collecting diagnostics..."
    if [[ -x scripts/linux/collect-diagnostics.sh ]]; then
      bash scripts/linux/collect-diagnostics.sh diagnostics || true
      warn "Diagnostics collected under diagnostics/"
    fi
  fi
else
  warn "verify-offline-stack.sh not found, skipping verification"
fi

echo
ok "Offline installation completed"
echo "Web:      http://127.0.0.1/"
echo "Backend:  http://127.0.0.1:3001/api/health"
echo "xpay:     http://127.0.0.1:8888/starmc/pay"
