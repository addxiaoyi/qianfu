#!/usr/bin/env bash
set -euo pipefail
NODE_LOGIN=$(python3 -c 'import json; print(json.dumps({"identifier":"dev_local","password":"dev123456"}))' | curl -sS -A 'Mozilla/5.0' -X POST http://127.0.0.1:3001/api/v1/auth/login -H 'Content-Type: application/json' --data @-)
NODE_TOKEN=$(printf '%s' "$NODE_LOGIN" | python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["token"])')
CSRF=$(curl -sS -A 'Mozilla/5.0' -c /tmp/qf-csrf-cookie.txt -b /tmp/qf-csrf-cookie.txt http://127.0.0.1:3001/api/v1/csrf-token)
CSRF_TOKEN=$(printf '%s' "$CSRF" | python3 -c 'import json,sys; data=json.load(sys.stdin); print(data.get("csrfToken") or data.get("data",{}).get("csrfToken") or "")')
SYNC_PAYLOAD=$(python3 -c 'import json; print(json.dumps({"callbackUrl":"http://127.0.0.1:3001/api/v1/payment/xpay/tenant-notify"}))')
SYNC=$(printf '%s' "$SYNC_PAYLOAD" | curl -sS -A 'Mozilla/5.0' -c /tmp/qf-csrf-cookie.txt -b /tmp/qf-csrf-cookie.txt -X POST http://127.0.0.1:3001/api/v1/admin/payment-projects/qianfu/xpay-tenant/sync -H "Authorization: Bearer ${NODE_TOKEN}" -H "x-csrf-token: ${CSRF_TOKEN}" -H 'Content-Type: application/json' --data @-)
printf '__SYNC__\n%s\n' "$SYNC"
TEST_PAYLOAD=$(python3 -c 'import json; print(json.dumps({"planId":"custom","amount":"6.00","paymentMethod":"alipay","provider":"xpay","subject":"Tenant Smoke 103","extra":"tenant-smoke-103"}))')
TEST_ORDER=$(printf '%s' "$TEST_PAYLOAD" | curl -sS -A 'Mozilla/5.0' -c /tmp/qf-csrf-cookie.txt -b /tmp/qf-csrf-cookie.txt -X POST http://127.0.0.1:3001/api/v1/admin/payment-projects/qianfu/test-order -H "Authorization: Bearer ${NODE_TOKEN}" -H "x-csrf-token: ${CSRF_TOKEN}" -H 'Content-Type: application/json' --data @-)
printf '__TEST_ORDER__\n%s\n' "$TEST_ORDER"
XPAY_LOGIN=$(python3 -c 'import json; print(json.dumps({"username":"xpayadmin","password":"olutBYFB2271"}))' | curl -sS -A 'Mozilla/5.0' -X POST http://127.0.0.1:8889/admin/auth/local/login -H 'Content-Type: application/json' --data @-)
printf '__XPAY_LOGIN__\n%s\n' "$XPAY_LOGIN"