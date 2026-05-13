#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

echo "[STEP] Checking Docker and Compose..."
if ! command -v docker >/dev/null 2>&1; then
  echo "[FAIL] docker not found. Please install Docker first."
  exit 1
fi
if ! docker compose version >/dev/null 2>&1; then
  echo "[FAIL] docker compose plugin not found."
  exit 1
fi
echo "[OK] Docker environment detected"

if [[ ! -f .env.fullstack ]]; then
  echo "[STEP] .env.fullstack missing, creating from template..."
  cp .env.fullstack.example .env.fullstack
  echo "[WARN] Please edit .env.fullstack secrets after first boot."
fi

echo "[STEP] Building and starting full stack..."
docker compose --env-file .env.fullstack -f docker-compose.fullstack.yml up -d --build

echo "[STEP] Waiting for services..."
sleep 8

check_url() {
  local name="$1"
  local url="$2"
  if curl -fsS "$url" >/dev/null 2>&1; then
    echo "[OK] $name is ready: $url"
  else
    echo "[WARN] $name not ready yet: $url"
  fi
}

check_url "Backend" "http://127.0.0.1:3001/api/health"
check_url "xpay" "http://127.0.0.1:8888/actuator/health"
check_url "Web" "http://127.0.0.1/"

echo
echo "[DONE] Full local stack bootstrapped."
echo "       Web:      http://127.0.0.1/"
echo "       Backend:  http://127.0.0.1:3001/api/health"
echo "       xpay:     http://127.0.0.1:8888/starmc/pay"
