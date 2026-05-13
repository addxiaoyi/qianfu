/**
 * 本机直接跑 Java XPay（Spring Boot），不经过 Docker。
 * 需已安装 JDK 17+，且本机 MySQL / Redis 与 xpay-code/src/main/resources/application.properties 一致。
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const xpayDir = path.join(root, 'xpay-3.1_YTM7H', 'xpay-code');

if (!existsSync(xpayDir)) {
  console.error('[xpay] 未找到目录:', xpayDir);
  process.exit(1);
}

const isWin = process.platform === 'win32';
const mvnwCmd = path.join(xpayDir, 'mvnw.cmd');
const mvnwUnix = path.join(xpayDir, 'mvnw');
const args = ['spring-boot:run'];

let child;
if (isWin && existsSync(mvnwCmd)) {
  child = spawn('mvnw.cmd', args, { cwd: xpayDir, stdio: 'inherit', shell: true });
} else if (!isWin && existsSync(mvnwUnix)) {
  child = spawn('./mvnw', args, { cwd: xpayDir, stdio: 'inherit', shell: false });
} else {
  child = spawn('mvn', args, { cwd: xpayDir, stdio: 'inherit', shell: true });
}

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
