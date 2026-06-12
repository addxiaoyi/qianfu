#!/usr/bin/env bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

BAD_LIST=$(grep -RIl 'gitlab-ce/ubuntu' /etc/apt/sources.list /etc/apt/sources.list.d 2>/dev/null || true)
if [ -n "$BAD_LIST" ]; then
  for f in $BAD_LIST; do
    cp "$f" "$f.bak-qianfu"
    sed -i 's|^deb |# deb |g' "$f"
  done
fi

apt-get update
apt-get install -y openjdk-17-jre-headless redis-server
systemctl enable redis-server >/dev/null 2>&1 || true
systemctl restart redis-server
npm install -g pm2

mkdir -p /www/wwwroot/qianfu-app
rm -rf /www/wwwroot/qianfu-app/dist-server /www/wwwroot/qianfu-app/qianfu-liandeng /www/wwwroot/qianfu-app/prisma /www/wwwroot/qianfu-app/xpay-code

tar -xzf /tmp/deploy-103-app-20260516.tar.gz -C /www/wwwroot/qianfu-app
cp /tmp/qianfu-103.env /www/wwwroot/qianfu-app/.env
cp /tmp/qf-xpay-pm2.sh /www/wwwroot/qianfu-app/qf-xpay-pm2.sh
chmod +x /www/wwwroot/qianfu-app/qf-xpay-pm2.sh
python3 /tmp/fix-sqlite-audit-log-schema.py /www/wwwroot/qianfu-app/prisma/dev.db || true
mkdir -p /www/wwwroot/qianfu-app/logs
mkdir -p /www/wwwroot/qianfu-app/xpay-code/src/main/resources/static/assets/qr/{alipay,wechat,qqpay,unipay,tenants}

mysql -uroot -padmin -e "CREATE DATABASE IF NOT EXISTS xpay DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -uroot -padmin xpay < /www/wwwroot/qianfu-app/xpay-code/sql/init.sql

cd /www/wwwroot/qianfu-app
npm install --omit=dev --legacy-peer-deps --ignore-scripts

cp /www/server/panel/vhost/nginx/0.default.conf /www/server/panel/vhost/nginx/0.default.conf.bak.$(date +%s) || true
cp /tmp/0.default.conf /www/server/panel/vhost/nginx/0.default.conf

pm2 delete qianfu-api >/dev/null 2>&1 || true
pm2 delete qianfu-xpay >/dev/null 2>&1 || true
APP_NAME=qianfu-api PORT=3001 NODE_ENV=production pm2 start ecosystem.config.cjs --only qianfu-api --update-env
pm2 start /www/wwwroot/qianfu-app/qf-xpay-pm2.sh --name qianfu-xpay --interpreter bash
pm2 save >/dev/null 2>&1 || true

/www/server/nginx/sbin/nginx -t
/www/server/nginx/sbin/nginx -s reload
sleep 10

echo __VERSIONS__
node -v
npm -v
java -version 2>&1 | head -n 2
echo __PM2__
pm2 list
echo __PORTS__
ss -ltnp | grep -E ':(80|3001|8889|6379)\\b' || true
echo __ROOT__
curl -I -sS http://127.0.0.1/
echo __API__
curl -I -sS http://127.0.0.1/api/health
echo __AUTH__
curl -sS -A 'Mozilla/5.0' -X POST http://127.0.0.1/api/v1/auth/login -H 'Content-Type: application/json' --data '{"identifier":"dev_local","password":"dev123456"}'
echo
echo __XPAYLOGIN__
printf '%s' '{"username":"xpayadmin","password":"olutBYFB2271"}' | curl -sS -A 'Mozilla/5.0' -X POST http://127.0.0.1/admin/auth/local/login -H 'Content-Type: application/json' --data @-