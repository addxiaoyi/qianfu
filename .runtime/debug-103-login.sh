#!/usr/bin/env bash
set -euo pipefail
NODE_LOGIN=$(python3 -c 'import json; print(json.dumps({"identifier":"dev_local","password":"dev123456"}))' | curl -sS -A 'Mozilla/5.0' -X POST http://127.0.0.1:3001/api/v1/auth/login -H 'Content-Type: application/json' --data @-)
printf '__NODE_LOGIN__\n%s\n' "$NODE_LOGIN"
CSRF=$(curl -sS -A 'Mozilla/5.0' -c /tmp/qf-csrf-cookie.txt -b /tmp/qf-csrf-cookie.txt http://127.0.0.1:3001/api/v1/csrf-token)
printf '__CSRF__\n%s\n' "$CSRF"
XPAY_LOGIN=$(python3 -c 'import json; print(json.dumps({"username":"xpayadmin","password":"olutBYFB2271"}))' | curl -sS -A 'Mozilla/5.0' -X POST http://127.0.0.1:8889/admin/auth/local/login -H 'Content-Type: application/json' --data @-)
printf '__XPAY_LOGIN__\n%s\n' "$XPAY_LOGIN"