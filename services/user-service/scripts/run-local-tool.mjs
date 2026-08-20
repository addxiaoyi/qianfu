import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serviceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const binDirectory = path.join(serviceRoot, 'node_modules', '.bin');
const [tool, ...args] = process.argv.slice(2);
if (!tool) {
  console.error('user_service_tool=failed reason=missing_tool');
  process.exit(2);
}

function resolveWindowsShimTarget(toolName) {
  const shimPath = path.join(binDirectory, `${toolName}.cmd`);
  const shim = readFileSync(shimPath, 'utf8');
  const match = shim.match(/%dp0%\\\.\.\\([^"\r\n]+)"/i);
  if (!match) {
    throw new Error(`Unable to resolve Windows shim target for ${toolName}`);
  }
  return path.resolve(binDirectory, '..', match[1].replaceAll('\\', path.sep));
}

const isWindows = process.platform === 'win32';
const executable = isWindows ? process.execPath : path.join(binDirectory, tool);
const executableArgs = isWindows ? [resolveWindowsShimTarget(tool), ...args] : args;
const environment = { ...process.env };
environment.DATABASE_URL ||= 'postgresql://qianfu:placeholder@localhost:5432/qianfu_users';
if (tool === 'tsc' && !/--max-old-space-size(?:=|\s)/.test(environment.NODE_OPTIONS || '')) {
  environment.NODE_OPTIONS = `${environment.NODE_OPTIONS || ''} --max-old-space-size=768`.trim();
}

const result = spawnSync(executable, executableArgs, {
  cwd: serviceRoot,
  env: environment,
  stdio: 'inherit',
});
if (result.error) {
  console.error(`user_service_tool=failed tool=${tool} reason=${result.error.message}`);
  process.exit(1);
}
if (result.signal) {
  console.error(`user_service_tool=failed tool=${tool} signal=${result.signal}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
