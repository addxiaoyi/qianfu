#!/usr/bin/env bash
set -Eeuo pipefail

expected_current="/www/wwwroot/qianfu-releases/20260724-2305-promo-tier-settlement"
current="$(readlink -f /www/wwwroot/qianfu-app/current)"
if [[ "$current" != "$expected_current" ]]; then
  echo "Unexpected QianFu current release: $current" >&2
  exit 1
fi

remove_releases=(
  "/www/wwwroot/qianfu-releases/20260720-1900-ui-fixes-batch14"
  "/www/wwwroot/qianfu-releases/20260720-1945-ui-fixes-batch15"
  "/www/wwwroot/qianfu-releases/20260720-2015-ui-fixes-batch16"
  "/www/wwwroot/qianfu-releases/20260721-0620-security-deps"
)

audit_dir="/root/qianfu-maintenance"
mkdir -p "$audit_dir"
manifest="$audit_dir/release-cleanup-$(date +%Y%m%d-%H%M%S).txt"
{
  echo "current=$current"
  echo "before=$(df -B1 --output=used,avail,pcent / | tail -n1 | xargs)"
  for release in "${remove_releases[@]}"; do
    if [[ ! -d "$release" ]]; then
      echo "missing=$release"
      continue
    fi
    symlink_refs="$(find /www/wwwroot/qianfu-app /www/wwwroot/qianfu-releases -maxdepth 3 -type l -lname "$release" -print 2>/dev/null | wc -l)"
    process_refs="$(find /proc/[0-9]*/cwd -lname "$release" -print 2>/dev/null | wc -l)"
    size="$(du -sb "$release" | awk '{print $1}')"
    echo "candidate=$release bytes=$size symlink_refs=$symlink_refs process_refs=$process_refs"
    if [[ "$symlink_refs" != "0" || "$process_refs" != "0" ]]; then
      echo "Release is still referenced: $release" >&2
      exit 1
    fi
  done
} | tee "$manifest"

for release in "${remove_releases[@]}"; do
  [[ -d "$release" ]] || continue
  rm -rf --one-file-system "$release"
done

sync
echo "after=$(df -B1 --output=used,avail,pcent / | tail -n1 | xargs)" | tee -a "$manifest"
readlink -f /www/wwwroot/qianfu-app/current | tee -a "$manifest"
pm2 jlist | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const p=JSON.parse(s).find(x=>x.name==='qianfu-api');if(!p||p.pm2_env.status!=='online'||p.pm2_env.restart_time!==0)process.exit(1);console.log('qianfu-api=online restarts=0')})" | tee -a "$manifest"
curl -fsS -m 8 -H 'Host: mc-u.top' -H 'X-Forwarded-Proto: https' http://127.0.0.1:3001/api/health | grep -q '"ready":true'
echo "cleanup=ok manifest=$manifest"
