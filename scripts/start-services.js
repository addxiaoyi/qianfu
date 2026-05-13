#!/usr/bin/env node
/**
 * 服务启动脚本 - 无容器版本
 * 用法: node scripts/start-services.js [mode]
 *   mode: 'monolith' (默认) - 启动单体应用
 *         'microservices' - 启动微服务集群
 *         'single <service>' - 启动单个服务
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');

// 服务配置
const SERVICES = {
  monolith: {
    name: 'qianfu-monolith',
    script: 'dist-server/index.js',
    port: process.env.PORT || 3050,
    env: { NODE_ENV: 'development' }
  },
  'event-bus': {
    name: 'qianfu-event-bus',
    script: 'services/event-bus/dist/index.js',
    port: 3060,
    env: { NODE_ENV: 'development' }
  },
  'user-service': {
    name: 'qianfu-user-service',
    script: 'services/user-service/dist/index.js',
    port: 3070,
    env: { NODE_ENV: 'development' }
  }
};

const running = new Map();

function log(service, msg, color = '\x1b[0m') {
  const time = new Date().toLocaleTimeString('zh-CN');
  console.log(`\x1b[90m[${time}]\x1b[0m ${color}[${service}]\x1b[0m ${msg}`);
}

function startService(name, config) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, ...config.env, PORT: config.port };
    const child = spawn('node', [config.script], {
      cwd: ROOT,
      env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    child.stdout.on('data', (data) => {
      process.stdout.write(`\x1b[36m[${name}]\x1b[0m ${data}`);
    });

    child.stderr.on('data', (data) => {
      process.stderr.write(`\x1b[31m[${name}]\x1b[0m ${data}`);
    });

    child.on('spawn', () => {
      log(name, `Started on port ${config.port}`, '\x1b[32m');
      running.set(name, child);
      resolve();
    });

    child.on('error', (err) => {
      log(name, `Failed: ${err.message}`, '\x1b[31m');
      reject(err);
    });

    child.on('exit', (code) => {
      log(name, `Exited with code ${code}`, '\x1b[33m');
      running.delete(name);
    });
  });
}

function stopAll() {
  log('manager', 'Stopping all services...', '\x1b[33m');
  for (const [name, child] of running) {
    log(name, 'Sending SIGTERM...', '\x1b[90m');
    child.kill('SIGTERM');
  }
  running.clear();
}

// 主逻辑
const mode = process.argv[2] || 'monolith';

process.on('SIGINT', () => {
  log('manager', 'Received SIGINT, shutting down...', '\x1b[33m');
  stopAll();
  process.exit(0);
});

process.on('SIGTERM', () => {
  stopAll();
  process.exit(0);
});

async function main() {
  console.log('\x1b[36m╔══════════════════════════════════════╗\x1b[0m');
  console.log('\x1b[36m║     千服服务管理器 (无容器版)         ║\x1b[0m');
  console.log('\x1b[36m╚══════════════════════════════════════╝\x1b[0m\n');

  if (mode === 'monolith') {
    log('manager', 'Starting in MONOLITH mode...', '\x1b[36m');
    await startService('monolith', SERVICES.monolith);
  } else if (mode === 'microservices') {
    log('manager', 'Starting in MICROSERVICES mode...', '\x1b[36m');
    // 按依赖顺序启动
    await startService('event-bus', SERVICES['event-bus']);
    await startService('user-service', SERVICES['user-service']);
  } else if (mode === 'single') {
    const serviceName = process.argv[3];
    if (!SERVICES[serviceName]) {
      console.error(`Unknown service: ${serviceName}`);
      console.log('Available services:', Object.keys(SERVICES).join(', '));
      process.exit(1);
    }
    await startService(serviceName, SERVICES[serviceName]);
  } else {
    console.error(`Unknown mode: ${mode}`);
    console.log('Usage: node scripts/start-services.js [monolith|microservices|single <service>]');
    process.exit(1);
  }

  log('manager', 'All services started. Press Ctrl+C to stop.', '\x1b[32m');
}

main().catch(console.error);
