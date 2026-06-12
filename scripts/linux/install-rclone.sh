#!/usr/bin/env bash
set -euo pipefail

wait_for_apt() {
  local max_wait="${1:-300}"
  local waited=0
  while true; do
    if ! pgrep -fa 'apt|dpkg|unattended' >/dev/null 2>&1; then
      break
    fi
    if (( waited >= max_wait )); then
      echo "[FAIL] apt/dpkg is still busy after ${max_wait}s"
      pgrep -fa 'apt|dpkg|unattended' || true
      return 1
    fi
    echo "[WAIT] apt/dpkg busy, retrying in 5s..."
    pgrep -fa 'apt|dpkg|unattended' || true
    sleep 5
    waited=$((waited + 5))
  done
}

show_status() {
  echo
  echo "[INFO] rclone binary: $(command -v rclone)"
  rclone version | sed -n '1,4p'
  echo "[INFO] config file: $(rclone config file | tail -n 1)"
  echo "[INFO] remotes:"
  rclone listremotes || true
}

if command -v rclone >/dev/null 2>&1; then
  echo "[OK] rclone already installed"
  show_status
  exit 0
fi

if [[ "${EUID}" -ne 0 ]]; then
  echo "[FAIL] run as root"
  exit 1
fi

if ! command -v apt-get >/dev/null 2>&1; then
  echo "[FAIL] apt-get not found; install rclone manually"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
wait_for_apt 600

echo "[STEP] apt-get update"
apt-get update -y

echo "[STEP] apt-get install rclone"
apt-get install -y rclone

echo "[DONE] rclone installed"
show_status
echo
echo "[NEXT] if your Google Drive auth was completed on another machine,"
echo "       copy that machine's rclone.conf to:"
echo "       /root/.config/rclone/rclone.conf"
