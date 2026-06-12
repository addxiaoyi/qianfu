#!/usr/bin/env bash
set -euo pipefail

RCLONE_REMOTE_NAME="${RCLONE_REMOTE_NAME:-gdrive}"
RCLONE_REMOTE_ROOT="${RCLONE_REMOTE_ROOT:-qianfu}"
BACKUP_DIR="${BACKUP_DIR:-/mnt/qianfu-data/backups}"
CUTOVER_BACKUP_DIR="${CUTOVER_BACKUP_DIR:-/mnt/qianfu-data/cutover-backups}"
PLUGIN_DIR="${PLUGIN_DIR:-/www/wwwroot/qianfu-app/plugins}"
UPLOAD_DIR="${UPLOAD_DIR:-/www/wwwroot/qianfu-app/uploads}"
MOUNT_POINT="${MOUNT_POINT:-/mnt/gdrive-qianfu}"
RCLONE_PROXY_URL="${RCLONE_PROXY_URL:-}"

usage() {
  cat <<'EOF'
Usage: bash scripts/linux/rclone-gdrive.sh <command> [args]

Environment:
  RCLONE_REMOTE_NAME   rclone remote alias, default: gdrive
  RCLONE_REMOTE_ROOT   folder root inside remote, default: qianfu
  BACKUP_DIR           local backup dir, default: /mnt/qianfu-data/backups
  CUTOVER_BACKUP_DIR   local cutover backup dir, default: /mnt/qianfu-data/cutover-backups
  PLUGIN_DIR           local plugin dir, default: /www/wwwroot/qianfu-app/plugins
  UPLOAD_DIR           local upload dir, default: /www/wwwroot/qianfu-app/uploads
  MOUNT_POINT          mount point, default: /mnt/gdrive-qianfu
  RCLONE_PROXY_URL     optional proxy URL (e.g. socks5://127.0.0.1:14080)

Commands:
  status
  list-remotes
  show-config
  test-remote
  push-backups
  push-cutover-backups
  push-plugins
  push-uploads
  copy-up <local-path> <remote-subpath> [copy|sync]
  copy-down <remote-subpath> <local-path> [copy|sync]
  mount [remote-subpath] [mount-point]
  umount [mount-point]

Notes:
  1) Do not mount Google Drive as MySQL data dir or hot runtime dir.
  2) Use mount mainly for browsing, manual restore, or cold archive access.
EOF
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "[FAIL] missing command: $1"
    exit 1
  }
}

require_rclone() {
  require_cmd rclone
}

rclone_run() {
  if [[ -n "${RCLONE_PROXY_URL}" ]]; then
    HTTP_PROXY="${RCLONE_PROXY_URL}" \
    HTTPS_PROXY="${RCLONE_PROXY_URL}" \
    ALL_PROXY="${RCLONE_PROXY_URL}" \
    NO_PROXY="" \
    rclone "$@"
  else
    rclone "$@"
  fi
}

join_remote() {
  local subpath="${1:-}"
  local remote="${RCLONE_REMOTE_NAME}:"
  if [[ -n "${RCLONE_REMOTE_ROOT}" ]]; then
    remote="${remote}${RCLONE_REMOTE_ROOT#/}"
  fi
  if [[ -n "${subpath}" ]]; then
    if [[ -n "${RCLONE_REMOTE_ROOT}" ]]; then
      remote="${remote%/}/${subpath#/}"
    else
      remote="${remote}${subpath#/}"
    fi
  fi
  echo "${remote%/}"
}

rclone_copy() {
  local src="$1"
  local dst="$2"
  local mode="${3:-copy}"
  if [[ ! -e "$src" ]]; then
    echo "[FAIL] source not found: $src"
    exit 1
  fi
  echo "[STEP] rclone ${mode} ${src} -> ${dst}"
  rclone_run "${mode}" \
    --fast-list \
    --transfers=4 \
    --checkers=8 \
    --drive-chunk-size=64M \
    --create-empty-src-dirs \
    -P \
    "$src" "$dst"
}

show_status() {
  require_rclone
  echo "[INFO] rclone binary: $(command -v rclone)"
  rclone_run version | sed -n '1,4p'
  echo "[INFO] config file: $(rclone_run config file | tail -n 1)"
  echo "[INFO] remote alias list:"
  rclone_run listremotes || true
  echo "[INFO] effective remote root: $(join_remote)"
}

cmd="${1:-}"
case "$cmd" in
  status)
    show_status
    ;;
  list-remotes)
    require_rclone
    rclone_run listremotes
    ;;
  show-config)
    require_rclone
    rclone_run config file
    ;;
  test-remote)
    require_rclone
    echo "[STEP] probing remote root: $(join_remote)"
    rclone_run lsd "$(join_remote)"
    ;;
  push-backups)
    require_rclone
    rclone_copy "$BACKUP_DIR" "$(join_remote backups)" copy
    ;;
  push-cutover-backups)
    require_rclone
    rclone_copy "$CUTOVER_BACKUP_DIR" "$(join_remote cutover-backups)" copy
    ;;
  push-plugins)
    require_rclone
    rclone_copy "$PLUGIN_DIR" "$(join_remote plugins)" copy
    ;;
  push-uploads)
    require_rclone
    rclone_copy "$UPLOAD_DIR" "$(join_remote uploads)" copy
    ;;
  copy-up)
    require_rclone
    local_path="${2:-}"
    remote_subpath="${3:-}"
    mode="${4:-copy}"
    if [[ -z "$local_path" || -z "$remote_subpath" ]]; then
      usage
      exit 1
    fi
    rclone_copy "$local_path" "$(join_remote "$remote_subpath")" "$mode"
    ;;
  copy-down)
    require_rclone
    remote_subpath="${2:-}"
    local_path="${3:-}"
    mode="${4:-copy}"
    if [[ -z "$remote_subpath" || -z "$local_path" ]]; then
      usage
      exit 1
    fi
    mkdir -p "$local_path"
    echo "[STEP] rclone ${mode} $(join_remote "$remote_subpath") -> $local_path"
    rclone_run "${mode}" \
      --fast-list \
      --transfers=4 \
      --checkers=8 \
      --drive-chunk-size=64M \
      -P \
      "$(join_remote "$remote_subpath")" "$local_path"
    ;;
  mount)
    require_rclone
    subpath="${2:-}"
    mount_point="${3:-$MOUNT_POINT}"
    mkdir -p "$mount_point"
    echo "[STEP] mounting $(join_remote "$subpath") -> $mount_point"
    rclone_run mount "$(join_remote "$subpath")" "$mount_point" \
      --daemon \
      --dir-cache-time 10m \
      --poll-interval 30s \
      --umask 022 \
      --vfs-cache-mode full \
      --vfs-cache-max-age 24h
    echo "[DONE] mount ready: $mount_point"
    ;;
  umount)
    mount_point="${2:-$MOUNT_POINT}"
    if command -v fusermount >/dev/null 2>&1; then
      fusermount -u "$mount_point"
    else
      umount "$mount_point"
    fi
    echo "[DONE] unmounted: $mount_point"
    ;;
  -h|--help|"")
    usage
    ;;
  *)
    echo "[FAIL] unknown command: $cmd"
    usage
    exit 1
    ;;
esac
