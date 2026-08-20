#!/usr/bin/env python3
import argparse
import base64
import os
import pathlib
import posixpath
import shutil
import subprocess
import sys
import socket


REPO_ROOT = pathlib.Path(__file__).resolve().parents[1]
VENDOR = REPO_ROOT / ".runtime" / "python-ssh"
if VENDOR.exists():
    sys.path.insert(0, str(VENDOR))

import paramiko  # noqa: E402


def bash_quote(value: str) -> str:
    return "'" + value.replace("'", "'\"'\"'") + "'"


def get_password() -> str:
    raw = os.environ.get("QF_SSH_PASSWORD", "")
    if raw:
        return raw
    encoded = os.environ.get("QF_SSH_PASSWORD_B64", "")
    if encoded:
        return base64.b64decode(encoded).decode("utf-8")
    raise SystemExit("QF_SSH_PASSWORD or QF_SSH_PASSWORD_B64 is required.")


def latest_bundle() -> pathlib.Path:
    bundle_dir = REPO_ROOT / "output" / "prod-restore-bundles"
    bundles = sorted(bundle_dir.glob("qianfu-prod-restore-*.tar.gz"), key=lambda p: p.stat().st_mtime, reverse=True)
    if not bundles:
        raise SystemExit(f"No restore bundle found under {bundle_dir}")
    return bundles[0]


def mkdir_p_sftp(sftp: paramiko.SFTPClient, remote_dir: str) -> None:
    parts = [p for p in remote_dir.split("/") if p]
    current = ""
    for part in parts:
        current += "/" + part
        try:
            sftp.stat(current)
        except FileNotFoundError:
            sftp.mkdir(current)


def run_remote(client: paramiko.SSHClient, command: str) -> int:
    print(f"[remote] {command}")
    stdin, stdout, stderr = client.exec_command(command, get_pty=True)
    stdin.close()
    while not stdout.channel.exit_status_ready():
        if stdout.channel.recv_ready():
            sys.stdout.buffer.write(stdout.channel.recv(4096))
            sys.stdout.buffer.flush()
        if stdout.channel.recv_stderr_ready():
            sys.stderr.buffer.write(stdout.channel.recv_stderr(4096))
            sys.stderr.buffer.flush()
    while stdout.channel.recv_ready():
        sys.stdout.buffer.write(stdout.channel.recv(4096))
    while stdout.channel.recv_stderr_ready():
        sys.stderr.buffer.write(stdout.channel.recv_stderr(4096))
    sys.stdout.buffer.flush()
    sys.stderr.buffer.flush()
    return stdout.channel.recv_exit_status()


def build_remote_script(args: argparse.Namespace, remote_bundle: str) -> str:
    scope = []
    if args.web_only:
        scope.append("--web-only")
    if args.pay_only:
        scope.append("--pay-only")
    if args.skip_pm2:
        scope.append("--skip-pm2")

    def repair_cmd(*extra: str) -> str:
        return "bash scripts/linux/prod-terminal-minimal-repair.sh " + " ".join(scope + list(extra))

    commands = [
        "set -euo pipefail",
        f"cd {bash_quote(args.remote_app_root)}",
    ]
    if not args.pay_only:
        remote_dist = posixpath.join(args.remote_app_root, "qianfu-liandeng/dist")
        commands.append(
            f"dist_dir={bash_quote(remote_dist)}; "
            f"case \"$dist_dir\" in {bash_quote(remote_dist)}) rm -rf \"$dist_dir\" ;; "
            "*) echo '[FAIL] refusing to remove unexpected dist path' >&2; exit 1 ;; esac"
        )
    commands.extend(
        [
            f"tar -xzf {bash_quote(remote_bundle)} -C {bash_quote(args.remote_app_root)}",
            "bash scripts/linux/prod-terminal-snapshot.sh",
        ]
    )

    if not args.snapshot_only:
        commands.append(repair_cmd("--preflight-only"))
    if not args.snapshot_only and not args.preflight_only:
        commands.append(repair_cmd("--dry-run", "--no-strict"))
    if not args.snapshot_only and not args.preflight_only and not args.no_repair:
        final_args = []
        if args.no_strict:
            final_args.append("--no-strict")
        commands.append(repair_cmd(*final_args))

    return "; ".join(cmd.strip() for cmd in commands if cmd.strip())


