#!/usr/bin/env python3
import argparse
import atexit
import base64
from datetime import datetime, timezone
import hashlib
import hmac
import io
import ipaddress
import json
import os
from pathlib import Path, PurePosixPath
import posixpath
import re
import shutil
import socket
import subprocess
import sys
import tarfile


REPO_ROOT = Path(__file__).resolve().parents[1]
VENDOR = REPO_ROOT / '.runtime' / 'python-ssh'
if VENDOR.exists():
    sys.path.insert(0, str(VENDOR))

import paramiko  # noqa: E402


RELEASE_ID = re.compile(r'^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$')
WEB_ROOT = re.compile(r'^/www/wwwroot/[A-Za-z0-9._-]+$')
_RELEASE_LOCK_HANDLE: io.BufferedRandom | None = None


def fail(message: str) -> None:
    raise SystemExit(message)


def acquire_release_lock() -> None:
    global _RELEASE_LOCK_HANDLE
    lock_path = REPO_ROOT / 'output' / 'prod-launch' / '.deploy-baota.lock'
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    handle = lock_path.open('a+b')
    if handle.tell() == 0:
        handle.write(b'\0')
        handle.flush()
    handle.seek(0)

    try:
        if os.name == 'nt':
            import msvcrt

            msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl

            fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        handle.close()
        fail('Another Baota release is already running in this workspace.')

    _RELEASE_LOCK_HANDLE = handle
    atexit.register(handle.close)


def shell_quote(value: str) -> str:
    return "'" + value.replace("'", "'\"'\"'") + "'"


def resolve_identity_file(value: str) -> str:
    if not value:
        return ''
    identity = Path(value).expanduser().resolve()
    if not identity.is_file():
        fail('SSH identity file does not exist or is not a regular file.')
    return str(identity)


def resolve_auth(identity_file: str) -> tuple[str, str]:
    password = os.environ.get('QF_SSH_PASSWORD', '')
    if not password and not identity_file:
        fail('QF_SSH_PASSWORD or --identity-file is required.')
    return password, identity_file


def validate_bind_address(value: str) -> str:
    if not value:
        return ''
    try:
        ipaddress.ip_address(value)
    except ValueError:
        fail('SSH bind address must be a valid local IP address.')
    return value


def validate_release_id(value: str) -> str:
    if not RELEASE_ID.fullmatch(value):
        fail('Release id must contain only letters, digits, dots, underscores, and dashes.')
    return value


def validate_web_root(value: str, option: str) -> str:
    if not WEB_ROOT.fullmatch(value):
        fail(f'{option} must be a direct child of /www/wwwroot.')
    return value


def normalized_fingerprint(value: str) -> str:
    fingerprint = value.strip()
    if not re.fullmatch(r'SHA256:[A-Za-z0-9+/]+', fingerprint):
        fail('Host key fingerprint must use the SSH SHA256:<base64> format.')
    return fingerprint


def remote_fingerprint(key: paramiko.PKey) -> str:
    digest = hashlib.sha256(key.asbytes()).digest()
    encoded = base64.b64encode(digest).decode('ascii').rstrip('=')
    return f'SHA256:{encoded}'


def require_directory(path: Path) -> None:
    if not path.is_dir():
        fail(f'Required release artifact directory is missing: {path}')
    if path.is_symlink():
        fail(f'Release artifact directory cannot be a symbolic link: {path}')


def add_tree(archive: tarfile.TarFile, source: Path, target: str) -> None:
    require_directory(source)
    archive.add(source, arcname=target, recursive=True)


def release_bundle_path(release_id: str) -> Path:
    output_dir = REPO_ROOT / 'output' / 'prod-launch'
    output_dir.mkdir(parents=True, exist_ok=True)
    return output_dir / f'qianfu-baota-release-{release_id}.tar.gz'


