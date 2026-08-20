#!/usr/bin/env bash
set -Eeuo pipefail

archive="${1:-/opt/qianfu-paypro/incoming/paypro-production-20260726-disabled.tar.gz}"
expected_sha="c756ae95724852bc8be1ae96bd7dc974c47de2f0165fbc0ad567552d59dcd529"
base="/opt/qianfu-paypro"
release="$base/releases/20260726-prod-disabled"
staging="$base/.staging-20260726-prod-disabled"

actual_sha="$(sha256sum "$archive" | awk '{print $1}')"
if [[ "$actual_sha" != "$expected_sha" ]]; then
  echo "Archive checksum mismatch: $actual_sha" >&2
  exit 1
fi

rm -rf "$staging"
mkdir -p "$staging" "$base/releases"
tar -xzf "$archive" -C "$staging"
test -f "$staging/paypro/.env"
test -f "$staging/paypro/artifacts/paypro.jar"
test -f "$staging/paypro/mysql-init/001-schema.sql"
chmod 600 "$staging/paypro/.env"
chmod 755 "$staging/paypro/scripts/"*.sh

(
  cd "$staging/paypro"
  ./scripts/verify.sh .env
)

if [[ -e "$release" ]]; then
  echo "Release already exists: $release" >&2
  exit 1
fi
mv "$staging/paypro" "$release"
rmdir "$staging"

rollback_stack() {
  (cd "$release" && ./scripts/compose.sh down) || true
}
trap 'rollback_stack' ERR

(
  cd "$release"
  ./scripts/deploy.sh
)

curl -fsS -m 10 http://127.0.0.1:8889/api/health | grep -q '"status":"ok"'
grep -qx 'PAYPRO_ALIPAY_ENABLED=false' "$release/.env"
grep -qx 'PAYPRO_WECHAT_ENABLED=false' "$release/.env"
grep -qx 'PAYPRO_ALLOW_BUNDLED_QR_CODES=false' "$release/.env"
if find "$release/payment-assets/qr" -type f ! -name '.gitkeep' -print -quit | grep -q .; then
  echo "Unexpected payment image asset found" >&2
  exit 1
fi

ln -sfn "$release" "$base/current"
trap - ERR
echo "paypro-deploy=ok release=$release bind=127.0.0.1:8889 payments=disabled"
