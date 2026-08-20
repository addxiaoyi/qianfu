import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (...parts: string[]) => fs.readFileSync(path.join(root, ...parts), 'utf8');

describe('quality and release audit contract', () => {
  it('stamps and re-manifests the Service Worker during production builds', () => {
    const packageJson = JSON.parse(read('package.json'));
    const build = packageJson.scripts.build as string;

    expect(packageJson.scripts['frontend:sw:stamp']).toBe('node scripts/stamp-service-worker-build.mjs');
    expect(packageJson.scripts['frontend:sw:check']).toBe('node scripts/stamp-service-worker-build.mjs --check');
    expect(build).toContain('npm run frontend:manifest && npm run frontend:sw:stamp');
    expect(build).toContain('npm run frontend:sw:stamp && npm run frontend:manifest');
    expect(build).toContain('npm run frontend:manifest && npm run frontend:sw:check');
  });

  it('exposes one quality command covering static, functional, source and API guards', () => {
    const packageJson = JSON.parse(read('package.json'));
    const quality = packageJson.scripts['test:quality'] as string;
    for (const command of [
      'audit:frontend:controls',
      'audit:frontend:images',
      'audit:frontend:interactions',
      'audit:frontend:routes',
      'audit:frontend:query-errors',
      'audit:frontend:async-errors',
      'audit:functions',
      'audit:source-trackability',
      'guard:structure',
      'guard:api-contract',
      'guard:openapi-sync',
      'guard:style-tokens',
    ]) {
      expect(quality).toContain(`npm run ${command}`);
    }
  });

  it('keeps source and function audits machine-readable', () => {
    const sourceAudit = read('scripts', 'audit-source-trackability.cjs');
    const functionAudit = read('scripts', 'audit-function-coverage.cjs');

    expect(sourceAudit).toContain('SOURCE_TRACKABILITY_REPORT=');
    expect(sourceAudit).toContain('SOURCE_TRACKABILITY_FINDINGS=');
    expect(sourceAudit).toContain('service_worker_sri_mismatch');
    expect(functionAudit).toContain('FUNCTION_COVERAGE_REPORT=');
    expect(functionAudit).toContain('FUNCTION_UNCOVERED_STATIC=');
    expect(functionAudit).toContain('frontendApiCalls');
    expect(functionAudit).toContain('backendRouteDefinitions');
  });

  it('includes the full UI audit route declarations in function coverage evidence', () => {
    const reportDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qianfu-function-audit-'));
    const reportPath = path.join(reportDir, 'report.json');

    try {
      execFileSync(process.execPath, ['scripts/audit-function-coverage.cjs', '--report', reportPath], {
        cwd: root,
        stdio: 'ignore',
      });

      const report = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as {
        frontendRoutes: Array<{
          variant: string;
          path: string;
          browserCovered: boolean;
          coverageSources?: string[];
        }>;
      };
      const desktopNews = report.frontendRoutes.find(
        (route) => route.variant === 'desktop' && route.path === '/news',
      );

      expect(desktopNews?.browserCovered).toBe(true);
      expect(desktopNews?.coverageSources).toContain('ui-full-audit');
    } finally {
      fs.rmSync(reportDir, { recursive: true, force: true });
    }
  });
});
