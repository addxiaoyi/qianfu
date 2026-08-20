#!/usr/bin/env bash
set -euo pipefail

URL_FILE="${POSTGRES_URL_FILE:-/root/.qianfu-postgres-url}"
STATE_DIR="${QIANFU_MONITOR_STATE_DIR:-/var/lib/qianfu-monitor}"
DOMAIN="${QIANFU_MONITOR_DOMAIN:-mc-u.top}"
DISK_LIMIT="${QIANFU_DISK_LIMIT_PERCENT:-80}"
MEMORY_LIMIT="${QIANFU_MEMORY_LIMIT_PERCENT:-90}"
SWAP_LIMIT="${QIANFU_SWAP_LIMIT_PERCENT:-50}"
RELEASE_LIMIT="${QIANFU_RELEASE_LIMIT:-6}"
RELEASE_ROOT="${QIANFU_RELEASE_ROOT:-/www/wwwroot/qianfu-releases}"
CERT_LIMIT_DAYS="${QIANFU_CERT_LIMIT_DAYS:-21}"
BACKUP_MAX_AGE_SECONDS="${QIANFU_BACKUP_MAX_AGE_SECONDS:-129600}"
BACKUP_DIR="${POSTGRES_BACKUP_DIR:-/www/backup/qianfu/postgres}"

install -d -m 700 "$STATE_DIR"
issues=()

add_issue() {
  issues+=("$1|$2")
}

if ! pg_isready -q -h 127.0.0.1 -p 5432; then
  add_issue postgres "PostgreSQL 无法连接"
fi

if ! redis-cli -h 127.0.0.1 ping 2>/dev/null | grep -qx PONG; then
  add_issue redis "Redis 无法连接"
fi

if ! pm2 pid qianfu-api 2>/dev/null | grep -Eq '^[1-9][0-9]*$'; then
  add_issue pm2 "qianfu-api 进程未运行"
fi

api_fail_file="$STATE_DIR/api-fail-count"
api_fail_count="$(cat "$api_fail_file" 2>/dev/null || printf 0)"
if curl --fail --silent --show-error --max-time 10 "https://$DOMAIN/api/health" >/dev/null; then
  printf '0\n' > "$api_fail_file"
else
  api_fail_count=$((api_fail_count + 1))
  printf '%s\n' "$api_fail_count" > "$api_fail_file"
  if (( api_fail_count >= 3 )); then
    add_issue api "API 健康检查连续失败 ${api_fail_count} 次"
  fi
fi

disk_percent="$(df -P /www/wwwroot | awk 'NR == 2 { gsub(/%/, "", $5); print $5 }')"
if (( disk_percent >= DISK_LIMIT )); then
  add_issue disk "磁盘使用率 ${disk_percent}% 超过阈值 ${DISK_LIMIT}%"
fi

memory_percent="$(awk '/MemTotal/{total=$2}/MemAvailable/{available=$2}END{printf "%d", (total-available)*100/total}' /proc/meminfo)"
if (( memory_percent >= MEMORY_LIMIT )); then
  add_issue memory "内存使用率 ${memory_percent}% 超过阈值 ${MEMORY_LIMIT}%"
fi

swap_percent="$(awk '/SwapTotal/{total=$2}/SwapFree/{free=$2}END{if(total > 0) printf "%d", (total-free)*100/total; else print 0}' /proc/meminfo)"
if (( swap_percent >= SWAP_LIMIT )); then
  add_issue swap "Swap 使用率 ${swap_percent}% 超过阈值 ${SWAP_LIMIT}%"
fi

release_count="$(find "$RELEASE_ROOT" -mindepth 1 -maxdepth 1 -type d -name '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]-*' -printf '.' 2>/dev/null | wc -c)"
if (( release_count > RELEASE_LIMIT )); then
  add_issue releases "应用发布目录 ${release_count} 个，超过阈值 ${RELEASE_LIMIT}"
fi

cert_end="$(timeout 15 openssl s_client -servername "$DOMAIN" -connect "$DOMAIN:443" </dev/null 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2- || true)"
if [[ -z "$cert_end" ]]; then
  add_issue certificate "无法读取 $DOMAIN 的 TLS 证书"
else
  cert_seconds=$(( $(date -d "$cert_end" +%s) - $(date +%s) ))
  cert_days=$(( cert_seconds / 86400 ))
  if (( cert_days < CERT_LIMIT_DAYS )); then
    add_issue certificate "$DOMAIN 的 TLS 证书剩余 ${cert_days} 天"
  fi
fi

latest_backup_epoch="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'qianfu-*.dump' -printf '%T@\n' 2>/dev/null | sort -nr | head -1 | cut -d. -f1)"
if [[ -z "$latest_backup_epoch" ]]; then
  add_issue backup "没有找到 PostgreSQL 备份"
elif (( $(date +%s) - latest_backup_epoch > BACKUP_MAX_AGE_SECONDS )); then
  add_issue backup "PostgreSQL 备份已超过 36 小时未更新"
fi
if [[ -s "$STATE_DIR/backup.failed" ]] || systemctl is-failed --quiet qianfu-postgres-backup.service; then
  add_issue backup "最近一次 PostgreSQL 备份失败"
fi

current_codes="$STATE_DIR/current-issues"
previous_codes="$STATE_DIR/previous-issues"
printf '%s\n' "${issues[@]}" | sed '/^$/d' | cut -d'|' -f1 | sort -u > "$current_codes"
touch "$previous_codes"

database_url=""
if [[ -r "$URL_FILE" ]]; then
  database_url="$(<"$URL_FILE")"
  database_url="${database_url%%\?*}"
fi

notify_admins() {
  local title="$1"
  local content="$2"
  [[ -n "$database_url" ]] || return 0
  psql "$database_url" -v ON_ERROR_STOP=1 -v title="$title" -v content="$content" <<'SQL' >/dev/null
INSERT INTO "Notification" ("user_id", "title", "content", "type", "is_read", "created_at")
SELECT "id", :'title', :'content', 'WARNING', false, now()
FROM "User"
WHERE upper("role") IN ('ADMIN', 'SUPER_ADMIN');
SQL
}

while IFS='|' read -r code message; do
  [[ -n "$code" ]] || continue
  if ! grep -qxF "$code" "$previous_codes"; then
    notify_admins "系统监控告警" "$message"
    logger -t qianfu-monitor -- "ALERT $code $message"
  fi
done < <(printf '%s\n' "${issues[@]}")

while IFS= read -r recovered_code; do
  [[ -n "$recovered_code" ]] || continue
  if ! grep -qxF "$recovered_code" "$current_codes"; then
    notify_admins "系统监控恢复" "$recovered_code 对应的检查已恢复正常"
    logger -t qianfu-monitor -- "RECOVERED $recovered_code"
  fi
done < "$previous_codes"

install -m 600 "$current_codes" "$previous_codes"
printf 'monitor_ok=true issues=%s disk=%s memory=%s swap=%s releases=%s\n' "${#issues[@]}" "$disk_percent" "$memory_percent" "$swap_percent" "$release_count"
