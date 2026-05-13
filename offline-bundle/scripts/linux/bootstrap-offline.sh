#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

echo "[STEP] Checking Docker..."
if ! command -v docker >/dev/null 2>&1; then
  echo "[FAIL] docker not found."
  exit 1
fi
if ! docker compose version >/dev/null 2>&1; then
  echo "[FAIL] docker compose plugin not found."
  exit 1
fi

if [[ ! -d images ]]; then
  echo "[FAIL] images directory not found. Put offline image tar files in ./images"
  exit 1
fi

if [[ ! -f .env.offline ]]; then
  if [[ -f .env.offline.example ]]; then
    cp .env.offline.example .env.offline
  elif [[ -f .env.fullstack.example ]]; then
    cp .env.fullstack.example .env.offline
  fi
  echo "[WARN] Generated .env.offline template. Please adjust secrets as needed."
fi

echo "[STEP] Loading Docker images..."
for img in images/*.tar; do
  echo " - loading $img"
  docker load -i "$img" >/dev/null
done

echo "[STEP] Starting offline stack..."
docker compose --env-file .env.offline -f docker-compose.offline.yml up -d

echo "[STEP] Basic health probes..."
sleep 8
curl -fsS http://127.0.0.1:3001/api/health >/dev/null && echo "[OK] backend ready" || echo "[WARN] backend not ready yet"
curl -fsS http://127.0.0.1:8888/actuator/health >/dev/null && echo "[OK] xpay ready" || echo "[WARN] xpay not ready yet"
curl -fsS http://127.0.0.1/ >/dev/null && echo "[OK] web ready" || echo "[WARN] web not ready yet"

echo "[DONE] Offline stack bootstrap complete."
