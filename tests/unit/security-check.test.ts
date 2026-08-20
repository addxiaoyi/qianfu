import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runSecurityChecks, securityCheckExitCode } from '../../scripts/security-check';

const tempRoots: string[] = [];

afterEach(() => {
  for (const tempRoot of tempRoots.splice(0)) {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

function writeFixtureFile(root: string, relativePath: string, content: string) {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function createSecurityFixture(middlewareSource?: string) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qianfu-security-check-'));
  tempRoots.push(root);

  writeFixtureFile(root, 'qianfu-liandeng/public/robots.txt', [
    'User-agent: *',
    'Disallow: /api/',
    'Disallow: /admin/',
    'Disallow: /uploads/private/',
    'Allow: /',
  ].join('\n'));
  writeFixtureFile(root, 'qianfu-liandeng/vite.config.ts', [
    'export default {',
    '  build: {',
    '    terserOptions: {',
    '      compress: { drop_console: true, drop_debugger: true },',
    '    },',
    '  },',
    '};',
  ].join('\n'));
  writeFixtureFile(root, 'server/app.ts', [
    "import { initializeMiddlewareLayers } from './bootstrap/middlewareLayers';",
    'initializeMiddlewareLayers(app);',
  ].join('\n'));
  writeFixtureFile(root, 'server/bootstrap/middlewareLayers.ts', middlewareSource ?? [
    "import { antiCrawler } from '../middleware/antiCrawler';",
    "import { registerSecurityHeaders } from './security';",
    'registerSecurityHeaders(app);',
    'app.use(antiCrawler);',
  ].join('\n'));
  writeFixtureFile(root, 'server/bootstrap/security.ts', [
    "import helmet from 'helmet';",
    'app.use(helmet({',
    '  contentSecurityPolicy: {},',
    "  xFrameOptions: { action: 'deny' },",
    '}));',
  ].join('\n'));

  return root;
}

describe('security check gate', () => {
  it('accepts the active frontend and middleware security wiring', () => {
    const report = runSecurityChecks(createSecurityFixture(), () => undefined);

    expect(report.ok).toBe(true);
    expect(securityCheckExitCode(report)).toBe(0);
  });

  it('fails when the anti-crawler middleware is no longer registered', () => {
    const report = runSecurityChecks(
      createSecurityFixture("import { registerSecurityHeaders } from './security';\nregisterSecurityHeaders(app);"),
      () => undefined,
    );

    expect(report.ok).toBe(false);
    expect(report.checks.find((check) => check.code === 'middleware.antiCrawler')?.ok).toBe(false);
    expect(securityCheckExitCode(report)).toBe(1);
  });
});
