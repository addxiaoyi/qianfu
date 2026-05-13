#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

DRY_RUN="false"
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN="true" ;;
  esac
done

log() { echo "[INFO] $*"; }
warn() { echo "[WARN] $*"; }
fail() { echo "[FAIL] $*"; exit 1; }

BASE_WEB_PORT="${PORT_WEB:-4123}"
BASE_API_PORT="${PORT_API:-3000}"
BASE_SUPERTOKENS_PORT="${PORT_SUPERTOKENS:-3567}"
BASE_XPAY_PORT="${PORT_XPAY:-8888}"
BASE_PREVIEW_PORT="${PORT_PREVIEW:-4124}"

is_listening() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -ltn | awk '{print $4}' | grep -qE "[:.]${port}$"
  elif command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1
  else
    return 1
  fi
}

pick_port() {
  local start="$1"
  local port="$start"
  while is_listening "$port"; do
    port=$((port + 1))
  done
  echo "$port"
}

ensure_node_deps() {
  if [[ ! -d node_modules ]]; then
    log "node_modules missing, running npm install"
    if [[ "$DRY_RUN" == "true" ]]; then
      log "[dry-run] npm install"
    else
      npm install
    fi
  else
    log "node_modules exists, skipping npm install"
  fi
}

check_command() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    fail "$cmd not found"
  fi
}

ensure_env_file() {
  if [[ ! -f .env.local ]]; then
    if [[ -f .env.example ]]; then
      if [[ "$DRY_RUN" == "true" ]]; then
        log "[dry-run] cp .env.example .env.local"
      else
        cp .env.example .env.local
      fi
      log "Created .env.local from .env.example"
    elif [[ -f .env ]]; then
      if [[ "$DRY_RUN" == "true" ]]; then
        log "[dry-run] cp .env .env.local"
      else
        cp .env .env.local
      fi
      log "Created .env.local from .env"
    else
      fail "No .env.example or .env found to bootstrap .env.local"
    fi
  fi
}

write_autogen_env() {
  local api_port="$1"
  local web_port="$2"
  local st_port="$3"
  local xpay_port="$4"
  local preview_port="$5"

  if [[ "$DRY_RUN" == "true" ]]; then
    log "[dry-run] write .env.local.auto"
    return 0
  fi

  cat > .env.local.auto <<EOF
PORT=${api_port}
FRONTEND_URL=http://127.0.0.1:${web_port}
API_PUBLIC_URL=http://127.0.0.1:${api_port}
VITE_BACKEND_URL=http://127.0.0.1:${api_port}
VITE_SUPERTOKENS_API_DOMAIN=http://127.0.0.1:${api_port}
SUPERTOKENS_CONNECTION_URI=http://127.0.0.1:${st_port}
QIANFU_API_URL=http://127.0.0.1:${xpay_port}/qianfu-api
QIANFU_CALLBACK_URL=http://127.0.0.1:${api_port}/api/qianfu/xpay/notify
VITE_PORT=${web_port}
VITE_PREVIEW_PORT=${preview_port}
VITE_USE_POLLING=1
NODE_ENV=development
EOF

  log "Generated .env.local.auto"
}

start_background() {
  local name="$1"
  shift
  local logfile=".run-${name}.log"
  log "Starting ${name}: $*"
  if [[ "$DRY_RUN" == "true" ]]; then
    log "[dry-run] nohup $* > $logfile"
    return 0
  fi
  nohup "$@" >"$logfile" 2>&1 &
  echo $! > ".run-${name}.pid"
}

wait_http() {
  local url="$1"
  local name="$2"
  local timeout_seconds="${3:-120}"
  local elapsed=0
  until curl -fsS "$url" >/dev/null 2>&1; do
    sleep 2
    elapsed=$((elapsed + 2))
    if (( elapsed >= timeout_seconds )); then
      warn "Timed out waiting for ${name} at ${url}"
      return 1
    fi
  done
  log "${name} is up at ${url}"
}

check_command npm
check_command npx
check_command curl
if command -v docker >/dev/null 2>&1; then
  log "docker found"
