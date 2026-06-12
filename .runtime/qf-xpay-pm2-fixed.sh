#!/usr/bin/env bash
set -euo pipefail
cd /www/wwwroot/qianfu-app
ENV_EXPORTS=$(python3 - <<'PY'
import shlex
from pathlib import Path
for raw in Path('/www/wwwroot/qianfu-app/.env').read_text(encoding='utf-8').splitlines():
    line = raw.strip().rstrip('\r')
    if not line or line.startswith('#') or '=' not in line:
        continue
    key, value = line.split('=', 1)
    key = key.strip()
    value = value.strip()
    if len(value) >= 2 and ((value[0] == value[-1] == '"') or (value[0] == value[-1] == "'")):
        value = value[1:-1]
    print(f"export {key}={shlex.quote(value)}")
PY
)
eval "$ENV_EXPORTS"
cd /www/wwwroot/qianfu-app/xpay-code
exec java -jar target/xpay-3.1.0.jar