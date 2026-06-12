# 移动端输入刷新 hotfix 上线指令（服务器本机执行）
# 1) 把压缩包上传到服务器，比如 /tmp/qianfu-mobile-refresh-fix-20260521-133402.tar.gz
# 2) 在服务器执行以下命令：
set -e
PKG=/tmp/qianfu-mobile-refresh-fix-20260521-133402.tar.gz
ROOT=/www/wwwroot/qianfu-app
WEB=$ROOT/qianfu-liandeng/dist
BACKUP=$ROOT/qianfu-liandeng/dist.__bak_$(date +%Y%m%d_%H%M%S)

mkdir -p "$ROOT/qianfu-liandeng"
cp -a "$WEB" "$BACKUP"
rm -rf "$WEB"
mkdir -p "$WEB"

tar -xzf "$PKG" -C "$ROOT/qianfu-liandeng"
# 解包后目录是 $ROOT/qianfu-liandeng/dist

# 可选：清理旧静态缓存目录（如有）
# find "$WEB/assets" -maxdepth 1 -type f -name 'index-*.js' -mtime +2 -delete || true

nginx -t
nginx -s reload || systemctl reload nginx || true
pm2 restart qianfu-api || true

echo "deploy done"
