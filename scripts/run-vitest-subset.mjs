#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';

const argv = process.argv.slice(2);
const sep = argv.indexOf('--');
const optionArgs = sep >= 0 ? argv.slice(0, sep) : [];
const fileArgs = sep >= 0 ? argv.slice(sep + 1) : [];

const labelIndex = optionArgs.indexOf('--label');
const label = labelIndex >= 0 && optionArgs[labelIndex + 1] ? optionArgs[labelIndex + 1] : 'subset';
const withCoverage = optionArgs.includes('--coverage');
const allowMissing = optionArgs.includes('--allow-missing');
const allowEmpty = optionArgs.includes('--allow-empty');

const existingFiles = fileArgs.filter((file) => existsSync(file));
const missingFiles = fileArgs.filter((file) => !existsSync(file));

if (missingFiles.length > 0) {
  const level = allowMissing ? 'warn' : 'error';
  console[level](`[vitest:${label}] missing files (${missingFiles.length}):`);
  for (const file of missingFiles) {
    console[level](`- ${file}`);
  }
  if (!allowMissing) {
    console.error(`[vitest:${label}] refusing to continue with missing test files. Pass --allow-missing only for intentional partial runs.`);
    process.exit(1);
  }
}

if (existingFiles.length === 0) {
  const message = `[vitest:${label}] no existing test files.`;
  if (allowEmpty) {
    console.warn(`${message} Skipping because --allow-empty was provided.`);
    process.exit(0);
  }
  console.error(`${message} Refusing to pass an empty test subset.`);
  process.exit(1);
}

const args = ['node_modules/vitest/vitest.mjs', 'run'];
if (withCoverage) args.push('--coverage');
args.push(...existingFiles);

const child = spawn(process.execPath, args, {
  stdio: 'inherit',
  env: process.env,
  windowsHide: true,
});

child.on('exit', (code) => {
  process.exit(code ?? 1);
});

child.on('error', (error) => {
  console.error(`[vitest:${label}] failed to run vitest:`, error);
  process.exit(1);
});
