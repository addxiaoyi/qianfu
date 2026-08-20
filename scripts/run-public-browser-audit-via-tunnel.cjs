const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const domain = process.env.QIANFU_TUNNEL_DOMAIN || 'mc-u.top';
const localHost = process.env.QIANFU_TUNNEL_LOCAL_HOST || '127.0.0.1';
const localPort = Number(process.env.QIANFU_TUNNEL_LOCAL_PORT || 8445);
const python = process.env.PYTHON || process.env.PYTHON_EXECUTABLE || 'python';
const tunnelScript = path.join(root, 'scripts', 'production-https-tunnel.py');
const auditScript = path.join(root, 'scripts', 'public-live-browser-audit.cjs');
const forwardedArgs = process.argv.slice(2);
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

function hasOption(name) {
  return forwardedArgs.some((value) => value === name || value.startsWith(`${name}=`));
}

function findBrowserExecutable() {
  const configured = process.env.PUBLIC_BROWSER_AUDIT_EXECUTABLE_PATH;
  const candidates = [
    configured,
    process.platform === 'win32' ? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' : '',
    process.platform === 'win32' ? 'C:/Program Files/Microsoft/Edge/Application/msedge.exe' : '',
    process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : '',
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate)) || '';
}

function waitForTunnelReady(child, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const timer = setTimeout(() => reject(new Error('HTTPS tunnel did not become ready')), timeoutMs);
    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      process.stdout.write(text);
      buffer += text;
      if (buffer.includes('tunnel_ready=')) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.stderr.on('data', (chunk) => process.stderr.write(chunk));
    child.once('exit', (code) => {
      clearTimeout(timer);
      if (!buffer.includes('tunnel_ready=')) reject(new Error(`HTTPS tunnel exited before ready (${code})`));
    });
  });
}

function canConnect() {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: localHost, port: localPort });
    const finish = (value) => {
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(400, () => finish(false));
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
  });
}

async function waitForPortClosed(timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!(await canConnect())) return true;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return !(await canConnect());
}

async function stopTunnel(child) {
  if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
  await new Promise((resolve) => setTimeout(resolve, 600));
  if (child.exitCode === null && child.signalCode === null) {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      child.kill('SIGKILL');
    }
  }
  if (!(await waitForPortClosed())) throw new Error(`tunnel port ${localHost}:${localPort} is still open`);
}

async function main() {
  if (!Number.isInteger(localPort) || localPort < 1 || localPort > 65535) {
    throw new Error('QIANFU_TUNNEL_LOCAL_PORT must be a valid port');
  }

  const tunnel = spawn(python, [tunnelScript], {
    cwd: root,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let audit = null;
  const interrupt = () => {
    audit?.kill('SIGINT');
    tunnel.kill('SIGTERM');
  };
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', interrupt);

  try {
    await waitForTunnelReady(tunnel);
    const browserExecutable = findBrowserExecutable();
    const args = [auditScript];
    if (!hasOption('--base')) args.push('--base', `https://${domain}:${localPort}`);
    if (!hasOption('--out-dir')) args.push('--out-dir', path.join('.runtime', `live-public-audit-tunnel-${timestamp}`));
    if (!hasOption('--skip-pay') && !hasOption('--include-pay')) args.push('--skip-pay');
    if (!hasOption('--concurrency')) args.push('--concurrency', '2');
    if (!hasOption('--stable-wait-ms')) args.push('--stable-wait-ms', '500');
    if (!hasOption('--host-resolver-rules')) args.push('--host-resolver-rules', `MAP ${domain} ${localHost}`);
    if (browserExecutable && !hasOption('--executable-path')) args.push('--executable-path', browserExecutable);
    args.push(...forwardedArgs);

    audit = spawn(process.execPath, args, { cwd: root, env: process.env, stdio: 'inherit' });
    const exitCode = await new Promise((resolve) => audit.once('exit', (code) => resolve(code ?? 1)));
    if (exitCode !== 0) process.exitCode = exitCode;
  } finally {
    process.removeListener('SIGINT', interrupt);
    process.removeListener('SIGTERM', interrupt);
    await stopTunnel(tunnel);
    console.log(`tunnel_closed=${localHost}:${localPort}`);
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
