import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relativePath: string) =>
  readFileSync(path.join(root, relativePath), 'utf8').replace(/\r\n/g, '\n');

const packageJson = JSON.parse(read('package.json')) as {
  dependencies: Record<string, string | undefined>;
  devDependencies: Record<string, string | undefined>;
  scripts: Record<string, string | undefined>;
};

describe('low audit closure', () => {
  it('locks modern compiler and Express 5 types while keeping route params narrowed', () => {
    expect(packageJson.devDependencies.typescript).toMatch(/^\^5\.9\./);
    expect(packageJson.devDependencies['@types/express']).toMatch(/^\^5\./);
    expect(packageJson.dependencies.express).toMatch(/^\^5\./);

    const routeParams = read('server/utils/requestParams.ts');
    expect(routeParams).toContain('getRouteParam');
    expect(routeParams).toContain('string | string[] | undefined');

    for (const file of [
      'server/controllers/mailConfigController.ts',
      'server/controllers/promoMetricController.ts',
      'server/controllers/promoReadController.ts',
      'server/core/controller/QianFuController.ts',
    ]) {
      expect(read(file)).toContain('getRouteParam');
    }
  });

  it('enforces a zero-warning release lint scope and full coverage observation', () => {
    const lint = packageJson.scripts.lint ?? '';
    expect(lint).toContain('eslint server qianfu-liandeng/src tests');
    expect(lint).toContain('--max-warnings 0');
    expect(lint).not.toContain('--max-warnings 500');
    expect(packageJson.scripts['test:coverage:full']).toContain('COVERAGE_SCOPE=full');

    const eslintConfig = read('.eslintrc.cjs');
    expect(eslintConfig).toContain('Optional modules not mounted by the production router');
    expect(eslintConfig).toContain("'qianfu-liandeng/src/forms/**/*.ts'");
    expect(eslintConfig).toContain("'qianfu-liandeng/src/forms/**/*.tsx'");
  });

  it('keeps CI, Node version pins, and the simplified frontend architecture present', () => {
    expect(existsSync(path.join(root, '.github/workflows/ci.yml'))).toBe(true);
    const ci = read('.github/workflows/ci.yml');
    expect(ci).toContain('npm run validate');
    expect(ci).toContain('npm run build');
    expect(ci).toContain('npm run test:coverage:full');

    const nvmVersion = read('.nvmrc').trim();
    const nodeVersion = read('.node-version').trim();
    expect(nvmVersion).toBe(nodeVersion);
    expect(nvmVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(existsSync(path.join(root, 'qianfu-liandeng/src/infrastructure'))).toBe(false);
  });

  it('uses one editor and one centralized Radix form primitive boundary', () => {
    expect(packageJson.dependencies.tinymce).toBeTruthy();
    expect(packageJson.dependencies.vditor).toBeUndefined();

    const primitives = read('qianfu-liandeng/src/components/ui/formPrimitives.ts');
    expect(primitives).toContain("@radix-ui/react-label");
    expect(primitives).toContain('formPrimitiveTheme');

    const renderer = read('qianfu-liandeng/src/forms/FormRenderer.tsx');
    expect(renderer).toContain("from '@/components/ui/formPrimitives'");
    expect(renderer).toContain('formPrimitiveTheme.label');
    expect(renderer).not.toContain("from '@radix-ui/");
  });

  it('collects Web Vitals through a validated rate-limited Prometheus path', () => {
    expect(packageJson.dependencies['web-vitals']).toBeTruthy();

    const browserMetrics = read('qianfu-liandeng/src/lib/webVitals.ts');
    expect(browserMetrics).toContain("'/api/v1/web-vitals'");
    expect(browserMetrics).toContain('onCLS');
    expect(browserMetrics).toContain('onINP');
    expect(browserMetrics).toContain('onLCP');
    expect(browserMetrics).toContain('navigator.sendBeacon');
    const frontendEntry = read('qianfu-liandeng/src/main.tsx');
    expect(frontendEntry).toContain('scheduleWebVitals()');
    expect(browserMetrics).toContain('requestIdleCallback');
    expect(browserMetrics).toContain('timeout: 5000');

    const statsRoute = read('server/routes/stats.ts');
    expect(statsRoute).toContain("router.post('/web-vitals', serversLimiter");
    expect(statsRoute).toContain('webVitalSchema.safeParse');
    expect(statsRoute).toContain('metricsService.recordWebVital');

    const metrics = read('server/services/metricsService.ts');
    expect(metrics).toContain('qianfu_web_vital_duration_seconds');
    expect(metrics).toContain('qianfu_web_vital_cls_score');
  });

  it('mounts prefetch context and makes link prefetch strategies exclusive', () => {
    const app = read('qianfu-liandeng/src/App.tsx');
    expect(app).toContain('<Router>');
    expect(app).toContain('<PrefetchProvider>');
    expect(app.indexOf('<Router>')).toBeLessThan(app.indexOf('<PrefetchProvider>'));

    const prefetch = read('qianfu-liandeng/src/hooks/useRoutePrefetch.tsx');
    expect(prefetch).toContain('event.preventDefault()');
    expect(prefetch).toContain("prefetch === 'visible'");
    expect(prefetch).toContain("prefetch === 'idle'");
    expect(prefetch).toContain('enabled = true');
    expect(prefetch).toContain("ref={prefetch === 'visible' ? visibleRef : undefined}");
  });
});