def validate_existing_bundle(release_id: str) -> Path:
    bundle = release_bundle_path(release_id)
    if not bundle.is_file() or bundle.is_symlink():
        fail(f'Reusable release bundle is missing or unsafe: {bundle}')

    required_files = {
        'release.json',
        'payload/dist-server/server/index.js',
        'payload/packages/shared/dist/index.js',
        'payload/qianfu-liandeng/dist/index.html',
        'payload/qianfu-liandeng/dist/qianfu-dist-manifest.json',
        'payload/node_modules/@aws-sdk/s3-request-presigner/package.json',
        'payload/node_modules/optimist/package.json',
        'payload/node_modules/poplib/package.json',
        'payload/prisma/schema.prisma',
        'payload/prisma/schema.postgresql.prisma',
        'scripts/linux/snapshot-baota-release.sh',
        'scripts/linux/publish-baota-release.sh',
        'scripts/linux/optimize-prod-disk.sh',
    }
    try:
        with tarfile.open(bundle, 'r:gz') as archive:
            members = {member.name: member for member in archive.getmembers()}
            for name in members:
                path = PurePosixPath(name)
                if path.is_absolute() or '..' in path.parts:
                    fail(f'Reusable release bundle contains an unsafe path: {name}')
            missing = sorted(required_files - members.keys())
            if missing or any(not members[name].isfile() for name in required_files):
                fail('Reusable release bundle is incomplete.')
            manifest_file = archive.extractfile(members['release.json'])
            if manifest_file is None:
                fail('Reusable release bundle manifest cannot be read.')
            manifest = json.loads(manifest_file.read().decode('utf-8'))
    except (OSError, EOFError, tarfile.TarError, UnicodeDecodeError, json.JSONDecodeError) as error:
        fail(f'Reusable release bundle validation failed: {error}')

    if manifest.get('release') != release_id:
        fail('Reusable release bundle does not match the requested release id.')
    return bundle


def build_bundle(release_id: str) -> Path:
    normalize_esm_imports()
    artifacts = (
        (REPO_ROOT / 'dist-server', 'payload/dist-server'),
        (REPO_ROOT / 'packages' / 'shared' / 'dist', 'payload/packages/shared/dist'),
        (REPO_ROOT / 'qianfu-liandeng' / 'dist', 'payload/qianfu-liandeng/dist'),
        (REPO_ROOT / 'node_modules' / '@aws-sdk' / 's3-request-presigner', 'payload/node_modules/@aws-sdk/s3-request-presigner'),
        (REPO_ROOT / 'node_modules' / 'optimist', 'payload/node_modules/optimist'),
        (REPO_ROOT / 'node_modules' / 'poplib', 'payload/node_modules/poplib'),
        (REPO_ROOT / 'prisma' / 'migrations', 'payload/prisma/migrations'),
    )
    files = (
        (REPO_ROOT / 'prisma' / 'schema.prisma', 'payload/prisma/schema.prisma'),
        (REPO_ROOT / 'prisma' / 'schema.postgresql.prisma', 'payload/prisma/schema.postgresql.prisma'),
        (REPO_ROOT / 'scripts' / 'linux' / 'snapshot-baota-release.sh', 'scripts/linux/snapshot-baota-release.sh'),
        (REPO_ROOT / 'scripts' / 'linux' / 'publish-baota-release.sh', 'scripts/linux/publish-baota-release.sh'),
        (REPO_ROOT / 'scripts' / 'linux' / 'optimize-prod-disk.sh', 'scripts/linux/optimize-prod-disk.sh'),
    )
    bundle = release_bundle_path(release_id)
    pending_bundle = bundle.with_name(f'{bundle.name}.tmp')

    if bundle.exists():
        fail(f'Release bundle already exists: {bundle}')

    pending_bundle.unlink(missing_ok=True)
    try:
        with tarfile.open(pending_bundle, 'w:gz') as archive:
            for source, target in artifacts:
                add_tree(archive, source, target)
            for source, target in files:
                if not source.is_file() or source.is_symlink():
                    fail(f'Required release script is missing: {source}')
                archive.add(source, arcname=target, recursive=False)

            manifest = json.dumps(
                {
                    'release': release_id,
                    'created_at': datetime.now(timezone.utc).isoformat(),
                    'artifacts': [target for _, target in artifacts],
                },
                indent=2,
            ).encode('utf-8')
            metadata = tarfile.TarInfo('release.json')
            metadata.size = len(manifest)
            archive.addfile(metadata, io.BytesIO(manifest))
        pending_bundle.replace(bundle)
    except BaseException:
        pending_bundle.unlink(missing_ok=True)
        raise

    return bundle


