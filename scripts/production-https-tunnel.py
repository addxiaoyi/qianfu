from __future__ import annotations

import os
import select
import socketserver
import sys
from pathlib import Path

import paramiko


def env_int(name: str, default: int) -> int:
    value = os.environ.get(name)
    if not value:
        return default
    try:
        parsed = int(value)
    except ValueError as exc:
        raise RuntimeError(f'{name} must be an integer') from exc
    if not 1 <= parsed <= 65535:
        raise RuntimeError(f'{name} must be between 1 and 65535')
    return parsed


def connect_client(host: str, port: int, user: str, key: Path, *, sock=None) -> paramiko.SSHClient:
    client = paramiko.SSHClient()
    client.load_system_host_keys()
    client.set_missing_host_key_policy(paramiko.RejectPolicy())
    client.connect(
        host,
        port=port,
        username=user,
        key_filename=str(key),
        look_for_keys=False,
        allow_agent=False,
        timeout=20,
        banner_timeout=20,
        auth_timeout=20,
        sock=sock,
    )
    return client


JUMP_HOST = os.environ.get('QIANFU_TUNNEL_JUMP_HOST', '186.241.74.3')
JUMP_PORT = env_int('QIANFU_TUNNEL_JUMP_PORT', 22)
JUMP_USER = os.environ.get('QIANFU_TUNNEL_JUMP_USER', 'root')
JUMP_KEY = Path(os.path.expanduser(os.environ.get('QIANFU_TUNNEL_JUMP_KEY', '~/.ssh/hermes_186_ed25519')))
TARGET_HOST = os.environ.get('QIANFU_TUNNEL_TARGET_HOST', '121.196.161.249')
TARGET_SSH_PORT = env_int('QIANFU_TUNNEL_TARGET_SSH_PORT', 22)
TARGET_USER = os.environ.get('QIANFU_TUNNEL_TARGET_USER', 'root')
TARGET_KEY = Path(os.path.expanduser(os.environ.get('QIANFU_TUNNEL_TARGET_KEY', '~/.ssh/qianfu_aliyun_ed25519')))
TARGET_SERVICE_HOST = os.environ.get('QIANFU_TUNNEL_TARGET_SERVICE_HOST', '127.0.0.1')
TARGET_PORT = env_int('QIANFU_TUNNEL_TARGET_PORT', 443)
LOCAL_HOST = os.environ.get('QIANFU_TUNNEL_LOCAL_HOST', '127.0.0.1')
LOCAL_PORT = env_int('QIANFU_TUNNEL_LOCAL_PORT', 8445)

for label, key in [('jump', JUMP_KEY), ('target', TARGET_KEY)]:
    if not key.is_file():
        raise RuntimeError(f'{label} key not found: {key}')

jump_client = connect_client(JUMP_HOST, JUMP_PORT, JUMP_USER, JUMP_KEY)
jump_transport = jump_client.get_transport()
if jump_transport is None or not jump_transport.is_active():
    jump_client.close()
    raise RuntimeError('jump transport unavailable')
jump_transport.set_keepalive(30)

bridge = jump_transport.open_session(timeout=20)
bridge.exec_command(f'exec nc {TARGET_HOST} {TARGET_SSH_PORT}')
target_client = connect_client(TARGET_HOST, TARGET_SSH_PORT, TARGET_USER, TARGET_KEY, sock=bridge)
target_transport = target_client.get_transport()
if target_transport is None or not target_transport.is_active():
    target_client.close()
    jump_client.close()
    raise RuntimeError('target transport unavailable')
target_transport.set_keepalive(30)


class TunnelHandler(socketserver.BaseRequestHandler):
    def handle(self) -> None:
        try:
            channel = target_transport.open_channel(
                'direct-tcpip',
                (TARGET_SERVICE_HOST, TARGET_PORT),
                self.client_address,
                timeout=20,
            )
        except Exception as exc:
            print(f'tunnel_channel_error={type(exc).__name__}:{exc}', file=sys.stderr, flush=True)
            return

        try:
            while True:
                readable, _, _ = select.select([self.request, channel], [], [], 30)
                if self.request in readable:
                    data = self.request.recv(65536)
                    if not data:
                        break
                    channel.sendall(data)
                if channel in readable:
                    data = channel.recv(65536)
                    if not data:
                        break
                    self.request.sendall(data)
        except (EOFError, OSError):
            # Browsers routinely cancel speculative or keep-alive connections.
            pass
        finally:
            channel.close()


class TunnelServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True
    request_queue_size = 128


server = TunnelServer((LOCAL_HOST, LOCAL_PORT), TunnelHandler)
print(f'tunnel_ready=https://{os.environ.get("QIANFU_TUNNEL_DOMAIN", "mc-u.top")}:{LOCAL_PORT}', flush=True)
try:
    server.serve_forever(poll_interval=0.2)
except KeyboardInterrupt:
    pass
finally:
    server.server_close()
    target_client.close()
    jump_client.close()
