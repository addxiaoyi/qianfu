#!/usr/bin/env bash
set -euo pipefail
NODE_LOGIN=$(python3 -c 'import json; print(json.dumps({"identifier":"dev_local","password":"dev123456"}))' | curl -sS -A 'Mozilla/5.0' -X POST http://127.0.0.1:3001/api/v1/auth/login -H 'Content-Type: application/json' --data @-)
NODE_TOKEN=$(printf '%s' "$NODE_LOGIN" | python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["token"])')
CSRF=$(curl -sS -A 'Mozilla/5.0' -c /tmp/qf-csrf-cookie.txt -b /tmp/qf-csrf-cookie.txt http://127.0.0.1:3001/api/v1/csrf-token)
CSRF_TOKEN=$(printf '%s' "$CSRF" | python3 -c 'import json,sys; data=json.load(sys.stdin); print(data.get("csrfToken") or data.get("data",{}).get("csrfToken") or "")')
SYNC_PAYLOAD=$(python3 -c 'import json; print(json.dumps({"callbackUrl":"http://127.0.0.1:3001/api/v1/payment/xpay/tenant-notify"}))')
SYNC=$(printf '%s' "$SYNC_PAYLOAD" | curl -sS -A 'Mozilla/5.0' -c /tmp/qf-csrf-cookie.txt -b /tmp/qf-csrf-cookie.txt -X POST http://127.0.0.1:3001/api/v1/admin/payment-projects/qianfu/xpay-tenant/sync -H "Authorization: Bearer ${NODE_TOKEN}" -H "x-csrf-token: ${CSRF_TOKEN}" -H 'Content-Type: application/json' --data @-)
TEST_PAYLOAD=$(python3 -c 'import json; print(json.dumps({"planId":"custom","amount":"6.00","paymentMethod":"alipay","provider":"xpay","subject":"Tenant Smoke 103","extra":"tenant-smoke-103"}))')
TEST_ORDER=$(printf '%s' "$TEST_PAYLOAD" | curl -sS -A 'Mozilla/5.0' -c /tmp/qf-csrf-cookie.txt -b /tmp/qf-csrf-cookie.txt -X POST http://127.0.0.1:3001/api/v1/admin/payment-projects/qianfu/test-order -H "Authorization: Bearer ${NODE_TOKEN}" -H "x-csrf-token: ${CSRF_TOKEN}" -H 'Content-Type: application/json' --data @-)
ORDER_ID=$(printf '%s' "$TEST_ORDER" | python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["orderId"])')
PROVIDER=$(printf '%s' "$TEST_ORDER" | python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["provider"])')
PAYMENT_URL=$(printf '%s' "$TEST_ORDER" | python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["paymentUrl"])')
XPAY_LOGIN=$(python3 -c 'import json; print(json.dumps({"username":"xpayadmin","password":"olutBYFB2271"}))' | curl -sS -A 'Mozilla/5.0' -X POST http://127.0.0.1:8889/admin/auth/local/login -H 'Content-Type: application/json' --data @-)
XPAY_TOKEN=$(printf '%s' "$XPAY_LOGIN" | python3 -c 'import json,sys; print(json.load(sys.stdin)["result"]["token"])')
TRADE_NO="TENANT-SMOKE-103-$(date +%s%3N)"
PAID_PAYLOAD=$(python3 -c "import json; print(json.dumps({'tradeNo': '$TRADE_NO'}))")
PAID=$(printf '%s' "$PAID_PAYLOAD" | curl -sS -A 'Mozilla/5.0' -X POST http://127.0.0.1:8889/open/tenants/qianfu/orders/${ORDER_ID}/paid -H "Authorization: Bearer ${XPAY_TOKEN}" -H 'Content-Type: application/json' --data @-)
sleep 2
NODE_ORDER=$(curl -sS -A 'Mozilla/5.0' http://127.0.0.1:3001/api/v1/admin/payment-projects/qianfu/orders/${ORDER_ID} -H "Authorization: Bearer ${NODE_TOKEN}")
NODE_STATUS=$(printf '%s' "$NODE_ORDER" | python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["status"])')
XPAY_ORDER=$(curl -sS -A 'Mozilla/5.0' http://127.0.0.1:8889/open/tenants/qianfu/orders/${ORDER_ID} -H "Authorization: Bearer ${XPAY_TOKEN}")
XPAY_CALLBACK_STATUS=$(printf '%s' "$XPAY_ORDER" | python3 -c 'import json,sys; print(json.load(sys.stdin)["result"].get("callbackStatus",""))')
XPAY_ORDER_STATUS=$(printf '%s' "$XPAY_ORDER" | python3 -c 'import json,sys; print(json.load(sys.stdin)["result"].get("status",""))')
printf 'PROVIDER=%s\n' "$PROVIDER"
printf 'PAYMENT_URL=%s\n' "$PAYMENT_URL"
printf 'NODE_STATUS=%s\n' "$NODE_STATUS"
printf 'XPAY_CALLBACK_STATUS=%s\n' "$XPAY_CALLBACK_STATUS"
printf 'XPAY_ORDER_STATUS=%s\n' "$XPAY_ORDER_STATUS"
printf '%s\n__SYNC__\n%s\n__PAID__\n%s\n' "$TEST_ORDER" "$SYNC" "$PAID"