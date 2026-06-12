#!/usr/bin/env bash
set -euo pipefail
NODE_LOGIN=$(python3 -c 'import json; print(json.dumps({"identifier":"dev_local","password":"dev123456"}))' | curl -sS -A 'Mozilla/5.0' -X POST http://127.0.0.1:3001/api/v1/auth/login -H 'Content-Type: application/json' --data @-)
NODE_TOKEN=$(printf '%s' "$NODE_LOGIN" | python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["token"])')
PROJECTS=$(curl -sS -A 'Mozilla/5.0' http://127.0.0.1:3001/api/v1/admin/payment-projects -H "Authorization: Bearer ${NODE_TOKEN}")
printf '%s\n' "$PROJECTS"