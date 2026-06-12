#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

BACKUP_CRON="0 3 * * *"
DEPLOY_CRON="*/15 * * * *"
STRICT_PUBLIC_SMOKE="0"

usage() {
  cat <<'EOF'
Usage: bash scripts/linux/setup-bt-cron.sh [options]

Options:
  --backup-cron "expr"   Cron expression for DB backup task (default: 0 3 * * *)
  --deploy-cron "expr"   Cron expression for lightweight auto deploy task (default: */15 * * * *)
  --strict-public-smoke  Append --strict-public-smoke to the deploy task
  -h, --help              Show help

What it writes:
  1) Daily backup: npm run server:build && node dist-server/server/scripts/backupDb.js
  2) Auto deploy check: bash scripts/linux/deploy-bt-oneclick.sh --skip-preflight

You can paste resulting lines into Baota planned tasks (Shell Script type).
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --backup-cron) BACKUP_CRON="$2"; shift 2 ;;
    --deploy-cron) DEPLOY_CRON="$2"; shift 2 ;;
    --strict-public-smoke) STRICT_PUBLIC_SMOKE="1"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1"; usage; exit 1 ;;
  esac
done

BACKUP_CMD="cd $ROOT_DIR && npm run server:build && node dist-server/server/scripts/backupDb.js"
DEPLOY_CMD="cd $ROOT_DIR && bash scripts/linux/deploy-bt-oneclick.sh --skip-preflight"
if [[ "$STRICT_PUBLIC_SMOKE" == "1" ]]; then
  DEPLOY_CMD+=" --strict-public-smoke"
fi

echo "=== Baota Cron Suggestions ==="
echo "[Backup] $BACKUP_CRON $BACKUP_CMD"
echo "[Deploy] $DEPLOY_CRON $DEPLOY_CMD"
echo
echo "Tip: create two planned tasks in Baota (Shell script), copy commands above."
if [[ "$STRICT_PUBLIC_SMOKE" == "1" ]]; then
  echo "Tip: strict public smoke requires PUBLIC_SMOKE_BASE_URL or a public API_PUBLIC_URL/FRONTEND_URL in .env."
  echo "Tip: if you also serve pay.star-web.top, set PAY_DOMAIN_HOST or XPAY_PUBLIC_URL so the cron deploy can probe the pay certificate and root marker."
fi