def main() -> int:
    parser = argparse.ArgumentParser(description="Password-based SSH runner for Qianfu production restore.")
    parser.add_argument("--host", default=os.environ.get("QF_SSH_HOST", "121.196.161.249"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("QF_SSH_PORT", "22")))
    parser.add_argument("--user", default=os.environ.get("QF_SSH_USER", "root"))
    parser.add_argument("--bundle", default=os.environ.get("QF_RESTORE_BUNDLE", ""))
    parser.add_argument("--remote-app-root", default=os.environ.get("QF_REMOTE_APP_ROOT", "/www/wwwroot/qianfu-app"))
    parser.add_argument("--remote-bundle-path", default=os.environ.get("QF_REMOTE_BUNDLE_PATH", ""))
    parser.add_argument("--check-only", action="store_true")
    parser.add_argument("--remote-command", default="")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--skip-upload", action="store_true")
    parser.add_argument("--snapshot-only", action="store_true")
    parser.add_argument("--preflight-only", action="store_true")
    parser.add_argument("--skip-pm2", action="store_true")
    parser.add_argument("--web-only", action="store_true")
    parser.add_argument("--pay-only", action="store_true")
    parser.add_argument("--no-repair", action="store_true")
    parser.add_argument("--no-strict", action="store_true")
    parser.add_argument("--no-verify", action="store_true")
    args = parser.parse_args()

    if args.web_only and args.pay_only:
        raise SystemExit("--web-only and --pay-only cannot be used together.")

    bundle = pathlib.Path(args.bundle).resolve() if args.bundle else latest_bundle()
    remote_bundle = args.remote_bundle_path or f"/www/wwwroot/{bundle.name}"

    print(f"[connect] target={args.user}@{args.host}:{args.port} bundle={bundle} remoteBundle={remote_bundle}")
    remote_script = build_remote_script(args, remote_bundle)
    if args.dry_run:
        print(f"[dry] upload {bundle} -> {remote_bundle}")
        print(f"[dry] remote script: {remote_script}")
        return 0

    password = get_password()
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(
            hostname=args.host,
            port=args.port,
            username=args.user,
            password=password,
            timeout=12,
            banner_timeout=12,
            auth_timeout=12,
            look_for_keys=False,
            allow_agent=False,
        )
    except paramiko.AuthenticationException:
        raise SystemExit(f"Authentication failed for {args.user}@{args.host}:{args.port}.")
    except (paramiko.SSHException, socket.error, OSError) as exc:
        raise SystemExit(f"SSH connection failed for {args.user}@{args.host}:{args.port}: {exc}")

    try:
        rc = run_remote(client, "hostname; whoami; pwd; test -d /www/wwwroot/qianfu-app && echo APP_ROOT_OK")
        if rc != 0:
            raise SystemExit(rc)
        if args.check_only:
            print("[done] SSH password check succeeded.")
            return 0
        if args.remote_command:
            return run_remote(client, args.remote_command)

        if not args.skip_upload:
            print(f"[upload] {bundle} -> {remote_bundle}")
            sftp = client.open_sftp()
            try:
                mkdir_p_sftp(sftp, posixpath.dirname(remote_bundle))
                sftp.put(str(bundle), remote_bundle)
            finally:
                sftp.close()
        else:
            print(f"[skip] upload disabled; remote bundle must exist at {remote_bundle}")

        rc = run_remote(client, remote_script)
        if rc != 0:
            raise SystemExit(rc)
    finally:
        client.close()

    if not args.no_verify and not args.snapshot_only and not args.preflight_only and not args.no_repair:
        print("[verify] npm run prod:verify:public:win")
        npm_command = shutil.which("npm") or shutil.which("npm.cmd")
        if not npm_command:
            raise SystemExit("npm command not found; run production verification manually.")
        completed = subprocess.run([npm_command, "run", "prod:verify:public:win"], cwd=REPO_ROOT)
        if completed.returncode != 0:
            raise SystemExit(completed.returncode)

    print("[done] password SSH restore runner finished.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
