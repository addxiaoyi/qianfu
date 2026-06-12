#!/usr/bin/env bash
set -euo pipefail
ORDER_ID='qianfu_2a1e4641-49e0-43c1-8bba-0246515ac016'
AMOUNT='6.00'
TRADE_NO="GW-SMOKE-103-$(date +%s%3N)"
TIMESTAMP="$(date +%s%3N)"
NONCE="nonce$(date +%s%N)"
PROVIDER='alipay'
STATUS='SUCCESS'
SECRET=$(grep '^QIANFU_SECRET_KEY=' /www/wwwroot/qianfu-app/.env | cut -d= -f2-)
SIGN=$(python3 - <<PY
import base64, hashlib, hmac
params = {
  'amount': '$AMOUNT',
  'nonce': '$NONCE',
  'provider': '$PROVIDER',
  'status': '$STATUS',
  'timestamp': '$TIMESTAMP',
  'tradeNo': '$TRADE_NO',
}
base = '&'.join(f"{k}={params[k]}" for k in sorted(params))
print(base64.b64encode(hmac.new('$SECRET'.encode(), base.encode(), hashlib.sha256).digest()).decode())
PY
)
PAYLOAD=$(python3 - <<PY
import json
print(json.dumps({
  'tradeNo': '$TRADE_NO',
  'amount': '$AMOUNT',
  'timestamp': '$TIMESTAMP',
  'nonce': '$NONCE',
  'status': '$STATUS',
  'provider': '$PROVIDER',
  'sign': '$SIGN'
}))
PY
)
RESP=$(printf '%s' "$PAYLOAD" | curl -sS -A 'Mozilla/5.0' -X POST http://127.0.0.1:8889/open/gateway/tenants/qianfu/orders/${ORDER_ID}/notify -H 'Content-Type: application/json' --data @-)
sleep 2
NODE_LOGIN=$(python3 -c 'import json; print(json.dumps({"identifier":"dev_local","password":"dev123456"}))' | curl -sS -A 'Mozilla/5.0' -X POST http://127.0.0.1:3001/api/v1/auth/login -H 'Content-Type: application/json' --data @-)
NODE_TOKEN=$(printf '%s' "$NODE_LOGIN" | python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["token"])')
NODE_ORDER=$(curl -sS -A 'Mozilla/5.0' http://127.0.0.1:3001/api/v1/admin/payment-projects/qianfu/orders/${ORDER_ID} -H "Authorization: Bearer ${NODE_TOKEN}")
XPAY_LOGIN=$(python3 -c 'import json; print(json.dumps({"username":"xpayadmin","password":"olutBYFB2271"}))' | curl -sS -A 'Mozilla/5.0' -X POST http://127.0.0.1:8889/admin/auth/local/login -H 'Content-Type: application/json' --data @-)
XPAY_TOKEN=$(printf '%s' "$XPAY_LOGIN" | python3 -c 'import json,sys; print(json.load(sys.stdin)["result"]["token"])')
XPAY_ORDER=$(curl -sS -A 'Mozilla/5.0' http://127.0.0.1:8889/open/tenants/qianfu/orders/${ORDER_ID} -H "Authorization: Bearer ${XPAY_TOKEN}")
printf '__GATEWAY__\n%s\n__NODE_ORDER__\n%s\n__XPAY_ORDER__\n%s\n' "$RESP" "$NODE_ORDER" "$XPAY_ORDER"