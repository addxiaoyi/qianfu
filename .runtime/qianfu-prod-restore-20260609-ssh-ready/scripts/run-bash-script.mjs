#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const scriptArg = process.argv[2];
const forwardedArgs = process.argv.slice(3);

if (!scriptArg) {
  console.error('[run-bash-script] Missing script path argument.');
  process.exit(1);
}

const scriptPath = path.resolve(process.cwd(), scriptArg);

if (!existsSync(scriptPath)) {
  console.error(`[run-bash-script] Script not found: ${scriptPath}`);
  process.exit(1);
}

const isWindows = process.platform === 'win32';

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function toGitBashPath(inputPath) {
  const normalized = path.resolve(inputPath).replace(/\\/g, '/');
  const driveMatch = normalized.match(/^([A-Za-z]):\/(.*)$/);
  if (!driveMatch) return normalized;
  const [, drive, rest] = driveMatch;
  return `/${drive.toLowerCase()}/${rest}`;
}

function resolveWindowsBash() {
  const candidates = [
    process.env.GIT_BASH,
    'C:\\Program Files\\Git\\bin\\bash.exe',
    'C:\\Program Files\\Git\\usr\\bin\\bash.exe',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

let child;

if (isWindows) {
  const bashPath = resolveWindowsBash();
  if (!bashPath) {
    console.error(
      '[run-bash-script] Git Bash not found. Set GIT_BASH or install Git for Windows to run this script from npm on Windows.',
    );
    process.exit(1);
  }

  const cwd = toGitBashPath(process.cwd());
  const bashScript = toGitBashPath(scriptPath);
  const quotedArgs = forwardedArgs.map(shellQuote).join(' ');
  const command = `cd ${shellQuote(cwd)} && bash ${shellQuote(bashScript)}${quotedArgs ? ` ${quotedArgs}` : ''}`;

  child = spawn(bashPath, ['-lc', command], {
    stdio: 'inherit',
    windowsHide: true,
  });
} else {
  child = spawn('bash', [scriptPath, ...forwardedArgs], {
    stdio: 'inherit',
  });
}

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

child.on('error', (error) => {
  console.error('[run-bash-script] Failed to start bash script:', error);
  process.exit(1);
});
