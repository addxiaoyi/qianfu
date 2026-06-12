#!/usr/bin/env bash
set -euo pipefail
python3 - <<'PY'
from pathlib import Path
path = Path('/www/wwwroot/qianfu-app/.env')
text = path.read_text(encoding='utf-8').replace('\r','')
repl = {
  'FRONTEND_URL': 'http://mc-u.top',
  'API_PUBLIC_URL': 'http://mc-u.top',
  'CORS_ORIGIN': 'http://mc-u.top',
  'XPAY_API_URL': 'http://mc-u.top/xpay/starmc/pay',
  'XPAY_NOTIFY_URL': 'http://mc-u.top/api/v1/payment/xpay/notify',
  'XPAY_GATEWAY_BASE_URL': 'http://mc-u.top/xpay',
  'XPAY_PUBLIC_URL': 'http://mc-u.top/xpay',
  'PAYPRO_NOTIFY_URL': 'http://mc-u.top/api/v1/payment/paypro/notify',
  'HUPIJIAO_NOTIFY_URL': 'http://mc-u.top/api/v1/payment/hupijiao/notify',
}
lines = text.split('\n')
out = []
seen = set()
for line in lines:
    if not line or line.lstrip().startswith('#') or '=' not in line:
        out.append(line)
        continue
    k, v = line.split('=',1)
    key = k.strip()
    if key in repl:
        out.append(f'{key}={repl[key]}')
        seen.add(key)
    else:
        out.append(line)
for key, value in repl.items():
    if key not in seen:
        out.append(f'{key}={value}')
path.write_text('\n'.join(out).rstrip('\n') + '\n', encoding='utf-8')
PY
cd /www/wwwroot/qianfu-app
pm2 restart qianfu-api >/dev/null
pm2 restart qianfu-xpay >/dev/null
sleep 10
NODE_LOGIN=$(python3 -c 'import json; print(json.dumps({"identifier":"dev_local","password":"dev123456"}))' | curl -sS -A 'Mozilla/5.0' -X POST http://127.0.0.1:3001/api/v1/auth/login -H 'Content-Type: application/json' --data @-)
NODE_TOKEN=$(printf '%s' "$NODE_LOGIN" | python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["token"])')
CSRF=$(curl -sS -A 'Mozilla/5.0' -c /tmp/qf-csrf-cookie.txt -b /tmp/qf-csrf-cookie.txt http://127.0.0.1:3001/api/v1/csrf-token)
CSRF_TOKEN=$(printf '%s' "$CSRF" | python3 -c 'import json,sys; data=json.load(sys.stdin); print(data.get("csrfToken") or data.get("data",{}).get("csrfToken") or "")')
PUT_PAYLOAD=$(python3 - <<'PY'
import json
cfg = {
  'displayName': 'QianFu',
  'upstreamProvider': 'xpay',
  'xpayApiUrl': 'http://mc-u.top/xpay/starmc/pay',
  'xpayNotifyUrl': 'http://mc-u.top/api/v1/payment/xpay/notify',
  'xpayGatewayBaseUrl': 'http://mc-u.top/xpay',
  'xpayTenantKey': 'qianfu',
}
print(json.dumps(cfg))
PY
)
printf '%s' "$PUT_PAYLOAD" | curl -sS -A 'Mozilla/5.0' -c /tmp/qf-csrf-cookie.txt -b /tmp/qf-csrf-cookie.txt -X PUT http://127.0.0.1:3001/api/v1/admin/payment-projects/qianfu -H "Authorization: Bearer ${NODE_TOKEN}" -H "x-csrf-token: ${CSRF_TOKEN}" -H 'Content-Type: application/json' --data @-