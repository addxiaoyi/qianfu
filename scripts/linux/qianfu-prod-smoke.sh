#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${QIANFU_MONITOR_DOMAIN:-mc-u.top}"
STATE="${QIANFU_MONITOR_STATE_DIR:-/var/lib/qianfu-monitor}"
install -d -m 700 "$STATE"

UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/150 Safari/537.36'
base=(--noproxy '*' --resolve "$DOMAIN:443:127.0.0.1" -sS --max-time 20
  -H "User-Agent: $UA"
  -H 'Accept: application/json, text/plain, */*'
  -H "Origin: https://$DOMAIN"
  -H "Referer: https://$DOMAIN/")
failed=()

check() {
  local name="$1" expected="$2" path="$3" marker="${4:-}" body code
  body="$(mktemp)"
  code="$(curl "${base[@]}" -o "$body" -w '%{http_code}' "https://$DOMAIN$path" || true)"
  if [[ "$code" != "$expected" ]] || { [[ -n "$marker" ]] && ! grep -qF "$marker" "$body"; }; then
    failed+=("$name:$code")
  fi
  rm -f "$body"
}

check health 200 /api/health '"status":"healthy"'
check ready 200 /api/ready '"status":"ready"'
check csrf 200 /api/v1/csrf-token '"csrfToken"'
check public_servers 200 /api/v1/public/servers '"success":true'
check server_stats 200 /api/servers/stats '"success":true'
check profile_boundary 401 /api/v1/profile '"code":"UNAUTHORIZED"'
check wallet_boundary 403 /api/v1/wallet/balance 'PERSONAL_FILING_DISABLED'
check github_oauth 302 /api/v1/auth/github/start

if (( ${#failed[@]} )); then
  printf '%s smoke failed: %s\n' "$(date -Is)" "${failed[*]}" > "$STATE/prod-smoke.failed"
  logger -t qianfu-prod-smoke -- "FAILED ${failed[*]}"
  exit 1
fi

rm -f "$STATE/prod-smoke.failed"
printf '%s\n' "$(date +%s)" > "$STATE/prod-smoke.last-success"
printf 'smoke_ok=true checks=8\n'
