#!/usr/bin/env bash
set -euo pipefail
cd /www/wwwroot/qianfu-app
set -a
source /www/wwwroot/qianfu-app/.env
set +a
cd /www/wwwroot/qianfu-app/xpay-code
exec java -jar target/xpay-3.1.0.jar
