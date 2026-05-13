#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROJECT_DIR="$BASE_DIR/project"
REPORT_DIR="$BASE_DIR/manifest"
mkdir -p "$REPORT_DIR"

TS="$(date +%Y%m%d_%H%M%S)"
REPORT_FILE="$REPORT_DIR/portable-verify-$TS.log"

log() {
  echo "$1" | tee -a "$REPORT_FILE"
}

check_port() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -ltn | awk '{print $4}' | grep -qE "[:.]${port}$"
  elif command -v netstat >/dev/null 2>&1; then
    netstat -ltn 2>/dev/null | awk '{print $4}' | grep -qE "[:.]${port}$"
  else
    return 2
  fi
}

check_url() {
  local name="$1"
  local url="$2"
  local code
  code="$(curl -m 8 -s -o /dev/null -w "%{http_code}" "$url" || true)"
  if [[ "$code" =~ ^2|3 ]]; then
    log "[OK]   $name ($url) -> $code"
    return 0
  fi
  log "[FAIL] $name ($url) -> ${code:-0}"
  return 1
}

overall=0

log "[STEP] Portable verification started at $(date -Iseconds)"
log "[STEP] Base directory: $BASE_DIR"

log "[STEP] Checking listening ports"
if check_port 3000; then
  log "[OK]   backend port 3000 is listening"
else
  log "[FAIL] backend port 3000 is not listening"
  overall=1
fi

if check_port 8888; then
  log "[OK]   xpay port 8888 is listening"
else
  log "[FAIL] xpay port 8888 is not listening"
  overall=1
fi

if check_port 3306; then
  log "[OK]   mysql port 3306 is listening"
else
  log "[WARN] mysql port 3306 is not listening (if external DB is used, ignore)"
fi

if check_port 6379; then
  log "[OK]   redis port 6379 is listening"
else
  log "[WARN] redis port 6379 is not listening (if memory fallback is expected, ignore)"
fi

log "[STEP] Checking HTTP endpoints"
check_url "backend health" "http://127.0.0.1:3000/api/health" || overall=1
check_url "xpay pay page" "http://127.0.0.1:8888/starmc/pay" || overall=1
check_url "qianfu health" "http://127.0.0.1:3000/api/qianfu/health" || overall=1

if [[ -f "$PROJECT_DIR/package.json" ]]; then
  log "[STEP] Running npm run local:verify in project"
  set +e
  (
    cd "$PROJECT_DIR"
    npm run local:verify
  ) 2>&1 | tee -a "$REPORT_FILE"
  rc=${PIPESTATUS[0]}
  set -e
  if [[ $rc -eq 0 ]]; then
    log "[OK]   npm run local:verify passed"
  else
    log "[FAIL] npm run local:verify failed (exit=$rc)"
    overall=1
  fi
else
  log "[FAIL] project/package.json not found"
  overall=1
fi

if [[ $overall -eq 0 ]]; then
  log "[OK]   Portable verification PASSED"
  exit 0
else
  log "[FAIL] Portable verification FAILED"
  exit 1
fi

