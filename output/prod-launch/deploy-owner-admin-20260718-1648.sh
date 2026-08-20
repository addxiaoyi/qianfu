#!/usr/bin/env bash
set -euo pipefail

app_root=/www/wwwroot/qianfu-app
release_root=/www/wwwroot/qianfu-releases
release=qianfu-20260718-1648
old="$(readlink -f "$app_root/current")"
new="$release_root/$release"
next_link="$app_root/.current-$release"

rm -rf "$new"
mkdir -p "$new"
cp -a "$old/." "$new/"

install -m 0644 "$app_root/.incoming/$release-auth.js" "$new/dist-server/server/middleware/auth.js"
install -m 0644 "$app_root/.incoming/$release-auth.js.map" "$new/dist-server/server/middleware/auth.js.map"
install -m 0644 "$app_root/.incoming/$release-users.js" "$new/dist-server/server/controllers/userManagementController.js"
install -m 0644 "$app_root/.incoming/$release-users.js.map" "$new/dist-server/server/controllers/userManagementController.js.map"

printf '%s  %s\n' \
  '1fbbcbffce26fb7ac99cd5623010dc0cbf1a3bb0ebc31837f97f9605aa0f7a5c' "$new/dist-server/server/middleware/auth.js" \
  '143294fe0713eb7a10d8b464b3d1fb1f19414201f2559d19bdfc5cbb122919fd' "$new/dist-server/server/middleware/auth.js.map" \
  'cc18eef2ac4e79ea4958faef69a4b28568463a8cb4fb7cb356294d2ea4a464ba' "$new/dist-server/server/controllers/userManagementController.js" \
  '4e01b9b58e201765a169db45dba5900f4ba4ee7d3e6e17a6a1d5132d72b4fb35' "$new/dist-server/server/controllers/userManagementController.js.map" | sha256sum -c -

ln -s "$new" "$next_link"
mv -Tf "$next_link" "$app_root/current"

if pm2 restart qianfu-api --update-env >/dev/null && \
  timeout 45 bash -c "until curl -fsS -A healthcheck -H 'Host: mc-u.top' -H 'X-Forwarded-Proto: https' http://127.0.0.1:3001/api/ready >/dev/null; do sleep 2; done"; then
  rm -f "$app_root/.incoming/$release-auth.js" "$app_root/.incoming/$release-auth.js.map"
  rm -f "$app_root/.incoming/$release-users.js" "$app_root/.incoming/$release-users.js.map"
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
