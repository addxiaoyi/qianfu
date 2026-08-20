#!/usr/bin/env bash
set -Eeuo pipefail

config="/etc/ssh/sshd_config"
backup="/etc/ssh/sshd_config.backup-$(date +%Y%m%d-%H%M%S)"
cp -a "$config" "$backup"

rollback() {
  cp -a "$backup" "$config"
  sshd -t
  systemctl reload sshd
}
trap 'rollback' ERR

set_directive() {
  local key="$1"
  local value="$2"
  if grep -Eiq "^[[:space:]#]*${key}[[:space:]]+" "$config"; then
    sed -ri "s|^[[:space:]#]*${key}[[:space:]]+.*|${key} ${value}|I" "$config"
  else
    printf '\n%s %s\n' "$key" "$value" >> "$config"
  fi
}

set_directive PermitRootLogin prohibit-password
set_directive PasswordAuthentication no
set_directive KbdInteractiveAuthentication no
set_directive ChallengeResponseAuthentication no
set_directive PubkeyAuthentication yes
set_directive MaxAuthTries 3

sshd -t
systemctl reload sshd

effective="$(sshd -T)"
grep -qx 'permitrootlogin without-password' <<<"$effective" || grep -qx 'permitrootlogin prohibit-password' <<<"$effective"
grep -qx 'passwordauthentication no' <<<"$effective"
grep -qx 'kbdinteractiveauthentication no' <<<"$effective"
grep -qx 'pubkeyauthentication yes' <<<"$effective"

trap - ERR
echo "ssh-hardening=ok backup=$backup"
