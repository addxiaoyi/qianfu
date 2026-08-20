#!/usr/bin/env bash
set -euo pipefail

app_root=/www/wwwroot/qianfu-app
release_root=/www/wwwroot/qianfu-releases
release=qianfu-20260718-2002
old="$(readlink -f "$app_root/current")"
new="$release_root/$release"
next_link="$app_root/.current-$release"

rm -rf "$new"
mkdir -p "$new"
cp -a "$old/." "$new/"
install -m 0644 "$app_root/.incoming/$release-promo.js" "$new/dist-server/server/controllers/promoController.js"
install -m 0644 "$app_root/.incoming/$release-promo.js.map" "$new/dist-server/server/controllers/promoController.js.map"

printf '%s  %s\n' \
  '2b48e701299e7b3f5adeccaa7ee3c2ee693b43bc3038eef2c6d10297e15d9a1b' "$new/dist-server/server/controllers/promoController.js" \
  '8fd0f8372dce827b1709a80da489be1b3132280dd6215c74f3672737e40f1765' "$new/dist-server/server/controllers/promoController.js.map" | sha256sum -c -

ln -s "$new" "$next_link"
mv -Tf "$next_link" "$app_root/current"

if pm2 restart qianfu-api --update-env >/dev/null && \
  timeout 45 bash -c "until curl -fsS -A healthcheck -H 'Host: mc-u.top' -H 'X-Forwarded-Proto: https' http://127.0.0.1:3001/api/ready >/dev/null; do sleep 2; done"; then
  rm -f "$app_root/.incoming/$release-promo.js" "$app_root/.incoming/$release-promo.js.map"
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