def normalize_esm_imports() -> None:
    fixer = REPO_ROOT / 'scripts' / 'fix-esm-import-extensions.mjs'
    if not fixer.is_file():
        fail(f'Required ESM import fixer is missing: {fixer}')

    node = shutil.which('node')
    if node is None:
        fail('node is required to normalize server ESM imports before packaging.')

    for target in (REPO_ROOT / 'packages' / 'shared' / 'dist', REPO_ROOT / 'dist-server'):
        require_directory(target)
        subprocess.run([node, str(fixer), str(target)], check=True)


def mkdir_p(sftp: paramiko.SFTPClient, remote_dir: str) -> None:
    current = ''
    for part in (segment for segment in remote_dir.split('/') if segment):
        current = f'{current}/{part}'
        try:
            sftp.stat(current)
        except FileNotFoundError:
            sftp.mkdir(current)


def write_utf8(value: str, *, error: bool = False) -> None:
    if not value:
        return

    encoded = value.encode('utf-8', errors='replace')
    if error:
        sys.stderr.buffer.write(encoded)
        sys.stderr.buffer.flush()
        return

    sys.stdout.buffer.write(encoded)
    sys.stdout.buffer.flush()


def run_remote(client: paramiko.SSHClient, command: str) -> None:
    stdin, stdout, stderr = client.exec_command(command, get_pty=False)
    stdin.close()
    output = stdout.read().decode('utf-8', errors='replace')
    errors = stderr.read().decode('utf-8', errors='replace')
    status = stdout.channel.recv_exit_status()
    write_utf8(output)
    write_utf8(errors, error=True)
    if status != 0:
        fail(f'Remote command failed with exit status {status}.')


def connect_pinned(
    host: str,
    port: int,
    user: str,
    password: str,
    identity_file: str,
    bind_address: str,
    expected_fingerprint: str,
) -> paramiko.SSHClient:
    sock = socket.create_connection(
        (host, port),
        timeout=15,
        source_address=(bind_address, 0) if bind_address else None,
    )
    transport = paramiko.Transport(sock)
    try:
        transport.start_client(timeout=15)
        actual_fingerprint = remote_fingerprint(transport.get_remote_server_key())
        if not hmac.compare_digest(actual_fingerprint, expected_fingerprint):
            fail(
                'Remote SSH host key does not match the expected fingerprint. '
                f'Observed {actual_fingerprint}.'
            )
        if identity_file:
            private_key = paramiko.PKey.from_path(identity_file)
            transport.auth_publickey(user, private_key)
        else:
            transport.auth_password(user, password, fallback=False)
        if not transport.is_authenticated():
            fail(f'Authentication failed for {user}@{host}:{port}.')
    except BaseException:
        transport.close()
        raise

    client = paramiko.SSHClient()
    client._transport = transport
    return client


def stage_command(args: argparse.Namespace, release_id: str, remote_bundle: str) -> str:
    stage = posixpath.join(args.remote_app_root, '.releases', release_id)
    incoming = posixpath.dirname(remote_bundle)
    return ' '.join(
        (
            'set -euo pipefail;',
            f'test ! -e {shell_quote(stage)};',
            f'mkdir -p {shell_quote(incoming)} {shell_quote(stage)};',
            f'tar -xzf {shell_quote(remote_bundle)} -C {shell_quote(stage)};',
            f'env APP_ROOT={shell_quote(args.remote_app_root)} WEB_ROOT={shell_quote(args.web_root)} '
            f'WEB_DOMAIN={shell_quote(args.web_domain)} '
            f'bash {shell_quote(posixpath.join(stage, "scripts/linux/publish-baota-release.sh"))} '
            f'--release {shell_quote(release_id)} --check-only',
        )
    )


