set -e
sed -i 's/^DEV_AUTH_DISPLAY_NAME=.*/DEV_AUTH_DISPLAY_NAME="Local Dev"/' /www/wwwroot/qianfu-app/.env
cd /www/wwwroot/qianfu-app
npm install --omit=dev --legacy-peer-deps --ignore-scripts >/tmp/qf-npm-relink.log 2>&1 || (cat /tmp/qf-npm-relink.log && exit 1)
pm2 restart qianfu-api >/dev/null
pm2 delete qianfu-xpay >/dev/null 2>&1 || true
pm2 start /www/wwwroot/qianfu-app/qf-xpay-pm2.sh --name qianfu-xpay --interpreter bash >/dev/null
/www/server/nginx/sbin/nginx -s stop >/dev/null 2>&1 || true
sleep 2
/www/server/nginx/sbin/nginx -c /www/server/nginx/conf/nginx.conf
sleep 12
echo __PORTS__
ss -ltnp | grep -E ':(80|3001|8889|6379)\\b' || true
echo __ROOT__
curl -I -sS http://127.0.0.1/
echo __API_DIRECT__
curl -I -sS http://127.0.0.1:3001/api/health || true
echo __API_NGINX__
curl -I -sS http://127.0.0.1/api/health || true
echo __AUTH__
curl -sS -A 'Mozilla/5.0' -X POST http://127.0.0.1/api/v1/auth/login -H 'Content-Type: application/json' --data '{"identifier":"dev_local","password":"dev123456"}'
echo
echo __XPAYLOGIN__
printf '%s' '{"username":"xpayadmin","password":"olutBYFB2271"}' | curl -sS -A 'Mozilla/5.0' -X POST http://127.0.0.1/admin/auth/local/login -H 'Content-Type: application/json' --data @-