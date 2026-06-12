#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function psSingleQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

const packageJson = process.env.npm_package_json
  ? path.resolve(process.env.npm_package_json)
  : path.resolve('qianfu-liandeng/package.json');
const packageDir = path.dirname(packageJson);
const target = path.join(packageDir, 'dist');

if (path.basename(target) !== 'dist' || path.dirname(target) !== packageDir) {
  throw new Error(`Refuse to clean unexpected path: ${target}`);
}

if (process.platform === 'win32') {
  const command = [
    `$target = ${psSingleQuote(target)}`,
    `$parent = ${psSingleQuote(packageDir)}`,
    `if ((Split-Path -Leaf $target) -ne 'dist' -or (Split-Path -Parent $target) -ne $parent) { throw "Refuse to clean $target" }`,
    `if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Recurse -Force }`,
  ].join('; ');
  execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command], {
    stdio: 'inherit',
  });
} else {
  fs.rmSync(target, { recursive: true, force: true });
}

if (fs.existsSync(target)) {
  throw new Error(`Failed to clean dist directory: ${target}`);
}