def publish_command(args: argparse.Namespace, release_id: str) -> str:
    stage = posixpath.join(args.remote_app_root, '.releases', release_id)
    return (
        f'env APP_ROOT={shell_quote(args.remote_app_root)} WEB_ROOT={shell_quote(args.web_root)} '
        f'WEB_DOMAIN={shell_quote(args.web_domain)} '
        f'bash {shell_quote(posixpath.join(stage, "scripts/linux/publish-baota-release.sh"))} '
        f'--release {shell_quote(release_id)}'
    )


def cleanup_upload_command(args: argparse.Namespace, remote_bundle: str) -> str:
    incoming = posixpath.join(args.remote_app_root, '.incoming')
    return ' '.join(
        (
            'set -euo pipefail;',
            f'rm -f -- {shell_quote(remote_bundle)};',
            f'find {shell_quote(incoming)} -maxdepth 1 -type f '
            "-name 'qianfu-baota-release-*.tar.gz' -mtime +1 -delete;",
        )
    )


def main() -> int:
    parser = argparse.ArgumentParser(description='Pinned-host atomic Baota release runner.')
    parser.add_argument('--host', required=True)
    parser.add_argument('--host-key-sha256', required=True)
    parser.add_argument('--port', type=int, default=22)
    parser.add_argument('--user', default='root')
    parser.add_argument('--identity-file', default=os.environ.get('QF_SSH_IDENTITY_FILE', ''))
    parser.add_argument('--bind-address', default=os.environ.get('QF_SSH_BIND_ADDRESS', ''))
    parser.add_argument('--reuse-bundle', action='store_true')
    parser.add_argument('--release', default=datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S'))
    parser.add_argument('--remote-app-root', default='/www/wwwroot/qianfu-app')
    parser.add_argument('--web-root', default='/www/wwwroot/mc-u.top')
    parser.add_argument('--web-domain', default='mc-u.top')
    parser.add_argument('--preflight-only', action='store_true')
    parser.add_argument('--publish-staged', action='store_true')
    args = parser.parse_args()

    if args.preflight_only and args.publish_staged:
        fail('--preflight-only and --publish-staged cannot be used together.')

    acquire_release_lock()

    release_id = validate_release_id(args.release)
    args.host_key_sha256 = normalized_fingerprint(args.host_key_sha256)
    args.remote_app_root = validate_web_root(args.remote_app_root, '--remote-app-root')
    args.web_root = validate_web_root(args.web_root, '--web-root')
    args.identity_file = resolve_identity_file(args.identity_file)
    args.bind_address = validate_bind_address(args.bind_address)
    password, identity_file = resolve_auth(args.identity_file)
    remote_bundle = posixpath.join(
        args.remote_app_root,
        '.incoming',
        f'qianfu-baota-release-{release_id}.tar.gz',
    )

    print(f'[stage] target={args.user}@{args.host}:{args.port} release={release_id}')
    if args.publish_staged:
        print('[stage] reusing the previously preflighted remote release.')
    else:
        bundle = validate_existing_bundle(release_id) if args.reuse_bundle else build_bundle(release_id)
        remote_bundle = posixpath.join(args.remote_app_root, '.incoming', bundle.name)
        print(f'[stage] bundle={bundle.name}')

    client = connect_pinned(
        args.host,
        args.port,
        args.user,
        password,
        identity_file,
        args.bind_address,
        args.host_key_sha256,
    )
    try:
        if args.publish_staged:
            run_remote(client, publish_command(args, release_id))
        else:
            sftp = client.open_sftp()
            try:
                mkdir_p(sftp, posixpath.dirname(remote_bundle))
                sftp.put(str(bundle), remote_bundle)
            finally:
                sftp.close()

            run_remote(client, stage_command(args, release_id, remote_bundle))
            if args.preflight_only:
                print('[done] remote release stage passed preflight.')
                return 0

            run_remote(client, publish_command(args, release_id))
        run_remote(client, cleanup_upload_command(args, remote_bundle))
    finally:
        client.close()

    print('[done] atomic release published.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
