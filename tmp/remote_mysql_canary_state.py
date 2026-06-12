import json
import paramiko
import sys
import time

HOST = "103.236.92.10"
USER = "root"
PASSWORD = "olutBYFB2271"

REMOTE_PY = r"""
import json, subprocess

def run(cmd, timeout=180):
    p = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout)
    return {"command": cmd, "exit": p.returncode, "stdout": p.stdout[-30000:], "stderr": p.stderr[-12000:]}

report = {
    "ps": run("ps -eo pid,etime,pcpu,pmem,args | grep 'node dist-server/server/index.js' | grep -v grep || true"),
    "ports": run("ss -ltnp | grep 3012 || true"),
    "log": run("tail -n 400 /tmp/qianfu-mysql-canary2.log 2>&1 || true"),
    "health": run("curl -i -sS http://127.0.0.1:3012/api/health || true"),
}
print(json.dumps(report, ensure_ascii=False))
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
    stdin, stdout, stderr = client.exec_command(cmd, timeout=600)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    exit_code = stdout.channel.recv_exit_status()
    client.close()
    payload = json.dumps({"exit_code": exit_code, "stdout": out, "stderr": err}, ensure_ascii=False, indent=2)
    sys.stdout.buffer.write(payload.encode("utf-8", errors="replace"))

if __name__ == "__main__":
    run()
