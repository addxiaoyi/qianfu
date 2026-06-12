#!/usr/bin/env bash
set -euo pipefail
NODE_LOGIN=$(python3 -c 'import json; print(json.dumps({"identifier":"dev_local","password":"dev123456"}))' | curl -sS -A 'Mozilla/5.0' -X POST http://127.0.0.1:3001/api/v1/auth/login -H 'Content-Type: application/json' --data @-)
NODE_TOKEN=$(printf '%s' "$NODE_LOGIN" | python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["token"])')
PROJECTS=$(curl -sS -A 'Mozilla/5.0' http://127.0.0.1:3001/api/v1/admin/payment-projects -H "Authorization: Bearer ${NODE_TOKEN}")
PAYLOAD=$(printf '%s' "$PROJECTS" | python3 - <<'PY'
import json, sys
raw = json.load(sys.stdin)
proj = next(p for p in raw['data']['projects'] if p['key'] == 'qianfu')
cfg = proj['config']
cfg['xpayApiUrl'] = 'http://mc-u.top/xpay/starmc/pay'
cfg['xpayNotifyUrl'] = 'http://mc-u.top/api/v1/payment/xpay/notify'
cfg['xpayGatewayBaseUrl'] = 'http://mc-u.top/xpay'
print(json.dumps(cfg))
PY
)
CSRF=$(curl -sS -A 'Mozilla/5.0' -c /tmp/qf-csrf-cookie.txt -b /tmp/qf-csrf-cookie.txt http://127.0.0.1:3001/api/v1/csrf-token)
CSRF_TOKEN=$(printf '%s' "$CSRF" | python3 -c 'import json,sys; data=json.load(sys.stdin); print(data.get("csrfToken") or data.get("data",{}).get("csrfToken") or "")')
printf '%s' "$PAYLOAD" | curl -sS -A 'Mozilla/5.0' -c /tmp/qf-csrf-cookie.txt -b /tmp/qf-csrf-cookie.txt -X PUT http://127.0.0.1:3001/api/v1/admin/payment-projects/qianfu -H "Authorization: Bearer ${NODE_TOKEN}" -H "x-csrf-token: ${CSRF_TOKEN}" -H 'Content-Type: application/json' --data @-
TEST_PAYLOAD=$(python3 -c 'import json; print(json.dumps({"planId":"custom","amount":"9.00","paymentMethod":"alipay","provider":"xpay","subject":"Domain Preview","extra":"domain-preview"}))')
TEST_ORDER=$(printf '%s' "$TEST_PAYLOAD" | curl -sS -A 'Mozilla/5.0' -c /tmp/qf-csrf-cookie.txt -b /tmp/qf-csrf-cookie.txt -X POST http://127.0.0.1:3001/api/v1/admin/payment-projects/qianfu/test-order -H "Authorization: Bearer ${NODE_TOKEN}" -H "x-csrf-token: ${CSRF_TOKEN}" -H 'Content-Type: application/json' --data @-)
printf '\n__TEST_ORDER__\n%s\n' "$TEST_ORDER"