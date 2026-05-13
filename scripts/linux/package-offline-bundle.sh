#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

BUNDLE_DIR="${1:-offline-bundle}"
mkdir -p "$BUNDLE_DIR/images"

echo "[STEP] Building project images..."
docker build -t qianfu-app:offline -f Dockerfile .
docker build -t qianfu-xpay:offline -f xpay-3.1_YTM7H/xpay-code/Dockerfile xpay-3.1_YTM7H/xpay-code

echo "[STEP] Pulling base images for offline use..."
docker pull mysql:8.0
docker pull redis:7-alpine
docker pull nginx:alpine

echo "[STEP] Saving images to tar archives..."
docker save -o "$BUNDLE_DIR/images/qianfu-app-offline.tar" qianfu-app:offline
docker save -o "$BUNDLE_DIR/images/qianfu-xpay-offline.tar" qianfu-xpay:offline
docker save -o "$BUNDLE_DIR/images/mysql-8.0.tar" mysql:8.0
docker save -o "$BUNDLE_DIR/images/redis-7-alpine.tar" redis:7-alpine
docker save -o "$BUNDLE_DIR/images/nginx-alpine.tar" nginx:alpine

echo "[STEP] Copying runtime files..."
cp docker-compose.offline.yml "$BUNDLE_DIR/"
cp .env.fullstack.example "$BUNDLE_DIR/.env.offline.example"
cp nginx.conf "$BUNDLE_DIR/"
cp -r xpay-3.1_YTM7H/xpay-code/sql "$BUNDLE_DIR/sql"
mkdir -p "$BUNDLE_DIR/scripts/linux"
cp scripts/linux/bootstrap-offline.sh "$BUNDLE_DIR/scripts/linux/bootstrap-offline.sh"
cp scripts/linux/verify-offline-stack.sh "$BUNDLE_DIR/scripts/linux/verify-offline-stack.sh"
cp scripts/linux/collect-diagnostics.sh "$BUNDLE_DIR/scripts/linux/collect-diagnostics.sh"
chmod +x "$BUNDLE_DIR/scripts/linux/bootstrap-offline.sh"
chmod +x "$BUNDLE_DIR/scripts/linux/verify-offline-stack.sh"
chmod +x "$BUNDLE_DIR/scripts/linux/collect-diagnostics.sh"

cat > "$BUNDLE_DIR/README-OFFLINE.txt" <<'EOF'
Offline deployment package for QianFu fullstack.

Usage on offline machine:
1) Install Docker + Docker Compose plugin.
2) Extract bundle to any path.
3) cp .env.offline.example .env.offline
4) Load images:
   docker load -i images/qianfu-app-offline.tar
   docker load -i images/qianfu-xpay-offline.tar
   docker load -i images/mysql-8.0.tar
   docker load -i images/redis-7-alpine.tar
   docker load -i images/nginx-alpine.tar
5) Start:
   docker compose --env-file .env.offline -f docker-compose.offline.yml up -d
6) Or run:
   bash scripts/linux/bootstrap-offline.sh
EOF

echo "[DONE] Offline bundle created at: $BUNDLE_DIR"
