set -e
pm2 status qianfu-api --no-color
pm2 logs qianfu-api --lines 80 --nostream --no-color || true
echo '--- CURL LOCAL HEALTH ---'
curl -sS -m 10 http://127.0.0.1:3001/api/health || true