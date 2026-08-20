import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface SecurityCheck {
  code: string;
  description: string;
  filePath: string;
  ok: boolean;
}

export interface SecurityCheckReport {
  checks: SecurityCheck[];
  passed: number;
  total: number;
  ok: boolean;
}

interface SourceFile {
  filePath: string;
  content: string | null;
  error: string | null;
}

type LogLine = (line: string) => void;

function readSource(projectRoot: string, relativePath: string): SourceFile {
  const filePath = path.resolve(projectRoot, relativePath);

  try {
    return { filePath, content: fs.readFileSync(filePath, 'utf8'), error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown read error';
    return { filePath, content: null, error: message };
  }
}

function checkSource(
  source: SourceFile,
  code: string,
  description: string,
  pattern: RegExp,
): SecurityCheck {
  return {
    code,
    description,
    filePath: source.filePath,
    ok: source.content !== null && pattern.test(source.content),
  };
}

function logCheck(check: SecurityCheck, source: SourceFile, log: LogLine) {
  const status = check.ok ? 'PASS' : 'FAIL';
  const suffix = source.error ? `: ${source.error}` : '';
  log(`[${status}] ${check.description}: ${check.filePath}${suffix}`);
}

export function runSecurityChecks(
  projectRoot = process.cwd(),
  log: LogLine = console.log,
): SecurityCheckReport {
  const robots = readSource(projectRoot, 'qianfu-liandeng/public/robots.txt');
  const viteConfig = readSource(projectRoot, 'qianfu-liandeng/vite.config.ts');
  const app = readSource(projectRoot, 'server/app.ts');
  const middleware = readSource(projectRoot, 'server/bootstrap/middlewareLayers.ts');
  const security = readSource(projectRoot, 'server/bootstrap/security.ts');

  const checks = [
    checkSource(robots, 'robots.api', 'robots.txt blocks API crawling', /^Disallow:\s*\/api\/\s*$/m),
    checkSource(robots, 'robots.admin', 'robots.txt blocks admin crawling', /^Disallow:\s*\/admin\/\s*$/m),
    checkSource(
      robots,
      'robots.privateUploads',
      'robots.txt blocks private uploads crawling',
      /^Disallow:\s*\/uploads\/private\/\s*$/m,
    ),
    checkSource(robots, 'robots.public', 'robots.txt keeps public pages crawlable', /^Allow:\s*\/\s*$/m),
    checkSource(viteConfig, 'vite.dropConsole', 'production build removes console output', /drop_console\s*:\s*true/),
    checkSource(viteConfig, 'vite.dropDebugger', 'production build removes debugger statements', /drop_debugger\s*:\s*true/),
    checkSource(
      app,
      'app.middlewareLayers',
      'application initializes middleware layers',
      /initializeMiddlewareLayers\s*\(\s*app\s*\)/,
    ),
    checkSource(
      middleware,
      'middleware.securityHeaders',
      'middleware layer registers security headers',
      /registerSecurityHeaders\s*\(\s*app\s*\)/,
    ),
    checkSource(
      middleware,
      'middleware.antiCrawler',
      'middleware layer registers anti-crawler protection',
      /app\.use\s*\(\s*antiCrawler\s*\)/,
    ),
    checkSource(security, 'security.helmet', 'security module registers Helmet', /helmet\s*\(/),
    checkSource(security, 'security.csp', 'security module configures CSP', /contentSecurityPolicy\s*:/),
    checkSource(
      security,
      'security.frameDeny',
      'security module denies frame embedding',
      /xFrameOptions\s*:\s*\{\s*action\s*:\s*['"]deny['"]\s*\}/,
    ),
  ];

  for (const check of checks) {
    const source = [robots, viteConfig, app, middleware, security].find((item) => item.filePath === check.filePath);
    if (!source) {
      throw new Error(`Security check source not found for ${check.code}`);
    }
    logCheck(check, source, log);
  }

  const passed = checks.filter((check) => check.ok).length;
  const report = { checks, passed, total: checks.length, ok: passed === checks.length };
  log(`Security Check Complete: ${report.passed}/${report.total} passed.`);
  return report;
}

export function securityCheckExitCode(report: SecurityCheckReport): 0 | 1 {
  return report.ok ? 0 : 1;
}

function main() {
  try {
    process.exitCode = securityCheckExitCode(runSecurityChecks());
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown security check error';
    console.error(`Security check failed to run: ${message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
