#!/usr/bin/env bash
set -euo pipefail
cd /www/wwwroot/qianfu-app
node --input-type=module - <<'NODE'
import { PrismaClient } from './dist-server/prisma/generated/client/index.js';
const prisma = new PrismaClient({ datasources: { db: { url: 'file:/www/wwwroot/qianfu-app/prisma/dev.db' } } });
const key = 'payment_project:qianfu';
const row = await prisma.systemConfig.findUnique({ where: { key } });
const cfg = row?.value ? JSON.parse(row.value) : {};
cfg.displayName = cfg.displayName || 'QianFu';
cfg.upstreamProvider = 'xpay';
cfg.xpayGatewayBaseUrl = 'http://mc-u.top/xpay';
cfg.xpayApiUrl = 'http://mc-u.top/xpay/starmc/pay';
cfg.xpayNotifyUrl = 'http://mc-u.top/api/v1/payment/xpay/notify';
cfg.payProNotifyUrl = 'http://mc-u.top/api/v1/payment/paypro/notify';
cfg.hupijiaoNotifyUrl = 'http://mc-u.top/api/v1/payment/hupijiao/notify';
await prisma.systemConfig.upsert({ where: { key }, update: { value: JSON.stringify(cfg), is_secret: false, description: 'Payment project config for qianfu' }, create: { key, value: JSON.stringify(cfg), is_secret: false, description: 'Payment project config for qianfu' } });
console.log(JSON.stringify(cfg));
await prisma.$disconnect();
NODE
NODE_LOGIN=$(python3 -c 'import json; print(json.dumps({"identifier":"dev_local","password":"dev123456"}))' | curl -sS -A 'Mozilla/5.0' -X POST http://127.0.0.1:3001/api/v1/auth/login -H 'Content-Type: application/json' --data @-)
NODE_TOKEN=$(printf '%s' "$NODE_LOGIN" | python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["token"])')
CSRF=$(curl -sS -A 'Mozilla/5.0' -c /tmp/qf-csrf-cookie.txt -b /tmp/qf-csrf-cookie.txt http://127.0.0.1:3001/api/v1/csrf-token)
CSRF_TOKEN=$(printf '%s' "$CSRF" | python3 -c 'import json,sys; data=json.load(sys.stdin); print(data.get("csrfToken") or data.get("data",{}).get("csrfToken") or "")')
TEST_PAYLOAD=$(python3 -c 'import json; print(json.dumps({"planId":"custom","amount":"11.00","paymentMethod":"alipay","provider":"xpay","subject":"Domain Final","extra":"domain-final"}))')
TEST_ORDER=$(printf '%s' "$TEST_PAYLOAD" | curl -sS -A 'Mozilla/5.0' -c /tmp/qf-csrf-cookie.txt -b /tmp/qf-csrf-cookie.txt -X POST http://127.0.0.1:3001/api/v1/admin/payment-projects/qianfu/test-order -H "Authorization: Bearer ${NODE_TOKEN}" -H "x-csrf-token: ${CSRF_TOKEN}" -H 'Content-Type: application/json' --data @-)
ORDER_ID=$(printf '%s' "$TEST_ORDER" | python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["orderId"])')
PAYMENT_URL=$(printf '%s' "$TEST_ORDER" | python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["paymentUrl"])')
TRADE_NO="GW-MCU-$(date +%s%3N)"
TIMESTAMP="$(date +%s%3N)"
NONCE="nonce$(date +%s%N)"
SECRET=$(grep '^QIANFU_SECRET_KEY=' /www/wwwroot/qianfu-app/.env | cut -d= -f2-)
SIGN=$(python3 - <<PY
import base64, hashlib, hmac
params = {
  'amount': '11.00',
  'nonce': '$NONCE',
  'provider': 'alipay',
  'status': 'SUCCESS',
  'timestamp': '$TIMESTAMP',
  'tradeNo': '$TRADE_NO',
}
base = '&'.join(f"{k}={params[k]}" for k in sorted(params))
print(base64.b64encode(hmac.new('$SECRET'.encode(), base.encode(), hashlib.sha256).digest()).decode())
PY
)
GW_PAYLOAD=$(python3 - <<PY
import json
print(json.dumps({'tradeNo':'$TRADE_NO','amount':'11.00','timestamp':'$TIMESTAMP','nonce':'$NONCE','status':'SUCCESS','provider':'alipay','sign':'$SIGN'}))
PY
)
GW_RESP=$(printf '%s' "$GW_PAYLOAD" | curl -sS -A 'Mozilla/5.0' -X POST http://127.0.0.1:8889/open/gateway/tenants/qianfu/orders/${ORDER_ID}/notify -H 'Content-Type: application/json' --data @-)
sleep 2
NODE_ORDER=$(curl -sS -A 'Mozilla/5.0' http://127.0.0.1:3001/api/v1/admin/payment-projects/qianfu/orders/${ORDER_ID} -H "Authorization: Bearer ${NODE_TOKEN}")
printf '__PAYMENT_URL__\n%s\n__NODE_ORDER__\n%s\n__GW__\n%s\n' "$PAYMENT_URL" "$NODE_ORDER" "$GW_RESP"