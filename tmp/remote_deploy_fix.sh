set -e
ROOT=/www/wwwroot/qianfu-app
WEB=$ROOT/qianfu-liandeng/dist
TS=$(date +%Y%m%d_%H%M%S)
BAK=$ROOT/qianfu-liandeng/dist.__bak_$TS
cp -a "$WEB" "$BAK"
rm -rf "$WEB"
tar -xzf /tmp/qianfu-mobile-refresh-fix-20260521-133402.tar.gz -C "$ROOT/qianfu-liandeng"
nginx -t
nginx -s reload
pm2 restart qianfu-api || true
echo deploy_done
ls -lah "$ROOT/qianfu-liandeng/dist/index.html"
head -n 20 "$ROOT/qianfu-liandeng/dist/index.html"