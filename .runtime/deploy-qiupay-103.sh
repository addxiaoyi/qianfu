set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y python3-venv libzbar0
mkdir -p /www/wwwroot/qiu-pay
rm -rf /www/wwwroot/qiu-pay/app /www/wwwroot/qiu-pay/.venv /www/wwwroot/qiu-pay/data
mkdir -p /www/wwwroot/qiu-pay/data
tar -xzf /tmp/qiu-pay-deploy-20260517.tar.gz -C /www/wwwroot/qiu-pay
cd /www/wwwroot/qiu-pay
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
chmod +x qiu-pay-pm2.sh
pm2 delete qiu-pay >/dev/null 2>&1 || true
pm2 start /www/wwwroot/qiu-pay/qiu-pay-pm2.sh --name qiu-pay --interpreter bash
pm2 save >/dev/null 2>&1 || true
sleep 12
echo __PM2__
pm2 list
echo __PORT__
ss -ltnp | grep 8001 || true
echo __HEALTH__
curl -sS http://127.0.0.1:8001/health
echo
echo __LOGIN__
python3 -c 'import json; print(json.dumps({"username":"qiupayadmin","password":"olutBYFB2271"}))' | curl -sS -A 'Mozilla/5.0' -X POST http://127.0.0.1:8001/v1/admin/auth/login -H 'Content-Type: application/json' --data @-