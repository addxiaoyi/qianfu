#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

log() { echo "[INFO] $*"; }
warn() { echo "[WARN] $*"; }

stop_by_pid_file() {
  local name="$1"
  local pid_file=".run-${name}.pid"

  if [[ ! -f "$pid_file" ]]; then
    warn "${pid_file} not found, skip ${name}"
    return 0
  fi

  local pid
  pid="$(cat "$pid_file" 2>/dev/null || true)"
  if [[ -z "${pid}" ]]; then
    warn "${pid_file} is empty, removing"
    rm -f "$pid_file"
    return 0
  fi

  if kill -0 "$pid" >/dev/null 2>&1; then
    log "Stopping ${name} (pid=${pid})"
    kill "$pid" || true

    for _ in {1..10}; do
      if kill -0 "$pid" >/dev/null 2>&1; then
        sleep 0.5
      else
        break
      fi
    done

    if kill -0 "$pid" >/dev/null 2>&1; then
      warn "Force killing ${name} (pid=${pid})"
      kill -9 "$pid" || true
    fi
  else
    warn "${name} pid ${pid} not running"
  fi

  rm -f "$pid_file"
}

stop_by_pid_file "web"
stop_by_pid_file "api"
stop_by_pid_file "xpay"

if command -v docker >/dev/null 2>&1 && [[ -f docker-compose.supertokens.yml ]]; then
  log "Stopping SuperTokens docker compose stack"
  docker compose -f docker-compose.supertokens.yml down || warn "Failed to stop supertokens compose stack"
fi

log "Done."
