#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

OUT_DIR="${1:-diagnostics}"
TS="$(date +%Y%m%d_%H%M%S)"
WORK_DIR="$OUT_DIR/qianfu-diagnostics-$TS"
mkdir -p "$WORK_DIR"

echo "[STEP] Collecting compose status..."
docker compose --env-file .env.offline -f docker-compose.offline.yml ps > "$WORK_DIR/compose-ps.txt" 2>&1 || true
docker compose --env-file .env.offline -f docker-compose.offline.yml config > "$WORK_DIR/compose-config.txt" 2>&1 || true

echo "[STEP] Collecting logs..."
docker compose --env-file .env.offline -f docker-compose.offline.yml logs --tail=300 > "$WORK_DIR/compose-logs.txt" 2>&1 || true

echo "[STEP] Collecting inspect data..."
for c in qianfu-mysql qianfu-redis qianfu-xpay qianfu-app qianfu-nginx; do
  docker inspect "$c" > "$WORK_DIR/inspect-$c.json" 2>/dev/null || true
done

echo "[STEP] Collecting host info..."
uname -a > "$WORK_DIR/uname.txt" 2>&1 || true
docker version > "$WORK_DIR/docker-version.txt" 2>&1 || true
docker images > "$WORK_DIR/docker-images.txt" 2>&1 || true
df -h > "$WORK_DIR/disk-usage.txt" 2>&1 || true

ARCHIVE="$OUT_DIR/qianfu-diagnostics-$TS.tar.gz"
tar -czf "$ARCHIVE" -C "$OUT_DIR" "qianfu-diagnostics-$TS"

echo "[DONE] Diagnostics archive created: $ARCHIVE"
