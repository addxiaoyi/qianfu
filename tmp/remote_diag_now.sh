set -e
hostname
uname -a
whoami
pm2 status qianfu-api --no-color || true
pm2 logs qianfu-api --lines 120 --nostream --no-color || true
echo '--- qianfu app root ---'
ls -lah /www/wwwroot/qianfu-app | sed -n '1,120p'
echo '--- env grep ---'
if [ -f /www/wwwroot/qianfu-app/.env ]; then sed -n '1,220p' /www/wwwroot/qianfu-app/.env; fi
echo '--- api ecosystem ---'
if [ -f /www/wwwroot/qianfu-app/ecosystem.config.js ]; then sed -n '1,220p' /www/wwwroot/qianfu-app/ecosystem.config.js; fi
if [ -f /www/wwwroot/qianfu-app/ecosystem.config.cjs ]; then sed -n '1,220p' /www/wwwroot/qianfu-app/ecosystem.config.cjs; fi
echo '--- mysql status ---'
(systemctl status mysql --no-pager -l || systemctl status mariadb --no-pager -l || true)
ss -lntp | grep 3306 || true
mysql --version || true
echo '--- local health ---'
curl -i -sS -m 10 http://127.0.0.1:3001/api/health || true
