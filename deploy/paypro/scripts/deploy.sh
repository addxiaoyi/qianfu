#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
DEPLOY_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
ENV_FILE=${1:-"$DEPLOY_ROOT/.env"}
. "$SCRIPT_DIR/compose.sh"

"$SCRIPT_DIR/verify.sh" "$ENV_FILE"
cd "$DEPLOY_ROOT"

compose --env-file "$ENV_FILE" -f "$DEPLOY_ROOT/docker-compose.yml" build --pull paypro
compose --env-file "$ENV_FILE" -f "$DEPLOY_ROOT/docker-compose.yml" up -d --wait --wait-timeout 240 mysql redis
compose --env-file "$ENV_FILE" -f "$DEPLOY_ROOT/docker-compose.yml" up -d --wait --wait-timeout 240 paypro

HOST_PORT=$(grep -E '^PAYPRO_HOST_PORT=' "$ENV_FILE" | tail -n 1 | cut -d= -f2- || true)
HOST_PORT=${HOST_PORT:-8889}
curl -fsS "http://127.0.0.1:${HOST_PORT}/api/health" | grep -q '"status":"ok"'

echo '[OK] Isolated PayPro stack is healthy.'
echo 'QianFu payment configuration and production releases were not changed.'
