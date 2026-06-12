#!/usr/bin/env bash
set -euo pipefail
cd /www/wwwroot/qiu-pay
source .venv/bin/activate
exec python -m uvicorn app.main:app --host 127.0.0.1 --port 8001
