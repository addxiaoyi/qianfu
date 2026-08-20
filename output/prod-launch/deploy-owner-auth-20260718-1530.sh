#!/usr/bin/env bash
set -euo pipefail

app_root=/www/wwwroot/qianfu-app
release_root=/www/wwwroot/qianfu-releases
release=qianfu-20260718-1530
old="$(readlink -f "$app_root/current")"
new="$release_root/$release"
next_link="$app_root/.current-$release"

rm -rf "$new"
mkdir -p "$new"
cp -a "$old/." "$new/"
install -m 0644 "$app_root/.incoming/$release-auth.js" "$new/dist-server/server/middleware/auth.js"
install -m 0644 "$app_root/.incoming/$release-auth.js.map" "$new/dist-server/server/middleware/auth.js.map"

printf '%s  %s\n' \
  '84b997a73852f479983b0277d220fe90df3820c70378a1f1de2b7e049bf5702f' "$new/dist-server/server/middleware/auth.js" \
  '772af29455a08528fa23b06d6b09a53c4aa2dc43e24f48a9e356c9fcaf609fab' "$new/dist-server/server/middleware/auth.js.map" | sha256sum -c -

ln -s "$new" "$next_link"
mv -Tf "$next_link" "$app_root/current"

if pm2 restart qianfu-api --update-env >/dev/null && \
  timeout 45 bash -c "until curl -fsS -A healthcheck -H 'Host: mc-u.top' -H 'X-Forwarded-Proto: https' http://127.0.0.1:3001/api/ready >/dev/null; do sleep 2; done"; then
  rm -f "$app_root/.incoming/$release-auth.js" "$app_root/.incoming/$release-auth.js.map"
  echo "DEPLOYED=$new"
  curl -fsS -A healthcheck -H 'Host: mc-u.top' -H 'X-Forwarded-Proto: https' http://127.0.0.1:3001/api/ready
  exit 0
fi

rollback_link="$app_root/.rollback-$release"
ln -s "$old" "$rollback_link"
mv -Tf "$rollback_link" "$app_root/current"
pm2 restart qianfu-api --update-env >/dev/null
echo "ROLLED_BACK=$old" >&2
exit 1
