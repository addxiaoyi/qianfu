#!/usr/bin/env node
import { spawn, execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

const FRONTEND_PORT = 4123;
const BACKEND_PORT = 3000;
const MOTIA_PORT = 3005;
const PROBE_PORT = 3452;

const services = new Map<string, { process: any; name: string; command: string; args: string[] }>();

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function log(message: string, type: 'info' | 'success' | 'error' | 'warn' = 'info'): void {
  const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
  const prefix = {
    info: '[INFO]',
    success: '[OK]',
    error: '[ERR]',
    warn: '[WARN]'
  }[type] || '[INFO]';
  console.log(`[${timestamp}] ${prefix} ${message}`);
}

function isPortInUse(port: number): boolean {
  try {
    execSync(`netstat -ano | findstr :${port}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

async function killProcessOnPort(port: number): Promise<void> {
  try {
    const isWindows = process.platform === 'win32';
    const output = execSync(isWindows ? `netstat -ano | findstr :${port}` : `lsof -i :${port} -t`, { encoding: 'utf-8', stdio: 'pipe' });
    
    if (isWindows) {
      const lines = output.trim().split('\n');
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 5) {
          const pid = parts[4];
          if (pid && pid !== '0') {
            try {
              execSync(`taskkill /PID ${pid} /F /T`, { stdio: 'ignore' });
              log(`Terminated process on port ${port} (PID: ${pid})`, 'warn');
            } catch (e) {
              // Ignore if already dead
            }
          }
        }
      }
    } else {
      // Unix/Linux implementation
      const pids = output.trim().split('\n');
      for (const pid of pids) {
        if (pid) {
          try {
            process.kill(parseInt(pid), 'SIGKILL');
            log(`Terminated process on port ${port} (PID: ${pid})`, 'warn');
          } catch (e) {
      console.error('[AutoFix] Unhandled exception:', e);
    }
        }
      }
    }
    await sleep(500);
  } catch {
    // Port not in use or command failed
  }
}

async function startService(name: string, command: string, args: string[], env: Record<string, string> = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const isWindows = process.platform === 'win32';
    const actualCommand = isWindows ? (command === 'npx' ? 'npx.cmd' : command) : command;
    const serviceEnv = { ...process.env, ...env };
    
    log(`Starting ${name}...`);
    
    const child = spawn(actualCommand, args, {
      cwd: rootDir,
      env: serviceEnv,
      stdio: ['inherit', 'pipe', 'pipe'], // Capture output but allow input
      detached: false,
      shell: isWindows // Enable shell on Windows to avoid EINVAL for .cmd files
    });

    services.set(name, { process: child, name, command, args });

    if (child.stdout) {
      child.stdout.on('data', (data) => {
        const text = data.toString();
        process.stdout.write(`[${name}] ${text}`);
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (data) => {
        process.stderr.write(`[${name} ERROR] ${data.toString()}`);
      });
    }

    child.on('error', (error) => {
      log(`${name} failed to start: ${error.message}`, 'error');
      reject(error);
    });

    child.on('exit', (code, _signal) => {
      if (code !== 0 && code !== null) {
        log(`${name} exited with code: ${code}`, 'warn');
      }
    });

    setTimeout(() => {
      resolve(child);
    }, 1000);
  });
}

async function waitForService(name: string, checkFn: () => Promise<boolean> | boolean, maxAttempts: number = 30): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    if (await checkFn()) {
      log(`${name} health check passed`, 'success');
      return true;
    }
    await sleep(500);
  }
  log(`${name} health check timeout`, 'error');
  return false;
}

async function checkBackendHealth() {
  try {
    const url = `http://localhost:${BACKEND_PORT}/api/health`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(2000)
    });
    const ok = response.ok;
    if (!ok) log(`Backend health check status: ${response.status}`, 'warn');
    return ok;
  } catch {
    return false;
  }
}

async function checkMotiaHealth() {
  try {
    const url = `http://localhost:${MOTIA_PORT}`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(2000)
    });
    return response.ok;
  } catch (err: any) {
    return false;
  }
}

async function checkProbeHealth() {
  try {
    const url = `http://localhost:${PROBE_PORT}`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(2000)
    });
    return response.ok;
  } catch (err: any) {
    return false;
  }
}