else
  warn "docker not found; SuperTokens compose auto-start will be skipped"
fi
if command -v java >/dev/null 2>&1; then
  log "java found"
else
  warn "java not found; direct xpay auto-start may be skipped"
fi

ensure_node_deps
ensure_env_file

WEB_PORT="$(pick_port "$BASE_WEB_PORT")"
API_PORT="$(pick_port "$BASE_API_PORT")"
SUPERTOKENS_PORT="$(pick_port "$BASE_SUPERTOKENS_PORT")"
XPAY_PORT="$(pick_port "$BASE_XPAY_PORT")"
PREVIEW_PORT="$(pick_port "$BASE_PREVIEW_PORT")"

write_autogen_env "$API_PORT" "$WEB_PORT" "$SUPERTOKENS_PORT" "$XPAY_PORT" "$PREVIEW_PORT"

log "Ports selected: web=${WEB_PORT}, api=${API_PORT}, supertokens=${SUPERTOKENS_PORT}, xpay=${XPAY_PORT}, preview=${PREVIEW_PORT}"

export PORT="$API_PORT"
export FRONTEND_URL="http://127.0.0.1:${WEB_PORT}"
export API_PUBLIC_URL="http://127.0.0.1:${API_PORT}"
export VITE_BACKEND_URL="http://127.0.0.1:${API_PORT}"
export VITE_SUPERTOKENS_API_DOMAIN="http://127.0.0.1:${API_PORT}"
export SUPERTOKENS_CONNECTION_URI="http://127.0.0.1:${SUPERTOKENS_PORT}"
export QIANFU_API_URL="http://127.0.0.1:${XPAY_PORT}/qianfu-api"
export QIANFU_CALLBACK_URL="http://127.0.0.1:${API_PORT}/api/qianfu/xpay/notify"
export VITE_PORT="$WEB_PORT"
export VITE_PREVIEW_PORT="$PREVIEW_PORT"
export VITE_USE_POLLING=1

log "Preparing Prisma"
npx prisma generate
npx prisma migrate deploy

if command -v docker >/dev/null 2>&1; then
  log "Attempting to start SuperTokens core via docker compose"
  if [[ -f docker-compose.supertokens.yml ]]; then
    if [[ "$DRY_RUN" == "true" ]]; then
      log "[dry-run] docker compose -f docker-compose.supertokens.yml up -d"
    else
      docker compose -f docker-compose.supertokens.yml up -d || warn "Failed to start supertokens compose stack"
    fi
  else
    warn "docker-compose.supertokens.yml not found; skipping SuperTokens core compose start"
  fi
else
  warn "docker not found; skipping SuperTokens core auto-start"
fi

if [[ -d "xpay-3.1_YTM7H/xpay-code" ]]; then
  if [[ -f "xpay-3.1_YTM7H/xpay-code/mvnw" ]]; then
    log "Starting xpay service (Maven wrapper)"
    if [[ "$DRY_RUN" == "true" ]]; then
      log "[dry-run] (cd xpay-3.1_YTM7H/xpay-code && nohup ./mvnw spring-boot:run > ../../.run-xpay.log 2>&1 &)"
    else
      (cd "xpay-3.1_YTM7H/xpay-code" && nohup ./mvnw spring-boot:run > ../../.run-xpay.log 2>&1 & echo $! > ../../.run-xpay.pid)
    fi
  else
    warn "xpay mvnw not found; skipping direct xpay start"
  fi
else
  warn "xpay directory not found; skipping xpay start"
fi

start_background api npm run server
start_background web npm run dev

if [[ "$DRY_RUN" == "true" ]]; then
  log "[dry-run] skip wait for backend/frontend"
else
  wait_http "http://127.0.0.1:${API_PORT}/api/health" "backend"
  wait_http "http://127.0.0.1:${WEB_PORT}" "frontend"
fi

log "Fullstack started successfully."
log "API: http://127.0.0.1:${API_PORT}"
log "Web: http://127.0.0.1:${WEB_PORT}"
log "Autogen env: .env.local.auto"
log "Logs: .run-api.log, .run-web.log"
