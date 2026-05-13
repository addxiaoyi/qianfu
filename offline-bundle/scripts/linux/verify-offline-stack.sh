#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

REPORT_DIR="${1:-reports}"
mkdir -p "$REPORT_DIR"

TS="$(date +%Y%m%d_%H%M%S)"
JSON_FILE="$REPORT_DIR/offline-acceptance-$TS.json"
HTML_FILE="$REPORT_DIR/offline-acceptance-$TS.html"

check_url() {
  local name="$1"
  local url="$2"
  local code
  code="$(curl -m 8 -s -o /dev/null -w "%{http_code}" "$url" || true)"
  if [[ "$code" =~ ^2|3 ]]; then
    echo "{\"name\":\"$name\",\"url\":\"$url\",\"ok\":true,\"status\":$code}"
  else
    if [[ -z "$code" ]]; then code=0; fi
    echo "{\"name\":\"$name\",\"url\":\"$url\",\"ok\":false,\"status\":$code}"
  fi
}

BACKEND="$(check_url "backend_health" "http://127.0.0.1:3001/api/health")"
XPAY="$(check_url "xpay_health" "http://127.0.0.1:8888/actuator/health")"
WEB="$(check_url "web_home" "http://127.0.0.1/")"

OVERALL="true"
echo "$BACKEND" | grep -q '"ok":false' && OVERALL="false"
echo "$XPAY" | grep -q '"ok":false' && OVERALL="false"
echo "$WEB" | grep -q '"ok":false' && OVERALL="false"

cat > "$JSON_FILE" <<EOF
{
  "generatedAt": "$(date -Iseconds)",
  "overallPass": $OVERALL,
  "checks": [
    $BACKEND,
    $XPAY,
    $WEB
  ]
}
EOF

cat > "$HTML_FILE" <<EOF
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Offline Acceptance Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; background: #f7f8fa; color: #111; }
    .ok { color: #117a37; }
    .fail { color: #b42318; }
    .card { background: white; border-radius: 10px; padding: 16px; margin-bottom: 12px; box-shadow: 0 1px 2px rgba(0,0,0,.08); }
    code { background: #f0f2f5; padding: 2px 6px; border-radius: 6px; }
  </style>
</head>
<body>
  <h1>Offline Acceptance Report</h1>
  <p>Generated at: <code>$(date -Iseconds)</code></p>
  <h2 class="$( [[ "$OVERALL" == "true" ]] && echo ok || echo fail )">
    Overall: $( [[ "$OVERALL" == "true" ]] && echo PASS || echo FAIL )
  </h2>
  <div class="card">
    <h3>Backend</h3>
    <p>URL: <code>http://127.0.0.1:3001/api/health</code></p>
    <p>Status: <strong>$(echo "$BACKEND" | sed -n 's/.*"status":\([0-9]*\).*/\1/p')</strong></p>
  </div>
  <div class="card">
    <h3>xpay</h3>
    <p>URL: <code>http://127.0.0.1:8888/actuator/health</code></p>
    <p>Status: <strong>$(echo "$XPAY" | sed -n 's/.*"status":\([0-9]*\).*/\1/p')</strong></p>
  </div>
  <div class="card">
    <h3>Web</h3>
    <p>URL: <code>http://127.0.0.1/</code></p>
    <p>Status: <strong>$(echo "$WEB" | sed -n 's/.*"status":\([0-9]*\).*/\1/p')</strong></p>
  </div>
  <p>Raw JSON report: <code>$(basename "$JSON_FILE")</code></p>
</body>
</html>
EOF

echo "[OK] JSON report: $JSON_FILE"
echo "[OK] HTML report: $HTML_FILE"

if [[ "$OVERALL" == "true" ]]; then
  exit 0
fi
exit 1
