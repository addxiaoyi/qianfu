import json
import paramiko
import sys
import time

HOST = "103.236.92.10"
USER = "root"
PASSWORD = "olutBYFB2271"

REMOTE_PY = r"""
import json
import pathlib
import subprocess

def run(cmd, timeout=120):
    p = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout)
    return p.stdout

rows = []
ps = run("pgrep -f 'node dist-server/server/index.js' || true", timeout=120)
for line in ps.splitlines():
    pid = line.strip()
    if not pid:
        continue
    cwd = subprocess.run(f"readlink -f /proc/{pid}/cwd", shell=True, capture_output=True, text=True, timeout=30).stdout.strip()
    cmdline = pathlib.Path(f"/proc/{pid}/cmdline").read_bytes().replace(b"\0", b" ").decode("utf-8", "replace").strip()
    rows.append({"pid": pid, "cwd": cwd, "cmdline": cmdline})

print(json.dumps(rows, ensure_ascii=False))
"""

def connect_with_retry():
    last_error = None
    for attempt in range(3):
        try:
            client = paramiko.SSHClient()
            client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            client.connect(HOST, username=USER, password=PASSWORD, timeout=30, banner_timeout=60, auth_timeout=30)
            return client
        except Exception as exc:
            last_error = exc
            time.sleep(3 * (attempt + 1))
    raise last_error

def run():
    client = connect_with_retry()
    cmd = "python3 - <<'PY'\n" + REMOTE_PY + "\nPY"
    stdin, stdout, stderr = client.exec_command(cmd, timeout=300)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    exit_code = stdout.channel.recv_exit_status()
    client.close()
    payload = json.dumps({"exit_code": exit_code, "stdout": out, "stderr": err}, ensure_ascii=False, indent=2)
    sys.stdout.buffer.write(payload.encode("utf-8", errors="replace"))

if __name__ == "__main__":
    run()
