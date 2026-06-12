#!/usr/bin/env python3
import os
import sys
import stat
import posixpath
from pathlib import Path

import paramiko

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass


HOST = os.environ.get("QF_DEPLOY_HOST", "103.236.92.10")
PORT = int(os.environ.get("QF_DEPLOY_PORT", "22"))
USER = os.environ.get("QF_DEPLOY_USER", "root")
PASSWORD = os.environ.get("QF_DEPLOY_PASSWORD", "")
REMOTE_ROOT = os.environ.get("QF_REMOTE_ROOT", "/www/wwwroot/qianfu-app")

LOCAL_ROOT = Path(__file__).resolve().parents[2]

FILES = [
    (
        LOCAL_ROOT / "dist-server/server/controllers/authCodeController.js",
        posixpath.join(REMOTE_ROOT, "dist-server/server/controllers/authCodeController.js"),
    ),
    (
        LOCAL_ROOT / "dist-server/server/controllers/authCodeController.js.map",
        posixpath.join(REMOTE_ROOT, "dist-server/server/controllers/authCodeController.js.map"),
    ),
    (
        LOCAL_ROOT / "dist-server/server/controllers/registerController.js",
        posixpath.join(REMOTE_ROOT, "dist-server/server/controllers/registerController.js"),
    ),
    (
        LOCAL_ROOT / "dist-server/server/controllers/registerController.js.map",
        posixpath.join(REMOTE_ROOT, "dist-server/server/controllers/registerController.js.map"),
    ),
    (
        LOCAL_ROOT / "dist-server/server/controllers/userController.js",
        posixpath.join(REMOTE_ROOT, "dist-server/server/controllers/userController.js"),
    ),
    (
        LOCAL_ROOT / "dist-server/server/controllers/userController.js.map",
        posixpath.join(REMOTE_ROOT, "dist-server/server/controllers/userController.js.map"),
    ),
    (
        LOCAL_ROOT / "dist-server/server/controllers/userLevelController.js",
        posixpath.join(REMOTE_ROOT, "dist-server/server/controllers/userLevelController.js"),
    ),
    (
        LOCAL_ROOT / "dist-server/server/controllers/userLevelController.js.map",
        posixpath.join(REMOTE_ROOT, "dist-server/server/controllers/userLevelController.js.map"),
    ),
    (
        LOCAL_ROOT / "dist-server/server/utils/sanitizer.js",
        posixpath.join(REMOTE_ROOT, "dist-server/server/utils/sanitizer.js"),
    ),
    (
        LOCAL_ROOT / "dist-server/server/utils/sanitizer.js.map",
        posixpath.join(REMOTE_ROOT, "dist-server/server/utils/sanitizer.js.map"),
    ),
]

DIRS = [
    (
        LOCAL_ROOT / "qianfu-liandeng/dist",
        posixpath.join(REMOTE_ROOT, "qianfu-liandeng/dist"),
    ),
]


def ensure_remote_dir(sftp: paramiko.SFTPClient, remote_path: str) -> None:
    directory = posixpath.dirname(remote_path)
    parts = []
    while directory and directory != "/":
        parts.append(directory)
        directory = posixpath.dirname(directory)
    for item in reversed(parts):
        try:
            sftp.stat(item)
        except OSError:
            sftp.mkdir(item)


def upload_files(sftp: paramiko.SFTPClient) -> None:
    for local_path, remote_path in FILES:
        if not local_path.exists():
            raise FileNotFoundError(f"Missing local file: {local_path}")
        ensure_remote_dir(sftp, remote_path)
        sftp.put(str(local_path), remote_path)
        print(f"[upload] {local_path} -> {remote_path}")


def upload_dirs(sftp: paramiko.SFTPClient) -> None:
    for local_dir, remote_dir in DIRS:
        if not local_dir.is_dir():
            raise FileNotFoundError(f"Missing local directory: {local_dir}")
        for local_path in local_dir.rglob("*"):
            if not local_path.is_file():
                continue
            rel = local_path.relative_to(local_dir).as_posix()
            remote_path = posixpath.join(remote_dir, rel)
            ensure_remote_dir(sftp, remote_path)
            sftp.put(str(local_path), remote_path)
            print(f"[upload] {local_path} -> {remote_path}")


def restart_pm2(ssh: paramiko.SSHClient) -> None:
    command = (
        f"cd {REMOTE_ROOT} && "
        "pm2 restart qianfu-api && "
        "pm2 status qianfu-api --no-color | head -n 20"
    )
    stdin, stdout, stderr = ssh.exec_command(command, timeout=60)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    print(out)
    if err.strip():
        print("[pm2 stderr]")
        print(err)
    if code != 0:
        raise RuntimeError(f"PM2 restart failed with code {code}")


def main() -> None:
    if not PASSWORD:
        raise RuntimeError("QF_DEPLOY_PASSWORD is required")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(
        hostname=HOST,
        port=PORT,
        username=USER,
        password=PASSWORD,
        timeout=15,
        banner_timeout=20,
        auth_timeout=20,
    )
    try:
        sftp = ssh.open_sftp()
        try:
            upload_files(sftp)
            upload_dirs(sftp)
        finally:
            sftp.close()
        restart_pm2(ssh)
        print("[done] hotfix deployed")
    finally:
        ssh.close()


if __name__ == "__main__":
    main()
