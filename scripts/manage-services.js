import { spawn } from 'child_process';
import http from 'http';
import net from 'net';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const BACKEND_PORT = 3000;
const FRONTEND_PORT = 4123;
const CMS_PORT = 3030;
const HEALTH_CHECK_URL = `http://localhost:${BACKEND_PORT}/api/health`;
const CMS_DIR = path.resolve(ROOT, 'supabase-1.26.01/apps/cms');

let backendProcess = null;
let frontendProcess = null;
let cmsProcess = null;
let failureCount = 0;

function log(msg) {
  console.log(`[Manager] ${new Date().toLocaleTimeString()} - ${msg}`);
}

async function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(true);
      } else {
        resolve(false);
      }
    });
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    server.listen(port);
  });
}

function startBackend() {
  log('Starting Backend...');
  backendProcess = spawn('npm', ['run', 'server'], {
    cwd: ROOT,
    shell: true,
    stdio: 'inherit'
  });

  backendProcess.on('exit', (code) => {
    log(`Backend exited with code ${code}`);
    backendProcess = null;
  });
}

function startFrontend() {
  log('Starting Frontend...');
  frontendProcess = spawn('npm', ['run', 'dev'], {
    cwd: ROOT,
    shell: true,
    stdio: 'inherit'
  });

  frontendProcess.on('exit', (code) => {
    log(`Frontend exited with code ${code}`);
    frontendProcess = null;
  });
}

function startCMS() {
  log('Starting Payload CMS...');
  
  // Find pnpm's bin directory which usually contains the 'next' command
  const pnpmBin = path.resolve(ROOT, 'supabase-1.26.01/node_modules/.pnpm/node_modules/.bin');
  
  // Set environment variables directly to avoid dependency on cross-env
  const env = { 
    ...process.env, 
    NODE_OPTIONS: '--no-deprecation',
    PORT: '3030',
    PATH: `${pnpmBin};${process.env.PATH}`
  };
  
  // Use pnpm for Payload CMS as it is part of a pnpm workspace
  cmsProcess = spawn('pnpm', ['run', 'dev', '--port', '3030'], {
    cwd: CMS_DIR,
    shell: true,
    stdio: 'inherit',
    env
  });

  cmsProcess.on('exit', (code) => {
    log(`Payload CMS exited with code ${code}`);
    cmsProcess = null;
  });
}

async function checkHealth() {
  return new Promise((resolve) => {
    const req = http.get(HEALTH_CHECK_URL, (res) => {
      if (res.statusCode === 200) {
        resolve(true);
      } else {
        resolve(false);
      }
      res.resume();
    }).on('error', () => {
      resolve(false);
    });
    req.setTimeout(5000);
  });
}

async function main() {
  log('Initializing service manager...');

  // 1. Check Backend
  const backendRunning = await isPortInUse(BACKEND_PORT);
  if (backendRunning) {
    log('Backend is already running.');
  } else {
    startBackend();
  }

  // 2. Check Frontend
  const frontendRunning = await isPortInUse(FRONTEND_PORT);
  if (frontendRunning) {
    log('Frontend is already running.');
  } else {
    startFrontend();
  }

  // 3. Check Payload CMS
  const cmsRunning = await isPortInUse(CMS_PORT);
  if (cmsRunning) {
    log('Payload CMS is already running.');
  } else {
    startCMS();
  }

  // 4. Health Monitor Loop
  setInterval(async () => {
    const ok = await checkHealth();
    if (ok) {
      failureCount = 0;
    } else {
      failureCount++;
      log(`Health check failed (${failureCount}/3)`);
      
      if (failureCount >= 3) {
        log('Backend unresponsive. Restarting...');
        if (backendProcess) {
          spawn('taskkill', ['/F', '/T', '/PID', backendProcess.pid], { shell: true });
        }
        startBackend();
        failureCount = 0;
      }
    }

    // Ensure frontend is still up
    const fUp = await isPortInUse(FRONTEND_PORT);
    if (!fUp) {
      log('Frontend died. Restarting...');
      startFrontend();
    }

    // Ensure CMS is still up
    const cUp = await isPortInUse(CMS_PORT);
    if (!cUp) {
      log('Payload CMS died. Restarting...');
      startCMS();
    }
  }, 30000);
}

main().catch(err => {
  console.error('Manager failed:', err);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  log('Shutting down...');
  if (backendProcess) backendProcess.kill();
  if (frontendProcess) frontendProcess.kill();
  if (cmsProcess) cmsProcess.kill();
  process.exit();
});