async function checkFrontendHealth() {
  return isPortInUse(FRONTEND_PORT);
}

async function cleanup() {
  log('Stopping all services...', 'warn');
  
  const serviceNames = Array.from(services.keys()).reverse();
  
  for (const name of serviceNames) {
    const service = services.get(name);
    if (service && service.process) {
      try {
        log(`Stopping ${name}...`);
        
        if (process.platform === 'win32' && service.process.pid) {
          try {
            // Use taskkill /T to kill the entire process tree on Windows
            execSync(`taskkill /PID ${service.process.pid} /F /T`, { stdio: 'ignore' });
          } catch (e) {
            // Process might already be dead
          }
        } else {
          service.process.kill('SIGTERM');
          await sleep(500);
          
          try {
            // Check if still alive and force kill
            if (service.process.pid) {
              process.kill(service.process.pid, 0);
              service.process.kill('SIGKILL');
            }
          } catch (e) {
      console.error('[AutoFix] Unhandled exception:', e);
    }
        }
        
        log(`${name} stopped`, 'success');
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log(`Error stopping ${name}: ${errorMessage}`, 'error');
      }
    }
  }
  
  // Final port cleanup to be absolutely sure
  await killProcessOnPort(BACKEND_PORT);
  await killProcessOnPort(MOTIA_PORT);
  await killProcessOnPort(PROBE_PORT);
  await killProcessOnPort(FRONTEND_PORT);
  
  log('All services stopped', 'success');
  process.exit(0);
}

async function main() {
  console.clear();
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║          [Motia] MotiaCraft Integrated Dev Launcher          ║
║                                                               ║
║   Frontend: http://localhost:${FRONTEND_PORT}                    ║
║   Backend: http://localhost:${BACKEND_PORT}                     ║
║   Motia: http://localhost:${MOTIA_PORT}                       ║
║   Probe: http://localhost:${PROBE_PORT}                       ║
╚═══════════════════════════════════════════════════════════════╝
  `);

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('exit', cleanup);

  try {
    log('Checking port usage...');
    
    const ports = [
      { port: BACKEND_PORT, name: 'Backend' },
      { port: MOTIA_PORT, name: 'Motia' },
      { port: PROBE_PORT, name: 'Probe' },
      { port: FRONTEND_PORT, name: 'Frontend' }
    ];

    for (const { port, name } of ports) {
      if (isPortInUse(port)) {
        log(`${name} port ${port} in use, cleaning up...`, 'warn');
        await killProcessOnPort(port);
      }
    }

    log('Generating Prisma client...', 'info');
    try {
      execSync('npx prisma generate', { stdio: 'inherit' });
      log('Prisma client generated', 'success');
    } catch (e) {
      log('Prisma client generation failed', 'error');
    }

    // Start services
    if (process.env.MOTIA_ENABLED !== 'false') {
      log('Starting Motia dev service...', 'info');
      await startService('motia', 'npx', ['tsx', 'motia-dev.ts']);
      await waitForService('Motia', checkMotiaHealth);
    }

    // Backend initialization
    await startService('server', 'npx', ['tsx', 'watch', '--ignore', './uploads', 'server/index.ts']);
    await waitForService('Backend', checkBackendHealth);

    // Probe initialization
    // The probe is started by the backend's server/index.ts (startIntelligentProbeService())
    await waitForService('Probe', checkProbeHealth);

    const vitePort = FRONTEND_PORT;
    log(`Starting frontend on port ${vitePort}...`);
    
    await startService('frontend', 'npx', ['vite', '--port', String(vitePort), '--host', '--strictPort']);
    await waitForService('Frontend', checkFrontendHealth);

    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║  [OK] All services started!                                    ║
║                                                               ║
║  URL: http://localhost:${vitePort}                                 ║
║                                                               ║
║  Press Ctrl+C to stop all services                            ║
╚═══════════════════════════════════════════════════════════════╝
`);

    // Keep the process alive
    await new Promise(() => {});

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Startup failed: ${errorMessage}`, 'error');
    await cleanup();
  }
}

main().catch(async (error: unknown) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  log(`Unhandled error: ${errorMessage}`, 'error');
  await cleanup();
});
